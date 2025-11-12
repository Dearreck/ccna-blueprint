"use strict";

export const dom = {
    // Pestañas
    calcTab: document.getElementById('calculator-tab-btn'),
    exerTab: document.getElementById('exercises-tab-btn'),

    // Contenedores de Pestañas
    calcPane: document.getElementById('calculator-pane'),
    exerPane: document.getElementById('exercises-pane'),
    resultsCard: document.getElementById('results-card'),

    // Selector de Modo
    modeRadios: document.querySelectorAll('input[name="calculationType"]'),

    // Formulario Classful
    classfulForm: document.getElementById('classful-form'),
    classfulIp: document.getElementById('classful-ip'),
    classfulReqType: document.querySelectorAll('input[name="classfulRequirementType"]'),
    classfulSubnets: document.getElementById('classful-subnets'),
    classfulHosts: document.getElementById('classful-hosts'),

    // Formulario VLSM
    vlsmForm: document.getElementById('vlsm-form'),
    vlsmCidr: document.getElementById('vlsm-cidr'),
    vlsmReqList: document.getElementById('vlsm-requirements-list'),
    addVlsmBtn: document.getElementById('add-vlsm-req-btn'),

    // Resultados Calculadora
    resultsContainer: document.getElementById('results-container'),
    resultsSummary: document.getElementById('results-summary'),
    copyArea: document.getElementById('copy-results-area'),
    copyBtn: document.getElementById('copy-results-btn'),
    copyFeedback: document.getElementById('copy-feedback'),

    // --- Selectores de Ejercicios ---
    exGenForm: document.getElementById('exercise-generator-form'),
    exType: document.getElementById('ex-type'),
    exDisplayArea: document.getElementById('exercise-display-area'),
    exProblemText: document.getElementById('problem-text'),
    exAnswerForm: document.getElementById('exercise-answer-form'),
    exAnswerInputs: document.getElementById('answer-inputs-container'),
    exShowSolutionBtn: document.getElementById('show-answer-btn'),
    exFeedback: document.getElementById('exercise-feedback'),

    // --- Selectores para Modo Desafío ---
    exModeToggle: document.getElementById('ex-mode-toggle'),
    practiceConfigContainer: document.getElementById('practice-config-container'),
    challengeStartContainer: document.getElementById('challenge-start-container'),
    startChallengeBtn: document.getElementById('start-challenge-btn'),

    // --- Selectores para Lógica de Desafío ---
    exChallengeCounter: document.getElementById('ex-challenge-counter'),
    exSubmitBtn: document.getElementById('ex-submit-btn'),

    // Formulario Sumarización (NUEVO)
    summaryForm: document.getElementById('summary-form'),
    summaryIpList: document.getElementById('summary-ip-list')
};