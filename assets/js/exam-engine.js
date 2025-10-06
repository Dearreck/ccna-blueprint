document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');
    const questionCountSelect = document.getElementById('question-count-select');

    // --- ESTADO DEL EXAMEN ---
    let allQuestions = []; // Almacenará todas las preguntas cargadas
    let currentExamQuestions = []; // Las preguntas para la sesión actual
    let currentQuestionIndex = 0;
    let userScore = 0;
    let examMode = 'study';

    // --- DEFINICIÓN DE CATEGORÍAS (Según el PDF) ---
    const examCategories = [
        { id: '1.0-network-fundamentals', name: '1.0 Network Fundamentals (20%)' },
        { id: '2.0-network-access', name: '2.0 Network Access (20%)' },
        { id: '3.0-ip-connectivity', name: '3.0 IP Connectivity (25%)' },
        { id: '4.0-ip-services', name: '4.0 IP Services (10%)' },
        { id: '5.0-security-fundamentals', name: '5.0 Security Fundamentals (15%)' },
        { id: '6.0-automation-programmability', name: '6.0 Automation & Programmability (10%)' }
    ];

    /**
     * Carga dinámicamente las categorías del examen en la página de configuración.
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
            label.textContent = category.name;
            formCheckDiv.appendChild(input);
            formCheckDiv.appendChild(label);
            colDiv.appendChild(formCheckDiv);
            categorySelectionContainer.appendChild(colDiv);
        });
    }

    /**
     * Inicia el proceso del examen una vez que el usuario hace clic en "Comenzar".
     */
    async function startExam() {
        // 1. Recopilar configuración del usuario
        const selectedMode = document.querySelector('input[name="examMode"]:checked').value;
        const selectedCategoryElements = document.querySelectorAll('#category-selection-container input[type="checkbox"]:checked');
        const questionCount = questionCountSelect.value;
        
        if (selectedCategoryElements.length === 0) {
            alert('Por favor, selecciona al menos una categoría.');
            return;
        }

        const selectedCategories = Array.from(selectedCategoryElements).map(el => el.value);
        examMode = selectedMode;

        // 2. Cargar las preguntas de los archivos JSON seleccionados
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

        // 3. Preparar el set de preguntas para el examen
        currentExamQuestions = shuffleArray([...allQuestions]); // Barajamos una copia

        if (questionCount !== 'all') {
            currentExamQuestions = currentExamQuestions.slice(0, parseInt(questionCount));
        }
        
        // 4. Resetear estado e iniciar UI del examen
        currentQuestionIndex = 0;
        userScore = 0;
        
        examSetupContainer.classList.add('d-none');
        examQuestionsContainer.classList.remove('d-none');
        
        // El siguiente paso será llamar a una función para mostrar la primera pregunta
        console.log(`Examen iniciado en modo ${examMode} con ${currentExamQuestions.length} preguntas.`);
        // displayQuestion(); // <-- Esta será nuestra próxima función a implementar
    }

    /**
     * Carga las preguntas desde los archivos JSON especificados.
     * @param {string[]} categories - Un array de IDs de categorías (ej: ['1.0-network-fundamentals']).
     * @returns {Promise<object[]>} - Una promesa que resuelve a un array con todas las preguntas.
     */
    async function fetchQuestions(categories) {
        const fetchPromises = categories.map(category => {
            // Ajustamos la ruta para que sea relativa a la raíz del sitio
            const path = `../data/${category}.json`;
            return fetch(path).then(response => {
                if (!response.ok) {
                    throw new Error(`No se pudo cargar el archivo: ${path}`);
                }
                return response.json();
            });
        });

        const questionArrays = await Promise.all(fetchPromises);
        
        // Aplanamos el array de arrays en un solo array de preguntas
        return questionArrays.flat();
    }

    /**
     * Algoritmo Fisher-Yates para barajar un array.
     * @param {any[]} array - El array a barajar.
     * @returns {any[]} - El array barajado.
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }


    // --- FUNCIÓN DE INICIALIZACIÓN ---
    function init() {
        loadCategories();
        
        if (startExamBtn) {
            startExamBtn.addEventListener('click', startExam);
        }
    }

    // Arrancamos la inicialización
    init();

});
