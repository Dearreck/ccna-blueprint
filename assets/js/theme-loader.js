// Contenido de assets/js/theme-loader.js
(function() {
    try {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
            // Aplica la clase directamente al <html> antes de que se cargue nada más
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) {
        console.error("No se pudo acceder a localStorage para cargar el tema.");
    }
})();
