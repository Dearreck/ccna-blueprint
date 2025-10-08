// assets/js/i18n.js (Versión Corregida y Simplificada)
const i18n = {
    currentLanguage: 'es',
    translations: {},

    async init() {
        const savedLang = localStorage.getItem('CCNA_language');
        const browserLang = navigator.language.split('-')[0];
        this.currentLanguage = savedLang || (['es', 'en'].includes(browserLang) ? browserLang : 'en');
        
        await this.loadTranslations();
        this.translatePage();
        this.setupLanguageSelector();
    },

    async loadTranslations() {
        try {
            // Lógica de ruta simplificada y corregida
            const response = await fetch(`../lang/${this.currentLanguage}.json`);
            if (!response.ok) {
                throw new Error(`Fallo al cargar el archivo de idioma: ${response.statusText}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error cargando traducciones:', error);
            // Si falla (por ejemplo, en la página raíz), intenta una ruta alternativa.
            try {
                const response = await fetch(`lang/${this.currentLanguage}.json`);
                if (!response.ok) throw new Error('Fallo en el segundo intento de carga.');
                this.translations = await response.json();
            } catch (fallbackError) {
                console.error('Error en el intento de fallback:', fallbackError);
            }
        }
    },

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.get(key);
            if (translation !== key) {
                element.textContent = translation;
            }
        });
    },

    get(key) {
        return this.translations[key] || key;
    },

    setupLanguageSelector() {
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.value = this.currentLanguage;
            langSelector.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
    },

    setLanguage(lang) {
        if (lang === this.currentLanguage) return;
        localStorage.setItem('CCNA_language', lang);
        window.location.reload();
    }
};

// Asegurarnos de que el motor se inicialice después de que todo esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
    i18n.init();
}
