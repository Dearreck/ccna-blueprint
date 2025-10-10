// assets/js/exam-engine.js (Versión Final y Completa)

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');
    const questionCountSelect = document.getElementById('question-count-select');
    const examResultsContainer = document.getElementById('exam-results-container');
    const examReviewContainer = document.getElementById('exam-review-container');

    // --- CONFIGURACIÓN DE CATEGORÍAS ---
    const CATEGORY_CONFIG = {
        '1.0-network-fundamentals': { color: '#0d6efd', icon: 'fa-sitemap' },
        '2.0-network-access': { color: '#198754', icon: 'fa-network-wired' },
        '3.0-ip-connectivity': { color: '#6f42c1', icon: 'fa-route' },
        '4.0-ip-services': { color: '#fd7e14', icon: 'fa-cogs' },
        '5.0-security-fundamentals': { color: '#dc3545', icon: 'fa-shield-alt' },
        '6.0-automation-programmability': { color: '#0dcaf0', icon: 'fa-code' }
    };

    // --- ESTADO DEL EXAMEN ---
    let allQuestions = [];
    let currentExamQuestions = [];
    let currentQuestionIndex = 0;
    let examStats = { correct: 0, incorrect: 0, skipped: 0 };
    let examMode = 'study';
    let timerInterval = null;
    let timeRemaining = 0;

    const examCategories = [
        { id: '1.0-network-fundamentals', i18nKey: 'category_1_0' },
        { id: '2.0-network-access', i18nKey: 'category_2_0' },
        { id: '3.0-ip-connectivity', i18nKey: 'category_3_0' },
        { id: '4.0-ip-services', i18nKey: 'category_4_0' },
        { id: '5.0-security-fundamentals', i18nKey: 'category_5_0' },
        { id: '6.0-automation-programmability', i18nKey: 'category_6_0' }
    ];

    /*function loadCategories() {
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
    }*/

    async function loadAndDisplayCategories() {
        if (!categorySelectionContainer) return;
        categorySelectionContainer.innerHTML = `<p class="text-muted">Cargando preguntas...</p>`;
    
        let totalQuestionsInBank = 0;
        const allCategoryIds = examCategories.map(cat => cat.id);
        const allQuestionsData = await fetchQuestions(allCategoryIds); // Carga todas las preguntas de una vez
    
        categorySelectionContainer.innerHTML = ''; // Limpia el mensaje de "cargando"
    
        examCategories.forEach(category => {
            const questionCount = allQuestionsData.filter(q => q.category === category.id).length;
            totalQuestionsInBank += questionCount;
            
            const categoryInfo = CATEGORY_CONFIG[category.id] || { color: '#6c757d' };
    
            const categoryHTML = `
                <div class="col-12 col-md-6 mb-2">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${category.id}" id="check-${category.id}" checked>
                        <label class="form-check-label" for="check-${category.id}">
                            ${i1n.get(category.i18nKey) || category.id}
                        </label>
                        <span class="badge rounded-pill" style="background-color: ${categoryInfo.color};">${questionCount}</span>
                    </div>
                </div>`;
            categorySelectionContainer.innerHTML += categoryHTML;
        });
    
        // Opcional: Mostrar el total de preguntas en algún lugar
        console.log(`Total de preguntas en el banco: ${totalQuestionsInBank}`);
    }

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
        
        // Pre-procesamos TODAS las preguntas para añadirles su lista de opciones barajadas.
        // Esto evita errores en la revisión si el examen se termina antes de tiempo.
        currentExamQuestions.forEach(question => {
            question.shuffledOptions = shuffleArray([...question.options]);
            question.userAnswerIndex = null; // Inicializamos la respuesta del usuario
        });

        currentQuestionIndex = 0;
        examStats = { correct: 0, incorrect: 0, skipped: 0 };
        
        examSetupContainer.classList.add('d-none');
        examResultsContainer.classList.add('d-none');
        examReviewContainer.classList.add('d-none');
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
        const lang = i1n.currentLanguage || 'es';

        const categoryInfo = CATEGORY_CONFIG[question.category] || { color: '#6c757d', icon: 'fa-question-circle' };
        // Prepara el contenido del popover (si la pregunta es v2.0)
        const popoverTitle = question.topic ? `Tema ${question.topic.id}` : 'Categoría';
        const popoverContent = question.topic 
            ? `${question.topic.description_es}<br><small class="text-muted">${question.topic.subtopic_id}: ${question.topic.subtopic_description}</small>`
            : question.category;
        
        const categoryBadgeHTML = `
            <div class="category-badge" 
                 style="background-color: ${categoryInfo.color};"
                 data-bs-toggle="popover"
                 data-bs-trigger="hover focus"
                 data-bs-html="true"
                 title="${popoverTitle}"
                 data-bs-content="${popoverContent}">
                <i class="fas ${categoryInfo.icon}"></i>
            </div>`;
    
        const buttonText = examMode === 'study' ? i1n.get('btn_verify') : i1n.get('btn_next');
        const skipButtonText = i1n.get('btn_skip');
        const endButtonText = i1n.get('btn_end_exam');
        const questionText = question[`question_${lang}`] || question.question_en;
        const headerText = `${i1n.get('question_header')} ${currentQuestionIndex + 1} ${i1n.get('question_of')} ${currentExamQuestions.length}`;
        const headerHTML = `<h5 class="mb-0 d-flex align-items-center">${categoryBadgeHTML} <span class="ms-2">${headerText}</span></h5>`;
        const timerHTML = examMode === 'exam' ? `<div id="timer-display" class="fs-5 fw-bold text-primary"></div>` : '';
    
        let imageHTML = '', codeHTML = '';
        if (question.image) {
            imageHTML = `<div class="text-center my-3"><img src="../data/images/${question.image}" class="img-fluid rounded border" alt="Diagrama de la pregunta"></div>`;
        }
        if (question.code) {
            codeHTML = `<pre class="code-block"><code>${question.code}</code></pre>`;
        }
    
        let cardHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-transparent border-0 pt-4 px-4">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">${headerHTML}</h5>
                        ${timerHTML}
                    </div>
                </div>
                <div class="card-body p-4 p-md-5">
                    <p class="question-text lead">${questionText}</p>
                    ${imageHTML}
                    ${codeHTML}
                    <div id="options-container" class="mt-4">`;

        // Determina el tipo de input a usar
        const inputType = question.isMultipleChoice ? 'checkbox' : 'radio';
        
        question.shuffledOptions.forEach((option, index) => {
            const optionText = option[`text_${lang}`] || option.text_en || option.text_es;
            cardHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}">
                    <label class="form-check-label" for="option${index}">${optionText}</label>
                </div>`;
        });
        
        cardHTML += `
                    </div>
                </div>
                <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                    <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${endButtonText}</button></div>
                    <div>
                        <button id="skip-question-btn" class="btn btn-secondary me-2">${skipButtonText}</button>
                        <button id="check-answer-btn" class="btn btn-primary"></button>
                    </div>
                </div>
            </div>`;
        
        examQuestionsContainer.innerHTML = cardHTML;
    
        // --- INICIO DE LA SOLUCIÓN ---
        const isAlreadyAnsweredInStudyMode = question.userAnswerIndex !== null && examMode === 'study';
        const actionButton = document.getElementById('check-answer-btn');
    
        if (isAlreadyAnsweredInStudyMode) {
            // La pregunta ya fue respondida, así que la renderizamos en su estado final
            document.querySelectorAll('#options-container .form-check-input').forEach(input => input.disabled = true);
    
            question.shuffledOptions.forEach((option, index) => {
                const label = document.querySelector(`label[for="option${index}"]`);
                if (option.isCorrect) {
                    label.classList.add('correct');
                    if (question.userAnswerIndex === index) { // Si el usuario acertó, marcamos su selección
                        document.getElementById(`option${index}`).checked = true;
                    }
                } else if (index === question.userAnswerIndex) {
                    label.classList.add('incorrect');
                    document.getElementById(`option${index}`).checked = true;
                }
            });
    
            const explanationText = question[`explanation_${lang}`] || question.explanation_en;
            if (explanationText) {
                const explanationDiv = document.createElement('div');
                explanationDiv.className = 'alert alert-info mt-4 explanation-box';
                explanationDiv.innerHTML = `<strong>${i1n.get('explanation_label')}:</strong> ${explanationText}`;
                document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
            }
    
            actionButton.textContent = i1n.get('btn_next');
            actionButton.onclick = proceedToNextQuestion;

            // Mantenemos el botón "Omitir" deshabilitado, pero el de "Finalizar" activo
            document.getElementById('skip-question-btn').disabled = true;
        } else {
            // Comportamiento normal para preguntas no respondidas
            actionButton.textContent = buttonText;
            actionButton.onclick = handleAnswerSubmission;
        }
        // --- FIN DE LA SOLUCIÓN ---
    
        if (examMode === 'exam') updateTimerDisplay();
        document.getElementById('skip-question-btn').addEventListener('click', skipQuestion);
        document.getElementById('end-exam-btn').addEventListener('click', finishExam);

        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(function (popoverTriggerEl) {
          return new bootstrap.Popover(popoverTriggerEl);
        });
    }
    
    // Esta función necesita ser reescrita para manejar ambos casos
    function handleAnswerSubmission() {
        const selectedInputs = document.querySelectorAll('input[name="questionOptions"]:checked');
        if (selectedInputs.length === 0) {
            alert(i1n.get('alert_select_answer'));
            return;
        }
    
        // Guardamos un array de índices seleccionados
        const selectedIndices = Array.from(selectedInputs).map(input => parseInt(input.value, 10));
        
        const question = currentExamQuestions[currentQuestionIndex];
        // Guardamos el array para preguntas de selección múltiple, o solo el número para las de selección única
        question.userAnswerIndex = question.isMultipleChoice ? selectedIndices : selectedIndices[0];
    
        // Lógica de Verificación
        let isCompletelyCorrect = false;
        if (question.isMultipleChoice) {
            const correctIndices = new Set(
                question.shuffledOptions.map((opt, i) => opt.isCorrect ? i : -1).filter(i => i !== -1)
            );
            const selectedIndicesSet = new Set(selectedIndices);
            
            // La respuesta es correcta si ambos conjuntos son idénticos en tamaño y contenido
            isCompletelyCorrect = correctIndices.size === selectedIndicesSet.size && 
                                  [...correctIndices].every(i => selectedIndicesSet.has(i));
        } else {
            // Lógica original para preguntas de selección única
            const selectedOption = question.shuffledOptions[selectedIndices[0]];
            isCompletelyCorrect = selectedOption.isCorrect;
        }
    
        if (examMode === 'study') {
            // En modo estudio, mostramos la explicación y el feedback
            if (isCompletelyCorrect) {
                examStats.correct++;
            } else {
                examStats.incorrect++;
            }
            showStudyModeFeedback(); // Nueva función para encapsular el feedback visual
        } else {
            // En modo examen, solo contamos y avanzamos
            if (isCompletelyCorrect) {
                examStats.correct++;
            } else {
                examStats.incorrect++;
            }
            proceedToNextQuestion();
        }
    }

    // Nueva función para el feedback visual en Modo Estudio
    function showStudyModeFeedback() {
        const question = currentExamQuestions[currentQuestionIndex];
        const lang = i1n.currentLanguage || 'es';
    
        document.querySelectorAll('#options-container .form-check-input').forEach(input => input.disabled = true);
        
        question.shuffledOptions.forEach((option, index) => {
            const label = document.querySelector(`label[for="option${index}"]`);
            const userSelectedThis = Array.isArray(question.userAnswerIndex) 
                ? question.userAnswerIndex.includes(index)
                : question.userAnswerIndex === index;
    
            if (option.isCorrect) {
                label.classList.add('correct');
            } else if (userSelectedThis && !option.isCorrect) {
                label.classList.add('incorrect');
            }
        });
    
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
        if (explanationText) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'alert alert-info mt-4 explanation-box';
            explanationDiv.innerHTML = `<strong>${i1n.get('explanation_label')}:</strong> ${marked.parse(explanationText)}`;
            document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
        }
    
        const actionButton = document.getElementById('check-answer-btn');
        actionButton.textContent = i1n.get('btn_next');
        actionButton.onclick = proceedToNextQuestion;
        
        document.getElementById('skip-question-btn').disabled = true;
    }

    function handleStudyModeAnswer(selectedOptionInput) {
        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        question.userAnswerIndex = selectedOptionIndex;
        
        document.getElementById('skip-question-btn').disabled = true;
        document.getElementById('end-exam-btn').disabled = true;
        
        const lang = i1n.currentLanguage || 'es';
        const selectedOption = question.shuffledOptions[selectedOptionIndex];
        
        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
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
        actionButton.onclick = proceedToNextQuestion;
    }

    function handleExamModeAnswer(selectedOptionInput) {
        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        question.userAnswerIndex = selectedOptionIndex;

        const selectedOption = question.shuffledOptions[selectedOptionIndex];

        if (selectedOption.isCorrect) examStats.correct++;
        else examStats.incorrect++;
        
        proceedToNextQuestion();
    }
    
    function skipQuestion() {
        currentExamQuestions[currentQuestionIndex].userAnswerIndex = 'skipped'; 
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

        // Se recorren las preguntas desde el índice actual hasta el final.
        for (let i = currentQuestionIndex; i < currentExamQuestions.length; i++) {
            const question = currentExamQuestions[i];
            
            // Si una pregunta no ha sido respondida (su estado es null),
            // se actualiza su estado individual a 'skipped'.
            if (question.userAnswerIndex === null) {
                question.userAnswerIndex = 'skipped';
                
                // También se actualiza la estadística general para mantener la consistencia.
                examStats.skipped++; 
            }
        }
        
        saveExamAttempt();
        displayResults(examStats, currentExamQuestions.length);
    }

    function displayResults(stats, totalQuestions) {
        examResultsContainer.classList.remove('d-none');
        const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;

        document.getElementById('results-score').textContent = `${scorePercentage}%`;
        document.getElementById('results-summary').textContent = `${i1n.get('results_summary_part1')} ${stats.correct} ${i1n.get('results_summary_part2')} ${totalQuestions} ${i1n.get('results_summary_part3')}`;
        document.getElementById('results-correct').textContent = stats.correct;
        document.getElementById('results-incorrect').textContent = stats.incorrect;
        document.getElementById('results-skipped').textContent = stats.skipped;
        
        document.querySelector('#results-correct + small').textContent = i1n.get('results_correct');
        document.querySelector('#results-incorrect + small').textContent = i1n.get('results_incorrect');
        document.querySelector('#results-skipped + small').textContent = i1n.get('results_skipped');
        document.getElementById('review-exam-btn').textContent = i1n.get('btn_review');
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
        
        document.getElementById('review-exam-btn').onclick = displayExamReview;
        document.getElementById('restart-exam-btn').onclick = resetToSetup;
    }

    // Variable para el índice de la pregunta a revisar
