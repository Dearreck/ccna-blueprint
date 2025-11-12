/*
 * Archivo: /tools/subnetting-gen/modules/exercises.js
 * Lógica "Controladora": Maneja el estado, la UI y los eventos
 * para la pestaña "Generador de Ejercicios".
 *
 * (VERSIÓN 3 - CON FEEDBACK DETALLADO INTEGRADO)
 */
"use strict";

import { dom } from './dom-selectors.js';
import { generators, generateComingSoon } from './exercise-generators.js';
// Traemos la función de renderizado de la calculadora
import { renderResults } from './calculator.js';
// Importar el nuevo renderizador de feedback
import { FeedbackRenderer } from './feedback-renderer.js';
import { BitWorkshop } from '../../../components/bit-workshop/bit-workshop.js';

// --- Variables de Estado ---

let currentProblem = null;
let inChallengeMode = false;
const CHALLENGE_LENGTH = 10;
let challengeProblems = [];
let currentChallengeIndex = 0;
let challengeScore = 0;

// --- Caché para Plantillas ---
const templateCache = {};

async function _loadTemplate(templateName) {
    const templateId = `${templateName}-template`;

    if (templateCache[templateId]) {
        return templateCache[templateId].content.cloneNode(true);
    }

    try {
        const response = await fetch(`templates/${templateName}.html`);
        if (!response.ok) {
            throw new Error(`Error ${response.status} al cargar ${templateName}.html`);
        }
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const templateElement = doc.getElementById(templateId);

        if (!templateElement || !(templateElement instanceof HTMLTemplateElement)) {
            console.error(`Elemento <template> con id "${templateId}" no encontrado en ${templateName}.html`);
            return null;
        }

        templateCache[templateId] = templateElement;
        return templateElement.content.cloneNode(true);

    } catch (error) {
        console.error(`Fallo al cargar o procesar la plantilla "${templateName}":`, error);
        return null;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// =========================================================================
// FUNCIONES DE RENDERIZADO Y TRADUCCIÓN
// =========================================================================

function renderProblemText() {
    if (!currentProblem || !currentProblem.problemTemplateKey) {
        dom.exProblemText.innerHTML = '';
        return;
    }

    const { problemData, problemTemplateKey } = currentProblem;
    let textTemplate = i1n.get(problemTemplateKey);

    if (!textTemplate) {
        dom.exProblemText.innerHTML = `Error: Missing i18n key ${problemTemplateKey}`;
        return;
    }

    // --- 1. MANEJO DE REEMPLAZOS COMPLEJOS (LISTAS) ---
    if (problemTemplateKey === 'ex_vlsm_problem' && problemData.requirements) {
        const reqListHtml = '<ul>' + problemData.requirements.map(r => {
            const hostsText = i1n.get('ex_vlsm_hosts_label').replace('{hosts}', r.hosts);
            const nameText = i1n.get(r.nameKey);
            return `<li><strong>${nameText}</strong>: ${hostsText}</li>`;
        }).join('') + '</ul>';
        textTemplate = textTemplate.replace(/{reqListHtml}/g, reqListHtml);
    }

    if (problemTemplateKey === 'ex_summarization_problem' && problemData.ipList) {
        const ipListHtml = '<ul class="text-start ps-5">' + problemData.ipList.map(ip => {
            return `<li><code>${ip}/${problemData.basePrefix}</code></li>`;
        }).join('') + '</ul>';
        textTemplate = textTemplate.replace(/{ipList}/g, ipListHtml);
    }

    // --- 2. MANEJO DE REEMPLAZOS DE TEXTO DINÁMICO ---
    if (problemTemplateKey === 'ex_vlsm_problem') {
        const largestText = i1n.get('ex_vlsm_largest_networks_text');
        textTemplate = textTemplate.replace(/{boldLargestNetworks}/g, `<strong>${largestText}</strong>`);
    }

    if (problemTemplateKey === 'ex_classful_problem' && problemData) {
        const reqTextKey = (problemData.reqType === 'subnets') ? 'ex_classful_req_subnets' : 'ex_classful_req_hosts'; // Corregido: 'ex_classful_req_subnets'
        const reqText = i1n.get(reqTextKey).replace(/{value}/g, `<strong>${problemData.value}</strong>`);
        textTemplate = textTemplate.replace(/{reqText}/g, reqText);
    }

    // --- 3. MANEJO DE REEMPLAZOS SIMPLES (CLAVE -> VALOR) ---
    if (problemData) {
        for (const key in problemData) {
            if (typeof problemData[key] === 'string' || typeof problemData[key] === 'number') {
                const placeholder = `{${key}}`;
                let value = `<strong>${problemData[key]}</strong>`;

                if (key === 'ipStr') {
                    const mask = problemData.maskStr || '';
                    value += ' ' + createWorkshopButton(problemData.ipStr, mask);
                } else if (key === 'networkCidr') {
                    const [ip, cidr] = problemData.networkCidr.split('/');
                    value += ' ' + createWorkshopButton(ip, `/${cidr}`);
                }

                textTemplate = textTemplate.replace(new RegExp(placeholder, 'g'), value);
            }
        }
    }

    dom.exProblemText.innerHTML = textTemplate;
}

function createWorkshopButton(ip, mask) {
    return `<span 
              class="bit-workshop-trigger" 
              role="button" 
              tabindex="0"
              title="${i1n.get('bits_workshop_title')}" 
              data-ip="${ip}" 
              data-mask="${mask}"
              style="cursor: help; font-style: normal; margin-left: 4px;">💡</span>`;
}

async function renderExerciseUIInputs() {
    if (!currentProblem) {
        dom.exAnswerInputs.innerHTML = '';
        return;
    }

    const { templateName, isDynamicList, reqCount } = currentProblem;
    dom.exAnswerInputs.innerHTML = '';

    const isComingSoon = (templateName === 'ex-mode-coming-soon');
    const submitButton = dom.exAnswerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = isComingSoon;
    if (dom.exShowSolutionBtn) dom.exShowSolutionBtn.disabled = isComingSoon;

    if (isDynamicList) {
        for (let i = 1; i <= reqCount; i++) {
            const templateFragment = await _loadTemplate(templateName);
            if (!templateFragment) continue;

            const netKey = `net${i}`;
            templateFragment.querySelectorAll('label').forEach(label => {
                const prefix = label.getAttribute('data-i18n-id-prefix');
                if (prefix) {
                    const newId = prefix.replace('net', netKey);
                    const inputId = newId.replace('label-', 'ans-');
                    label.id = newId;
                    label.setAttribute('for', inputId);
                }
            });
            templateFragment.querySelectorAll('input').forEach(input => {
                const prefix = input.getAttribute('data-i18n-id-prefix');
                if (prefix) {
                    input.id = prefix.replace('net', netKey);
                }
            });
            if (i === reqCount) {
                const hr = templateFragment.querySelector('hr');
                if (hr) hr.style.display = 'none';
            }
            dom.exAnswerInputs.appendChild(templateFragment);
        }
    } else {
        const templateFragment = await _loadTemplate(templateName);
        if (!templateFragment) {
            FeedbackRenderer.renderError('ex_error_generating'); // Usar el renderizador de feedback
            return;
        }
        dom.exAnswerInputs.appendChild(templateFragment);
    }
}

function translateDynamicLabels() {
    if (!currentProblem || !currentProblem.templateVars) return;

    const { templateVars, isDynamicList, reqCount } = currentProblem;

    if (isDynamicList) { // VLSM
        for (const templateId in templateVars) {
            const dynamicLabelEl = dom.exAnswerInputs.querySelector(`#${templateId}`);
            const dynamicVarData = templateVars[templateId];

            if (dynamicLabelEl && dynamicVarData && dynamicVarData.key) {
                const name = i1n.get(dynamicVarData.nameKey);
                const labelTemplate = i1n.get(dynamicVarData.key);
                dynamicLabelEl.textContent = labelTemplate.replace('{reqName}', name);
                // Quita el atributo para que i1n.translatePage() no lo sobrescriba
                dynamicLabelEl.removeAttribute('data-i18n-id-prefix');
            }
        }
    } else { // Classful
        for (const labelId in templateVars) {
            const labelEl = dom.exAnswerInputs.querySelector(`#${labelId}`);
            const varData = templateVars[labelId];
            if (labelEl) {
                const i18nKey = labelEl.getAttribute('data-i18n');
                const labelTemplate = i1n.get(i18nKey);
                labelEl.textContent = labelTemplate.replace('{index}', varData.index);

                // Quita el atributo para que i1n.translatePage() no lo sobrescriba
                labelEl.removeAttribute('data-i18n');
            }
        }
    }
}

/**
 * Muestra el feedback simple (ya no se usa para feedback detallado).
 * Se mantiene por si el modo desafío quiere usarlo.
 */
function renderSimpleFeedback(key) {
    const message = i1n.get(key);
    const alertClass = (key === 'ex_feedback_correct') ? 'alert-success' : 'alert-danger';
    dom.exFeedback.innerHTML = `<div class="alert ${alertClass} mt-4">${message}</div>`;
}


function updateSubmitButton() {
    const submitBtnTextKey = inChallengeMode ? 'ex_next_question_btn' : 'ex_check_btn';
    const submitBtnIcon = inChallengeMode ? 'fa-arrow-right' : 'fa-check';
    if (dom.exSubmitBtn && typeof i1n !== 'undefined') {
        dom.exSubmitBtn.innerHTML = `<i class="fas ${submitBtnIcon} me-2"></i>${i1n.get(submitBtnTextKey)}`;
    }
}

function clearExercise() {
    dom.exDisplayArea.classList.add('d-none');
    dom.exProblemText.innerHTML = '';
    dom.exAnswerInputs.innerHTML = '';
    FeedbackRenderer.clear(); // Limpia el feedback detallado
    currentProblem = null;

    if (dom.exChallengeCounter) dom.exChallengeCounter.innerHTML = '';
    if (dom.exAnswerForm) {
        dom.exAnswerForm.style.display = 'block';
    }

    // --- LÓGICA DE RESETEO DE BOTONES ---
    if (dom.exSubmitBtn) {
        dom.exSubmitBtn.disabled = false;
        // Clonar el botón para eliminar el listener 'click' (de "Siguiente Pregunta")
        // y restaurar el listener 'submit' del formulario.
        const newSubmitBtn = dom.exSubmitBtn.cloneNode(true);
        // Asegurarse de que sea de tipo 'submit'
        newSubmitBtn.setAttribute('type', 'submit');
        dom.exSubmitBtn.parentNode.replaceChild(newSubmitBtn, dom.exSubmitBtn);
        dom.exSubmitBtn = newSubmitBtn; // Re-cachear el nuevo botón en el DOM
    }

    if (dom.exShowSolutionBtn && !inChallengeMode) {
        dom.exShowSolutionBtn.disabled = false;
        dom.exShowSolutionBtn.style.display = 'inline-block';
    }
}

// =========================================================================
// MANEJADORES DE EVENTOS
// =========================================================================

async function handleExerciseGenerate(e) {
    if (e) e.preventDefault();

    const type = dom.exType.value;
    const difficulty = document.querySelector('input[name="ex-difficulty"]:checked').value;

    clearExercise(); // Limpia el estado anterior

    const generatorFunc = generators[type] || generateComingSoon;
    currentProblem = generatorFunc(difficulty);

    if (!currentProblem) {
        FeedbackRenderer.renderError('ex_error_generating'); // Usar feedback
        return;
    }

    await renderExerciseUIInputs();
    if (typeof i1n !== 'undefined') {
        i1n.translatePage();
    }
    renderProblemText();
    translateDynamicLabels();

    updateSubmitButton(); // Restablece el texto a "Revisar Respuesta"
    dom.exDisplayArea.classList.remove('d-none');
    dom.exDisplayArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleExerciseCheck(e) {
    e.preventDefault();
    if (!currentProblem) return;

    let allCorrect = true;

    dom.exAnswerInputs.querySelectorAll('input').forEach(el => {
        el.classList.remove('is-valid', 'is-invalid');
    });

    for (const key in currentProblem.solution) {
        const inputEl = document.getElementById(`ans-${key}`);
        if (inputEl) {
            const userAnswer = inputEl.value.trim().replace(/\s/g, '');
            const correctAnswer = String(currentProblem.solution[key]).replace(/\s/g, '');

            if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
                inputEl.classList.add('is-valid');
            } else {
                inputEl.classList.add('is-invalid');
                allCorrect = false;
            }
        }
    }

    // --- LÓGICA DE FEEDBACK MODIFICADA ---
    if (inChallengeMode) {
        if (allCorrect) {
            challengeScore++;
            renderSimpleFeedback('ex_feedback_correct');
        } else {
            renderSimpleFeedback('ex_feedback_incorrect');
        }
        dom.exSubmitBtn.disabled = true;
        currentChallengeIndex++;

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (currentChallengeIndex < CHALLENGE_LENGTH) {
            await loadChallengeProblem(currentChallengeIndex);
            dom.exSubmitBtn.disabled = false;
        } else {
            showChallengeResults();
        }
    } else {
        // --- MODO PRÁCTICA (NUEVA LÓGICA) ---
        // 1. Mostrar la explicación detallada SIEMPRE
        //await FeedbackRenderer.render(currentProblem);

        // --- MODO PRÁCTICA (NUEVA LÓGICA) ---
        // 1. Mostrar la explicación detallada SIEMPRE

        // --- INICIO DE LA CORRECCIÓN ---
        if (currentProblem.feedbackData && currentProblem.feedbackData.isVlsm) {
            // Es VLSM: Reutiliza la lógica de la calculadora para renderizar la tabla.
            const oldResultsContainer = dom.resultsContainer;
            dom.resultsContainer = dom.exFeedback; // Apuntar al div de feedback
            dom.exFeedback.innerHTML = ''; // Limpiar

            // Añadir título antes de la tabla
            dom.exFeedback.innerHTML = `<h5 class="alert-heading" data-i18n="fb_detailed_solution">Solución Detallada</h5><hr>`;

            // Renderizar la tabla VLSM
            await renderResults(currentProblem.fullCalcResult);
            i1n.translatePage(); // Traducir la tabla

            dom.resultsContainer = oldResultsContainer; // Restaurar el selector original
        } else {
            // Es otro modo: Renderizar el feedback de texto normal.
            await FeedbackRenderer.render(currentProblem);
        }
        // --- FIN DE LA CORRECCIÓN ---
    }
}

async function handleExerciseShowSolution() {
    if (!currentProblem) return;

    for (const key in currentProblem.solution) {
        const inputEl = document.getElementById(`ans-${key}`);
        if (inputEl) {
            inputEl.value = currentProblem.solution[key];
            inputEl.classList.remove('is-invalid');
            inputEl.classList.add('is-valid');
        }
    }

    // --- LÓGICA DE FEEDBACK MODIFICADA ---

    // 1. Comprobar si es VLSM y renderizar la tabla
    if (currentProblem.feedbackData && currentProblem.feedbackData.isVlsm) {
        const oldResultsContainer = dom.resultsContainer;
        dom.resultsContainer = dom.exFeedback; // Apuntar al div de feedback
        dom.exFeedback.innerHTML = ''; // Limpiar

        // Añadir título antes de la tabla
        dom.exFeedback.innerHTML = `<h5 class="alert-heading" data-i18n="fb_detailed_solution">Solución Detallada</h5><hr>`;

        await renderResults(currentProblem.fullCalcResult); // Renderizar la tabla VLSM
        i1n.translatePage(); // Traducir la tabla

        dom.resultsContainer = oldResultsContainer; // Restaurar
    } else {
        // 2. Renderizar el feedback de texto normal para otros modos
        await FeedbackRenderer.render(currentProblem);
    }

    // 3. Deshabilitar botones
    if (dom.exSubmitBtn) dom.exSubmitBtn.disabled = true;
    if (dom.exShowSolutionBtn) dom.exShowSolutionBtn.disabled = true;
}

/**
 * Re-renderiza el texto del ejercicio actual cuando cambia el idioma.
 * (ACTUALIZADA PARA CORREGIR EL RE-RENDERIZADO DEL FEEDBACK)
 */
async function refreshExerciseLanguage() {
    if (!currentProblem || dom.exDisplayArea.classList.contains('d-none')) {
        return; // No hay nada que re-traducir
    }

    // 1. Re-renderizar el enunciado principal
    renderProblemText();

    // 2. Re-traducir todas las etiquetas estáticas, placeholders, etc.
    i1n.translatePage();

    // 3. Re-traducir las etiquetas de input dinámicas (VLSM, Classful Nth)
    translateDynamicLabels();

    // 4. (NUEVA LÓGICA) Re-renderizar el feedback si ya está visible
    if (dom.exFeedback.innerHTML !== '' && currentProblem.feedbackData) {
        // Si el panel de feedback tiene contenido (es decir, ya se mostró la solución
        // o se revisó la respuesta), entonces forzamos un re-renderizado
        // del feedback para que se traduzca.

        console.log("Re-rendering feedback panel for language change...");

        // Manejar caso especial de VLSM (tabla)
        if (currentProblem.feedbackData.isVlsm) {
            // Re-renderizar la tabla de VLSM
            const oldResultsContainer = dom.resultsContainer;
            dom.resultsContainer = dom.exFeedback;
            dom.exFeedback.innerHTML = ''; // Limpiar
            dom.exFeedback.innerHTML = `<h5 class="alert-heading" data-i18n="fb_detailed_solution">Solución Detallada</h5><hr>`;
            await renderResults(currentProblem.fullCalcResult); // Esta función ya la importa 'exercises.js'
            i1n.translatePage(); // Traducir la tabla
            dom.resultsContainer = oldResultsContainer; // Restaurar
        } else if (currentProblem.templateName !== 'ex-mode-coming-soon') {
            // Renderizar el feedback de texto normal para otros modos
            await FeedbackRenderer.render(currentProblem); // Re-renderizar feedback de texto
        }
    }

    // 5. Re-traducir el contador y el botón de submit (para modo desafío)
    if (inChallengeMode && dom.exChallengeCounter) {
        const counterText = i1n.get('ex_challenge_counter', 'Pregunta {current} de {total}')
            .replace('{current}', currentChallengeIndex + 1)
            .replace('{total}', CHALLENGE_LENGTH);
        dom.exChallengeCounter.innerHTML = counterText;
    }

    // 6. Actualizar texto del botón (considerando si es "Check" o "Next")
    if (dom.exSubmitBtn.getAttribute('type') === 'submit') {
        // Si es el botón "Revisar" original
        updateSubmitButton();
    } else if (!inChallengeMode) {
        // Si es el botón "Siguiente Ejercicio" (clonado)
        dom.exSubmitBtn.innerHTML = `<i class="fas fa-arrow-right me-2"></i>${i1n.get('ex_next_question_btn')}`;
    }
}

// =========================================================================
// LÓGICA MODO DESAFÍO
// =========================================================================

function toggleChallengeMode(event) {
    inChallengeMode = event.target.checked;
    const pane = dom.exerPane;
    const practiceLabel = pane.querySelector('label[for="ex-mode-toggle"][data-i18n="ex_practice_mode"]');
    const challengeLabel = pane.querySelector('label[for="ex-mode-toggle"][data-i18n="ex_challenge_mode"]');

    if (inChallengeMode) {
        pane.classList.remove('practice-mode-active');
        pane.classList.add('challenge-mode-active');
        clearExercise();
        dom.exShowSolutionBtn.style.display = 'none';
        if (dom.challengeStartContainer) {
            dom.challengeStartContainer.style.display = 'block';
            dom.challengeStartContainer.classList.remove('d-none');
        }
        if (practiceLabel) practiceLabel.classList.add('text-muted');
        if (challengeLabel) challengeLabel.classList.remove('text-muted');

    } else {
        pane.classList.add('practice-mode-active');
        pane.classList.remove('challenge-mode-active');
        clearExercise();
        dom.exShowSolutionBtn.style.display = 'inline-block';
        if (dom.challengeStartContainer) {
            dom.challengeStartContainer.style.display = 'none';
        }
        if (practiceLabel) practiceLabel.classList.remove('text-muted');
        if (challengeLabel) challengeLabel.classList.add('text-muted');
    }

    updateSubmitButton();
}

function generateChallengeProblems() {
    const allTypes = Object.keys(generators);
    let problems = [];

    const difficulties = [
        'easy', 'easy', 'easy', 'easy',
        'medium', 'medium', 'medium', 'medium',
        'hard', 'hard'
    ];

    difficulties.forEach(diff => {
        const randomType = allTypes[Math.floor(Math.random() * allTypes.length)];
        problems.push(generators[randomType].bind(null, diff));
    });

    shuffleArray(problems);
    challengeProblems = problems;
}

async function loadChallengeProblem(index) {
    if (index >= challengeProblems.length) {
        showChallengeResults();
        return;
    }

    clearExercise();

    const generatorFunc = challengeProblems[index];
    currentProblem = generatorFunc();

    await renderExerciseUIInputs();
    if (typeof i1n !== 'undefined') {
        i1n.translatePage();
    }
    renderProblemText();
    translateDynamicLabels();

    const counterText = i1n.get('ex_challenge_counter', 'Pregunta {current} de {total}')
        .replace('{current}', index + 1)
        .replace('{total}', CHALLENGE_LENGTH);
    if (dom.exChallengeCounter) dom.exChallengeCounter.innerHTML = counterText;

    updateSubmitButton();
    dom.exDisplayArea.classList.remove('d-none');
}

function startChallenge() {
    if (!inChallengeMode) {
        dom.exModeToggle.checked = true;
        dom.exModeToggle.dispatchEvent(new Event('change'));
    }
    if (dom.challengeStartContainer) {
        dom.challengeStartContainer.style.display = 'none';
    }
    currentChallengeIndex = 0;
    challengeScore = 0;
    challengeProblems = [];
    generateChallengeProblems();
    loadChallengeProblem(currentChallengeIndex);
}

function showChallengeResults() {
    clearExercise();
    dom.exDisplayArea.classList.remove('d-none');

    const title = i1n.get('ex_challenge_results_title');
    const scoreText = i1n.get('ex_final_score');
    const buttonText = i1n.get('ex_view_results_btn');

    dom.exProblemText.innerHTML = `<h2 class="text-center">${title}</h2>`;
    // Usamos el FeedbackRenderer para mostrar los resultados
    dom.exFeedback.innerHTML = `
        <div class="alert alert-primary text-center">
            <h3 class="alert-heading">${scoreText}</h3>
            <p class="display-4 fw-bold">${challengeScore} / ${CHALLENGE_LENGTH}</p>
            <button id="reset-challenge-btn" class="btn btn-primary btn-lg mt-3">
                ${buttonText}
            </button>
        </div>
    `;

    document.getElementById('reset-challenge-btn').addEventListener('click', () => {
        dom.exModeToggle.checked = false;
        dom.exModeToggle.dispatchEvent(new Event('change'));
        clearExercise();
    });

    dom.exAnswerForm.style.display = 'none';
}


// =========================================================================
// INICIALIZACIÓN
// =========================================================================

export function initExercises() {
    dom.exGenForm.addEventListener('submit', handleExerciseGenerate);
    dom.exAnswerForm.addEventListener('submit', handleExerciseCheck);
    dom.exShowSolutionBtn.addEventListener('click', handleExerciseShowSolution);
    dom.calcTab.addEventListener('click', clearExercise);

    dom.exDisplayArea.addEventListener('click', (e) => {
        const trigger = e.target.closest('.bit-workshop-trigger');
        if (trigger) {
            e.preventDefault();
            const ip = trigger.dataset.ip;
            const mask = trigger.dataset.mask;
            BitWorkshop.open(ip, mask);
        }
    });

    if (dom.exModeToggle) {
        dom.exModeToggle.addEventListener('change', toggleChallengeMode);
    }
    if (dom.startChallengeBtn) {
        dom.startChallengeBtn.addEventListener('click', startChallenge);
    }

    if (dom.exModeToggle) {
        dom.exModeToggle.checked = false;
        dom.exModeToggle.dispatchEvent(new Event('change'));
    }

    if (typeof i1n !== 'undefined') {
        i1n.registerDynamicRenderer(refreshExerciseLanguage);
    }
}