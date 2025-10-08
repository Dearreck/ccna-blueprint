// assets/js/i18n.js (Versión SPA Refactorizada)

const i1n = {
    currentLanguage: 'es',
    translations: {},
    // NUEVO: Un array para almacenar funciones (callbacks) que se ejecutarán
    // cada vez que el idioma cambie. Esto permite que otros scripts,
    // como exam-engine.js, puedan refrescar su propio contenido dinámico.
    dynamicRenderCallbacks: [],

    /**
     * Inicializa el motor de traducción al cargar la página por primera vez.
     */
    async init() {
        // Determina el idioma a usar (del localStorage o del navegador)
        const savedLang = localStorage.getItem('CCNA_language');
        const browserLang = navigator.language.split('-')[0];
        this.currentLanguage = savedLang || (['es', 'en'].includes(browserLang) ? browserLang : 'en');
        
        await this.loadTranslations(); // Carga las traducciones iniciales
        this.translatePage();
        this.setupLanguageSelector();

        // Notifica a otros scripts que las traducciones iniciales están listas.
        document.dispatchEvent(new CustomEvent('i18n-loaded'));
    },

    /**
     * Carga el archivo de idioma .json. Ahora puede cargar cualquier idioma bajo demanda.
     */
    async loadTranslations() {
        try {
            // Se usa this.currentLanguage para cargar el idioma correcto.
            const response = await fetch(`/ccna-blueprint/lang/${this.currentLanguage}.json`);
            
            if (!response.ok) {
                throw new Error(`Fallo al cargar el archivo de idioma: ${response.statusText}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error crítico al cargar traducciones:', error);
        }
    },

    /**
     * Recorre el DOM y traduce todos los elementos estáticos que tengan el atributo [data-i18n].
     */
    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.get(key);
            
            if (translation && translation !== key) {
                const icon = element.querySelector('i');
                if (icon) {
                    element.innerHTML = `${icon.outerHTML} ${translation}`;
                } else {
                    element.textContent = translation;
                }
            }
        });
    },

    /**
     * Obtiene una traducción específica a partir de una clave.
     * Si no la encuentra, devuelve la clave misma.
     * @param {string} key - La clave de traducción (ej. "nav_home").
     * @returns {string} El texto traducido.
     */
    get(key) {
        return this.translations[key] || key;
    },

    /**
     * Configura el event listener para el selector de idioma.
     */
    setupLanguageSelector() {
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.value = this.currentLanguage;
            langSelector.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
    },

    /**
     * Establece el nuevo idioma y lanza el proceso de actualización sin recargar la página.
     * @param {string} lang - El nuevo idioma seleccionado (ej. "en").
     */
    setLanguage(lang) {
        if (lang === this.currentLanguage) return;
        localStorage.setItem('CCNA_language', lang);
        this.currentLanguage = lang;
        
        // MODIFICADO: En lugar de recargar, llamamos a la nueva función
        // que maneja la actualización dinámica.
        this.changeLanguage();
    },

    /**
     * NUEVO: Orquesta la actualización de idioma en toda la página.
     */
    async changeLanguage() {
        // 1. Carga las nuevas traducciones del archivo .json correspondiente.
        await this.loadTranslations();
        
        // 2. Vuelve a traducir todos los elementos estáticos de la página.
        this.translatePage();
        
        // 3. Ejecuta todas las funciones de "callback" que otros scripts
        //    hayan registrado, para que actualicen su contenido dinámico.
        this.dynamicRenderCallbacks.forEach(callback => callback());
    },

    /**
     * NUEVO: Permite que otros scripts (como exam-engine.js) registren una
     * función que debe ejecutarse cada vez que el idioma cambie.
     * @param {Function} callback - La función a ejecutar en el cambio de idioma.
     */
    registerDynamicRenderer(callback) {
        if (typeof callback === 'function') {
            this.dynamicRenderCallbacks.push(callback);
        }
    }
};

// IMPORTANTE: El script ya no se autoejecuta.
// Su inicialización ahora es controlada por main.js para asegurar
// que el DOM (específicamente la barra de navegación) esté listo.
