document.addEventListener('DOMContentLoaded', () => {
    const themeToggler = document.getElementById('theme-toggler');
    const currentTheme = localStorage.getItem('theme');

    // Aplicar el tema guardado al cargar la página
    if (currentTheme) {
        document.body.classList.add(currentTheme);
    }

    themeToggler.addEventListener('click', () => {
        // Alternar la clase 'dark-mode'
        document.body.classList.toggle('dark-mode');

        // Guardar la preferencia en localStorage
        let theme = 'light'; // Por defecto
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark-mode';
        }
        localStorage.setItem('theme', theme);
    });
});
