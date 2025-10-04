document.addEventListener('DOMContentLoaded', () => {
    // Seleccionamos el nuevo checkbox del interruptor
    const themeSwitch = document.getElementById('theme-switch-checkbox');

    // Función para aplicar el tema
    const applyTheme = (theme) => {
        if (theme === 'dark-mode') {
            document.body.classList.add('dark-mode');
            themeSwitch.checked = true; // Sincroniza el estado visual del toggle
        } else {
            document.body.classList.remove('dark-mode');
            themeSwitch.checked = false; // Sincroniza el estado visual del toggle
        }
    };

    // Al cargar la página, comprobamos el tema guardado en localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Añadimos el listener para cuando se haga clic en el interruptor
    themeSwitch.addEventListener('change', () => {
        let newTheme;
        if (themeSwitch.checked) {
            newTheme = 'dark-mode';
        } else {
            newTheme = 'light';
        }
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', newTheme);
    });
});
