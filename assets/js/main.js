// Función para cargar componentes HTML reutilizables
const loadComponent = (selector, url) => {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`No se pudo cargar el componente: ${url}`);
            }
            return response.text();
        })
        .then(data => {
            // Inserta el HTML del componente en el elemento especificado
            document.querySelector(selector).innerHTML = data;
        })
        .catch(error => console.error('Error cargando componente:', error));
};

(function() {
    // Nos aseguramos de que el script se ejecute en un entorno seguro
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
    // Función para inicializar la lógica del interruptor de tema
    const initializeThemeToggle = () => {
        const themeToggle = document.getElementById('theme-switch-checkbox');
        
        // Si el interruptor no existe, no hacemos nada más.
        if (!themeToggle) {
            console.error('El interruptor del tema no se encontró en el DOM.');
            return;
        }

        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
                themeToggle.checked = true;
            } else {
                document.body.classList.remove('dark-mode');
                themeToggle.checked = false;
            }
        };

        // Al cargar, aplicamos el tema guardado
        let currentTheme = 'light';
        try {
            currentTheme = localStorage.getItem('theme') || 'light';
        } catch (e) {
            console.warn('No se pudo acceder a localStorage.');
        }
        applyTheme(currentTheme);

        // Añadimos el listener para el cambio
        themeToggle.addEventListener('change', function() {
            const newTheme = this.checked ? 'dark' : 'light';
            document.body.classList.toggle('dark-mode', this.checked);
            try {
                localStorage.setItem('theme', newTheme);
            } catch (e) {
                console.warn('No se pudo guardar el tema en localStorage.');
            }
        });
    };

    // Función para cargar componentes HTML
    const loadComponent = (selector, url, callback) => {
        fetch(url)
            .then(response => response.ok ? response.text() : Promise.reject(`Error cargando ${url}`))
            .then(data => {
                document.querySelector(selector).innerHTML = data;
                // Si hay una función de callback, la ejecutamos AHORA
                if (callback) {
                    callback();
                }
            })
            .catch(error => console.error('Error cargando componente:', error));
    };

    // --- Lógica de Carga Principal ---
    const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
    
    // Cargamos el footer (no necesita callback)
    loadComponent('#footer-placeholder', `${basePath}components/footer.html`);
    
    // Cargamos la navbar y, SOLO CUANDO TERMINE, inicializamos el botón del tema.
    loadComponent('#navbar-placeholder', `${basePath}components/nav.html`, initializeThemeToggle);
    });
})();
