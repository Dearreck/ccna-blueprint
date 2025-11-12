// exam-simulator/modules/exam.js

// --- IMPORTACIONES ---
import { EventBus } from './eventBus.js';
import { Store } from './store.js';
import { Data } from './data.js';
import { Timer } from './timer.js';
import { showConfirmationModal, showAlertModal } from '../../components/confirm-modal/confirmModal.js';

// --- FIN IMPORTACIONES ---


// =========================================================================
// 5. EXAM MODULE (Core Business Logic)
// Orchestrates the exam flow, interacts with other modules.
// =========================================================================
export const Exam = {

    init(uiRef, configRef) {
        this.UI = uiRef; // Guarda la referencia a UI
        this.CONFIG = configRef; // Guarda la referencia a CONFIG

        // Subscribe to UI events
        EventBus.on('ui:startExamClicked', config => this.start(config));
        EventBus.on('ui:startCustomExamClicked', config => this.start(config));
        EventBus.on('ui:answerSubmitted', answerIndices => this.handleAnswerSubmission(answerIndices));
        EventBus.on('ui:skipClicked', () => this.skipQuestion());
        EventBus.on('ui:proceedClicked', () => this.proceedToNextQuestion());
        EventBus.on('ui:endExamClicked', () => this.confirmEndExam());
        EventBus.on('ui:restartExamClicked', () => this.resetToSetup());
        EventBus.on('ui:reviewExamClicked', () => this.startReview());
        EventBus.on('ui:reviewNavigate', index => this.navigateToReviewQuestion(index));
        EventBus.on('ui:reviewPrevious', () => this.previousReviewQuestion());
        EventBus.on('ui:reviewNext', () => this.nextReviewQuestion());
        EventBus.on('ui:backToResults', () => this.UI.showScreen('results'));
        EventBus.on('ui:flashcardPrevious', () => this.previousFlashcard());
        EventBus.on('ui:flashcardNext', () => this.nextFlashcard());

        // Subscribe to Timer events
        EventBus.on('timer:tick', remainingSeconds => {
            if (this.UI) this.UI.updateTimerDisplay(remainingSeconds); // Usa this.UI
        });
        EventBus.on('timer:finished', () => this.finish());
    },

    /**
     * Lee la configuración de la nueva UI unificada.
     * (VERSIÓN UNIFICADA)
     */
    _getExamConfiguration() {
        // 1. Obtener el Modo (el más fácil)
        const mode = document.querySelector('input[name="examMode"]:checked')?.value || 'study';

        // 2. Determinar el modo de contenido (Categoría o Tema)
        const isCategoryMode = document.getElementById('category-pane')?.classList.contains('active');

        let categoryIds = [];
        let topicIds = [];

        if (isCategoryMode) {
            // --- MODO CATEGORÍA ---
            const selectedCats = document.querySelectorAll('#category-selection-container input:checked');
            if (selectedCats.length === 0) {
                showAlertModal('alert_title_info', 'alert_select_category');
                return null;
            }
            categoryIds = Array.from(selectedCats).map(el => el.value);

        } else {
            // --- MODO TEMA ---
            const selectedTopicCheckboxes = document.querySelectorAll('#topic-accordion .topic-checkbox:checked');
            if (selectedTopicCheckboxes.length === 0) {
                showAlertModal('alert_title_info', 'alert_select_topic_or_category');
                return null;
            }

            // Obtenemos los IDs de los temas/subtemas
            topicIds = Array.from(selectedTopicCheckboxes).map(cb => cb.value);

            // Derivamos las categorías (para asegurar que carguemos los archivos JSON correctos)
            const categoryIdsSet = new Set();
            selectedTopicCheckboxes.forEach(cb => {
                const catId = cb.getAttribute('data-category-id');
                if (catId) categoryIdsSet.add(catId);
            });
            categoryIds = Array.from(categoryIdsSet);
        }

        // 3. Obtener Opciones (si no es modo Flashcard)
        let questionCount = 'all';
        let timeLimitSecs = null;

        if (mode !== 'flashcard') {
            // Obtener Número de Preguntas
            // (Leemos el select de categorías, pero podría ser un input numérico para temas)
            // Por simplicidad, este diseño reutiliza el select `question-count-select`
            questionCount = document.getElementById('question-count-select')?.value || '10';

            if (mode === 'exam') {
                // Obtener Límite de Tiempo (solo si es modo Examen)
                const timeLimitInput = document.getElementById('time-limit-input');
                const timeLimitMins = timeLimitInput?.value ? parseInt(timeLimitInput.value, 10) : null;

                if (timeLimitMins !== null && (!Number.isInteger(timeLimitMins) || timeLimitMins < 1)) {
                    showAlertModal('alert_title_info', 'alert_invalid_time_limit');
                    return null;
                }
                timeLimitSecs = timeLimitMins ? timeLimitMins * 60 : null;
            }
        }

        // 4. Retornar el objeto de configuración unificado
        return {
            mode: mode,
            categoryIds: categoryIds, // IDs de categorías (para cargar JSON)
            topicIds: topicIds,     // IDs de temas (para filtrar preguntas)
            questionCount: questionCount,
            timeLimit: timeLimitSecs,
            randomize: true // Asumimos siempre aleatorio, o puedes añadir este checkbox a las Opciones
        };
    },

    async start(config = null) {
        const examConfig = config || this._getExamConfiguration();
        if (!examConfig) return;

        Store.resetState();

        try {
            // Si hay categoryIds en la config (derivadas en _getExamConfiguration o seleccionadas en Quick), úsalas.
            // Si no (caso raro, quizás fallback?), carga todas (aunque ahora no debería pasar si hay topicIds).
            const categoriesToFetch = (examConfig.categoryIds && examConfig.categoryIds.length > 0)
                ? examConfig.categoryIds
                : (this.CONFIG ? this.CONFIG.categories.map(c => c.id) : []); // Fallback

            let fetchedQuestions = await Data.fetchQuestions(categoriesToFetch);

            // Filtro por Tema
            if (examConfig.topicIds && examConfig.topicIds.length > 0) {
                fetchedQuestions = fetchedQuestions.filter(q =>
                    examConfig.topicIds.includes(q.topic?.id) || examConfig.topicIds.includes(q.topic?.subtopic_id)
                );
            }

            // Necesita i1n
            if (fetchedQuestions.length === 0) {
                showAlertModal('alert_title_info', 'alert_no_questions');
                return;
            }

            // Selecciona número de preguntas y distribuye (necesita CONFIG)
            let examPool = [];
            if (examConfig.questionCount === 'all') {
                examPool = fetchedQuestions;
            } else {
                const numQuestions = parseInt(examConfig.questionCount, 10);
                if (examConfig.topicIds.length === 0 && examConfig.categoryIds.length > 0 && this.CONFIG) { // Distribución por peso
                    const questionsByCategory = {};
                    examConfig.categoryIds.forEach(id => {
                        questionsByCategory[id] = Data.shuffleArray(fetchedQuestions.filter(q => q.category === id));
                    });
                    const questionsToTake = this._distributeQuestionsByWeight(numQuestions, examConfig.categoryIds); // Usa this._distribute...

                    for (const categoryId of examConfig.categoryIds) {
                        const idealCount = questionsToTake[categoryId] || 0;
                        const availableQuestions = questionsByCategory[categoryId] || [];
                        const takeCount = Math.min(idealCount, availableQuestions.length);
                        examPool.push(...availableQuestions.slice(0, takeCount));
                    }
                } else { // Simple slice
                    examPool = Data.shuffleArray(fetchedQuestions).slice(0, numQuestions);
                }
            }

            // Randomizar
            if (examConfig.randomize) {
                examPool = Data.shuffleArray(examPool);
            }

            // Necesita i1n
            if (examPool.length === 0) {
                showAlertModal('alert_title_info', 'alert_no_questions');
                return;
            }

            // Pre-procesa preguntas
            examPool.forEach(q => {
                // Asegúrate de que q.options exista y sea un array
                if (Array.isArray(q.options)) {
                    q.shuffledOptions = Data.shuffleArray([...q.options]);
                } else {
                    q.shuffledOptions = []; // O maneja el error de otra forma
                    console.warn(`Pregunta ${q.id} no tiene 'options' o no es un array.`);
                }
                q.userAnswerIndex = null;
            });

            // Calcula límite de tiempo (necesita CONFIG)
            let finalTimeLimit = examConfig.timeLimit;
            if (finalTimeLimit === null && examConfig.mode === 'exam' && this.CONFIG) {
                finalTimeLimit = examPool.length * this.CONFIG.timePerQuestion;
            }

            Store.initializeExam(examPool, examConfig.mode, finalTimeLimit);

            if (Store.state.examMode === 'flashcard') {
                if (this.UI) this.UI._renderFlashcard(Store.getCurrentQuestion()); // Llama a render Flashcard
            } else {
                if (this.UI) this.UI.renderQuestion(Store.getCurrentQuestion()); // Llama a render Pregunta normal
                if (Store.state.examMode === 'exam') {
                    Timer.start(Store.state.timeRemaining);
                }
            }

        } catch (error) {
            console.error('Error starting exam:', error);
            showAlertModal('alert_title_error', 'alert_load_error');
        }
    },

    handleAnswerSubmission(selectedIndices) {
        const question = Store.getCurrentQuestion();
        if (!question || question.userAnswerIndex !== null) return;

        const answerIndex = (question.questionType === 'multiple-choice') ? selectedIndices : selectedIndices[0];
        const isCorrect = this._isAnswerCorrect(question, answerIndex); // Usa this._isAnswer...

        Store.recordAnswer(answerIndex, isCorrect);

        // Necesita UI e i1n
        if (Store.state.examMode === 'study' && this.UI) {
            this.UI.showFeedback(question, typeof i1n !== 'undefined' ? i1n.currentLanguage || 'es' : 'es');
        } else {
            this.proceedToNextQuestion();
        }
    },

    _isAnswerCorrect(question, answerIndex) {
        if (answerIndex === null || answerIndex === 'skipped' || !question || !Array.isArray(question.shuffledOptions)) return false;

        switch (question.questionType) {
            case 'single-choice':
            case 'true-false':
                // Verifica que el índice sea válido antes de acceder
                return question.shuffledOptions[answerIndex]?.isCorrect === true;
            case 'multiple-choice':
                if (!Array.isArray(answerIndex)) return false;
                const correctIndices = new Set(
                    question.shuffledOptions.map((opt, idx) => opt.isCorrect ? idx : -1).filter(idx => idx !== -1)
                );
                const selectedIndicesSet = new Set(answerIndex);
                // Comprueba igualdad de tamaño y contenido
                return correctIndices.size === selectedIndicesSet.size &&
                    [...correctIndices].every(idx => selectedIndicesSet.has(idx));
            default:
                return false;
        }
    },


    skipQuestion() {
        if (Store.getCurrentQuestion()?.userAnswerIndex !== null) return;
        Store.skipQuestion(); // Actualiza estado y stats en Store
        this.proceedToNextQuestion(); // Usa this.proceed...
    },

    proceedToNextQuestion() {
        const advanced = Store.advanceQuestion();
        // Necesita UI
        if (advanced && this.UI) {
            this.UI.renderQuestion(Store.getCurrentQuestion());
        } else {
            this.finish(); // Usa this.finish
        }
    },

    confirmEndExam() {
        // Usa showConfirmationModal importada (necesita i1n para claves)
        showConfirmationModal(
            'confirm_end_exam_title',
            'confirm_end_exam_body',
            'btn_confirm_end',
            'btn_cancel',
            () => this.finish() // Usa this.finish
        );
    },

    finish() {
        Timer.stop();
        Store.finalizeSkippedQuestions(); // Marca restantes como skipped

        const performanceData = this._calculatePerformance(); // Usa this._calculate...
        Store.setDetailedPerformance(performanceData);

        Data.saveAttempt(Store.getState()); // Guarda en localStorage
        // Necesita UI
        if (this.UI) this.UI.renderResults(Store.getState());
    },

    _calculatePerformance() {
        const topicPerformance = {};
        // Verifica que currentExamQuestions exista
        if (Store.state.currentExamQuestions) {
            Store.state.currentExamQuestions.forEach(q => {
                if (q.topic && q.topic.subtopic_id) {
                    const subtopicKey = q.topic.subtopic_id;
                    if (!topicPerformance[subtopicKey]) {
                        topicPerformance[subtopicKey] = {
                            correct: 0,
                            total: 0,
                            // Asume que las descripciones existen en la pregunta
                            description_es: q.topic.subtopic_description_es || q.topic.subtopic_description, // Añade fallback
                            description_en: q.topic.subtopic_description_en || q.topic.subtopic_description
                        };
                    }
                    topicPerformance[subtopicKey].total++;

                    // Comprueba corrección solo si NO es null Y NO es 'skipped'
                    if (q.userAnswerIndex !== null && q.userAnswerIndex !== 'skipped') {
                        if (this._isAnswerCorrect(q, q.userAnswerIndex)) { // Usa this._isAnswer...
                            topicPerformance[subtopicKey].correct++;
                        }
                    }
                }
            });
        }
        // Convierte a array y calcula porcentaje
        return Object.entries(topicPerformance).map(([key, value]) => ({
            id: key,
            ...value,
            percentage: (value.total > 0) ? Math.round((value.correct / value.total) * 100) : 0
        }));
    },


    resetToSetup() {
        Store.resetState();
        // Redirige a la URL base (maneja la recarga y limpieza de params)
        window.location.href = '/exam-simulator/';
    },

    // --- Review Mode Logic ---
    startReview() {
        Store.state.currentReviewIndex = 0;
        const question = Store.getQuestionForReview(0);
        // Necesita UI
        if (question && this.UI) {
            this.UI.renderReviewScreen(question, 0, Store.state.currentExamQuestions.length);
        }
    },

    navigateToReviewQuestion(index) {
        // Verifica que las preguntas existan
        if (Store.state.currentExamQuestions && index >= 0 && index < Store.state.currentExamQuestions.length) {
            Store.state.currentReviewIndex = index;
            const question = Store.getQuestionForReview(index);
            // Necesita UI
            if (this.UI) this.UI.renderReviewScreen(question, index, Store.state.currentExamQuestions.length);
        }
    },


    previousReviewQuestion() {
        const newIndex = Store.state.currentReviewIndex - 1;
        this.navigateToReviewQuestion(newIndex); // Usa this.navigateTo...
    },

    nextReviewQuestion() {
        const newIndex = Store.state.currentReviewIndex + 1;
        this.navigateToReviewQuestion(newIndex); // Usa this.navigateTo...
    },

    // Distribución por peso (necesita CONFIG)
    _distributeQuestionsByWeight(totalQuestions, categoryIds) {
        if (!this.CONFIG || !this.CONFIG.categoryWeights) {
            console.error("CONFIG o CONFIG.categoryWeights no definido para _distributeQuestionsByWeight");
            // Fallback: distribución equitativa
            const countPerCat = Math.floor(totalQuestions / categoryIds.length);
            const remainder = totalQuestions % categoryIds.length;
            const distribution = {};
            categoryIds.forEach((id, index) => {
                distribution[id] = countPerCat + (index < remainder ? 1 : 0);
            });
            return distribution;
        }

        // Lógica original de distribución por peso...
        const weights = categoryIds.map(id => this.CONFIG.categoryWeights[id] || 0);
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        const normalizedWeights = totalWeight > 0 ? weights.map(w => w / totalWeight) : weights.map(() => 1 / weights.length);

        const exactValues = normalizedWeights.map(w => totalQuestions * w);
        const baseIntegers = exactValues.map(v => Math.floor(v));

        let currentSum = baseIntegers.reduce((sum, val) => sum + val, 0);
        let difference = totalQuestions - currentSum;

        const remainders = exactValues.map((v, i) => ({
            index: i,
            remainder: v - baseIntegers[i]
        }));

        remainders.sort((a, b) => b.remainder - a.remainder); // Simplificado sort

        for (let i = 0; i < Math.abs(difference); i++) {
            if (i >= remainders.length) break;
            const categoryIndex = remainders[i].index;
            // Asegúrate de que baseIntegers[categoryIndex] exista
            if (typeof baseIntegers[categoryIndex] !== 'undefined') {
                baseIntegers[categoryIndex] += (difference > 0 ? 1 : -1);
                if (baseIntegers[categoryIndex] < 0) baseIntegers[categoryIndex] = 0;
            }
        }

        const distribution = {};
        categoryIds.forEach((id, index) => {
            distribution[id] = baseIntegers[index] || 0; // Asegura que haya un valor
        });

        // Ajuste final
        let finalSum = Object.values(distribution).reduce((s, v) => s + v, 0);
        let finalDiff = totalQuestions - finalSum;
        if (finalDiff !== 0 && categoryIds.length > 0) {
            let adjustIndex = 0;
            if (remainders.length > 0) {
                // Ajusta en el que tuvo mayor resto si falta, o menor si sobra
                adjustIndex = (finalDiff > 0) ? remainders[0].index : remainders[remainders.length - 1].index;
            }
            // Asegúrate de que categoryIds[adjustIndex] exista
            if (categoryIds[adjustIndex]) {
                distribution[categoryIds[adjustIndex]] = (distribution[categoryIds[adjustIndex]] || 0) + finalDiff;
                if (distribution[categoryIds[adjustIndex]] < 0) distribution[categoryIds[adjustIndex]] = 0;
            } else if (distribution[categoryIds[0]]) { // Fallback al primero si el índice falla
                distribution[categoryIds[0]] += finalDiff;
                if (distribution[categoryIds[0]] < 0) distribution[categoryIds[0]] = 0;
            }
        }

        return distribution;
    },

    /**
     * Navega a la flashcard anterior.
     */
    previousFlashcard() {
        const currentIndex = Store.state.currentQuestionIndex;
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            Store._setCurrentQuestionIndex(newIndex); // Actualiza índice en Store
            const question = Store.getCurrentQuestion();
            if (question && this.UI) {
                this.UI._renderFlashcard(question); // Re-renderiza con la nueva pregunta
            }
        }
    },

    /**
     * Navega a la siguiente flashcard o finaliza si es la última.
     */
    nextFlashcard() {
        const advanced = Store.advanceQuestion(); // Reutiliza advanceQuestion para cambiar el índice
        if (advanced && this.UI) {
            this.UI._renderFlashcard(Store.getCurrentQuestion()); // Renderiza la siguiente
        } else {
            // ¿Qué hacer al final? ¿Volver al setup? ¿Mostrar un mensaje?
            // Por ahora, volvamos al setup.
            this.resetToSetup();
            // O podrías mostrar un modal: showAlertModal('alert_title_info', 'flashcards_completed');
        }
    },
};