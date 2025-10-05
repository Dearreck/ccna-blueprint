document.addEventListener('DOMContentLoaded', () => {
    
    const initializeThemeToggle = () => {
        const themeToggle = document.getElementById('theme-switch-checkbox');
        if (!themeToggle) return;

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

    const loadComponent = (selector, url, callback) => {
        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Error al cargar ${url}`);
                return response.text();
            })
            .then(data => {
                const element = document.querySelector(selector);
                if (element) element.innerHTML = data;
                if (callback) callback();
            });
    };

    // Lógica de Carga Principal con basePath Dinámico ---

    // 1. Calculamos la profundidad de la página actual.
    // Contamos cuántos directorios hay después de "ccna-blueprint" en la URL.
    const path = window.location.pathname;
    const pathSegments = path.substring(path.indexOf('ccna-blueprint') + 'ccna-blueprint'.length).split('/');
    // Restamos 1 porque el último segmento es el archivo (index.html) o está vacío.
    const depth = pathSegments.length - 2;

    // 2. Construimos el prefijo de la ruta. Por cada nivel de profundidad, añadimos un "../".
    // Si la profundidad es 0 (estamos en la raíz), el prefijo queda vacío.
    const basePath = '../'.repeat(depth > 0 ? depth : 0);

    // 3. Usamos Promise.all con nuestra nueva ruta dinámica.
    Promise.all([
        loadComponent('#navbar-placeholder', `${basePath}components/nav.html`, initializeThemeToggle),
        loadComponent('#footer-placeholder', `${basePath}components/footer.html`)
    ]).then(() => {
        document.body.classList.add('loaded');
    }).catch(error => {
        console.error('Fallo al cargar componentes esenciales:', error);
        document.body.classList.add('loaded');
    });

    document.title = document.body.dataset.title || 'CCNA Blueprint';
});
