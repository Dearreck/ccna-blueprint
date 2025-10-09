document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const examOptions = document.getElementById('exam-options');
    const questionContainer = document.getElementById('question-container');
    const resultsContainer = document.getElementById('results-container');
    const reviewContainer = document.getElementById('review-container');

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const explanationText = document.getElementById('explanation');
    const progressText = document.getElementById('progress-text');
    const timerElement = document.getElementById('timer');

    const resultsSummaryBody = document.getElementById('results-summary-body');
    
    const reviewQuestionText = document.getElementById('review-question-text');
    const reviewOptionsContainer = document.getElementById('review-options-container');
    const reviewExplanation = document.getElementById('review-explanation');
    const reviewProgressText = document.getElementById('review-progress-text');

    // Botones
    const startExamBtn = document.getElementById('start-exam-btn');
    const nextButton = document.getElementById('next-btn');
    const prevButton = document.getElementById('prev-btn');
    const reviewExamBtn = document.getElementById('review-exam-btn');
    const prevReviewButton = document.getElementById('prev-review-btn');
    const nextReviewButton = document.getElementById('next-review-btn');
    const backToResultsButton = document.getElementById('back-to-results-btn');

    // --- ESTADO DEL EXAMEN ---
    let questions = [];
    let currentQuestionIndex = 0;
    let currentReviewIndex = 0;
    let examMode = 'study';
    let examTimer;

    // --- LÓGICA DEL EXAMEN ---
    async function startExam(category, lang) {
        const filePath = `data/${category}_${lang}.json`;
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const data = await response.json();
            if (!data || data.length === 0) throw new Error('No questions found in file');

            // --- MODIFICACIÓN 1 de 5: Inicialización del estado de cada pregunta ---
            questions = data.map(q => ({
                ...q,
                userStatus: undefined, // 'correct', 'incorrect', 'skipped'
                userChoice: null
            }));

            currentQuestionIndex = 0;
            examOptions.style.display = 'none';
            resultsContainer.style.display = 'none';
            reviewContainer.style.display = 'none';
            questionContainer.style.display = 'block';

            if (examMode === 'exam') {
                startTimer(questions.length * 60);
            }

            showQuestion(currentQuestionIndex);
        } catch (error) {
            console.error('Error loading questions:', error);
            alert('Error al cargar las preguntas. Verifique que el archivo exista y no esté vacío.');
        }
    }

    function showQuestion(index) {
        const question = questions[index];
        questionText.textContent = question.question;
        optionsContainer.innerHTML = '';
        explanationContainer.style.display = 'none';

        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'list-group-item list-group-item-action';
            button.textContent = option.text;
            button.dataset.option = option.id;
            
            if (question.userChoice === option.id) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => {
                if (question.userChoice === null) {
                    Array.from(optionsContainer.children).forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    checkAnswer(option.id, button);
                }
            });
            optionsContainer.appendChild(button);
        });

        if (question.userStatus && question.userStatus !== 'skipped') {
            Array.from(optionsContainer.children).forEach(btn => {
                btn.disabled = true;
                if (examMode === 'study') {
                    const optionId = btn.dataset.option;
                    if (optionId === question.answer) btn.classList.add('correct');
                    else if (optionId === question.userChoice) btn.classList.add('incorrect');
                }
            });
            if (examMode === 'study') {
                explanationText.textContent = question.explanation;
                explanationContainer.style.display = 'block';
            }
        }
        
        updateNavigation();
        updateProgress();
    }

    function checkAnswer(selectedOption) {
        const currentQuestion = questions[currentQuestionIndex];
        if (currentQuestion.userStatus) return; 

        const isCorrect = selectedOption === currentQuestion.answer;
        
        // --- MODIFICACIÓN 2 de 5: Almacenar estado y elección del usuario ---
        currentQuestion.userStatus = isCorrect ? 'correct' : 'incorrect';
        currentQuestion.userChoice = selectedOption;

        if (examMode === 'study') {
            Array.from(optionsContainer.children).forEach(btn => {
                btn.disabled = true;
                const optionId = btn.dataset.option;
                if (optionId === currentQuestion.answer) btn.classList.add('correct');
                else if (optionId === selectedOption) btn.classList.add('incorrect');
            });
            explanationText.textContent = currentQuestion.explanation;
            explanationContainer.style.display = 'block';
        }
    }

    function showResults() {
        questionContainer.style.display = 'none';
        if (examTimer) clearInterval(examTimer);
        timerElement.style.display = 'none';

        // --- MODIFICACIÓN 3 de 5: Lógica de conteo precisa y robusta ---
        const correctAnswers = questions.filter(q => q.userStatus === 'correct').length;
        const incorrectAnswers = questions.filter(q => q.userStatus === 'incorrect').length;
        const skippedQuestions = questions.filter(q => q.userStatus === 'skipped' || q.userStatus === undefined).length;

        const totalQuestions = questions.length;
        const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        const passed = score >= 85;

        updateResultsUI(totalQuestions, correctAnswers, incorrectAnswers, skippedQuestions, score, passed);
        updateResultsSummary();
        
        resultsContainer.style.display = 'block';
    }
    
    function updateResultsUI(total, correct, incorrect, skipped, score, passed) {
        document.getElementById('total-questions').textContent = total;
        document.getElementById('correct-answers').textContent = correct;
        document.getElementById('incorrect-answers').textContent = incorrect;
        document.getElementById('skipped-questions').textContent = skipped;
        document.getElementById('score').textContent = `${score.toFixed(2)}%`;
        const statusElement = document.getElementById('status');
        statusElement.textContent = passed ? 'Aprobado' : 'Reprobado';
        statusElement.className = `status ${passed ? 'status-passed' : 'status-failed'}`;
    }

    function updateResultsSummary() {
        resultsSummaryBody.innerHTML = '';
        questions.forEach((question, index) => {
            const row = document.createElement('tr');
            let statusIcon = '';
            switch (question.userStatus) {
                case 'correct': statusIcon = '<i class="fas fa-check-circle text-success"></i> Correcta'; break;
                case 'incorrect': statusIcon = '<i class="fas fa-times-circle text-danger"></i> Incorrecta'; break;
                default: statusIcon = '<i class="fas fa-minus-circle text-warning"></i> Omitida'; break;
            }
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${question.question.substring(0, 60)}...</td>
                <td>${statusIcon}</td>
                <td><button class="btn btn-sm btn-outline-primary review-question-btn" data-index="${index}">Revisar</button></td>
            `;
            resultsSummaryBody.appendChild(row);
        });
    }

    function startReview(index = 0) {
        resultsContainer.style.display = 'none';
        reviewContainer.style.display = 'block';
        currentReviewIndex = index;
        showReviewQuestion(currentReviewIndex);
    }

    function showReviewQuestion(index) {
        const question = questions[index];
        reviewQuestionText.textContent = question.question;
        reviewOptionsContainer.innerHTML = '';

        question.options.forEach(option => {
            const div = document.createElement('div');
            div.className = 'list-group-item';
            div.textContent = option.text;

            if (option.id === question.answer) div.classList.add('correct');
            else if (option.id === question.userChoice) div.classList.add('incorrect');
            
            reviewOptionsContainer.appendChild(div);
        });

        reviewExplanation.textContent = `Explicación: ${question.explanation}`;
        updateReviewNavigation();
        reviewProgressText.textContent = `Revisando Pregunta ${index + 1} de ${questions.length}`;
    }

    function updateReviewNavigation() {
        prevReviewButton.disabled = currentReviewIndex === 0;
        nextReviewButton.disabled = currentReviewIndex === questions.length - 1;
    }

    function updateNavigation() {
        prevButton.disabled = currentQuestionIndex === 0;
        nextButton.textContent = (currentQuestionIndex === questions.length - 1) ? 'Finalizar' : 'Siguiente';
    }

    function updateProgress() {
        progressText.textContent = `Pregunta ${currentQuestionIndex + 1} de ${questions.length}`;
    }

    function startTimer(duration) {
        let timer = duration;
        timerElement.style.display = 'block';
        examTimer = setInterval(() => {
            const minutes = parseInt(timer / 60, 10);
            const seconds = parseInt(timer % 60, 10);
            timerElement.textContent = `${minutes < 10 ? "0" + minutes : minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
            
            if (--timer < 0) {
                clearInterval(examTimer);
                // --- MODIFICACIÓN 4 de 5: Marcar preguntas restantes como omitidas al acabarse el tiempo ---
                questions.forEach(q => {
                    if (q.userStatus === undefined) {
                        q.userStatus = 'skipped';
                    }
                });
                showResults();
            }
        }, 1000);
    }

    // --- INICIALIZACIÓN ---
    function init() {
        startExamBtn.addEventListener('click', () => {
            const category = document.getElementById('category-select').value;
            const lang = document.documentElement.lang;
            examMode = document.getElementById('mode-select').value;
            startExam(category, lang);
        });

        nextButton.addEventListener('click', () => {
            // --- MODIFICACIÓN 5 de 5: Marcar pregunta como omitida si se avanza sin contestar ---
            if (questions[currentQuestionIndex].userStatus === undefined) {
                questions[currentQuestionIndex].userStatus = 'skipped';
            }

            if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                showQuestion(currentQuestionIndex);
            } else {
                showResults();
            }
        });

        prevButton.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                showQuestion(currentQuestionIndex);
            }
        });

        reviewExamBtn.addEventListener('click', () => startReview());

        resultsSummaryBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('review-question-btn')) {
                const index = parseInt(e.target.dataset.index, 10);
                startReview(index);
            }
        });

        prevReviewButton.addEventListener('click', () => {
            if (currentReviewIndex > 0) {
                currentReviewIndex--;
                showReviewQuestion(currentReviewIndex);
            }
        });

        nextReviewButton.addEventListener('click', () => {
            if (currentReviewIndex < questions.length - 1) {
                currentReviewIndex++;
                showReviewQuestion(currentReviewIndex);
            }
        });

        backToResultsButton.addEventListener('click', () => {
            reviewContainer.style.display = 'none';
            resultsContainer.style.display = 'block';
        });
    }

    init();
});
