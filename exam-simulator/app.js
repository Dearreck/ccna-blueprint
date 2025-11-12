// /exam-simulator/app.js - Punto de Entrada Principal

// --- IMPORTACIONES DE MÓDULOS ---
import { CONFIG } from './modules/config.js';
import { EventBus } from './modules/eventBus.js';
import { Store } from './modules/store.js';
import { Data } from './modules/data.js';
import { Timer } from './modules/timer.js';
import { Exam } from './modules/exam.js';
import { UI } from './modules/ui.js';

// Importa funciones del modal desde su nueva ubicación
import { initializeConfirmationModal, showAlertModal } from '../components/confirm-modal/confirmModal.js';
// (showConfirmationModal se importa en exam.js)

// --- INICIALIZACIÓN CUANDO EL DOM ESTÉ LISTO ---
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Función principal de inicialización del simulador.
     */
    async function initApp() {
        console.log("Initializing Exam Application...");

        // 1. Inicializa módulos básicos (sin dependencias complejas)
        Store.resetState();
        // EventBus no necesita init, es estático.
        // Data no necesita init.
        // Timer no necesita init ahora, se controla desde Exam.

        // 2. Inicializa el modal de confirmación
        await initializeConfirmationModal();
        await waitForI18n();
        await i1n.loadNamespaces(['exam']); // Carga las traducciones del examen

        // 3. Inicializa módulos con dependencias (pasando referencias)
        // Pasa CONFIG y Exam a UI
        UI.init(CONFIG, Exam);
        // Pasa UI y CONFIG a Exam
        Exam.init(UI, CONFIG); // Exam ahora tiene acceso a UI y CONFIG

        // 4. Lógica de arranque (URL Params vs Setup Screen)
        const urlParams = new URLSearchParams(window.location.search);
        const urlInitialMode = urlParams.get('initialMode');
        const urlMode = urlParams.get('mode');
        const urlCount = urlParams.get('count');

        if (urlInitialMode) { // <<<--- Prioridad 1: Preseleccionar modo en Setup
            console.log(`Initial mode requested: ${urlInitialMode}`);
            showSetupScreen(urlInitialMode); // Llama a setup pasando el modo
        } else if (urlMode === 'flashcard' && urlCount) { // <<<--- Prioridad 2: Iniciar Flashcards Directo (Si mantienes esta opción)
            console.log("Starting Flashcard mode directly from URL...");
            startFlashcardsFromUrl(urlParams);
        } else if (urlMode && urlCount) { // <<<--- Prioridad 3: Iniciar Examen Directo (Study/Exam)
            console.log("Starting Exam mode directly from URL...");
            startExamFromUrl(urlParams);
        } else { // <<<--- Default: Mostrar Setup sin preselección
            console.log("No specific mode/start requested, showing setup screen.");
            showSetupScreen();
        }

        // 5. Registra el renderer dinámico de i18n (si i1n existe)
        if (typeof i1n !== 'undefined') {
            i1n.registerDynamicRenderer(() => {
                console.log("Language changed, re-rendering current screen...");
                const currentState = Store.getState();
                // Determina qué pantalla está activa y la vuelve a renderizar
                // (Esta lógica ahora vive aquí, no dentro de la función init original)
                if (!UI.elements.setupContainer?.classList.contains('d-none')) {
                    UI.renderSetupScreen();
                } else if (!UI.elements.questionsContainer?.classList.contains('d-none')) {
                    // Comprueba el modo ACTUAL antes de decidir qué renderizar
                    if (currentState.examMode === 'flashcard') { // <<<--- AÑADIDO ESTE IF
                        const flashcardQ = Store.getCurrentQuestion(); // Usa getCurrentQuestion
                        if (flashcardQ) UI._renderFlashcard(flashcardQ); // Llama a render Flashcard
                    } else { // Si no es flashcard, es modo Study o Exam
                        const currentQ = Store.getCurrentQuestion();
                        if (currentQ) UI.renderQuestion(currentQ); // Llama a render Pregunta normal
                    } // <<<--- FIN DEL IF/ELSE AÑADIDO
                } else if (!UI.elements.resultsContainer?.classList.contains('d-none')) {
                    UI.renderResults(currentState);
                } else if (!UI.elements.reviewContainer?.classList.contains('d-none')) {
                    const reviewQ = Store.getQuestionForReview(currentState.currentReviewIndex);
                    if (reviewQ) UI.renderReviewScreen(reviewQ, currentState.currentReviewIndex, currentState.currentExamQuestions?.length || 0);
                }
            });
        } else {
            console.error("i18n object (i1n) not found. Dynamic rendering will not work.");
        }

    } // Fin de initApp

    // --- FUNCIONES AUXILIARES (Adaptadas de exam-engine.js original) ---

    /**
     * Espera a que el objeto i1n esté cargado y listo.
     * @returns {Promise<void>}
     */
    function waitForI18n() {
        return new Promise(resolve => {
            if (typeof i1n !== 'undefined' && i1n.translations && Object.keys(i1n.translations).length > 0) {
                resolve(); // Ya está listo
            } else {
                // Espera al evento personalizado que dispara i18n.js
                document.addEventListener('i18n-loaded', resolve, { once: true });
            }
        });
    }

    /**
     * Inicia el examen basado en parámetros de la URL.
     * @param {URLSearchParams} params
     */
    async function startExamFromUrl(params) {
        console.log("Starting exam from URL parameters...");
        const mode = params.get('mode') || 'study';
        const count = params.get('count') || '10';
        const categoriesParam = params.get('categories');
        let categoryIds = [];

        if (categoriesParam === 'all') {
            categoryIds = CONFIG.categories.map(cat => cat.id);
        } else if (categoriesParam) {
            categoryIds = categoriesParam.split(',');
        } else {
            categoryIds = CONFIG.categories.map(cat => cat.id); // Default to all
        }

        const examConfig = {
            mode: mode,
            categoryIds: categoryIds,
            topicIds: [],
            questionCount: count,
            timeLimit: null,
            randomize: true
        };

        // Llama a Exam.start (que ahora está en el módulo Exam)
        await Exam.start(examConfig);
    }

    /**
     * Muestra la pantalla de configuración inicial.
     */
    async function showSetupScreen(initialMode = null) {
        console.log("Rendering setup screen.");
        await UI.renderSetupScreen(); // Renderiza la estructura
        if (initialMode) {
            UI.preselectMode(initialMode); // Llama a la nueva función UI para marcar el radio
        }
        // Asegúrate de que los listeners se adjunten después de renderizar Y preseleccionar
        // UI._attachSetupListeners(); // Si _renderSetupScreen no lo hace ya
    }

    // --- Ejecuta la inicialización ---
    initApp();

}); // End DOMContentLoaded