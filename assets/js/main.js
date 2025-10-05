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
        const initializeThemeToggle = () => {
            const themeToggle = document.getElementById('theme-switch-checkbox');
            if (!themeToggle) return;
    
            // Sincronizamos el estado visual del toggle con el tema actual
            // El tema ya fue aplicado por theme-loader.js
            themeToggle.checked = document.documentElement.classList.contains('dark-mode');
    
            themeToggle.addEventListener('change', function() {
                const isDarkMode = this.checked;
                document.documentElement.classList.toggle('dark-mode', isDarkMode);
                try {
                    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
                } catch (e) {
                    console.warn('No se pudo guardar el tema.');
                }
            });
        };
    
        const loadComponent = (selector, url, callback) => {
            return fetch(url)
                .then(response => response.ok ? response.text() : Promise.reject(`Error cargando ${url}`))
                .then(data => {
                    const element = document.querySelector(selector);
                    if (element) element.innerHTML = data;
                    if (callback) callback();
                });
        };
    
        const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
    
        // Usamos Promise.all para esperar a que TODOS los componentes se carguen
        Promise.all([
            loadComponent('#navbar-placeholder', `${basePath}components/nav.html`, initializeThemeToggle),
            loadComponent('#footer-placeholder', `${basePath}components/footer.html`)
        ]).then(() => {
            // Cuando todo esté cargado, mostramos el cuerpo de la página
            document.body.classList.add('loaded');
        }).catch(error => {
            console.error('Fallo al cargar componentes esenciales:', error);
            // Si algo falla, mostramos el cuerpo de todas formas para que no se quede en blanco
            document.body.classList.add('loaded');
        });
    });

    
})();
