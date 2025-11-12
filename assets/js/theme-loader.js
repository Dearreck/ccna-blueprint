// assets/js/theme-loader.js

(() => {
    'use strict';

    /**
     * Obtiene el tema preferido del usuario desde localStorage o la configuración de su sistema operativo.
     * @returns {'light' | 'dark'} El tema preferido.
     */
    const getPreferredTheme = () => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            return storedTheme;
        }
        // Si no hay nada guardado, usa la preferencia del sistema operativo del usuario.
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    /**
     * Aplica el tema al documento HTML estableciendo el atributo 'data-bs-theme'.
     * @param {string} theme - El tema a aplicar ('light' o 'dark').
     */
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-bs-theme', theme);
    };

    // Aplica el tema preferido tan pronto como el script se carga.
    setTheme(getPreferredTheme());
})();