// exam-simulator/modules/store.js

export const Store = { // <<<--- AÑADIDO 'export'
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
        // Verifica que la pregunta exista en el array antes de intentar accederla
        if (this.state.currentExamQuestions && this.state.currentExamQuestions[index]) {
            this.state.currentExamQuestions[index].userAnswerIndex = answerIndex;
        } else {
            console.warn(`Intento de establecer respuesta para índice de pregunta inválido: ${index}`);
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
        if (this.state.currentExamQuestions && this.state.currentQuestionIndex < this.state.currentExamQuestions.length - 1) {
            this._setCurrentQuestionIndex(this.state.currentQuestionIndex + 1);
            return true; // Advanced successfully
        }
        return false; // Reached the end or no questions
    },


    finalizeSkippedQuestions() {
        if (this.state.currentExamQuestions) {
            this.state.currentExamQuestions.forEach((q, index) => {
                // Solo actualiza si la respuesta es estrictamente null (aún no tocada)
                if (q.userAnswerIndex === null) {
                    this._setUserAnswer(index, 'skipped'); // Marca como omitida
                    // Solo actualiza las estadísticas si realmente se está marcando como omitida AHORA
                    // Si ya fue omitida con el botón, las estadísticas ya se actualizaron.
                    // (Esta lógica asume que el botón skip llama a Store.skipQuestion que actualiza stats)
                    // Para simplificar, asumimos que solo actualizamos el estado aquí, no las stats.
                    // Las stats se deben actualizar en el momento de la acción (botón skip o fin del tiempo).
                    // Si el fin del tiempo es lo que causa esto, deberíamos llamar a _updateStats aquí.
                    // Vamos a añadir la actualización de stats aquí para el caso de fin de tiempo.
                    this._updateStats('skipped');
                }
            });
        }
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
        // Añadir comprobación para evitar errores si no hay preguntas
        if (this.state.currentExamQuestions && this.state.currentExamQuestions.length > 0) {
            return this.state.currentExamQuestions[this.state.currentQuestionIndex];
        }
        return null; // Devuelve null si no hay preguntas o el índice es inválido
    },

    getQuestionForReview(index) {
        // Añadir comprobación
        if (this.state.currentExamQuestions && index >= 0 && index < this.state.currentExamQuestions.length) {
            return this.state.currentExamQuestions[index];
        }
        return null; // Devuelve null si el índice es inválido
    },
    getState() {
        // Devuelve una copia superficial. Considera una copia profunda si el estado es complejo.
        return { ...this.state };
    }
};
