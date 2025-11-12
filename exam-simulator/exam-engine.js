// /exam-simulator/exam-engine.js (Refactored Architecture v1.0)

import { initializeConfirmationModal, showConfirmationModal, showAlertModal } from '../components/confirm-modal/confirmModal.js'; // <<<--- IMPORTA LAS FUNCIONES (usa ruta raíz)


document.addEventListener('DOMContentLoaded', () => {

    const CONFIG = {
        // --- Categories ---
        // Defines the main exam categories, linking them to i18n keys for translation.
        categories: [
            { id: '1.0-network-fundamentals', i18nKey: 'category_1_0' },
            { id: '2.0-network-access', i18nKey: 'category_2_0' },
            { id: '3.0-ip-connectivity', i18nKey: 'category_3_0' },
            { id: '4.0-ip-services', i18nKey: 'category_4_0' },
            { id: '5.0-security-fundamentals', i18nKey: 'category_5_0' },
            { id: '6.0-automation-programmability', i18nKey: 'category_6_0' }
        ],

        // --- Visuals ---
        // Provides colors and icons for category badges and potentially other UI elements.
        categoryVisuals: {
            '1.0-network-fundamentals': { color: '#0d6efd', icon: 'fa-sitemap' },
            '2.0-network-access': { color: '#198754', icon: 'fa-network-wired' },
            '3.0-ip-connectivity': { color: '#6f42c1', icon: 'fa-route' },
            '4.0-ip-services': { color: '#fd7e14', icon: 'fa-cogs' },
            '5.0-security-fundamentals': { color: '#dc3545', icon: 'fa-shield-alt' },
            '6.0-automation-programmability': { color: '#0dcaf0', icon: 'fa-code' }
        },

        // --- Exam Logic ---
        // Defines the official weighting for each category, used for distributing questions.
        categoryWeights: {
            '1.0-network-fundamentals': 0.20,
            '2.0-network-access': 0.20,
            '3.0-ip-connectivity': 0.25,
            '4.0-ip-services': 0.10,
            '5.0-security-fundamentals': 0.15,
            '6.0-automation-programmability': 0.10
        },
        // Default time per question (in seconds) for exam mode if no custom limit is set.
        timePerQuestion: 90,

        // --- Question Types ---
        // NEW: Defines the supported question types and their associated HTML input type.
        // This allows the UI module to render the correct input elements.
        questionTypes: {
            'single-choice': { inputType: 'radio' },
            'multiple-choice': { inputType: 'checkbox' },
            'true-false': { inputType: 'radio' }, // Rendered like single-choice
            // Add definitions for future types as they are implemented:
            // 'drag-and-drop': { /* ... custom rendering logic needed ... */ },
            // 'fill-in-the-blank': { inputType: 'text' },
            // 'ordering': { /* ... custom rendering logic needed ... */ },
            // 'matching': { /* ... custom rendering logic needed ... */ },
            // 'hotspot': { /* ... custom rendering logic needed ... */ },
            // 'simulator': { /* ... custom rendering logic needed ... */ }
        }
    };


    // =========================================================================
    // 1. EVENT BUS (Pub/Sub Pattern)
    // Facilitates communication between modules without direct dependencies.
    // =========================================================================
    const EventBus = {
        events: {},
        on(eventName, fn) {
            this.events[eventName] = this.events[eventName] || [];
            this.events[eventName].push(fn);
        },
        off(eventName, fn) {
            if (this.events[eventName]) {
                this.events[eventName] = this.events[eventName].filter(f => f !== fn);
            }
        },
        emit(eventName, data) {
            if (this.events[eventName]) {
                this.events[eventName].forEach(fn => fn(data));
            }
        }
    };

    // =========================================================================
    // 2. STORE (State Management)
    // Centralized state and functions to modify it (mutations/actions).
    // =========================================================================
    const Store = {
        state: {}, // Initial state defined in resetState

        // --- Private Mutations (Direct state changes, synchronous) ---
        _setAllQuestions(questions) {
            this.state.allQuestions = questions;
        },
        _setCurrentExamQuestions(questions) {
            this.state.currentExamQuestions = questions;
        },
        _setCurrentQuestionIndex(index) {
            this.state.currentQuestionIndex = index;
        },
        _setExamMode(mode) {
            this.state.examMode = mode;
        },
        _setTimeRemaining(seconds) {
            this.state.timeRemaining = seconds;
        },
        _decrementTime() {
            if (this.state.timeRemaining > 0) {
                this.state.timeRemaining--;
            }
        },
        _updateStats(type) { // 'correct', 'incorrect', 'skipped'
            this.state.stats[type]++;
        },
        _setUserAnswer(index, answerIndex) {
            if (this.state.currentExamQuestions[index]) {
                this.state.currentExamQuestions[index].userAnswerIndex = answerIndex;
            }
        },
        _setDetailedPerformance(performanceData) {
            this.state.detailedPerformance = performanceData;
        },

        // --- Public Actions (Commit mutations, can be async, contain logic) ---
        resetState() {
            this.state = {
                allQuestions: [],             // All questions loaded for selected filters
                currentExamQuestions: [],     // The specific questions for this exam instance
                currentQuestionIndex: 0,
                currentReviewIndex: 0,        // For review mode
                stats: { correct: 0, incorrect: 0, skipped: 0 },
                examMode: 'study',            // 'study' or 'exam'
                timeLimit: null,              // Total time limit in seconds (for exam mode)
                timeRemaining: 0,             // Current time remaining
                detailedPerformance: []       // Performance breakdown by topic
            };
            // console.log("State reset:", this.state);
        },

        initializeExam(questions, mode, timeLimit = null) {
            this._setCurrentExamQuestions(questions);
            this._setCurrentQuestionIndex(0);
            this._setExamMode(mode);
            this.state.stats = { correct: 0, incorrect: 0, skipped: 0 }; // Reset stats specifically
            if (mode === 'exam' && timeLimit) {
                this._setTimeRemaining(timeLimit);
                this.state.timeLimit = timeLimit;
            } else {
                this._setTimeRemaining(0); // Ensure time is 0 for study mode
                this.state.timeLimit = null;
            }
            // console.log("Exam Initialized:", this.state);
        },

        recordAnswer(answerIndex, isCorrect) {
            this._setUserAnswer(this.state.currentQuestionIndex, answerIndex);
            this._updateStats(isCorrect ? 'correct' : 'incorrect');
        },

        skipQuestion() {
            this._setUserAnswer(this.state.currentQuestionIndex, 'skipped');
            this._updateStats('skipped');
        },

        advanceQuestion() {
            if (this.state.currentQuestionIndex < this.state.currentExamQuestions.length - 1) {
                this._setCurrentQuestionIndex(this.state.currentQuestionIndex + 1);
                return true; // Advanced successfully
            }
            return false; // Reached the end
        },

        finalizeSkippedQuestions() {
            this.state.currentExamQuestions.forEach((q, index) => {
                if (q.userAnswerIndex === null) {
                    this._setUserAnswer(index, 'skipped');
                    this._updateStats('skipped');
                    // Only update stats if skipping happened *during* the finalization (exam mode timeout)
                    // If skipped via button, stats were already updated. This needs refinement based on exact flow.
                    // For now, let's assume skip button/timeout already handled stats.
                }
            });
        },

        setDetailedPerformance(performanceData) {
            this._setDetailedPerformance(performanceData);
        },

        updateTime() {
            this._decrementTime();
            return this.state.timeRemaining;
        },

        // --- Getters (Read-only access to state) ---
        getCurrentQuestion() {
            return this.state.currentExamQuestions[this.state.currentQuestionIndex];
        },
        getQuestionForReview(index) {
            return this.state.currentExamQuestions[index];
        },
        getState() {
            return { ...this.state }; // Return a copy to prevent direct mutation
        }
    };

    // =========================================================================
    // 3. UI MODULE (DOM Manipulation)
    // Reads state from Store, renders UI, emits user events via EventBus.
    // Uses <template> tags for structure.
    // =========================================================================
    const UI = {

        // --- Caché para Plantillas HTML ---
        _templateCache: {},

        // --- Bandera para evitar ejecuciones concurrentes ---
        _isPopulatingCategories: false,

        // --- DOM Element References ---
        elements: {
            setupContainer: document.getElementById('exam-setup-container'),
            questionsContainer: document.getElementById('exam-questions-container'),
            resultsContainer: document.getElementById('exam-results-container'),
            reviewContainer: document.getElementById('exam-review-container'),
            categorySelection: document.getElementById('category-selection-container'),
            topicAccordion: document.getElementById('topic-accordion'),
            startBtn: document.getElementById('start-exam-btn'),

            selectAllCategoriesBtn: document.getElementById('select-all-categories'),
            deselectAllCategoriesBtn: document.getElementById('deselect-all-categories'),

            startCustomBtn: document.getElementById('start-custom-exam-btn'),
            questionCountSelect: document.getElementById('question-count-select'),
            totalQuestionsBadge: document.getElementById('total-questions-count'),
            // ... (add references for results/review elements as needed)
        },

        /**
         * Carga una plantilla HTML desde un archivo o desde el caché.
         * @param {string} templateName - El nombre del archivo de plantilla (sin .html). Ej: 'question-card'.
         * @returns {Promise<DocumentFragment | null>} Una promesa que resuelve con el contenido clonado de la plantilla o null si hay error.
         */
        async _loadTemplate(templateName) {
            const templateId = `${templateName}-template`; // Ej: 'question-card-template'

            // 1. Revisa si la plantilla ya está en el caché
            if (this._templateCache[templateId]) {
                // Clona el contenido del template cacheado
                return this._templateCache[templateId].content.cloneNode(true);
            }

            // 2. Si no está en caché, intenta cargarla desde el archivo
            try {
                const response = await fetch(`/exam-simulator/templates/${templateName}.html`);
                if (!response.ok) {
                    throw new Error(`Error ${response.status} al cargar ${templateName}.html`);
                }
                const htmlText = await response.text();

                // 3. Parsea el texto HTML para encontrar el <template>
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const templateElement = doc.getElementById(templateId);

                if (!templateElement || !(templateElement instanceof HTMLTemplateElement)) {
                    console.error(`Elemento <template> con id "${templateId}" no encontrado en ${templateName}.html`);
                    return null;
                }

                // 4. Guarda el elemento <template> en el caché
                this._templateCache[templateId] = templateElement;
                console.log(`Plantilla "${templateId}" cargada y cacheada.`);

                // 5. Clona y devuelve el contenido
                return templateElement.content.cloneNode(true);

            } catch (error) {
                console.error(`Fallo al cargar o procesar la plantilla "${templateName}":`, error);
                return null; // Devuelve null en caso de error
            }
        },

        // --- Core UI Functions ---
        showScreen(screenName) {
            ['setup', 'questions', 'results', 'review'].forEach(key => {
                const container = this.elements[`${key}Container`];
                if (container) container.classList.add('d-none');
            });
            const activeContainer = this.elements[`${screenName}Container`];
            if (activeContainer) {
                activeContainer.classList.remove('d-none');
                window.scrollTo(0, 0); // Scroll to top when changing screens
            }
        },

        // --- Setup Screen Rendering ---
        async renderSetupScreen() {
            this.showScreen('setup');
            // TODO: Load categories/topics dynamically using Data module
            await this._populateCategories();
            await this._populateTopics(); // Will populate the accordion
            this._translateSetupOptions();
        },

        async _populateCategories() {
            // Verifica si ya está en ejecución o si falta el elemento
            if (!this.elements.categorySelection || this._isPopulatingCategories) {
                console.log("Skipping _populateCategories execution (already running or element missing).");
                return;
            }

            this._isPopulatingCategories = true; // <<<=== ESTABLECER BANDERA
            console.log("Starting _populateCategories..."); // Log para depuración

            try { // Usar try...finally para asegurar que la bandera se resetee
                this.elements.categorySelection.innerHTML = `<div class="col-12"><p class="text-muted">${i1n.get('loading_categories', 'Cargando categorías...')}</p></div>`;

                const allCategoryIds = CONFIG.categories.map(cat => cat.id);
                const allQuestionsData = await Data.fetchQuestions(allCategoryIds);
                Store._setAllQuestions(allQuestionsData);

                this.elements.categorySelection.innerHTML = ''; // Limpia contenedor
                console.log("Category container cleared."); // Log para depuración

                let totalCount = 0;

                for (const category of CONFIG.categories) {
                    const questionCount = allQuestionsData.filter(q => q.category === category.id).length;
                    totalCount += questionCount;

                    if (questionCount > 0) {
                        const templateFragment = await this._loadTemplate('setup-category-item');
                        if (templateFragment) {
                            const inputElement = templateFragment.querySelector('.category-checkbox');
                            const labelElement = templateFragment.querySelector('.form-check-label');
                            const nameSpan = templateFragment.querySelector('.category-name');
                            const countBadge = templateFragment.querySelector('.category-count');
                            const categoryInfo = CONFIG.categoryVisuals[category.id] || { color: '#6c757d', icon: 'fa-question-circle' };

                            if (inputElement) {
                                inputElement.value = category.id;
                                inputElement.id = `check-${category.id}`;
                                inputElement.checked = true; // Aseguramos que estén marcadas por defecto
                            }
                            if (labelElement) {
                                labelElement.setAttribute('for', `check-${category.id}`);
                            }
                            if (nameSpan) {
                                nameSpan.textContent = i1n.get(category.i18nKey) || category.id;
                            }
                            if (countBadge) {
                                countBadge.textContent = questionCount;
                                countBadge.style.backgroundColor = categoryInfo.color;
                            }
                            // Log antes de añadir
                            // console.log("Appending category:", category.id);
                            this.elements.categorySelection.appendChild(templateFragment);
                        }
                    }
                }

                this._attachSetupListeners();

                if (this.elements.totalQuestionsBadge) {
                    this.elements.totalQuestionsBadge.textContent = totalCount > 999 ? '999+' : totalCount;
                }
                // Validar estado inicial del botón Comenzar
                this._checkCategorySelection(); // Llamamos a la función helper

            } catch (error) {
                console.error("Error during _populateCategories:", error); // Añadir manejo de errores
            } finally {
                this._isPopulatingCategories = false; // <<<=== RESETEAR BANDERA
                console.log("Finished _populateCategories."); // Log para depuración
            }
        },

        // AÑADIR esta función helper si no existe, o asegúrate que se llame desde _attachSetupListeners
        _checkCategorySelection() {
            if (!this.elements.startBtn || !this.elements.categorySelection) return;
            const anyChecked = this.elements.categorySelection.querySelector('.category-checkbox:checked');
            this.elements.startBtn.disabled = !anyChecked;
            // Añadir lógica similar para el botón custom si es necesario
        },

        async _populateTopics() {
            if (!this.elements.topicAccordion) return;
            // TODO: This needs more sophisticated logic:
            // 1. Get all unique topics/subtopics from Store.state.allQuestions
            // 2. Group them by category
            // 3. Create accordion items for each category
            // 4. Create checkboxes for each topic/subtopic within its category
            // Use <template> for accordion item and topic checkbox item
            this.elements.topicAccordion.innerHTML = `<p class="text-muted small">Topic selection coming soon...</p>`; // Placeholder
        },

        _translateSetupOptions() {
            // Translate dropdown options for question count
            if (this.elements.questionCountSelect) {
                Array.from(this.elements.questionCountSelect.options).forEach(option => {
                    const key = `q_count_${option.value}`;
                    option.textContent = i1n.get(key); // Use i18n.get directly
                });
            }
            // Add translations for custom inputs if needed
        },

        // --- Question Screen Rendering ---
        async renderQuestion(question) { // Añadimos 'async' porque ahora usa _loadTemplate
            if (!question || !this.elements.questionsContainer) return;
            this.showScreen('questions');
            const lang = i1n.currentLanguage || 'es';

            // 1. Carga y clona la plantilla
            const templateFragment = await this._loadTemplate('question-card');
            if (!templateFragment) {
                console.error("No se pudo cargar la plantilla 'question-card'.");
                this.elements.questionsContainer.innerHTML = '<p class="text-danger">Error: Falta la plantilla de pregunta.</p>';
                return;
            }

            // --- Selecciona los elementos DENTRO del fragmento clonado ---
            const cardHeader = templateFragment.querySelector('.card-header');
            const questionTextEl = templateFragment.querySelector('.question-text');
            const imageContainer = templateFragment.querySelector('.question-image-container');
            const imageEl = templateFragment.querySelector('.question-image');
            const codeContainer = templateFragment.querySelector('.question-code-container');
            const codeEl = templateFragment.querySelector('.code-block code');
            const optionsContainer = templateFragment.querySelector('.options-container');
            // Nota: Los elementos de explicación se manejan en showFeedback

            // 2. Poblar el encabezado
            const headerHTML = this._createQuestionHeaderHTML(question, lang, Store.state.currentQuestionIndex, Store.state.currentExamQuestions.length);
            const timerHTML = Store.state.examMode === 'exam' ? `<div id="timer-display" class="fs-5 fw-bold text-primary">${this._formatTime(Store.state.timeRemaining)}</div>` : '';
            if (cardHeader) {
                cardHeader.innerHTML = `<div class="d-flex justify-content-between align-items-center">${headerHTML}${timerHTML}</div>`;
            }

            // 3. Poblar el cuerpo (Texto, Imagen, Código)
            if (questionTextEl) {
                // Usamos innerHTML aquí porque marked.parseInline devuelve HTML
                questionTextEl.innerHTML = marked.parseInline(question[`question_${lang}`] || question.question_en);
            }

            if (question.image && imageContainer && imageEl) {
                // Asumiendo que las imágenes están en /data/images/ relativo a la raíz del sitio
                imageEl.src = `/data/images/${question.image}`;
                imageContainer.style.display = 'block'; // Mostrar contenedor de imagen
            } else if (imageContainer) {
                imageContainer.style.display = 'none'; // Ocultar si no hay imagen
            }

            if (question.code && codeContainer && codeEl) {
                codeEl.textContent = question.code; // Usar textContent para el código preformateado
                codeContainer.style.display = 'block'; // Mostrar contenedor de código
            } else if (codeContainer) {
                codeContainer.style.display = 'none'; // Ocultar si no hay código
            }

            // 4. Poblar las opciones
            if (optionsContainer) {
                let optionsHTML = '';
                // Determina el tipo de input basado en questionType
                let inputType = CONFIG.questionTypes[question.questionType]?.inputType || 'radio';
                question.shuffledOptions.forEach((option, index) => {
                    const optionText = marked.parseInline(option[`text_${lang}`] || option.text_en || option.text_es); // Parsear texto de opción
                    optionsHTML += `
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}" data-index="${index}">
                            <label class="form-check-label" for="option${index}">${optionText}</label>
                        </div>`;
                });
                optionsContainer.innerHTML = optionsHTML; // Insertar todas las opciones
            }

            // 5. Borrar el contenido anterior e insertar la nueva tarjeta
            this.elements.questionsContainer.innerHTML = ''; // Limpiar contenedor
            this.elements.questionsContainer.appendChild(templateFragment); // Añadir la tarjeta completa

            // 6. Traducir textos estáticos de la plantilla (botones) si es necesario
            //    (Se asume que i18n.js los maneja si tienen data-i18n, como en la plantilla)
            i1n.translatePage(); // Llama a i18n para traducir los nuevos elementos

            // 7. Adjuntar listeners a los NUEVOS botones DENTRO del contenedor
            this._attachQuestionListeners();
            this._initPopovers(); // Re-inicializar popovers para la insignia de categoría
        },

        _createQuestionHeaderHTML(question, lang, index, total) {
            // (Reuses logic similar to your previous _createQuestionHeader)
            const categoryInfo = CONFIG.categoryVisuals[question.category] || { color: '#6c757d', icon: 'fa-question-circle' };
            const categoryName = i1n.get(CONFIG.categories.find(c => c.id === question.category)?.i18nKey || question.category);
            const topicDescription = question.topic ? (question.topic[`description_${lang}`] || question.topic.description_en) : '';
            const popoverTitle = categoryName;
            const popoverContent = question.topic
                ? `<strong>${question.topic.id}:</strong> ${topicDescription}<br><small class='text-muted'>${question.topic.subtopic_id}: ${question.topic.subtopic_description}</small>`
                : 'Subtopic information not available.';

            const categoryBadgeHTML = `
                 <div class="category-badge" style="background-color: ${categoryInfo.color};"
                      data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true"
                      title="${popoverTitle}" data-bs-content="${popoverContent}">
                     <i class="fas ${categoryInfo.icon}"></i>
                 </div>`;

            const headerText = `${i1n.get('question_header')} ${index + 1}/${total}`;
            return `<h5 class="mb-0 d-flex align-items-center">${categoryBadgeHTML} <span class="ms-2">${headerText}</span></h5>`;
        },

        _createOptionsHTML(question, lang, inputType) {
            let html = '';
            question.shuffledOptions.forEach((option, index) => {
                const optionText = marked.parseInline(option[`text_${lang}`] || option.text_en || option.text_es);
                // Important: Use data-index attribute to easily get the original index
                html += `
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}" data-index="${index}">
                        <label class="form-check-label" for="option${index}">${optionText}</label>
                    </div>`;
            });
            return html;
        },

        _createQuestionFooterHTML(lang) {
            const buttonText = (Store.state.examMode === 'study') ? i1n.get('btn_verify') : i1n.get('btn_next');
            return `
                <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                    <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${i1n.get('btn_end_exam')}</button></div>
                    <div>
                        <button id="skip-question-btn" class="btn btn-secondary me-2">${i1n.get('btn_skip')}</button>
                        <button id="check-answer-btn" class="btn btn-primary">${buttonText}</button>
                    </div>
                </div>`;
        },

        _attachQuestionListeners() {
            // Busca los botones DENTRO del contenedor de preguntas actual
            const checkBtn = this.elements.questionsContainer.querySelector('.check-answer-btn');
            const skipBtn = this.elements.questionsContainer.querySelector('.skip-question-btn');
            const endBtn = this.elements.questionsContainer.querySelector('.end-exam-btn');

            if (checkBtn) {
                // Configura el texto inicial del botón check/next según el modo
                checkBtn.textContent = (Store.state.examMode === 'study') ? i1n.get('btn_verify') : i1n.get('btn_next');

                // Añade el listener para enviar la respuesta
                checkBtn.addEventListener('click', () => {
                    // Busca las opciones seleccionadas DENTRO del contenedor actual
                    const selectedInputs = this.elements.questionsContainer.querySelectorAll('input[name="questionOptions"]:checked');
                    if (selectedInputs.length === 0) {
                        // Usa i18n.get para el mensaje de alerta
                        showAlertModal('alert_title_info', 'alert_select_answer');
                        return;
                    }
                    // Mapea los valores (índices) seleccionados
                    const selectedIndices = Array.from(selectedInputs).map(input => parseInt(input.value, 10));
                    // Emite el evento con los índices seleccionados
                    EventBus.emit('ui:answerSubmitted', selectedIndices);
                });
            }

            if (skipBtn) {
                // Añade el listener para omitir la pregunta
                skipBtn.addEventListener('click', () => EventBus.emit('ui:skipClicked'));

                // Habilita/Deshabilita el botón skip basado en si la pregunta ya fue respondida
                // (Se volverá a evaluar en showFeedback también)
                const currentQuestion = Store.getCurrentQuestion();
                skipBtn.disabled = currentQuestion?.userAnswerIndex !== null;
            }

            if (endBtn) {
                // Añade el listener para finalizar el examen
                endBtn.addEventListener('click', () => EventBus.emit('ui:endExamClicked'));
            }
        },

        showFeedback(question, lang) {
            // Obtiene una referencia al contenedor principal de la pregunta actual
            const container = this.elements.questionsContainer;
            if (!container) return; // Salir si el contenedor no existe

            // 1. Deshabilitar inputs y marcar respuestas
            // Busca todos los inputs de opciones DENTRO del contenedor actual
            container.querySelectorAll('.options-container .form-check-input').forEach(input => {
                input.disabled = true; // Deshabilita el input
            });

            question.shuffledOptions.forEach((option, index) => {
                // Busca la etiqueta correspondiente DENTRO del contenedor actual
                const label = container.querySelector(`label[for="option${index}"]`);
                if (!label) return; // Si no encuentra la etiqueta, salta a la siguiente

                // Determina si el usuario seleccionó esta opción
                let userSelectedThis = false;
                if (Array.isArray(question.userAnswerIndex)) { // Para multiple-choice
                    userSelectedThis = question.userAnswerIndex.includes(index);
                } else { // Para single-choice
                    userSelectedThis = (question.userAnswerIndex === index);
                }

                // Aplica clases CSS para feedback visual
                if (option.isCorrect) {
                    label.classList.add('correct'); // Marca la correcta
                    // Si el usuario acertó, asegúrate de que el input esté marcado (checked)
                    if (userSelectedThis) {
                        const input = container.querySelector(`#option${index}`);
                        if (input) input.checked = true;
                    }
                } else if (userSelectedThis) {
                    label.classList.add('incorrect'); // Marca la incorrecta que seleccionó el usuario
                    // Asegúrate de que el input incorrecto seleccionado esté marcado
                    const input = container.querySelector(`#option${index}`);
                    if (input) input.checked = true;
                }
            });

            // 2. Mostrar Explicación
            const explanationText = question[`explanation_${lang}`] || question.explanation_en;
            // Busca los elementos de explicación DENTRO del contenedor actual
            const explanationContainer = container.querySelector('.explanation-container');
            const explanationContent = container.querySelector('.explanation-content');

            if (explanationText && explanationContainer && explanationContent) {
                // Usa marked.parse para procesar el Markdown de la explicación
                explanationContent.innerHTML = marked.parse(explanationText);
                explanationContainer.style.display = 'block'; // Muestra el contenedor
            } else if (explanationContainer) {
                explanationContainer.style.display = 'none'; // Oculta si no hay explicación
            }

            // 3. Cambiar botón "Verificar" a "Siguiente" y reasignar evento
            // Busca el botón DENTRO del contenedor actual
            const checkBtn = container.querySelector('.check-answer-btn');
            if (checkBtn) {
                checkBtn.textContent = i1n.get('btn_next'); // Cambia el texto

                // --- IMPORTANTE: Reemplazar el botón para quitar listeners antiguos ---
                // Clonamos el botón existente. Esto crea una copia SIN los event listeners.
                const newCheckBtn = checkBtn.cloneNode(true);
                // Reemplazamos el botón viejo por el nuevo en el DOM.
                checkBtn.parentNode.replaceChild(newCheckBtn, checkBtn);
                // Añadimos el NUEVO listener al botón clonado para que emita 'ui:proceedClicked'.
                newCheckBtn.addEventListener('click', () => EventBus.emit('ui:proceedClicked'));
            }

            // 4. Deshabilitar botón "Omitir"
            // Busca el botón DENTRO del contenedor actual
            const skipBtn = container.querySelector('.skip-question-btn');
            if (skipBtn) {
                skipBtn.disabled = true; // Deshabilita el botón Omitir
            }
        },

        // --- Results Screen Rendering ---
        renderResults(stateData) {
            // (Similar logic to your previous displayResults)
            this.showScreen('results');
            const { stats, currentExamQuestions } = stateData;
            const totalQuestions = currentExamQuestions.length;
            const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;

            document.getElementById('results-score').textContent = `${scorePercentage}%`;
            document.getElementById('results-summary').textContent = `${i1n.get('results_summary_part1')} ${stats.correct} ${i1n.get('results_summary_part2')} ${totalQuestions} ${i1n.get('results_summary_part3')}`;
            document.getElementById('results-correct').textContent = stats.correct;
            document.getElementById('results-incorrect').textContent = stats.incorrect;
            document.getElementById('results-skipped').textContent = stats.skipped;

            // Translate labels
            document.querySelector('#results-correct + small').textContent = i1n.get('results_correct');
            document.querySelector('#results-incorrect + small').textContent = i1n.get('results_incorrect');
            document.querySelector('#results-skipped + small').textContent = i1n.get('results_skipped');
            document.getElementById('review-exam-btn').textContent = i1n.get('btn_review');
            document.getElementById('restart-exam-btn').textContent = i1n.get('btn_restart');
            document.querySelector('#exam-results-container a[href="../"]').textContent = i1n.get('btn_back_home'); // More specific selector


            // Update title and score color
            const resultsScoreElement = document.getElementById('results-score');
            resultsScoreElement.classList.remove('text-success', 'text-danger');
            if (scorePercentage >= 85) {
                resultsScoreElement.classList.add('text-success');
                document.getElementById('results-title').textContent = i1n.get('results_title_excellent');
            } else {
                resultsScoreElement.classList.add('text-danger');
                document.getElementById('results-title').textContent = i1n.get('results_title_practice');
            }

            // Attach button listeners
            document.getElementById('review-exam-btn').onclick = () => EventBus.emit('ui:reviewExamClicked');
            document.getElementById('restart-exam-btn').onclick = () => EventBus.emit('ui:restartExamClicked');

            // Render detailed performance
            this._renderDetailedResultsAccordion(stateData.detailedPerformance);
        },

        // --- Review Screen Rendering ---
        async renderReviewScreen(question, index, total) {
            this.showScreen('review'); // Muestra el contenedor de revisión
            const lang = i1n.currentLanguage || 'es';

            // 1. Carga y clona la plantilla de la tarjeta de revisión
            const cardTemplateFragment = await this._loadTemplate('review-card');
            if (!cardTemplateFragment) {
                this.elements.reviewContainer.innerHTML = '<p class="text-danger">Error: Falta la plantilla de revisión.</p>';
                return;
            }

            // --- Selecciona elementos DENTRO del fragmento clonado ---
            const skippedBadge = cardTemplateFragment.querySelector('.skipped-question-badge');
            const cardHeader = cardTemplateFragment.querySelector('.card-header');
            const questionTextEl = cardTemplateFragment.querySelector('.question-text');
            const imageContainer = cardTemplateFragment.querySelector('.question-image-container');
            const imageEl = cardTemplateFragment.querySelector('.question-image');
            const codeContainer = cardTemplateFragment.querySelector('.question-code-container');
            const codeEl = cardTemplateFragment.querySelector('.code-block code');
            const reviewOptionsContainer = cardTemplateFragment.querySelector('.review-options-container');
            const explanationContainer = cardTemplateFragment.querySelector('.explanation-container');
            const explanationContent = cardTemplateFragment.querySelector('.explanation-content');

            // 2. Configura la insignia "Omitida"
            if (skippedBadge) {
                skippedBadge.style.display = (question.userAnswerIndex === 'skipped') ? 'block' : 'none';
            }

            // 3. Pobla el encabezado (usando la función auxiliar _createQuestionHeaderHTML)
            const headerHTML = this._createQuestionHeaderHTML(question, lang, index, total); // Reutilizamos esta función
            if (cardHeader) {
                cardHeader.innerHTML = headerHTML; // Insertamos el HTML del encabezado
            }

            // 4. Pobla el cuerpo (Texto, Imagen, Código)
            if (questionTextEl) {
                questionTextEl.innerHTML = marked.parseInline(question[`question_${lang}`] || question.question_en);
            }
            if (question.image && imageContainer && imageEl) {
                imageEl.src = `/data/images/${question.image}`; // Ajusta la ruta si es necesario
                imageContainer.style.display = 'block';
            } else if (imageContainer) {
                imageContainer.style.display = 'none';
            }
            if (question.code && codeContainer && codeEl) {
                codeEl.textContent = question.code;
                codeContainer.style.display = 'block';
            } else if (codeContainer) {
                codeContainer.style.display = 'none';
            }

            // 5. Pobla las opciones de revisión (con clases correct/incorrect)
            if (reviewOptionsContainer) {
                let optionsHTML = '';
                question.shuffledOptions.forEach((option, idx) => {
                    let optionText = marked.parseInline(option[`text_${lang}`] || option.text_en);
                    let optionClass = 'review-option'; // Clase base

                    // Determina si el usuario seleccionó esta opción
                    let userSelected = false;
                    if (Array.isArray(question.userAnswerIndex)) {
                        userSelected = question.userAnswerIndex.includes(idx);
                    } else {
                        userSelected = (question.userAnswerIndex === idx);
                    }

                    // Aplica clases de feedback
                    if (option.isCorrect) {
                        optionClass += ' correct-answer';
                    } else if (userSelected) { // Solo si NO es correcta pero fue seleccionada
                        optionClass += ' incorrect-answer';
                    }
                    optionsHTML += `<div class="${optionClass}">${optionText}</div>`;
                });
                reviewOptionsContainer.innerHTML = optionsHTML; // Inserta todas las opciones formateadas
            }

            // 6. Pobla la explicación
            const explanationText = question[`explanation_${lang}`] || question.explanation_en;
            if (explanationText && explanationContainer && explanationContent) {
                explanationContent.innerHTML = marked.parse(explanationText);
                explanationContainer.style.display = 'block'; // Asegura que sea visible
            } else if (explanationContainer) {
                explanationContainer.style.display = 'none'; // Oculta si no hay explicación
            }

            // 7. Genera la barra de navegación de preguntas (ahora devuelve un Elemento DOM)
            const navElement = await this._createReviewNavHTML(Store.state.currentExamQuestions, index);

            // 8. Genera los botones de navegación Anterior/Siguiente/Volver
            const footerHTML = this._createReviewFooterHTML(index, total); // Esta función ya genera HTML string

            // 9. Construye el HTML final y lo inserta en el contenedor principal
            this.elements.reviewContainer.innerHTML = `
                 <div class="row">
                     <div class="col-12 col-lg-8 offset-lg-2">
                         <h2 class="text-center mb-4">${i1n.get('review_title')}</h2>
                         <div id="review-nav-placeholder"></div>
                         <div id="review-card-placeholder"></div>
                         ${footerHTML} </div>
                 </div>`;

            // Inserta los elementos DOM generados en sus placeholders
            const navPlaceholder = this.elements.reviewContainer.querySelector('#review-nav-placeholder');
            const cardPlaceholder = this.elements.reviewContainer.querySelector('#review-card-placeholder');

            if (navPlaceholder && navElement) {
                navPlaceholder.appendChild(navElement); // Añade el elemento DOM de la barra de navegación
            }
            if (cardPlaceholder) {
                cardPlaceholder.appendChild(cardTemplateFragment); // Añade el elemento DOM de la tarjeta
            }

            // 10. Adjunta listeners para la navegación (círculos y botones)
            this._attachReviewListeners(); // Esta función busca los elementos recién añadidos
            this._initPopovers(); // Para la insignia de categoría en el encabezado
        },

        // --- Helper functions for Review Screen ---
        _createReviewFooterHTML(index, total) {
            // (Sin cambios, esta función ya generaba HTML string para los botones externos)
            const prevDisabled = index === 0 ? 'disabled' : '';
            const nextDisabled = index === total - 1 ? 'disabled' : '';
            return `
                  <div class="d-flex justify-content-between mt-4">
                      <button id="prev-review-btn" class="btn btn-secondary" ${prevDisabled}>&laquo; ${i1n.get('btn_previous')}</button>
                      <button id="back-to-results-btn" class="btn btn-outline-primary">${i1n.get('review_back_button')}</button>
                      <button id="next-review-btn" class="btn btn-secondary" ${nextDisabled}>${i1n.get('btn_next')} &raquo;</button>
                  </div>`;
        },

        _attachReviewListeners() {
            // Add listeners for nav circles and prev/next/back buttons
            document.getElementById('question-nav-container')?.addEventListener('click', (e) => {
                if (e.target?.classList.contains('question-nav-circle')) {
                    const index = parseInt(e.target.dataset.index, 10);
                    EventBus.emit('ui:reviewNavigate', index);
                }
            });
            document.getElementById('prev-review-btn')?.addEventListener('click', () => EventBus.emit('ui:reviewPrevious'));
            document.getElementById('next-review-btn')?.addEventListener('click', () => EventBus.emit('ui:reviewNext'));
            document.getElementById('back-to-results-btn')?.addEventListener('click', () => EventBus.emit('ui:backToResults'));

            const navContainer = this.elements.reviewContainer.querySelector('#question-nav-container');
            if (navContainer) {
                navContainer.addEventListener('click', (e) => {
                    if (e.target?.classList.contains('question-nav-circle')) {
                        const index = parseInt(e.target.dataset.index, 10);
                        EventBus.emit('ui:reviewNavigate', index);
                    }
                });
            }
            const prevBtn = this.elements.reviewContainer.querySelector('#prev-review-btn');
            if (prevBtn) prevBtn.addEventListener('click', () => EventBus.emit('ui:reviewPrevious'));

            const nextBtn = this.elements.reviewContainer.querySelector('#next-review-btn');
            if (nextBtn) nextBtn.addEventListener('click', () => EventBus.emit('ui:reviewNext'));

            const backBtn = this.elements.reviewContainer.querySelector('#back-to-results-btn');
            if (backBtn) backBtn.addEventListener('click', () => EventBus.emit('ui:backToResults'));
        },

        // --- Timer Update ---
        updateTimerDisplay(seconds) {
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = this._formatTime(seconds);
                // Optional: Add visual indicator for low time
                if (seconds !== null && seconds <= 60) {
                    timerDisplay.classList.add('text-danger');
                } else {
                    timerDisplay.classList.remove('text-danger');
                }
            }
        },

        async _renderDetailedResultsAccordion(performanceData) {
            const container = document.getElementById('performance-accordion');
            if (!container) return; // Salir si el contenedor principal no existe

            // Vacía el contenedor antes de empezar
            container.innerHTML = '';

            // Añade el título del acordeón
            const titleHTML = `<h3 class="text-center mb-4">${i1n.get('results_performance_analysis')}</h3>`;
            container.insertAdjacentHTML('beforeend', titleHTML);

            // Verifica si hay datos de rendimiento
            if (!performanceData || performanceData.length === 0) {
                const noResultsHTML = `<p class="text-muted text-center">${i1n.get('no_detailed_results', 'No hay resultados detallados disponibles.')}</p>`; // Añadir clave i1n
                container.insertAdjacentHTML('beforeend', noResultsHTML);
                return;
            }

            const lang = i1n.currentLanguage || 'es';

            // Agrupa los resultados por categoría (usando el orden de CONFIG)
            const performanceByCategory = CONFIG.categories.reduce((acc, categoryConfig) => {
                acc[categoryConfig.id] = {
                    name: i1n.get(categoryConfig.i18nKey),
                    topics: []
                };
                return acc;
            }, {});

            performanceData.forEach(topicResult => {
                // Encuentra la pregunta para determinar su categoría (ineficiente, pero necesario por ahora)
                const question = Store.state.currentExamQuestions.find(q => q.topic && q.topic.subtopic_id === topicResult.id);
                if (question && performanceByCategory[question.category]) {
                    performanceByCategory[question.category].topics.push(topicResult);
                } else {
                    // Podríamos agrupar temas sin categoría o loggear un aviso
                    console.warn(`Topic ${topicResult.id} no pudo ser asociado a una categoría.`);
                }
            });

            let categoryIndex = 0; // Para generar IDs únicos para el acordeón

            // Itera sobre las categorías agrupadas
            for (const categoryId in performanceByCategory) {
                const categoryData = performanceByCategory[categoryId];
                const topics = categoryData.topics;

                // Salta categorías sin temas asociados en este examen
                if (topics.length === 0) continue;

                // --- Renderiza el item de categoría usando la plantilla ---
                const categoryTemplateFragment = await this._loadTemplate('results-performance-item');
                if (!categoryTemplateFragment) continue; // Salta si la plantilla falla

                // Calcula el rendimiento de la categoría
                const categoryTotal = topics.reduce((sum, t) => sum + t.total, 0);
                const categoryCorrect = topics.reduce((sum, t) => sum + t.correct, 0);
                const categoryPercentage = categoryTotal > 0 ? Math.round((categoryCorrect / categoryTotal) * 100) : 0;
                const badgeColor = this._getProportionalColor(categoryPercentage); // Obtiene color HSL

                // Selecciona elementos dentro del fragmento de categoría
                const accordionItem = categoryTemplateFragment.querySelector('.accordion-item'); // El div raíz
                const header = categoryTemplateFragment.querySelector('.accordion-header');
                const button = categoryTemplateFragment.querySelector('.accordion-button');
                const collapseDiv = categoryTemplateFragment.querySelector('.accordion-collapse');
                const categoryNameSpan = categoryTemplateFragment.querySelector('.category-performance-name');
                const categoryBadgeSpan = categoryTemplateFragment.querySelector('.category-performance-badge');
                const accordionBody = categoryTemplateFragment.querySelector('.accordion-body');

                // Configura IDs y atributos para el acordeón
                const uniqueHeadingId = `heading-category-${categoryIndex}`;
                const uniqueCollapseId = `collapse-category-${categoryIndex}`;
                if (header) header.id = uniqueHeadingId;
                if (button) {
                    button.setAttribute('data-bs-target', `#${uniqueCollapseId}`);
                    button.setAttribute('aria-controls', uniqueCollapseId);
                }
                if (collapseDiv) {
                    collapseDiv.id = uniqueCollapseId;
                    collapseDiv.setAttribute('aria-labelledby', uniqueHeadingId);
                }

                // Rellena nombre y badge de la categoría
                if (categoryNameSpan) categoryNameSpan.textContent = categoryData.name;
                if (categoryBadgeSpan) {
                    categoryBadgeSpan.textContent = `${categoryCorrect}/${categoryTotal} - ${categoryPercentage}%`;
                    categoryBadgeSpan.style.backgroundColor = badgeColor;
                }

                // --- Renderiza los items de tema DENTRO del cuerpo del acordeón ---
                if (accordionBody) {
                    // Ordena los temas por porcentaje (opcional, como antes)
                    topics.sort((a, b) => a.percentage - b.percentage);

                    for (const topic of topics) {
                        const topicTemplateFragment = await this._loadTemplate('results-topic-item');
                        if (!topicTemplateFragment) continue; // Salta si la plantilla de tema falla

                        // Selecciona elementos dentro del fragmento de tema
                        const descriptionSpan = topicTemplateFragment.querySelector('.topic-performance-description');
                        const scoreSpan = topicTemplateFragment.querySelector('.topic-performance-score');
                        const progressBar = topicTemplateFragment.querySelector('.topic-performance-bar');
                        const percentageSpan = topicTemplateFragment.querySelector('.topic-performance-percentage');

                        // Determina la clase de la barra de progreso
                        let topicBarClass = 'bg-warning';
                        if (topic.percentage >= 80) topicBarClass = 'bg-success';
                        else if (topic.percentage < 60) topicBarClass = 'bg-danger';

                        // Rellena los datos del tema
                        if (descriptionSpan) {
                            // Intenta obtener descripción traducida, si no, usa la inglesa o el ID
                            const topicDesc = topic[`description_${lang}`] || topic.description_en || topic.id;
                            descriptionSpan.textContent = `${topic.id} - ${topicDesc}`;
                        }
                        if (scoreSpan) scoreSpan.textContent = `${topic.correct}/${topic.total}`;
                        if (progressBar) {
                            // Quita clases de color anteriores y añade la nueva
                            progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-success');
                            progressBar.classList.add(topicBarClass);
                            // Establece el ancho y aria-valuenow
                            progressBar.style.width = `${topic.percentage}%`;
                            progressBar.setAttribute('aria-valuenow', topic.percentage);
                        }
                        if (percentageSpan) percentageSpan.textContent = `${topic.percentage}%`;

                        // Añade el fragmento del tema al cuerpo del acordeón de categoría
                        accordionBody.appendChild(topicTemplateFragment);
                    }
                }

                // Añade el fragmento completo de la categoría al contenedor principal del acordeón
                container.appendChild(categoryTemplateFragment);
                categoryIndex++; // Incrementa el índice para IDs únicos
            } // Fin del bucle for (categorías)
        }, // Fin de _renderDetailedResultsAccordion

        // --- Helper functions for Review Screen ---
        async _createReviewNavHTML(questions, currentIndex) {
            // Crea el contenedor principal para los círculos de navegación
            const navContainer = document.createElement('div');
            navContainer.id = 'question-nav-container';
            navContainer.className = 'd-flex flex-wrap justify-content-center gap-2 mb-4'; // Clases de Bootstrap

            // Itera sobre todas las preguntas del examen
            for (let index = 0; index < questions.length; index++) {
                const q = questions[index];

                // Carga la plantilla para el círculo de navegación
                const templateFragment = await this._loadTemplate('review-nav-item');
                if (!templateFragment) continue; // Salta si la plantilla falla

                // Selecciona el div principal dentro del fragmento
                const navCircle = templateFragment.querySelector('.question-nav-circle');
                if (!navCircle) continue; // Salta si no encuentra el elemento

                // 1. Determina la clase de estado (correcta, incorrecta, omitida)
                let statusClass = 'status-skipped'; // Por defecto
                if (q.userAnswerIndex !== null && q.userAnswerIndex !== 'skipped') {
                    // Recalcula si fue correcta o incorrecta usando la lógica de Exam
                    let isCorrect = Exam._isAnswerCorrect(q, q.userAnswerIndex);
                    statusClass = isCorrect ? 'status-correct' : 'status-incorrect';
                }

                // 2. Limpia clases de estado por defecto y añade la correcta
                navCircle.classList.remove('status-skipped', 'status-correct', 'status-incorrect', 'active'); // Limpia clases previas
                navCircle.classList.add(statusClass); // Añade la clase de estado calculada

                // 3. Añade la clase 'active' si es el índice actual
                if (index === currentIndex) {
                    navCircle.classList.add('active');
                }

                // 4. Establece el data-index y el número de pregunta
                navCircle.dataset.index = index; // Establece el atributo data-index
                navCircle.textContent = index + 1; // Establece el número visible

                // 5. Añade el círculo configurado al contenedor
                navContainer.appendChild(templateFragment);
            } // Fin del bucle for

            // Devuelve el contenedor con todos los círculos
            return navContainer; // Devuelve el elemento DOM, no HTML string
        },

        /**
         * Calcula un color en HSL que va de rojo a verde según un porcentaje.
         * @param {number} percentage - Un valor de 0 a 100.
         * @returns {string} Una cadena de color HSL, ej: 'hsl(120, 80%, 45%)'.
         */
        _getProportionalColor(percentage) {
            // Mapea el porcentaje (0-100) a un matiz (hue) en el círculo de color (0=rojo, 120=verde).
            const hue = (percentage / 100) * 120;
            const saturation = 80; // Saturación constante para colores vivos.
            const lightness = 45;  // Luminosidad constante para un buen contraste.
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        },

        _formatTime(totalSeconds) {
            if (totalSeconds === null || totalSeconds < 0) return "--:--";
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },

        // --- Popover Initialization ---
        _initPopovers() {
            // Ensure any existing popovers are destroyed before creating new ones
            const existingPopovers = bootstrap.Popover.getInstance(document.body); // Check if any exist
            if (existingPopovers) {
                // This might be too broad; ideally target only previous popovers.
                // For simplicity now, destroy all. Consider refining later.
                // console.warn("Need to refine popover destruction");
            }

            const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
            popoverTriggerList.map(el => new bootstrap.Popover(el));
        },

        /**
         * Adjunta los event listeners a los controles de la pantalla de configuración.
         * Debe llamarse una vez que el DOM de la configuración esté listo.
         */
        _attachSetupListeners() {
            const self = this; // Guardar referencia a 'this' (el objeto UI)

            // --- Helper Function ---
            // Verifica si hay categorías seleccionadas y habilita/deshabilita el botón 'Comenzar'.
            function checkCategorySelection() {
                if (!self.elements.startBtn || !self.elements.categorySelection) return;

                const anyChecked = self.elements.categorySelection.querySelector('.category-checkbox:checked');
                self.elements.startBtn.disabled = !anyChecked;
            }

            // --- Event Listeners ---

            // Botón "Todas"
            if (this.elements.selectAllCategoriesBtn && this.elements.categorySelection) {
                this.elements.selectAllCategoriesBtn.addEventListener('click', () => {
                    this.elements.categorySelection.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = true);
                    checkCategorySelection(); // Revalida el botón
                });
            }

            // Botón "Ninguna"
            if (this.elements.deselectAllCategoriesBtn && this.elements.categorySelection) {
                this.elements.deselectAllCategoriesBtn.addEventListener('click', () => {
                    this.elements.categorySelection.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
                    checkCategorySelection(); // Revalida el botón
                });
            }

            // Contenedor de categorías (para cambios individuales)
            if (this.elements.categorySelection) {
                this.elements.categorySelection.addEventListener('change', (event) => {
                    // Asegurarse de que el evento proviene de un checkbox de categoría
                    if (event.target.classList.contains('category-checkbox')) {
                        checkCategorySelection(); // Revalida el botón
                    }
                });
            }

            // Botón "Comenzar Examen" (Pestaña Rápida)
            if (this.elements.startBtn) {
                this.elements.startBtn.addEventListener('click', () => {
                    // No necesita pasar config aquí, Exam._getExamConfiguration lo leerá
                    EventBus.emit('ui:startExamClicked');
                });
            }

            // Botón "Comenzar Examen" (Pestaña Personalizada) - Asegúrate de tener la referencia en UI.elements
            if (this.elements.startCustomBtn) {
                this.elements.startCustomBtn.addEventListener('click', () => {
                    // No necesita pasar config aquí, Exam._getExamConfiguration lo leerá
                    EventBus.emit('ui:startCustomExamClicked');
                });
            }

            // TODO: Añadir listeners para la pestaña "Examen Personalizado" aquí
            // (ej. para el botón startCustomBtn, el acordeón de temas, etc.)


            // Llamada inicial para establecer el estado del botón (importante si _populateCategories no lo hace)
            // Se puede llamar aquí o asegurar que _populateCategories llame a checkCategorySelection al final.
            // checkCategorySelection();
        }
    };

    // =========================================================================
    // 4. DATA MODULE (Data Fetching & Processing)
    // Abstracts data sources (JSON, localStorage, API).
    // =========================================================================
    const Data = {
        // Cache for fetched questions to avoid refetching same category
        _questionCache: {},

        async fetchQuestions(categoryIds = [], topicIds = []) {
            // TODO: Implement filtering by topicIds if provided
            const uniqueCategoryIds = [...new Set(categoryIds)]; // Ensure no duplicates
            const categoriesToFetch = uniqueCategoryIds.filter(id => !this._questionCache[id]);

            if (categoriesToFetch.length > 0) {
                console.log("Fetching categories:", categoriesToFetch);
                const fetchPromises = categoriesToFetch.map(id =>
                    fetch(`/data/${id}.json`) // Use root-relative path
                        .then(response => {
                            if (!response.ok) throw new Error(`Failed to load: ${id} (${response.status})`);
                            // Handle potentially empty files gracefully
                            return response.text().then(text => text ? JSON.parse(text) : []);
                        })
                        .then(questions => {
                            this._questionCache[id] = questions; // Store in cache
                            return questions;
                        })
                        .catch(error => {
                            console.warn(`Could not load or parse ${id}:`, error);
                            this._questionCache[id] = []; // Cache empty array on error
                            return [];
                        })
                );
                await Promise.all(fetchPromises);
            }

            // Combine questions from requested categories from cache
            let combinedQuestions = [];
            uniqueCategoryIds.forEach(id => {
                if (this._questionCache[id]) {
                    combinedQuestions.push(...this._questionCache[id]);
                }
            });

            // TODO: Add filtering logic here if topicIds are provided
            // combinedQuestions = combinedQuestions.filter(q => topicIds.includes(q.topic?.id) || topicIds.includes(q.topic?.subtopic_id));

            return combinedQuestions;
        },

        shuffleArray(array) {
            // Fisher-Yates shuffle
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },

        saveAttempt(attemptData) {
            // (Same logic as before)
            const attempt = {
                date: new Date().toISOString(),
                stats: attemptData.stats,
                totalQuestions: attemptData.currentExamQuestions.length,
                mode: attemptData.examMode,
                // Optional: Could add performance breakdown here too
            };
            try {
                const history = JSON.parse(localStorage.getItem('CCNA_examHistory')) || [];
                history.push(attempt);
                // Limit history size if needed
                if (history.length > 50) history.shift();
                localStorage.setItem('CCNA_examHistory', JSON.stringify(history));
            } catch (e) {
                console.error("Could not save exam result.", e);
            }
        }
    };

    // =========================================================================
    // 5. EXAM MODULE (Core Business Logic)
    // Orchestrates the exam flow, interacts with other modules.
    // =========================================================================
    const Exam = {

        init() {
            // Subscribe to UI events
            EventBus.on('ui:startExamClicked', config => this.start(config));
            EventBus.on('ui:startCustomExamClicked', config => this.start(config)); // Add listener for custom start
            EventBus.on('ui:answerSubmitted', answerIndices => this.handleAnswerSubmission(answerIndices));
            EventBus.on('ui:skipClicked', () => this.skipQuestion());
            EventBus.on('ui:proceedClicked', () => this.proceedToNextQuestion()); // For study mode 'Next'
            EventBus.on('ui:endExamClicked', () => this.confirmEndExam());
            EventBus.on('ui:restartExamClicked', () => this.resetToSetup());
            EventBus.on('ui:reviewExamClicked', () => this.startReview());
            EventBus.on('ui:reviewNavigate', index => this.navigateToReviewQuestion(index));
            EventBus.on('ui:reviewPrevious', () => this.previousReviewQuestion());
            EventBus.on('ui:reviewNext', () => this.nextReviewQuestion());
            EventBus.on('ui:backToResults', () => UI.showScreen('results'));

            // Subscribe to Timer events
            EventBus.on('timer:tick', remainingSeconds => UI.updateTimerDisplay(remainingSeconds));
            EventBus.on('timer:finished', () => this.finish());
        },

        // Determine which configuration options to use based on active tab
        _getExamConfiguration() {
            const quickTabActive = document.getElementById('quick-exam-tab-btn')?.classList.contains('active');
            if (quickTabActive) {
                const selectedMode = document.querySelector('#quick-exam-pane input[name="examMode"]:checked')?.value || 'study';
                const selectedCats = document.querySelectorAll('#category-selection-container input:checked');
                const questionCount = document.getElementById('question-count-select')?.value || '10';

                if (selectedCats.length === 0) {
                    alert(i1n.get('alert_select_category'));
                    return null;
                }
                const categoryIds = Array.from(selectedCats).map(el => el.value);

                return {
                    mode: selectedMode,
                    categoryIds: categoryIds,
                    topicIds: [], // No topic filter in quick mode
                    questionCount: questionCount, // '10', '25', '50', 'all'
                    timeLimit: null, // Default time limit handled later based on count/mode
                    randomize: true // Always randomize in quick mode
                };

            } else {
                // Custom Exam Tab
                const selectedMode = document.querySelector('#custom-exam-pane input[name="examModeCustom"]:checked')?.value || 'study';
                // TODO: Read selected topics from the accordion checkboxes
                const selectedTopicCheckboxes = document.querySelectorAll('#topic-accordion input[type="checkbox"]:checked');
                const topicIds = Array.from(selectedTopicCheckboxes).map(cb => cb.value); // Will contain topic/subtopic IDs
                // Infer category IDs from selected topics (needs mapping logic)
                const categoryIds = []; // TODO: Populate this based on selected topics
                if (topicIds.length === 0) { // Or maybe check category checkboxes if accordion isn't used?
                    alert(i1n.get('alert_select_topic_or_category')); // Need new i18n key
                    return null;
                }


                const questionCountInput = document.getElementById('question-count-custom');
                const timeLimitInput = document.getElementById('time-limit-input');
                const randomizeCheckbox = document.getElementById('randomize-questions');

                const questionCount = questionCountInput?.value ? parseInt(questionCountInput.value, 10) : 'all'; // Default to all if empty or invalid
                const timeLimitMins = timeLimitInput?.value ? parseInt(timeLimitInput.value, 10) : null;
                const timeLimitSecs = timeLimitMins ? timeLimitMins * 60 : null; // Convert to seconds
                const randomize = randomizeCheckbox?.checked ?? true; // Default to true

                if (questionCount !== 'all' && (!Number.isInteger(questionCount) || questionCount < 1)) {
                    alert(i1n.get('alert_invalid_question_count')); // Need new i18n key
                    return null;
                }
                if (timeLimitSecs !== null && (!Number.isInteger(timeLimitMins) || timeLimitMins < 1)) {
                    alert(i1n.get('alert_invalid_time_limit')); // Need new i18n key
                    return null;
                }

                return {
                    mode: selectedMode,
                    categoryIds: categoryIds,
                    topicIds: topicIds,
                    questionCount: questionCount, // number or 'all'
                    timeLimit: timeLimitSecs, // in seconds or null
                    randomize: randomize
                };
            }
        },

        async start(config = null) {
            // If no config passed (e.g., from direct button click), get it from UI
            const examConfig = config || this._getExamConfiguration();
            if (!examConfig) return; // Validation failed in _getExamConfiguration

            // Reset Store state *before* fetching questions
            Store.resetState();

            try {
                // Fetch questions based on CATEGORIES selected. Topic filtering happens later.
                // TODO: Refine this - if only topics are selected, derive categories first.
                const categoriesToFetch = examConfig.categoryIds.length > 0 ? examConfig.categoryIds : CONFIG.categories.map(c => c.id); // Fetch all if no category selected but topics are?
                let fetchedQuestions = await Data.fetchQuestions(categoriesToFetch);

                // Filter by TOPIC if applicable (custom mode)
                if (examConfig.topicIds && examConfig.topicIds.length > 0) {
                    fetchedQuestions = fetchedQuestions.filter(q =>
                        examConfig.topicIds.includes(q.topic?.id) || examConfig.topicIds.includes(q.topic?.subtopic_id)
                    );
                }

                if (fetchedQuestions.length === 0) {
                    return alert(i1n.get('alert_no_questions'));
                }

                // Select the number of questions
                let examPool = [];
                if (examConfig.questionCount === 'all') {
                    examPool = fetchedQuestions;
                } else {
                    const numQuestions = parseInt(examConfig.questionCount, 10);
                    // Use weight distribution ONLY if filtering by category (quick mode) AND not selecting all
                    if (examConfig.topicIds.length === 0 && examConfig.categoryIds.length > 0) {
                        const questionsByCategory = {};
                        examConfig.categoryIds.forEach(id => {
                            questionsByCategory[id] = Data.shuffleArray(fetchedQuestions.filter(q => q.category === id));
                        });
                        const questionsToTake = this._distributeQuestionsByWeight(numQuestions, examConfig.categoryIds);

                        for (const categoryId of examConfig.categoryIds) {
                            const idealCount = questionsToTake[categoryId] || 0;
                            const availableQuestions = questionsByCategory[categoryId] || [];
                            const takeCount = Math.min(idealCount, availableQuestions.length);
                            examPool.push(...availableQuestions.slice(0, takeCount));
                        }
                    } else {
                        // If filtering by topic OR just taking a number from the whole pool, simple slice
                        examPool = Data.shuffleArray(fetchedQuestions).slice(0, numQuestions);
                    }
                }

                // Randomize if needed
                if (examConfig.randomize) {
                    examPool = Data.shuffleArray(examPool);
                }

                // Final check if pool is empty after filtering/slicing
                if (examPool.length === 0) {
                    return alert(i1n.get('alert_no_questions'));
                }


                // Pre-process (shuffle options) and initialize Store
                examPool.forEach(q => {
                    q.shuffledOptions = Data.shuffleArray([...q.options]);
                    q.userAnswerIndex = null; // Ensure reset
                });

                // Determine time limit
                let finalTimeLimit = examConfig.timeLimit; // Use custom limit if set
                if (finalTimeLimit === null && examConfig.mode === 'exam') {
                    // Calculate default exam time if not custom set
                    finalTimeLimit = examPool.length * CONFIG.timePerQuestion;
                }


                Store.initializeExam(examPool, examConfig.mode, finalTimeLimit);

                // Start UI and Timer
                UI.renderQuestion(Store.getCurrentQuestion());
                if (Store.state.examMode === 'exam') {
                    Timer.start(Store.state.timeRemaining);
                }

            } catch (error) {
                console.error('Error starting exam:', error);
                alert(i1n.get('alert_load_error'));
            }
        },

        handleAnswerSubmission(selectedIndices) {
            const question = Store.getCurrentQuestion();
            if (!question || question.userAnswerIndex !== null) return; // Already answered

            const answerIndex = (question.questionType === 'multiple-choice') ? selectedIndices : selectedIndices[0];
            const isCorrect = this._isAnswerCorrect(question, answerIndex);

            Store.recordAnswer(answerIndex, isCorrect);

            if (Store.state.examMode === 'study') {
                UI.showFeedback(question, i1n.currentLanguage || 'es');
                // Wait for user to click "Next" (handled by ui:proceedClicked event)
            } else {
                this.proceedToNextQuestion(); // Auto-advance in exam mode
            }
        },

        _isAnswerCorrect(question, answerIndex) {
            if (answerIndex === null || answerIndex === 'skipped') return false;

            switch (question.questionType) {
                case 'single-choice':
                // Fallthrough intentional
                case 'true-false': // Assuming options are structured correctly
                    return question.shuffledOptions[answerIndex]?.isCorrect === true;
                case 'multiple-choice':
                    if (!Array.isArray(answerIndex)) return false; // Should be an array
                    const correctIndices = new Set(
                        question.shuffledOptions.map((opt, idx) => opt.isCorrect ? idx : -1).filter(idx => idx !== -1)
                    );
                    const selectedIndicesSet = new Set(answerIndex);
                    return correctIndices.size === selectedIndicesSet.size &&
                        [...correctIndices].every(idx => selectedIndicesSet.has(idx));
                // TODO: Add cases for other question types (drag-drop, fill-blank etc.)
                default:
                    return false;
            }
        },

        skipQuestion() {
            if (Store.getCurrentQuestion()?.userAnswerIndex !== null) return; // Prevent skipping answered question
            Store.skipQuestion();
            this.proceedToNextQuestion();
        },

        proceedToNextQuestion() {
            const advanced = Store.advanceQuestion();
            if (advanced) {
                UI.renderQuestion(Store.getCurrentQuestion());
            } else {
                this.finish(); // Reached the end
            }
        },

        confirmEndExam() {
            showConfirmationModal(
                'confirm_end_exam_title',  // Nueva clave i18n para el título
                'confirm_end_exam_body',   // Nueva clave i18n para el mensaje
                'btn_confirm_end',         // Nueva clave i18n para "Finalizar"
                'btn_cancel',              // Nueva clave i18n para "Cancelar"
                () => this.finish()        // La función a ejecutar si confirman
            );
        },

        finish() {
            Timer.stop();
            Store.finalizeSkippedQuestions(); // Mark remaining as skipped (important for exam mode timeout)

            // Calculate detailed performance
            const performanceData = this._calculatePerformance();
            Store.setDetailedPerformance(performanceData);

            Data.saveAttempt(Store.getState());
            UI.renderResults(Store.getState());
        },

        _calculatePerformance() {
            const topicPerformance = {};
            Store.state.currentExamQuestions.forEach(q => {
                if (q.topic && q.topic.subtopic_id) { // Calculate based on subtopic
                    const subtopicKey = q.topic.subtopic_id;
                    if (!topicPerformance[subtopicKey]) {
                        topicPerformance[subtopicKey] = {
                            correct: 0,
                            total: 0,
                            description_es: q.topic.subtopic_description, // Store descriptions
                            description_en: q.topic.subtopic_description
                        };
                    }
                    topicPerformance[subtopicKey].total++;

                    // Check correctness only if answered (not skipped or null)
                    if (q.userAnswerIndex !== 'skipped' && q.userAnswerIndex !== null) {
                        if (this._isAnswerCorrect(q, q.userAnswerIndex)) {
                            topicPerformance[subtopicKey].correct++;
                        }
                    }
                    // Skipped counts towards total but not correct
                }
            });

            // Convert to array and calculate percentage
            return Object.entries(topicPerformance).map(([key, value]) => ({
                id: key,
                ...value,
                percentage: (value.total > 0) ? Math.round((value.correct / value.total) * 100) : 0
            }));
        },

        resetToSetup() {
            Store.resetState();

            // Navega a la URL base del simulador, eliminando parámetros GET
            window.location.href = '/exam-simulator/';
            //UI.renderSetupScreen(); // Re-render setup which includes fetching categories/topics
        },

        // --- Review Mode Logic ---
        startReview() {
            Store.state.currentReviewIndex = 0;
            const question = Store.getQuestionForReview(0);
            if (question) {
                UI.renderReviewScreen(question, 0, Store.state.currentExamQuestions.length);
            }
        },

        navigateToReviewQuestion(index) {
            if (index >= 0 && index < Store.state.currentExamQuestions.length) {
                Store.state.currentReviewIndex = index;
                const question = Store.getQuestionForReview(index);
                UI.renderReviewScreen(question, index, Store.state.currentExamQuestions.length);
            }
        },

        previousReviewQuestion() {
            const newIndex = Store.state.currentReviewIndex - 1;
            this.navigateToReviewQuestion(newIndex);
        },

        nextReviewQuestion() {
            const newIndex = Store.state.currentReviewIndex + 1;
            this.navigateToReviewQuestion(newIndex);
        },

        // Private method from original code - keep for weighted distribution
        _distributeQuestionsByWeight(totalQuestions, categoryIds) {
            // (Same logic as provided in your original code)
            const weights = categoryIds.map(id => CONFIG.categoryWeights[id] || 0);
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);

            // Adjust weights proportionally if the sum isn't 1 (or close enough)
            // This handles cases where user selects categories whose weights don't sum to 1
            const normalizedWeights = totalWeight > 0 ? weights.map(w => w / totalWeight) : weights.map(() => 1 / weights.length); // Equal if zero weight

            const exactValues = normalizedWeights.map(w => totalQuestions * w);
            const baseIntegers = exactValues.map(v => Math.floor(v));

            let currentSum = baseIntegers.reduce((sum, val) => sum + val, 0);
            let difference = totalQuestions - currentSum;

            const remainders = exactValues.map((v, i) => ({
                index: i,
                remainder: v - baseIntegers[i]
            }));

            remainders.sort((a, b) => {
                if (b.remainder === a.remainder) return a.index - b.index;
                return b.remainder - a.remainder;
            });

            // Distribute remaining questions (positive or negative difference handled)
            for (let i = 0; i < Math.abs(difference); i++) {
                if (i >= remainders.length) break; // Avoid index out of bounds if difference > #categories
                const categoryIndex = remainders[i].index;
                baseIntegers[categoryIndex] += (difference > 0 ? 1 : -1);
                // Ensure count doesn't go below zero if difference is negative
                if (baseIntegers[categoryIndex] < 0) baseIntegers[categoryIndex] = 0;
            }

            const distribution = {};
            categoryIds.forEach((id, index) => {
                distribution[id] = baseIntegers[index];
            });

            // Final adjustment if rounding errors still caused mismatch
            let finalSum = Object.values(distribution).reduce((s, v) => s + v, 0);
            let finalDiff = totalQuestions - finalSum;
            if (finalDiff !== 0 && categoryIds.length > 0) {
                // Add/remove difference to/from the category that got the most/least questions initially (or first category as fallback)
                let adjustIndex = 0;
                if (remainders.length > 0) {
                    adjustIndex = (finalDiff > 0) ? remainders[0].index : remainders[remainders.length - 1].index;
                }
                distribution[categoryIds[adjustIndex]] += finalDiff;
                if (distribution[categoryIds[adjustIndex]] < 0) distribution[categoryIds[adjustIndex]] = 0; // Prevent negative
            }


            return distribution;
        },

    };

    // =========================================================================
    // 6. TIMER MODULE
    // Manages the countdown timer for exam mode.
    // =========================================================================
    const Timer = {
        intervalId: null,

        start(totalSeconds) {
            this.stop(); // Clear any existing timer
            if (totalSeconds === null || totalSeconds <= 0) return; // No timer needed

            Store._setTimeRemaining(totalSeconds); // Initialize Store's time
            EventBus.emit('timer:tick', totalSeconds); // Initial display

            this.intervalId = setInterval(() => {
                const remaining = Store.updateTime(); // Decrement time in Store
                EventBus.emit('timer:tick', remaining); // Notify UI
                if (remaining <= 0) {
                    this.stop();
                    EventBus.emit('timer:finished'); // Notify Exam module
                }
            }, 1000);
        },

        stop() {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    };

    // =========================================================================
    // 7. INITIALIZATION
    // =========================================================================
    async function init() {
        console.log("Initializing Exam Engine...");
        Store.resetState();
        Exam.init(); // Setup Exam module listeners

        // Inicializa el modal UNA VEZ al cargar la aplicación
        await initializeConfirmationModal();

        /**
         * NUEVO: Parsea los parámetros de la URL.
         * @returns {URLSearchParams}
         */
        const getUrlParams = () => {
            // Esta línea lee la parte de la query string de la URL actual
            // (todo lo que viene después de '?')
            return new URLSearchParams(window.location.search);
        };

        /**
         * NUEVO: Lógica para iniciar el examen desde la URL.
         * @param {URLSearchParams} params - Los parámetros de la URL.
         */
        const startExamFromUrl = async (params) => {
            console.log("Starting exam from URL parameters...");

            // 1. Construye el objeto de configuración desde la URL
            // Aquí se leen los valores de 'mode', 'count' y 'categories'
            const mode = params.get('mode') || 'study'; // 'study' por defecto
            const count = params.get('count') || '10'; // '10' por defecto
            const categoriesParam = params.get('categories'); // ej. "all" o "1.0,3.0"

            let categoryIds = [];
            if (categoriesParam === 'all') {
                // Usa todas las categorías de CONFIG
                categoryIds = CONFIG.categories.map(cat => cat.id);
            } else if (categoriesParam) {
                // Usa las categorías específicas (separadas por coma)
                categoryIds = categoriesParam.split(',');
            } else {
                // Por defecto, si no se especifica, usa todas
                categoryIds = CONFIG.categories.map(cat => cat.id);
            }

            // Se crea el objeto de configuración para pasarlo a Exam.start
            const examConfig = {
                mode: mode,
                categoryIds: categoryIds,
                topicIds: [], // El examen rápido no filtra por tema
                questionCount: count, // '10', '25', '50', 'all'
                timeLimit: null, // Dejar que Exam.start calcule el tiempo si es modo 'exam'
                randomize: true
            };

            // 2. Espera a que i18n esté listo (necesario para las alertas en Exam.start)
            await new Promise(resolve => {
                if (typeof i1n !== 'undefined' && i1n.translations && Object.keys(i1n.translations).length > 0) {
                    resolve(); // i18n ya está cargado
                } else {
                    document.addEventListener('i18n-loaded', resolve, { once: true }); // Espera al evento
                }
            });

            // 3. Inicia el examen con la configuración obtenida
            await Exam.start(examConfig); //
        };

        /**
         * NUEVO: Lógica para mostrar la pantalla de configuración normal.
         */
        const showSetupScreen = async () => {
            // ... (código para mostrar pantalla de setup omitido por brevedad) ...
            console.log("i18n loaded, rendering setup screen."); //
            await UI.renderSetupScreen(); //
        };

        // --- Lógica Principal de Inicialización ---
        // Se obtienen los parámetros de la URL actual
        const urlParams = getUrlParams();

        // Se comprueba si existen los parámetros 'mode' y 'count'
        if (urlParams.has('mode') && urlParams.has('count')) {
            // Si existen, se llama a la función para iniciar el examen desde la URL
            startExamFromUrl(urlParams);
        } else {
            // Si NO existen, se llama a la función para mostrar la pantalla de configuración
            showSetupScreen();
        }

        document.addEventListener('i18n-loaded', async () => {
            console.log("i18n loaded, rendering setup screen.");
            await UI.renderSetupScreen(); // Espera a que se renderice
            // UI._attachSetupListeners(); // Llama aquí si no se llama dentro de _populateCategories
        });

        // Also handle case where i18n might already be loaded if this script runs later
        if (typeof i1n !== 'undefined' && i1n.translations && Object.keys(i1n.translations).length > 0) {
            console.log("i18n seems already loaded, rendering setup screen.");
            UI.renderSetupScreen();
        }

        // Register dynamic renderer for i18n changes (Refreshes current view)
        // Ensure i1n exists before registering
        if (typeof i1n !== 'undefined') {
            i1n.registerDynamicRenderer(() => {
                console.log("Language changed, re-rendering current screen...");
                const currentState = Store.getState(); // Get current state safely
                // Determine which screen is active and re-render it
                if (!UI.elements.setupContainer?.classList.contains('d-none')) {
                    UI.renderSetupScreen();
                } else if (!UI.elements.questionsContainer?.classList.contains('d-none')) {
                    UI.renderQuestion(Store.getCurrentQuestion());
                } else if (!UI.elements.resultsContainer?.classList.contains('d-none')) {
                    UI.renderResults(currentState);
                } else if (!UI.elements.reviewContainer?.classList.contains('d-none')) {
                    const reviewQuestion = Store.getQuestionForReview(currentState.currentReviewIndex);
                    UI.renderReviewScreen(reviewQuestion, currentState.currentReviewIndex, currentState.currentExamQuestions.length);
                }
            });
        } else {
            console.error("i18n object (i1n) not found. Dynamic rendering on language change will not work.");
        }

    }

    // --- Start the application ---
    init();

}); // End DOMContentLoaded