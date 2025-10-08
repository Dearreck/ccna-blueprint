// assets/js/i18n.js (Versión Definitiva con Ruta Absoluta)
const i18n = {
    currentLanguage: 'es',
    translations: {},

    async init() {
        // Determina el idioma a usar (del localStorage o del navegador)
        const savedLang = localStorage.getItem('CCNA_language');
        const browserLang = navigator.language.split('-')[0];
        this.currentLanguage = savedLang || (['es', 'en'].includes(browserLang) ? browserLang : 'en');
        
        await this.loadTranslations();
        this.translatePage();
        this.setupLanguageSelector();
    
        // Notifica a otros scripts que las traducciones están listas.
        document.dispatchEvent(new CustomEvent('i18n-loaded'));
    },

    async loadTranslations() {
        try {
            // --- LÍNEA CORREGIDA ---
            // Usamos una ruta absoluta desde la raíz del dominio, incluyendo el nombre del repositorio.
            const response = await fetch(`/ccna-blueprint/lang/${this.currentLanguage}.json`);
            
            if (!response.ok) {
                throw new Error(`Fallo al cargar el archivo de idioma: ${response.statusText}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error crítico al cargar traducciones:', error);
            // Si esto falla, es un problema de configuración y no hay mucho que hacer,
            // pero al menos no romperá el resto del sitio.
        }
    },

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.get(key);
            // Solo actualiza si la clave existe en el archivo de idioma
            if (translation && translation !== key) {
                // Usamos innerHTML para permitir iconos dentro de los elementos
                const icon = element.querySelector('i');
                if (icon) {
                    element.innerHTML = `${icon.outerHTML} ${translation}`;
                } else {
                    element.textContent = translation;
                }
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

// Inicializar el motor
/*
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
    i18n.init();
}
*/
