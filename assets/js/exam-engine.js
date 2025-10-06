document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS AL DOM ---
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const startExamBtn = document.getElementById('start-exam-btn');
    const examSetupContainer = document.getElementById('exam-setup-container');
    const examQuestionsContainer = document.getElementById('exam-questions-container');

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

        // Limpiamos el mensaje de "Cargando..."
        categorySelectionContainer.innerHTML = '';

        // Creamos un checkbox para cada categoría
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
            input.checked = true; // Las dejamos marcadas por defecto

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

    // --- FUNCIÓN DE INICIALIZACIÓN ---
    function init() {
        loadCategories();
        // Aquí añadiremos el event listener para el botón de empezar examen
    }

    // Arrancamos la inicialización
    init();

});
