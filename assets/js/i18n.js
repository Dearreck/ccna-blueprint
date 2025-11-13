// Añade esta función auxiliar fuera del objeto i1n o dentro de init
    function getBasePath() {
        const path = window.location.pathname;
        // Si la URL contiene el nombre de tu repo, úsalo como base.
        // Reemplaza 'ccna-blueprint' si tu repo se llama diferente.
        const repoName = '/ccna-blueprint'; 
        return path.includes(repoName) ? repoName : '';
    }

const i1n = {
    currentLanguage: 'es',
    translations: {},
    // Un array para almacenar funciones (callbacks) que se ejecutarán
    // cada vez que el idioma cambie. Esto permite que otros scripts,
    // como exam-engine.js, puedan refrescar su propio contenido dinámico.
    dynamicRenderCallbacks: [],
    // Un Set para rastrear qué módulos (namespaces) ya hemos cargado.
    // Empezamos con 'common' que se cargará en init().
    loadedNamespaces: new Set(),

    initPromise: null, // Guardará la promesa maestra
    initResolve: null, // Guardará la función para resolver la promesa

    /**
     * Inicializa el motor de traducción.
     * Ahora solo carga el archivo "común".
     */
    async init() {
        // 1. Crea la promesa maestra y guarda su función 'resolve'
        this.initPromise = new Promise(resolve => {
            this.initResolve = resolve;
        });

        // Determina el idioma 
        const savedLang = localStorage.getItem('CCNA_language');
        const browserLang = navigator.language.split('-')[0];
        this.currentLanguage = savedLang || (['es', 'en'].includes(browserLang) ? browserLang : 'en');

        // Carga 'common'
        await this.loadNamespaces(['common']); 

        // Traduce la página estática
        this.translatePage();
        this.setupLanguageSelector();

        document.dispatchEvent(new CustomEvent('i18n-loaded'));

        // 2. Resuelve la promesa maestra. ¡i18n está listo!
        this.initResolve();
        // -----------------------------------------
    },

    /**
     * Carga uno o más archivos de idioma (namespaces) y los FUSIONA.
     * @param {string[]} namespaces - Array de nombres de módulos (ej. ['exam', 'pw_cracker'])
     * @param {boolean} [triggerRender=true] - Si es true, llama a translatePage y callbacks.
     */
    async loadNamespaces(namespaces = [], triggerRender = true) {
        // 3. Espera a que init() termine, A MENOS QUE sea la carga de 'common'.
        const isCommonLoad = namespaces.includes('common');
        if (!isCommonLoad && this.initPromise) {
            // Pausa la ejecución aquí hasta que init() llame a this.initResolve()
            await this.initPromise;
        }
        // -------------------------------------------------------

        try {
            const fetchPromises = [];
            const namespacesToLoad = namespaces.filter(ns => !this.loadedNamespaces.has(ns));
            const basePath = getBasePath();

            if (namespacesToLoad.length === 0) {
                // Si no hay nada que cargar, pero SÍ queremos forzar un re-renderizado
                // (útil si el HTML se añadió después de la carga inicial).
                if (triggerRender) {
                    this.translatePage();
                    this.dynamicRenderCallbacks.forEach(callback => callback());
                }
                return; // No hay nada nuevo que cargar
            }

            for (const ns of namespacesToLoad) {
                //const url = `/lang/${this.currentLanguage}/${ns}.json`;
                const url = `${basePath}/lang/${this.currentLanguage}/${ns}.json`;

                fetchPromises.push(
                    fetch(url).then(response => {
                        if (!response.ok) {
                            throw new Error(`Fallo al cargar ${url}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                );
            }

            const allNewTranslations = await Promise.all(fetchPromises);

            for (const newTranslations of allNewTranslations) {
                Object.assign(this.translations, newTranslations);
            }

            namespacesToLoad.forEach(ns => this.loadedNamespaces.add(ns));

            // Si triggerRender es true, actualiza el DOM
            if (triggerRender) {
                this.translatePage();
                // También llamamos a los callbacks dinámicos
                //this.dynamicRenderCallbacks.forEach(callback => callback());
            }

        } catch (error) {
            console.error('Error crítico al cargar namespaces:', error);
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
                element.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.get(key);

            if (translation && translation !== key) {
                element.setAttribute('placeholder', translation);
            }
        });

        // Traduce atributos 'title' (y prepara para tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.get(key);
            if (translation && translation !== key) {
                element.removeAttribute('data-bs-original-title');
                element.setAttribute('title', translation);
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

        // En lugar de recargar, llamamos a la nueva función
        // que maneja la actualización dinámica.
        this.changeLanguage();
    },

    /**
     * Orquesta la actualización de idioma en toda la página.
     */
    async changeLanguage() {
        // 1. Resetea las traducciones y la lista de namespaces cargados
        this.translations = {};
        const namespacesToReload = [...this.loadedNamespaces];
        this.loadedNamespaces.clear();

        // 2. Vuelve a cargar los namespaces SIN disparar el renderizado
        await this.loadNamespaces(namespacesToReload, false);

        // 3. Vuelve a traducir todos los elementos estáticos (UNA SOLA VEZ)
        this.translatePage();

        // 4. Ejecuta todos los callbacks dinámicos (UNA SOLA VEZ)
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




