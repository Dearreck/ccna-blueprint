
document.addEventListener('DOMContentLoaded', () => {
    // Función para inicializar la lógica del interruptor de tema.
    // Se llamará DESPUÉS de que la navbar esté en la página.
    const initializeThemeToggle = () => {
        const themeToggle = document.getElementById('theme-switch-checkbox');
        
        if (!themeToggle) {
            console.error('El interruptor del tema no se encontró en el DOM.');
            return;
        }

        // Sincronizamos el estado visual del toggle con el tema actual
        // que ya fue aplicado por el script theme-loader.js en el <head>.
        themeToggle.checked = document.documentElement.classList.contains('dark-mode');

        // Añadimos el listener para cuando el usuario haga clic en el interruptor.
        themeToggle.addEventListener('change', function() {
            const isDarkMode = this.checked;
            document.documentElement.classList.toggle('dark-mode', isDarkMode);
            try {
                // Guardamos la preferencia del usuario para futuras visitas.
                localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            } catch (e) {
                console.warn('No se pudo guardar la preferencia del tema.');
            }
        });
    };

    // Función unificada para cargar componentes HTML.
    // Acepta un 'callback' opcional para ejecutar código después de la carga.
    const loadComponent = (selector, url, callback) => {
        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Error al cargar ${url}`);
                return response.text();
            })
            .then(data => {
                const element = document.querySelector(selector);
                if (element) element.innerHTML = data;
                // Si se proporcionó un callback, lo ejecutamos.
                if (callback) callback();
            });
    };

    // --- Lógica de Carga Principal ---
    const basePath = window.location.pathname.includes('/pages/') ? '../' : '';

    // Usamos Promise.all para esperar a que TODOS los componentes se carguen
    Promise.all([
        // Cargamos la navbar y le pasamos 'initializeThemeToggle' como el callback.
        loadComponent('#navbar-placeholder', `${basePath}components/nav.html`, initializeThemeToggle),
        // Cargamos el footer (no necesita callback).
        loadComponent('#footer-placeholder', `${basePath}components/footer.html`)
    ]).then(() => {
        // Cuando todo esté cargado, mostramos el cuerpo de la página.
        document.body.classList.add('loaded');
    }).catch(error => {
        console.error('Fallo al cargar componentes esenciales:', error);
        // Si algo falla, mostramos el cuerpo de todas formas para que la página no se quede en blanco.
        document.body.classList.add('loaded');
    });

    // Leemos el título del body y lo ponemos en la pestaña de la página
    document.title = document.body.dataset.title || 'CCNA Blueprint';
});
