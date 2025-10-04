(function() {
    // Nos aseguramos de que el script se ejecute en un entorno seguro
    'use strict';

    // Esperamos a que todo el contenido de la página esté cargado
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.getElementById('theme-switch-checkbox');

        // Si no encontramos el interruptor, no hacemos nada más.
        if (!themeToggle) {
            return;
        }

        // Función para aplicar el tema y actualizar el estado del interruptor
        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
                themeToggle.checked = true;
            } else {
                document.body.classList.remove('dark-mode');
                themeToggle.checked = false;
            }
        };

        // Al cargar, obtenemos el tema guardado. Si no hay nada, usamos 'light' por defecto.
        // Usamos try...catch por si localStorage está bloqueado por el navegador (modo privado, etc.)
        let currentTheme = 'light';
        try {
            currentTheme = localStorage.getItem('theme') || 'light';
        } catch (e) {
            console.warn('No se pudo acceder a localStorage. El tema no será persistente.');
        }

        applyTheme(currentTheme);

        // Añadimos el listener para cuando el estado del interruptor cambie
        themeToggle.addEventListener('change', function() {
            const newTheme = this.checked ? 'dark' : 'light';
            document.body.classList.toggle('dark-mode', this.checked);

            try {
                localStorage.setItem('theme', newTheme);
            } catch (e) {
                console.warn('No se pudo guardar el tema en localStorage.');
            }
        });
    });
})();
