// Motor de Internacionalización (i18n)
const i18n = {
    // Propiedades
    currentLanguage: 'es',
    translations: {},

    // Método para inicializar el motor
    async init() {
        // 1. Determinar el idioma
        const savedLang = localStorage.getItem('CCNA_language');
        const browserLang = navigator.language.split('-')[0];
        this.currentLanguage = savedLang || (['es', 'en'].includes(browserLang) ? browserLang : 'en');
        
        // 2. Cargar el archivo de idioma
        await this.loadTranslations();

        // 3. Traducir la página
        this.translatePage();

        // 4. Configurar el listener para el selector de idioma
        this.setupLanguageSelector();
    },

    // Carga el archivo JSON del idioma actual
    async loadTranslations() {
        try {
            // Calculamos la ruta base dinámicamente, igual que en main.js
            const path = window.location.pathname;
            const pathSegments = path.substring(path.indexOf('ccna-blueprint') + 'ccna-blueprint'.length).split('/');
            const depth = pathSegments.length - 2;
            const basePath = '../'.repeat(depth > 0 ? depth : 0);

            const response = await fetch(`${basePath}lang/${this.currentLanguage}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language file: ${this.currentLanguage}.json`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Cargar inglés como fallback en caso de error
            this.currentLanguage = 'en';
            await this.loadTranslations();
        }
    },

    // Busca y traduce todos los elementos con el atributo data-i18n
    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (this.translations[key]) {
                element.textContent = this.translations[key];
            }
        });
    },

    // Obtiene una traducción específica (para uso en otros scripts)
    get(key) {
        return this.translations[key] || key;
    },

    // Configura el selector de idioma
    setupLanguageSelector() {
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.value = this.currentLanguage; // Sincronizar el dropdown
            langSelector.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
    },

    // Cambia el idioma, guarda la preferencia y recarga la página
    setLanguage(lang) {
        if (lang === this.currentLanguage) return;
        this.currentLanguage = lang;
        localStorage.setItem('CCNA_language', lang);
        window.location.reload(); // La forma más simple de aplicar los cambios
    }
};

// Inicializar el motor cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});
