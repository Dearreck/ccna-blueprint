document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');
    const questionCountSelect = document.getElementById('question-count-select');
    const examResultsContainer = document.getElementById('exam-results-container');

    // --- ESTADO DEL EXAMEN ---
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
     * Carga las categorías del examen usando el motor de traducción.
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
            label.textContent = i18n.get(category.i18nKey) || category.id;
            
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
        const select = document.getElementById('question-count-select');
        if (!select) return;

        Array.from(select.options).forEach(option => {
            const key = `q_count_${option.value}`;
            const translation = i18n.get(key);
            if (translation !== key) {
                option.textContent = translation;
            }
        });
    }
    
    async function startExam() {
        const selectedMode = document.querySelector('input[name="examMode"]:checked').value;
        const selectedCategoryElements = document.querySelectorAll('#category-selection-container input[type="checkbox"]:checked');
        const questionCount = questionCountSelect.value;
        
        if (selectedCategoryElements.length === 0) {
            alert(i18n.get('alert_select_category'));
            return;
        }

        const selectedCategories = Array.from(selectedCategoryElements).map(el => el.value);
        examMode = selectedMode;

        try {
            allQuestions = await fetchQuestions(selectedCategories);
            if (allQuestions.length === 0) {
                alert(i18n.get('alert_no_questions'));
                return;
            }
        } catch (error) {
            console.error('Error al cargar las preguntas:', error);
            alert(i18n.get('alert_load_error'));
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

    function displayQuestion() {
        if (currentQuestionIndex >= currentExamQuestions.length) {
            finishExam();
            return;
        }

        const question = currentExamQuestions[currentQuestionIndex];
        examQuestionsContainer.innerHTML = '';
        const lang = i18n.currentLanguage || 'es';

        const questionCard = document.createElement('div');
        questionCard.className = 'card shadow-sm border-0';
        
        const buttonText = examMode === 'exam' ? i18n.get('btn_next') : i18n.get('btn_verify');
        const skipButtonText = i18n.get('btn_skip');
        const endButtonText = i18n.get('btn_end_exam');
        const questionText = question[`question_${lang}`] || question.question_en;

        let cardBodyHTML = `
            <div class="card-header bg-transparent border-0 pt-4 px-4">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${i18n.get('question_header')} ${currentQuestionIndex + 1} ${i18n.get('question_of')} ${currentExamQuestions.length}</h5>
                    <div id="timer-display" class="fs-5 fw-bold text-primary"></div>
                </div>
            </div>
            <div class="card-body p-4 p-md-5">
                <p class="question-text lead">${questionText}</p>`;

        if (question.code) cardBodyHTML += `<pre class="bg-dark text-light p-3 rounded"><code>${question.code}</code></pre>`;
        if (question.image) cardBodyHTML += `<div class="text-center my-3"><img src="${question.image}" class="img-fluid rounded" alt="Imagen de la pregunta"></div>`;
        
        cardBodyHTML += '<div id="options-container" class="mt-4">';
        const options = shuffleArray([...question.options]); 
        question.shuffledOptions = options;

        options.forEach((option, index) => {
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
            cardBodyHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}">
                    <label class="form-check-label" for="option${index}">${optionText}</label>
                </div>`;
        });
        cardBodyHTML += '</div></div>';

        cardBodyHTML += `
            <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${endButtonText}</button></div>
                <div>
                    <button id="skip-question-btn" class="btn btn-secondary me-2">${skipButtonText}</button>
                    <button id="check-answer-btn" class="btn btn-primary">${buttonText}</button>
                </div>
            </div>`;

        questionCard.innerHTML = cardBodyHTML;
        examQuestionsContainer.appendChild(questionCard);

        document.getElementById('check-answer-btn').addEventListener('click', handleAnswerSubmission);
        document.getElementById('skip-question-btn').addEventListener('click', skipQuestion);
        document.getElementById('end-exam-btn').addEventListener('click', finishExam);
    }
    
    function handleAnswerSubmission() {
        if (examMode === 'study') {
            handleStudyModeAnswer();
        } else {
            handleExamModeAnswer();
        }
    }

    function handleStudyModeAnswer() {
        document.getElementById('skip-question-btn').disabled = true;
        document.getElementById('end-exam-btn').disabled = true;
        
        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionInput = document.querySelector('input[name="questionOptions"]:checked');

        if (!selectedOptionInput) {
            alert(i18n.get('alert_select_answer'));
            document.getElementById('skip-question-btn').disabled = false;
            document.getElementById('end-exam-btn').disabled = false;
            return;
        }

        const lang = i18n.currentLanguage || 'es';
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];
        
        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
        const allOptionInputs = document.querySelectorAll('#options-container .form-check-input');
        allOptionInputs.forEach(input => input.disabled = true);
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';
        question.shuffledOptions.forEach((option, index) => {
            const isSelected = (index === selectedOptionIndex);
            const feedbackClass = option.isCorrect ? 'correct' : (isSelected ? 'incorrect' : '');
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
            optionsContainer.innerHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}" disabled ${isSelected ? 'checked' : ''}>
                    <label class="form-check-label ${feedbackClass}" for="option${index}">${optionText}</label>
                </div>`;
        });
        
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
        if (explanationText) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'alert alert-info mt-4 explanation-box';
            explanationDiv.innerHTML = `<strong>${i18n.get('explanation_label')}:</strong> ${explanationText}`;
            document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
        }

        const actionButton = document.getElementById('check-answer-btn');
        actionButton.textContent = i18n.get('btn_next');
        actionButton.removeEventListener('click', handleAnswerSubmission);
        actionButton.addEventListener('click', proceedToNextQuestion);
    }

    function handleExamModeAnswer() {
        const selectedOptionInput = document.querySelector('input[name="questionOptions"]:checked');
        if (!selectedOptionInput) {
            alert(i18n.get('alert_select_answer'));
            return;
        }

        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];

        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
        proceedToNextQuestion();
    }
    
    function skipQuestion() {
        examStats.skipped++;
        proceedToNextQuestion();
    }
    
    function proceedToNextQuestion() {
        currentQuestionIndex++;
        displayQuestion();
    }
    
    function finishExam() {
        stopTimer();
        examQuestionsContainer.classList.add('d-none');
        window.location.hash = 'results';
        
        saveExamAttempt();
        // Llamamos a la nueva función para mostrar los resultados
        displayResults(examStats, currentExamQuestions.length);
    }

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
    
    async function fetchQuestions(categories) {
        const fetchPromises = categories.map(category => {
            const path = `../data/${category}.json`;
            return fetch(path).then(response => {
                if (!response.ok) throw new Error(`Fallo al cargar: ${path}`);
                return response.json();
            });
        });
        const results = await Promise.allSettled(fetchPromises);
        const successfulQuestions = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') successfulQuestions.push(...result.value);
            else console.warn(`Se omitió un archivo: ${result.reason.message}`);
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

    // Función para obtener el último intento guardado
    function getLastExamAttempt() {
        try {
            const history = JSON.parse(localStorage.getItem('CCNA_examHistory')) || [];
            return history.length > 0 ? history[history.length - 1] : null;
        } catch (e) {
            console.error("No se pudo leer el historial de exámenes.", e);
            return null;
        }
    }

    // Función para mostrar los resultados
    function displayResults(stats, totalQuestions) {
        examResultsContainer.classList.remove('d-none');
        const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;

        document.getElementById('results-score').textContent = `${scorePercentage}%`;
        document.getElementById('results-summary').textContent = `${i18n.get('results_summary_part1')} ${stats.correct} ${i18n.get('results_summary_part2')} ${totalQuestions} ${i18n.get('results_summary_part3')}`;
        document.getElementById('results-correct').textContent = stats.correct;
        document.getElementById('results-incorrect').textContent = stats.incorrect;
        document.getElementById('results-skipped').textContent = stats.skipped;
        
        document.querySelector('#results-correct + small').textContent = i18n.get('results_correct');
        document.querySelector('#results-incorrect + small').textContent = i18n.get('results_incorrect');
        document.querySelector('#results-skipped + small').textContent = i18n.get('results_skipped');
        document.getElementById('restart-exam-btn').textContent = i18n.get('btn_restart');
        document.querySelector('#exam-results-container a').textContent = i18n.get('btn_back_home');

        const resultsScoreElement = document.getElementById('results-score');
        resultsScoreElement.classList.remove('text-success', 'text-warning', 'text-danger'); // Limpia clases previas
        if (scorePercentage >= 85) {
            resultsScoreElement.classList.add('text-success');
            document.getElementById('results-title').textContent = i18n.get('results_title_excellent');
        } else {
            resultsScoreElement.classList.add('text-danger');
            document.getElementById('results-title').textContent = i18n.get('results_title_practice');
        }
        
        // El botón de reiniciar ahora debe limpiar el hash
        const restartBtn = document.getElementById('restart-exam-btn');
        restartBtn.addEventListener('click', () => {
            window.location.hash = ''; // Limpia el hash
            window.location.reload(); // Recarga para ir a la configuración
        });
    }

    function init() {
        // Disparado por un evento personalizado desde i18n.js para asegurar que las traducciones estén listas.
        document.addEventListener('i18n-loaded', () => {
            loadCategories();
            translateQuestionCountOptions();

            // Revisa si la URL indica que debemos mostrar los resultados
            if (window.location.hash === '#results') {
                // Intentamos recuperar el último resultado de localStorage
                const lastAttempt = getLastExamAttempt();
                if (lastAttempt) {
                    // Ocultamos la configuración y mostramos los resultados con los datos guardados
                    examSetupContainer.classList.add('d-none');
                    displayResults(lastAttempt.stats, lastAttempt.totalQuestions);
                }
            }
        });

        if (startExamBtn) {
            startExamBtn.addEventListener('click', startExam);
        }
    }

    init();
});
