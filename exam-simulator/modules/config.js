// exam-simulator/modules/config.js

export const CONFIG = { // <<<--- AÑADIDO 'export'
    // --- Categories ---
    // Defines the main exam categories, linking them to i18n keys for translation.
    categories: [
        { id: '1.0-network-fundamentals', i18nKey: 'category_1_0' },
        { id: '2.0-network-access', i18nKey: 'category_2_0' },
        { id: '3.0-ip-connectivity', i18nKey: 'category_3_0' },
        { id: '4.0-ip-services', i18nKey: 'category_4_0' },
        { id: '5.0-security-fundamentals', i18nKey: 'category_5_0' },
        { id: '6.0-automation-programmability', i18nKey: 'category_6_0' }
    ],

    // --- Visuals ---
    // Provides colors and icons for category badges and potentially other UI elements.
    categoryVisuals: {
        '1.0-network-fundamentals': { color: '#0d6efd', icon: 'fa-sitemap' },
        '2.0-network-access': { color: '#198754', icon: 'fa-network-wired' },
        '3.0-ip-connectivity': { color: '#6f42c1', icon: 'fa-route' },
        '4.0-ip-services': { color: '#fd7e14', icon: 'fa-cogs' },
        '5.0-security-fundamentals': { color: '#dc3545', icon: 'fa-shield-alt' },
        '6.0-automation-programmability': { color: '#0dcaf0', icon: 'fa-code' }
    },

    // --- Exam Logic ---
    // Defines the official weighting for each category, used for distributing questions.
    categoryWeights: {
        '1.0-network-fundamentals': 0.20,
        '2.0-network-access': 0.20,
        '3.0-ip-connectivity': 0.25,
        '4.0-ip-services': 0.10,
        '5.0-security-fundamentals': 0.15,
        '6.0-automation-programmability': 0.10
    },
    // Default time per question (in seconds) for exam mode if no custom limit is set.
    timePerQuestion: 90,

    // --- Question Types ---
    // Defines the supported question types and their associated HTML input type.
    questionTypes: {
        'single-choice': { inputType: 'radio' },
        'multiple-choice': { inputType: 'checkbox' },
        'true-false': { inputType: 'radio' }, // Rendered like single-choice
        // Add definitions for future types as they are implemented:
        // 'drag-and-drop': { /* ... custom rendering logic needed ... */ },
        // 'fill-in-the-blank': { inputType: 'text' },
        // 'ordering': { /* ... custom rendering logic needed ... */ },
        // 'matching': { /* ... custom rendering logic needed ... */ },
        // 'hotspot': { /* ... custom rendering logic needed ... */ },
        // 'simulator': { /* ... custom rendering logic needed ... */ }
    }
};