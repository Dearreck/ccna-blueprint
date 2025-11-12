/*
 * Archivo: /tools/subnetting-gen/subnetting-gen.js
 * Archivo principal (módulo) que importa e inicializa
 * los módulos de la calculadora y los ejercicios.
 */
"use strict";

// Importar los inicializadores de los módulos
import { initCalculator } from './modules/calculator.js';
import { initExercises } from './modules/exercises.js';

// Importar selectores del DOM para listeners globales (inter-módulos)
import { dom } from './modules/dom-selectors.js';

/**
 * Inicializa la aplicación completa.
 */
async function init() {

    if (typeof i1n !== 'undefined') {
        // Espera a que las traducciones de subnetting estén listas
        // Esto cargará Y disparará la traducción automáticamente.
        // Automáticamente esperará a que i1n.init() termine.
        await i1n.loadNamespaces(['subnet_gen']);
    }

    // Inicializar cada módulo
    initCalculator();
    initExercises();

    // --- Listeners Globales / Inter-módulos ---

    // Limpiar el área de ejercicio si el usuario vuelve a la calculadora
    dom.calcTab.addEventListener('click', () => {
        dom.exDisplayArea.classList.add('d-none');
    });
}

// Iniciar la aplicación
document.addEventListener('DOMContentLoaded', init);