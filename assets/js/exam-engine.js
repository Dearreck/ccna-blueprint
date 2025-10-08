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
    let timerInterval = null; // Para el temporizador
    let timeRemaining = 0; // Tiempo restante en segundos

    // --- DEFINICIÓN DE CATEGORÍAS ---
    const examCategories = [
        { id: '1.0-network-fundamentals', name: '1.0 Network Fundamentals (20%)' },
        { id: '2.0-network-access', name: '2.0 Network Access (20%)' },
        { id: '3.0-ip-connectivity', name: '3.0 IP Connectivity (25%)' },
        { id: '4.0-ip-services', name: '4.0 IP Services (10%)' },
        { id: '5.0-security-fundamentals', name: '5.0 Security Fundamentals (15%)' },
        { id: '6.0-automation-programmability', name: '6.0 Automation & Programmability (10%)' }
    ];

    
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
            label.textContent = category.name;
            formCheckDiv.appendChild(input);
            formCheckDiv.appendChild(label);
            colDiv.appendChild(formCheckDiv);
            categorySelectionContainer.appendChild(colDiv);
        });
    }

    
    async function startExam() {
        const selectedMode = document.querySelector('input[name="examMode"]:checked').value;
        const selectedCategoryElements = document.querySelectorAll('#category-selection-container input[type="checkbox"]:checked');
        const questionCount = questionCountSelect.value;
        
        if (selectedCategoryElements.length === 0) {
            alert('Por favor, selecciona al menos una categoría.');
            return;
        }

        const selectedCategories = Array.from(selectedCategoryElements).map(el => el.value);
        examMode = selectedMode;

        try {
            allQuestions = await fetchQuestions(selectedCategories);
            if (allQuestions.length === 0) {
                alert('No se encontraron preguntas para las categorías seleccionadas.');
                return;
            }
        } catch (error) {
            console.error('Error al cargar las preguntas:', error);
            alert('Hubo un problema al cargar las preguntas.');
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
        
        // Iniciar temporizador si es Modo Examen
        if (examMode === 'exam') {
            const timePerQuestion = 90; // 90 segundos por pregunta (ajustable)
            timeRemaining = currentExamQuestions.length * timePerQuestion;
            startTimer();
        }
        
        displayQuestion();
    }

    /**
     * Muestra la pregunta actual en la interfaz, adaptándose al idioma seleccionado.
     */
    function displayQuestion() {
        if (currentQuestionIndex >= currentExamQuestions.length) {
            finishExam();
            return;
        }
    
        const question = currentExamQuestions[currentQuestionIndex];
        examQuestionsContainer.innerHTML = ''; 
    
        // Obtener el idioma actual desde el motor i18n
        const lang = i18n.currentLanguage || 'es';
    
        const questionCard = document.createElement('div');
        questionCard.className = 'card shadow-sm border-0';
        
        // Obtener textos de los botones del motor i18n
        const buttonText = examMode === 'exam' ? i18n.get('btn_next') : i18n.get('btn_verify');
        const skipButtonText = i18n.get('btn_skip');
        const endButtonText = i18n.get('btn_end_exam');
    
        // Seleccionar el texto de la pregunta en el idioma correcto (con fallback a inglés)
        const questionText = question[`question_${lang}`] || question.question_en;
    
        let cardBodyHTML = `
            <div class="card-header bg-transparent border-0 pt-4 px-4">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${i18n.get('question_header')} ${currentQuestionIndex + 1} ${i18n.get('question_of')} ${currentExamQuestions.length}</h5>
                    <div id="timer-display" class="fs-5 fw-bold text-primary"></div>
                </div>
            </div>
            <div class="card-body p-4 p-md-5">
                <p class="question-text lead">${questionText}</p>
        `;
    
        if (question.code) {
            cardBodyHTML += `<pre class="bg-dark text-light p-3 rounded"><code>${question.code}</code></pre>`;
        }
    
        if (question.image) {
             cardBodyHTML += `<div class="text-center my-3"><img src="${question.image}" class="img-fluid rounded" alt="Imagen de la pregunta"></div>`;
        }
        
        cardBodyHTML += '<div id="options-container" class="mt-4">';
        const options = shuffleArray([...question.options]); 
        question.shuffledOptions = options;
    
        options.forEach((option, index) => {
            // Seleccionar el texto de la opción en el idioma correcto (con fallback a inglés o español)
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
            cardBodyHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}">
                    <label class="form-check-label" for="option${index}">
                        ${optionText}
                    </label>
                </div>
            `;
        });
        cardBodyHTML += '</div></div>';
    
        cardBodyHTML += `
            <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                <div>
                    <button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${endButtonText}</button>
                </div>
                <div>
                    <button id="skip-question-btn" class="btn btn-secondary me-2">${skipButtonText}</button>
                    <button id="check-answer-btn" class="btn btn-primary">${buttonText}</button>
                </div>
            </div>
        `;
    
        questionCard.innerHTML = cardBodyHTML;
        examQuestionsContainer.appendChild(questionCard);
    
        document.getElementById('check-answer-btn').addEventListener('click', handleAnswerSubmission);
        document.getElementById('skip-question-btn').addEventListener('click', skipQuestion);
        document.getElementById('end-exam-btn').addEventListener('click', finishExam);
    }
    
    function handleAnswerSubmission() {
        if (examMode === 'study') {
            ();
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
            alert('Por favor, selecciona una respuesta.');
            document.getElementById('skip-question-btn').disabled = false;
            document.getElementById('end-exam-btn').disabled = false;
            return;
        }
    
        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Obtener el idioma activo desde el motor i18n
        const lang = i18n.currentLanguage || 'es';
    
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];
        
        if (selectedOption.isCorrect) {
            examStats.correct++;
        } else {
            examStats.incorrect++;
        }
        
        const allOptionInputs = document.querySelectorAll('#options-container .form-check-input');
        allOptionInputs.forEach(input => input.disabled = true);
    
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = ''; // Limpiar para redibujar
    
        question.shuffledOptions.forEach((option, index) => {
            const isSelected = (index === selectedOptionIndex);
            const feedbackClass = option.isCorrect ? 'correct' : (isSelected ? 'incorrect' : '');
            
            // 2. Usar el idioma activo para obtener el texto de la opción
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
    
            optionsContainer.innerHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}" disabled ${isSelected ? 'checked' : ''}>
                    <label class="form-check-label ${feedbackClass}" for="option${index}">
                        ${optionText}
                    </label>
                </div>`;
        });
        
        // 3. Usar el idioma activo para obtener el texto de la explicación
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
    
        if (explanationText) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'alert alert-info mt-4 explanation-box';
            explanationDiv.innerHTML = `<strong>${i18n.get('explanation_label')}:</strong> ${explanationText}`;
            document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
        }
        // --- FIN DE LA CORRECCIÓN ---
    
        const actionButton = document.getElementById('check-answer-btn');
        actionButton.textContent = i18n.get('btn_next'); // Usar i18n para el texto del botón
        actionButton.removeEventListener('click', handleAnswerSubmission);
        actionButton.addEventListener('click', proceedToNextQuestion);
    }

    function handleExamModeAnswer() {
        const selectedOptionInput = document.querySelector('input[name="questionOptions"]:checked');
        if (!selectedOptionInput) {
            alert('Debes seleccionar una respuesta para continuar.');
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
    
    /**
     * Muestra la pantalla de resultados y guarda la puntuación.
     * (Versión con el cálculo de porcentaje corregido)
     */
    function finishExam() {
        stopTimer();
        examQuestionsContainer.classList.add('d-none');
        examResultsContainer.classList.remove('d-none');
    
        const totalQuestions = currentExamQuestions.length;
        const answeredQuestions = examStats.correct + examStats.incorrect;
    
        // --- LÍNEA CORREGIDA ---
        // El porcentaje ahora se calcula sobre el TOTAL de preguntas, no solo las respondidas.
        const scorePercentage = totalQuestions > 0 ? Math.round((examStats.correct / totalQuestions) * 100) : 0;
        
        document.getElementById('results-score').textContent = `${scorePercentage}%`;
        document.getElementById('results-summary').textContent = `Has respondido ${answeredQuestions} de ${totalQuestions} preguntas.`;
        document.getElementById('results-correct').textContent = examStats.correct;
        document.getElementById('results-incorrect').textContent = examStats.incorrect;
        document.getElementById('results-skipped').textContent = examStats.skipped;
    
        const resultsScoreElement = document.getElementById('results-score');
        resultsScoreElement.classList.remove('text-success', 'text-danger');
        // El umbral de aprobación para el CCNA suele ser ~82.5%, usaremos 85% como referencia.
        if (scorePercentage >= 85) {
            resultsScoreElement.classList.add('text-success');
            document.getElementById('results-title').textContent = '¡Excelente Trabajo!';
        } else {
            resultsScoreElement.classList.add('text-danger');
            document.getElementById('results-title').textContent = '¡Sigue Practicando!';
        }
        
        saveExamAttempt();
    
        document.getElementById('restart-exam-btn').addEventListener('click', startExam);
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

    // --- LÓGICA DEL TEMPORIZADOR ---
    function startTimer() {
        stopTimer(); // Asegurarse de que no haya otros timers corriendo
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
    
    // --- FUNCIONES DE UTILIDAD ---
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

    function init() {
        loadCategories();
        if (startExamBtn) {
            startExamBtn.addEventListener('click', startExam);
        }
    }

    init();
});