let currentReviewIndex = 0;

function displayExamReview() {
    examResultsContainer.classList.add('d-none');
    examReviewContainer.classList.remove('d-none');
    currentReviewIndex = 0; // Inicia en la primera pregunta
    renderReviewPage(); // Llama a la nueva función de renderizado
}

function renderReviewPage() {
    if (currentReviewIndex < 0 || currentReviewIndex >= currentExamQuestions.length) {
        return; // No hace nada si el índice está fuera de los límites
    }

    const question = currentExamQuestions[currentReviewIndex];
    const lang = i1n.currentLanguage || 'es';

    const categoryInfo = CATEGORY_CONFIG[question.category] || { color: '#6c757d', icon: 'fa-question-circle' };
    
    // Prepara el contenido del popover (si la pregunta es v2.0)
    const popoverTitle = question.topic ? `Tema ${question.topic.id}` : 'Categoría';
    const popoverContent = question.topic 
        ? `${question.topic.description_es}<br><small class="text-muted">${question.topic.subtopic_id}: ${question.topic.subtopic_description}</small>`
        : question.category;
    
    const categoryBadgeHTML = `
        <div class="category-badge" 
             style="background-color: ${categoryInfo.color};"
             data-bs-toggle="popover"
             data-bs-trigger="hover focus"
             data-bs-html="true"
             title="${popoverTitle}"
             data-bs-content="${popoverContent}">
            <i class="fas ${categoryInfo.icon}"></i>
        </div>`;

    // Nueva variable para la insignia
    let skippedBadgeHTML = '';
    if (question.userAnswerIndex === 'skipped') {
        skippedBadgeHTML = `<div class="skipped-question-badge">${i1n.get('review_skipped_badge')}</div>`;
    }

    // --- INICIO DE LA SOLUCIÓN ---
    let questionNavHTML = '<div id="question-nav-container" class="d-flex flex-wrap justify-content-center gap-2 mb-4">';
    currentExamQuestions.forEach((q, index) => {
        let statusClass = 'status-skipped'; // Por defecto es omitida
    
        // Comprueba si la pregunta fue respondida
        if (q.userAnswerIndex !== null && q.userAnswerIndex !== 'skipped') {
            let isCompletelyCorrect = false;
    
            if (q.isMultipleChoice) {
                // Lógica de verificación para selección múltiple
                const correctIndices = new Set(q.shuffledOptions.map((opt, i) => opt.isCorrect ? i : -1).filter(i => i !== -1));
                const selectedIndicesSet = new Set(q.userAnswerIndex);
                isCompletelyCorrect = correctIndices.size === selectedIndicesSet.size && [...correctIndices].every(i => selectedIndicesSet.has(i));
            } else {
                // Lógica de verificación para selección única
                const selectedOption = q.shuffledOptions[q.userAnswerIndex];
                isCompletelyCorrect = selectedOption && selectedOption.isCorrect;
            }
            
            statusClass = isCompletelyCorrect ? 'status-correct' : 'status-incorrect';
        }
    
        const activeClass = (index === currentReviewIndex) ? 'active' : '';
        questionNavHTML += `<div class="question-nav-circle ${statusClass} ${activeClass}" data-index="${index}">${index + 1}</div>`;
    });
    questionNavHTML += '</div>';
    // --- FIN DE LA SOLUCIÓN ---

    const headerText = `${i1n.get('question_header')} ${currentReviewIndex + 1}/${currentExamQuestions.length}`;
    const headerHTML = `<h5 class="mb-0 d-flex align-items-center">${categoryBadgeHTML} <span class="ms-2">${headerText}:</span></h5>`;
    const questionText = question[`question_${lang}`] || question.question_en;
    const explanationText = question[`explanation_${lang}`] || question.explanation_en;

    // --- INICIO DE LA SOLUCIÓN ---
    // Añadimos la misma lógica que usamos en displayQuestion()
    let imageHTML = '', codeHTML = '';
    if (question.image) {
        imageHTML = `<div class="text-center my-3"><img src="../data/images/${question.image}" class="img-fluid rounded border" alt="Diagrama de la pregunta"></div>`;
    }
    if (question.code) {
        codeHTML = `<pre class="code-block"><code>${question.code}</code></pre>`;
    }

    let reviewHTML = `
        <div class="row">
            <div class="col-12 col-lg-8 offset-lg-2">
                <h2 class="text-center mb-4">${i1n.get('review_title')}</h2>
                ${questionNavHTML}
                <div class="card review-question-card">
                    ${skippedBadgeHTML}
                    <div class="card-header d-flex align-items-center">
                        ${headerHTML}
                    </div>
                    <div class="card-body">
                        <p class="question-text lead">${questionText}</p> ${imageHTML}
                        ${codeHTML}
    `;

    /*let reviewHTML = `
        <div class="row">
            <div class="col-12 col-lg-8 offset-lg-2">
                <h2 class="text-center mb-4">${i1n.get('review_title')}</h2>
                ${questionNavHTML}
                <div class="card review-question-card">
                    ${skippedBadgeHTML}
                    <div class="card-header">
                        <strong>${i1n.get('question_header')} ${currentReviewIndex + 1}/${currentExamQuestions.length}:</strong> ${questionText}
                    </div>
                    <div class="card-body">
                        ${imageHTML}  ${codeHTML}   `;*/

    question.shuffledOptions.forEach((option, optionIndex) => {
        const optionText = option[`text_${lang}`] || option.text_en;
        let optionClass = 'review-option';
    
        // Determina si el usuario seleccionó esta opción (funciona para ambos tipos de pregunta)
        const userSelectedThisOption = Array.isArray(question.userAnswerIndex)
            ? question.userAnswerIndex.includes(optionIndex)
            : question.userAnswerIndex === optionIndex;
    
        if (option.isCorrect) {
            // Si la opción es correcta, siempre se marca en verde
            optionClass += ' correct-answer';
        } else if (userSelectedThisOption) {
            // Si no es correcta, pero el usuario la seleccionó, se marca en rojo
            optionClass += ' incorrect-answer';
        }
        
        reviewHTML += `<div class="${optionClass}">${optionText}</div>`;
    });

    reviewHTML += `<div class="alert alert-info mt-3 explanation-box">
                            <strong>${i1n.get('explanation_label')}:</strong> 
                            ${marked.parse(explanationText)}
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-between mt-4">
                    <button id="prev-review-btn" class="btn btn-secondary" ${currentReviewIndex === 0 ? 'disabled' : ''}>&laquo; ${i1n.get('btn_previous')}</button>
                    <button id="back-to-results-btn" class="btn btn-outline-primary">${i1n.get('review_back_button')}</button>
                    <button id="next-review-btn" class="btn btn-secondary" ${currentReviewIndex === currentExamQuestions.length - 1 ? 'disabled' : ''}>${i1n.get('btn_next')} &raquo;</button>
                </div>
            </div>
        </div>`;
    
    examReviewContainer.innerHTML = reviewHTML;

    // Usamos delegación de eventos para que un solo listener maneje todos los círculos
    document.getElementById('question-nav-container').addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('question-nav-circle')) {
            const newIndex = parseInt(e.target.dataset.index, 10);
            if (newIndex !== currentReviewIndex) {
                currentReviewIndex = newIndex;
                renderReviewPage();
            }
        }
    });

    // Asignar eventos a los nuevos botones
    document.getElementById('prev-review-btn').addEventListener('click', () => {
        if (currentReviewIndex > 0) {
            currentReviewIndex--;
            renderReviewPage();
        }
    });

    document.getElementById('next-review-btn').addEventListener('click', () => {
        if (currentReviewIndex < currentExamQuestions.length - 1) {
            currentReviewIndex++;
            renderReviewPage();
        }
    });
    
    document.getElementById('back-to-results-btn').onclick = () => {
        examReviewContainer.classList.add('d-none');
        examResultsContainer.classList.remove('d-none');
    };

    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

    function resetToSetup() {
        examResultsContainer.classList.add('d-none');
        examQuestionsContainer.classList.add('d-none');
        examReviewContainer.classList.add('d-none');
        examSetupContainer.classList.remove('d-none');
        
        loadCategories();
        translateQuestionCountOptions();
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

    function init() {
        document.addEventListener('i18n-loaded', () => {
            loadAndDisplayCategories();
            translateQuestionCountOptions();
        });

        i1n.registerDynamicRenderer(() => {
            if (!examQuestionsContainer.classList.contains('d-none')) {
                displayQuestion();
            }
            else if (!examResultsContainer.classList.contains('d-none')) {
                displayResults(examStats, currentExamQuestions.length);
            }
            else if (!examReviewContainer.classList.contains('d-none')) {
                renderReviewPage();
            }
            else {
                loadCategories();
                translateQuestionCountOptions();
            }
        });

        if (startExamBtn) {
            startExamBtn.addEventListener('click', startExam);
        }
    }

    init();
});
