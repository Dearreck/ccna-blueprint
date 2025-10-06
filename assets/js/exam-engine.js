document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');
    const questionCountSelect = document.getElementById('question-count-select');

    // --- ESTADO DEL EXAMEN ---
    let allQuestions = [];
    let currentExamQuestions = [];
    let currentQuestionIndex = 0;
    let userScore = 0;
    let examMode = 'study';

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
                alert('No se encontraron preguntas para las categorías seleccionadas. Asegúrate de que los archivos JSON no estén vacíos.');
                return;
            }
        } catch (error) {
            console.error('Error al cargar las preguntas:', error);
            alert('Hubo un problema al cargar las preguntas. Revisa la consola para más detalles.');
            return;
        }

        currentExamQuestions = shuffleArray([...allQuestions]);

        if (questionCount !== 'all') {
            currentExamQuestions = currentExamQuestions.slice(0, parseInt(questionCount));
        }
        
        currentQuestionIndex = 0;
        userScore = 0;
        
        examSetupContainer.classList.add('d-none');
        examQuestionsContainer.classList.remove('d-none');
        
        displayQuestion();
    }

    function displayQuestion() {
        if (currentQuestionIndex >= currentExamQuestions.length) {
            // FIN DEL EXAMEN (próximamente)
            console.log("Fin del examen.");
            return;
        }

        const question = currentExamQuestions[currentQuestionIndex];
        examQuestionsContainer.innerHTML = ''; 

        const questionCard = document.createElement('div');
        questionCard.className = 'card shadow-sm border-0';
        
        let cardBodyHTML = `
            <div class="card-header bg-transparent border-0 pt-4 px-4">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Pregunta ${currentQuestionIndex + 1} de ${currentExamQuestions.length}</h5>
                </div>
            </div>
            <div class="card-body p-4 p-md-5">
                <p class="question-text lead">${question.question_es}</p>
        `;

        if (question.code) {
            cardBodyHTML += `<pre class="bg-dark text-light p-3 rounded"><code>${question.code}</code></pre>`;
        }

        if (question.image) {
             cardBodyHTML += `<div class="text-center my-3"><img src="${question.image}" class="img-fluid rounded" alt="Imagen de la pregunta"></div>`;
        }
        
        cardBodyHTML += '<div id="options-container" class="mt-4">';
        const options = shuffleArray([...question.options]); 
        question.shuffledOptions = options; // Guardamos las opciones barajadas para usarlas en la verificación

        options.forEach((option, index) => {
            cardBodyHTML += `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" name="questionOptions" id="option${index}" value="${index}">
                    <label class="form-check-label" for="option${index}">
                        ${option.text_es}
                    </label>
                </div>
            `;
        });
        cardBodyHTML += '</div></div>';

        cardBodyHTML += `
            <div class="card-footer bg-transparent border-0 pb-4 px-4 text-end">
                <button id="check-answer-btn" class="btn btn-primary">Verificar Respuesta</button>
            </div>
        `;

        questionCard.innerHTML = cardBodyHTML;
        examQuestionsContainer.appendChild(questionCard);

        // MODIFICACIÓN: Añadimos el listener al botón recién creado
        document.getElementById('check-answer-btn').addEventListener('click', handleAnswerSubmission);
    }
    
    /**
     * Novedad: Maneja la lógica de verificar la respuesta del usuario.
     */
    function handleAnswerSubmission() {
        const question = currentExamQuestions[currentQuestionIndex];
        const selectedOptionInput = document.querySelector('input[name="questionOptions"]:checked');

        if (!selectedOptionInput) {
            alert('Por favor, selecciona una respuesta.');
            return;
        }

        const selectedOptionIndex = parseInt(selectedOptionInput.value);
        const selectedOption = question.shuffledOptions[selectedOptionIndex];
        const isCorrect = selectedOption.isCorrect;

        if (isCorrect) {
            userScore++;
        }

        // --- Feedback Visual ---
        const allOptionLabels = document.querySelectorAll('#options-container .form-check-label');
        const allOptionInputs = document.querySelectorAll('#options-container .form-check-input');

        allOptionInputs.forEach(input => input.disabled = true); // Deshabilitar todas las opciones

        question.shuffledOptions.forEach((option, index) => {
            if (option.isCorrect) {
                allOptionLabels[index].classList.add('correct');
            } else if (index === selectedOptionIndex) {
                allOptionLabels[index].classList.add('incorrect');
            }
        });

        // --- Mostrar Explicación ---
        if (question.explanation_es) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'alert alert-info mt-4 explanation-box';
            explanationDiv.innerHTML = `<strong>Explicación:</strong> ${question.explanation_es}`;
            document.querySelector('.card-body').appendChild(explanationDiv);
        }

        // --- Cambiar Botón ---
        const actionButton = document.getElementById('check-answer-btn');
        actionButton.textContent = 'Siguiente Pregunta';
        actionButton.removeEventListener('click', handleAnswerSubmission); // Quitar listener viejo
        actionButton.addEventListener('click', proceedToNextQuestion); // Añadir nuevo listener
    }
    
    /**
     * Novedad: Avanza a la siguiente pregunta o finaliza el examen.
     */
    function proceedToNextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentExamQuestions.length) {
            displayQuestion();
        } else {
            alert(`Fin del examen. Tu puntuación: ${userScore} de ${currentExamQuestions.length}`);
            // Aquí irá la lógica para mostrar la pantalla de resultados final
        }
    }
    
    async function fetchQuestions(categories) {
        const fetchPromises = categories.map(category => {
            const path = `../data/${category}.json`;
            return fetch(path).then(response => {
                if (!response.ok) {
                    throw new Error(`No se pudo cargar el archivo: ${path}`);
                }
                return response.json();
            });
        });

        const questionArrays = await Promise.all(fetchPromises);
        return questionArrays.flat();
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
