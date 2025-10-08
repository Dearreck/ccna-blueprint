// assets/js/exam-engine.js (Versión SPA Refactorizada)

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');
    const questionCountSelect = document.getElementById('question-count-select');
    const examResultsContainer = document.getElementById('exam-results-container');

    // --- ESTADO DEL EXAMEN (Ahora persiste mientras no se recargue la página) ---
    let allQuestions = [];
    let currentExamQuestions = [];
    let currentQuestionIndex = 0;
    let examStats = { correct: 0, incorrect: 0, skipped: 0 };
    let examMode = 'study';
    let timerInterval = null;
    let timeRemaining = 0;

    // --- DEFINICIÓN DE CATEGORÍAS ---
    const examCategories = [
        { id: '1.0-network-fundamentals', i18nKey: 'category_1_0' },
        { id: '2.0-network-access', i18nKey: 'category_2_0' },
        { id: '3.0-ip-connectivity', i18nKey: 'category_3_0' },
        { id: '4.0-ip-services', i18nKey: 'category_4_0' },
        { id: '5.0-security-fundamentals', i18nKey: 'category_5_0' },
        { id: '6.0-automation-programmability', i18nKey: 'category_6_0' }
    ];

    /**
     * Carga las categorías del examen en la pantalla de configuración.
     */
    function loadCategories() {
        if (!categorySelectionContainer) return;
        categorySelectionContainer.innerHTML = '';
        examCategories.forEach(category => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col-12 col-md-6 mb-2';
            const formCheckDiv = document.createElement('div');
            formCheckDiv.className = 'form-check';
            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.value = category.id;
            input.id = `check-${category.id}`;
            input.checked = true;
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `check-${category.id}`;
            label.textContent = i1n.get(category.i18nKey) || category.id;
            
            formCheckDiv.appendChild(input);
            formCheckDiv.appendChild(label);
            colDiv.appendChild(formCheckDiv);
            categorySelectionContainer.appendChild(colDiv);
        });
    }

    /**
     * Traduce las opciones del selector de cantidad de preguntas.
     */
    function translateQuestionCountOptions() {
        if (!questionCountSelect) return;
        Array.from(questionCountSelect.options).forEach(option => {
            const key = `q_count_${option.value}`;
            const translation = i1n.get(key);
            if (translation !== key) {
                option.textContent = translation;
            }
        });
    }
    
    /**
     * Inicia un nuevo examen, cargando las preguntas y reseteando el estado.
     */
    async function startExam() {
        const selectedMode = document.querySelector('input[name="examMode"]:checked').value;
        const selectedCategoryElements = document.querySelectorAll('#category-selection-container input[type="checkbox"]:checked');
        const questionCount = questionCountSelect.value;
        
        if (selectedCategoryElements.length === 0) {
            alert(i1n.get('alert_select_category'));
            return;
        }

        const selectedCategories = Array.from(selectedCategoryElements).map(el => el.value);
        examMode = selectedMode;

        try {
            allQuestions = await fetchQuestions(selectedCategories);
            if (allQuestions.length === 0) {
                alert(i1n.get('alert_no_questions'));
                return;
            }
        } catch (error) {
            console.error('Error al cargar las preguntas:', error);
            alert(i1n.get('alert_load_error'));
            return;
        }

        currentExamQuestions = shuffleArray([...allQuestions]);
        if (questionCount !== 'all') {
            currentExamQuestions = currentExamQuestions.slice(0, parseInt(questionCount));
        }
        
        currentQuestionIndex = 0;
        examStats = { correct: 0, incorrect: 0, skipped: 0 };
        
        examSetupContainer.classList.add('d-none');
        examResultsContainer.classList.add('d-none');
        examQuestionsContainer.classList.remove('d-none');
        
        if (examMode === 'exam') {
            const timePerQuestion = 90;
            timeRemaining = currentExamQuestions.length * timePerQuestion;
            startTimer();
        }
        
        displayQuestion();
    }

    /**
     * Muestra la pregunta actual en la pantalla. Esta función ahora también
     * se usa para re-renderizar la pregunta cuando cambia el idioma.
     */
    function displayQuestion() {
        if (currentQuestionIndex >= currentExamQuestions.length) {
            finishExam();
            return;
        }

        const question = currentExamQuestions[currentQuestionIndex];
        const lang = i1n.currentLanguage || 'es';

        // Prepara los textos traducidos
        const buttonText = examMode === 'study' ? i1n.get('btn_verify') : i1n.get('btn_next');
        const skipButtonText = i1n.get('btn_skip');
        const endButtonText = i1n.get('btn_end_exam');
        const questionText = question[`question_${lang}`] || question.question_en;
        const headerText = `${i1n.get('question_header')} ${currentQuestionIndex + 1} ${i1n.get('question_of')} ${currentExamQuestions.length}`;

        // 1. Crea el HTML del temporizador SOLO si estamos en modo examen.
        const timerHTML = examMode === 'exam' 
            ? `<div id="timer-display" class="fs-5 fw-bold text-primary"></div>` 
            : ''; // Si no, crea una cadena vacía.
    
        // 2. Construye el HTML principal usando la variable timerHTML.
        let cardBodyHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-transparent border-0 pt-4 px-4">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">${headerText}</h5>
                        ${timerHTML} 
                    </div>
                </div>
                <div class="card-body p-4 p-md-5">
                    <p class="question-text lead">${questionText}</p>
                    ${question.code ? `<pre class="bg-dark text-light p-3 rounded"><code>${question.code}</code></pre>` : ''}
                    ${question.image ? `<div class="text-center my-3"><img src="${question.image}" class="img-fluid rounded" alt="Imagen de la pregunta"></div>` : ''}
                    <div id="options-container" class="mt-4">`;

        // Si las opciones no han sido barajadas para esta pregunta, se barajan una vez.
        if (!question.shuffledOptions) {
            question.shuffledOptions = shuffleArray([...question.options]);
        }
        
        question.shuffledOptions.forEach((option, index) => {
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
            cardBodyHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}">
                    <label class="form-check-label" for="option${index}">${optionText}</label>
                </div>`;
        });
        
        cardBodyHTML += `</div></div>
            <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${endButtonText}</button></div>
                <div>
                    <button id="skip-question-btn" class="btn btn-secondary me-2">${skipButtonText}</button>
                    <button id="check-answer-btn" class="btn btn-primary">${buttonText}</button>
                </div>
            </div></div>`;
        
        examQuestionsContainer.innerHTML = cardBodyHTML;
        
        // Solo actualiza el texto del timer si estamos en modo examen.
        if (examMode === 'exam') {
            updateTimerDisplay();
        }

        // Asigna los event listeners a los nuevos botones
        document.getElementById('check-answer-btn').addEventListener('click', handleAnswerSubmission);
        document.getElementById('skip-question-btn').addEventListener('click', skipQuestion);
        document.getElementById('end-exam-btn').addEventListener('click', finishExam);
    }
    
    /**
     * Maneja el envío de una respuesta, diferenciando entre modo estudio y examen.
     */
    function handleAnswerSubmission() {
        const selectedOptionInput = document.querySelector('input[name="questionOptions"]:checked');
        if (!selectedOptionInput) {
            alert(i1n.get('alert_select_answer'));
            return;
        }

        if (examMode === 'study') {
            handleStudyModeAnswer(selectedOptionInput);
        } else {
            handleExamModeAnswer(selectedOptionInput);
        }
    }

    /**
     * Lógica para el modo estudio: muestra feedback inmediato.
     */
    function handleStudyModeAnswer(selectedOptionInput) {
        document.getElementById('skip-question-btn').disabled = true;
        document.getElementById('end-exam-btn').disabled = true;
        
        const question = currentExamQuestions[currentQuestionIndex];
        const lang = i1n.currentLanguage || 'es';
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];
        
        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
        // Deshabilita y colorea las opciones
        document.querySelectorAll('#options-container .form-check-input').forEach(input => input.disabled = true);
        question.shuffledOptions.forEach((option, index) => {
            const label = document.querySelector(`label[for="option${index}"]`);
            if (option.isCorrect) {
                label.classList.add('correct');
            } else if (index === selectedOptionIndex) {
                label.classList.add('incorrect');
            }
        });
        
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
        if (explanationText) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'alert alert-info mt-4 explanation-box';
            explanationDiv.innerHTML = `<strong>${i1n.get('explanation_label')}:</strong> ${explanationText}`;
            document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
        }

        const actionButton = document.getElementById('check-answer-btn');
        actionButton.textContent = i1n.get('btn_next');
        actionButton.onclick = proceedToNextQuestion; // Cambia la acción del botón
    }

    /**
     * Lógica para el modo examen: registra la respuesta y avanza.
     */
    function handleExamModeAnswer(selectedOptionInput) {
        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];

        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
        proceedToNextQuestion();
    }
    
    /**
     * Salta la pregunta actual.
     */
    function skipQuestion() {
        examStats.skipped++;
        proceedToNextQuestion();
    }
    
    /**
     * Avanza a la siguiente pregunta del examen.
     */
    function proceedToNextQuestion() {
        currentQuestionIndex++;
        displayQuestion();
    }
    
    /**
     * Finaliza el examen y muestra la pantalla de resultados.
     */
    function finishExam() {
        stopTimer();
        examQuestionsContainer.classList.add('d-none');
        examResultsContainer.classList.remove('d-none');

        saveExamAttempt();
        displayResults(examStats, currentExamQuestions.length);
    }

    /**
     * Muestra la pantalla de resultados. Se usa al finalizar y al re-renderizar.
     */
    function displayResults(stats, totalQuestions) {
        examResultsContainer.classList.remove('d-none'); // Asegura que sea visible
        const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;

        document.getElementById('results-score').textContent = `${scorePercentage}%`;
        document.getElementById('results-summary').textContent = `${i1n.get('results_summary_part1')} ${stats.correct} ${i1n.get('results_summary_part2')} ${totalQuestions} ${i1n.get('results_summary_part3')}`;
        document.getElementById('results-correct').textContent = stats.correct;
        document.getElementById('results-incorrect').textContent = stats.incorrect;
        document.getElementById('results-skipped').textContent = stats.skipped;
        
        document.querySelector('#results-correct + small').textContent = i1n.get('results_correct');
        document.querySelector('#results-incorrect + small').textContent = i1n.get('results_incorrect');
        document.querySelector('#results-skipped + small').textContent = i1n.get('results_skipped');
        document.getElementById('restart-exam-btn').textContent = i1n.get('btn_restart');
        document.querySelector('#exam-results-container a').textContent = i1n.get('btn_back_home');

        const resultsScoreElement = document.getElementById('results-score');
        resultsScoreElement.classList.remove('text-success', 'text-danger');
        if (scorePercentage >= 85) {
            resultsScoreElement.classList.add('text-success');
            document.getElementById('results-title').textContent = i1n.get('results_title_excellent');
        } else {
            resultsScoreElement.classList.add('text-danger');
            document.getElementById('results-title').textContent = i1n.get('results_title_practice');
        }
        
        document.getElementById('restart-exam-btn').onclick = resetToSetup;
    }

    /**
     * NUEVO: Resetea la UI a la pantalla de configuración inicial.
     */
    function resetToSetup() {
        examResultsContainer.classList.add('d-none');
        examQuestionsContainer.classList.add('d-none');
        examSetupContainer.classList.remove('d-none');
        // Vuelve a traducir los elementos de la configuración por si el idioma cambió
        loadCategories();
        translateQuestionCountOptions();
    }

    /**
     * Guarda el intento actual en localStorage.
     */
    function saveExamAttempt() {
        const attempt = {
            date: new Date().toISOString(),
            stats: examStats,
            totalQuestions: currentExamQuestions.length,
            mode: examMode
        };
        try {
            const history = JSON.parse(localStorage.getItem('CCNA_examHistory')) || [];
            history.push(attempt);
            localStorage.setItem('CCNA_examHistory', JSON.stringify(history));
        } catch (e) { console.error("No se pudo guardar el resultado del examen.", e); }
    }

    // --- LÓGICA DEL TEMPORIZADOR ---
    function startTimer() {
        stopTimer();
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                finishExam();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // --- LÓGICA DE CARGA DE DATOS ---
    async function fetchQuestions(categories) {
        const fetchPromises = categories.map(category => {
            const path = `../data/${category}.json`;
            return fetch(path).then(response => {
                if (!response.ok) throw new Error(`Fallo al cargar: ${path}`);
                // Clave: Asegurarse de que el archivo no esté vacío antes de parsear
                return response.text().then(text => text ? JSON.parse(text) : []);
            });
        });

        const results = await Promise.allSettled(fetchPromises);
        const successfulQuestions = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                successfulQuestions.push(...result.value);
            } else if (result.status === 'rejected') {
                console.warn(`Se omitió un archivo: ${result.reason.message}`);
            }
        });
        return successfulQuestions.flat();
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Función de inicialización principal.
     */
    function init() {
        // Espera a que las traducciones iniciales estén listas
        document.addEventListener('i18n-loaded', () => {
            loadCategories();
            translateQuestionCountOptions();
        });

        // MODIFICADO: Se registra una función que i1n llamará CADA VEZ que el idioma cambie.
        // Esto es el corazón de la funcionalidad SPA.
        i1n.registerDynamicRenderer(() => {
            // Si estamos viendo una pregunta, la volvemos a mostrar para traducirla.
            if (!examQuestionsContainer.classList.contains('d-none')) {
                displayQuestion();
            }
            // Si estamos en la pantalla de resultados, la volvemos a mostrar.
            else if (!examResultsContainer.classList.contains('d-none')) {
                displayResults(examStats, currentExamQuestions.length);
            }
            // Si estamos en la configuración, refrescamos sus textos.
            else {
                loadCategories();
                translateQuestionCountOptions();
            }
        });

        if (startExamBtn) {
            startExamBtn.addEventListener('click', startExam);
        }
    }

    // Inicia todo el motor.
    init();
});
