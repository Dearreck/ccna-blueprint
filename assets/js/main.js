// assets/js/main.js (Versión SPA Refactorizada)

document.addEventListener('DOMContentLoaded', () => {
    
    /**
     * Inicializa el interruptor de tema (oscuro/claro) después de que se carga.
     */
    const initializeThemeToggle = () => {
        const themeToggle = document.getElementById('theme-switch-checkbox');
        if (!themeToggle) return;

        // Sincroniza el estado del checkbox con el tema actual
        themeToggle.checked = document.documentElement.classList.contains('dark-mode');

        themeToggle.addEventListener('change', function() {
            const isDarkMode = this.checked;
            document.documentElement.classList.toggle('dark-mode', isDarkMode);
            try {
                localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            } catch (e) {
                console.warn('No se pudo guardar la preferencia del tema.');
            }
        });
    };

    /**
     * Carga un componente HTML desde una URL y lo inyecta en un selector del DOM.
     * @param {string} selector - El selector CSS del elemento contenedor (ej. '#navbar-placeholder').
     * @param {string} url - La URL del archivo HTML del componente.
     * @param {Function} [callback] - Una función opcional que se ejecuta después de cargar el componente.
     * @returns {Promise<void>}
     */
    const loadComponent = (selector, url, callback) => {
        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Error al cargar ${url}`);
                return response.text();
            })
            .then(data => {
                const element = document.querySelector(selector);
                if (element) {
                    element.innerHTML = data;
                }
                // Si se proporciona un callback, se ejecuta aquí.
                if (callback) {
                    callback();
                }
            });
    };

    // --- Lógica de Carga Principal con basePath Dinámico ---

    // 1. Calcula la profundidad de la página actual para construir rutas relativas correctas.
    const path = window.location.pathname;
    const pathSegments = path.substring(path.indexOf('ccna-blueprint') + 'ccna-blueprint'.length).split('/');
    const depth = pathSegments.length - 2;
    const basePath = '../'.repeat(depth > 0 ? depth : 0);

    // 2. Carga de componentes y orquestación de scripts.
    Promise.all([
        // MODIFICADO: Ahora el callback de la barra de navegación se encarga
        // de inicializar tanto el tema como el motor de traducción.
        // Esto garantiza que i1n.init() solo se ejecute cuando el selector de idioma ya existe en el DOM.
        loadComponent('#navbar-placeholder', `${basePath}components/nav.html`, () => {
            initializeThemeToggle(); // Primero, inicializa el interruptor de tema.
            i1n.init();             // Segundo, inicializa el motor de traducción.
        }),
        loadComponent('#footer-placeholder', `${basePath}components/footer.html`)
    ]).then(() => {
        // 3. Una vez que TODOS los componentes están cargados y los scripts inicializados,
        // se muestra el contenido de la página para evitar el "flash".
        document.body.classList.add('loaded');
    }).catch(error => {
        console.error('Fallo al cargar componentes esenciales:', error);
        // Aun si hay un error, mostramos el cuerpo para que el usuario no vea una página en blanco.
        document.body.classList.add('loaded');
    });

    // Actualiza el título de la página si se ha definido en el body.
    document.title = document.body.dataset.title || 'CCNA Blueprint';
});
