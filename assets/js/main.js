import { BitWorkshop } from '../../components/bit-workshop/bit-workshop.js';

let globalTooltipElements = [];

/**
 * Destruye todas las instancias de tooltips existentes. (GLOBAL)
 */
window.disposeTooltips = () => {
    globalTooltipElements.forEach(el => {
        const tooltipInstance = bootstrap.Tooltip.getInstance(el);
        if (tooltipInstance) {
            tooltipInstance.dispose(); // Destruye la instancia
        }
    });
    globalTooltipElements = []; // Limpia el array
    // console.log("Disposed global tooltips.");
};

/**
 * Inicializa (o re-inicializa) todos los tooltips de Bootstrap en la página. (GLOBAL)
 */
window.initializeOrReinitializeTooltips = () => {
    window.disposeTooltips(); // Llama a la global

    // Busca TODOS los elementos
    globalTooltipElements = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));

    // Crea nuevas instancias
    globalTooltipElements.forEach(tooltipTriggerEl => {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
    // console.log(`Initialized/Reinitialized ${globalTooltipElements.length} global tooltips.`);
};

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    /**
     * Carga un componente HTML desde una URL y lo inyecta en un selector del DOM.
     * @param {string} selector - El selector CSS del elemento contenedor.
     * @param {string} url - La URL del archivo HTML del componente.
     * @returns {Promise<void>} Una promesa que se resuelve cuando el componente está cargado.
     */
    const loadComponent = (selector, url) => {
        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Error al cargar ${url}: ${response.statusText}`);
                return response.text();
            })
            .then(data => {
                const element = document.querySelector(selector);
                if (element) element.innerHTML = data;
                // Devolvemos resolved para indicar éxito (útil para Promise.all)
            });
    };

    /**
     * Inicializa el botón de cambio de tema.
     */
    const initializeThemeToggle = () => {
        const themeToggleButton = document.getElementById('theme-toggle-button');
        if (!themeToggleButton) return;
        const themeIcon = themeToggleButton.querySelector('i');
        if (!themeIcon) return;

        const updateIcon = (theme) => {
            themeIcon.className = (theme === 'dark') ? 'fas fa-sun' : 'fas fa-moon';
        };

        // Usa el tema actual determinado por theme-loader.js
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        updateIcon(currentTheme);

        themeToggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme); // Guarda preferencia
            updateIcon(newTheme);
        });
    };

    /**
     * Inicializa el trigger standalone del Taller de Bits en la navbar.
     */
    const initializeBitWorkshopTrigger = () => {
        const workshopTrigger = document.getElementById('standalone-workshop-trigger');
        if (workshopTrigger) {
            workshopTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                // Llama a BitWorkshop.open SIN argumentos
                BitWorkshop.open();
            });
        }
    };

    /**
     * Inicializa el botón de cambio de idioma.
     */
    const initializeLanguageSelector = () => {
        const langButton = document.getElementById('language-toggle-button');
        if (!langButton) return;
        const langTextSpan = document.getElementById('language-toggle-text');
        if (!langTextSpan) return;

        const updateText = () => {
            // Asegúrate de que i1n esté disponible
            if (typeof i1n !== 'undefined' && i1n.currentLanguage) {
                langTextSpan.textContent = (i1n.currentLanguage === 'es') ? 'EN' : 'ES';
            } else {
                // Fallback si i1n no está listo (raro con el nuevo orden, pero seguro)
                const savedLang = localStorage.getItem('CCNA_language') || 'es';
                langTextSpan.textContent = (savedLang === 'es') ? 'EN' : 'ES';
            }
        };

        // Llama una vez para establecer el texto inicial
        updateText();

        langButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof i1n === 'undefined') return; // Seguridad
            const newLang = (i1n.currentLanguage === 'es') ? 'en' : 'es';
            i1n.setLanguage(newLang); // i1n se encarga de redibujar y guardar
            updateText(); // Actualiza solo el texto del botón
        });
    };

    /**
     * Función principal de inicialización de la página.
     */
    const init = async () => {
        const scriptUrl = new URL(import.meta.url);
        const basePath = new URL('../../', scriptUrl).pathname.replace(/\/$/, '');
        // Resultado local: ""
        // Resultado GitHub: "/ccna-blueprint"
        // -----------------------------------------------------

        try {
            // 1. Cargar Navbar
            await loadComponent('#navbar-placeholder', `${basePath}/components/nav.html`);

            // Si estamos en GitHub (basePath tiene contenido), buscamos todos los enlaces que empiezan por "/"
            // y les añadimos el nombre del repositorio al principio.
            if (basePath) {
                document.querySelectorAll('#navbar-placeholder a[href^="/"]').forEach(link => {
                    const currentHref = link.getAttribute('href');
                    link.setAttribute('href', basePath + currentHref);
                });
            }
            // --------------------------------------------------

            // --- PASO 2: Ahora que el Navbar está en el DOM, inicializa sus controles ---
            initializeThemeToggle();
            // ¡Importante! Inicializa i18n AHORA, ANTES de cargar el footer y ANTES de mostrar el body
            await i1n.init(); // Espera a que cargue idioma y traduzca inicialmente
            initializeLanguageSelector(); // Inicializa el selector de idioma después de i1n

            initializeBitWorkshopTrigger(); // Inicializa el Taller de Bits

            // --- PASO 3: Carga el Footer (puede ser en paralelo ahora) ---
            if (basePath) {
                document.querySelectorAll('#footer-placeholder a[href^="/"]').forEach(link => {
                    const currentHref = link.getAttribute('href');
                    link.setAttribute('href', basePath + currentHref);
                });
            }
            // --------------------------------------------------

            // Carga el componente del Taller de Bits en segundo plano
            await BitWorkshop.load();

        } catch (error) {
            console.error('Fallo al cargar componentes o inicializar i18n:', error);
            // Aunque falle, mostramos el body para no dejar la página en blanco
        } finally {
            // --- PASO 4: SOLO AHORA, haz visible el body ---
            document.body.classList.add('loaded');
            document.body.style.visibility = 'visible';

            // --- INICIALIZA TODOS LOS TOOLTIPS DE BOOTSTRAP ---
            window.initializeOrReinitializeTooltips();

            // --- REGISTRA LA FUNCIÓN PARA ACTUALIZACIONES DE IDIOMA ---
            if (typeof i1n !== 'undefined') {
                // Esta función se ejecutará CADA VEZ que i1n.changeLanguage() termine
                i1n.registerDynamicRenderer(window.initializeOrReinitializeTooltips);
            } else {
                console.error("i1n object not found. Tooltips won't update on language change.");
            }
        }

        // Actualiza el título usando la clave i18n del data-title del body
        const titleKey = document.body.dataset.title;
        if (titleKey && typeof i1n !== 'undefined') {
            document.title = i1n.get(titleKey) || 'CCNA Blueprint'; // Usa i1n.get()
        } else {
            document.title = 'CCNA Blueprint'; // Fallback
        }
    };

    // --- PASO 0: Oculta el body al inicio ---
    document.body.style.visibility = 'hidden';
    // Opcional: Si usas fade-in con CSS
    // body { opacity: 0; transition: opacity 0.3s ease-in-out; }
    // body.loaded { opacity: 1; }

    init(); // Llama a la función principal
});


