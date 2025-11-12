/*
 * Archivo: /tools/subnetting-gen/modules/feedback-renderer.js
 * (ACTUALIZADO - Implementación Completa de Modo 2)
 */
"use strict";

import { dom } from './dom-selectors.js';
// ¡Importamos NetUtils para formatear el binario!
import * as NetUtils from './net-utils.js';

// --- Caché para Plantillas ---
const templateCache = {};

/**
 * Carga una plantilla HTML desde un archivo o desde el caché local.
 */
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

/**
 * Renderiza el panel de feedback detallado en el DOM.
 * @param {Object} problem - El objeto currentProblem completo.
 */
async function render(problem) {
    if (!problem || !problem.feedbackData) {
        dom.exFeedback.innerHTML = '';
        return;
    }

    let feedbackFragment;

    // Elige el constructor de HTML basado en el tipo de problema
    switch (problem.templateName) {
        case 'ex-mode-2-identify-network':
            feedbackFragment = await _buildMode2Feedback(problem);
            break;
        case 'ex-mode-1-classful':
            feedbackFragment = await _buildMode1Feedback(problem);
            break;
        case 'ex-mode-3-calculate-mask':
            feedbackFragment = await _buildMode3Feedback(problem);
            break;
        case 'ex-mode-4-summarization':
            feedbackFragment = await _buildMode4Feedback(problem);
            break;
        case 'ex-mode-5-vlsm-row':
            feedbackFragment = _buildModeStub('fb_not_available'); // VLSM tiene su propia lógica en exercises.js
            break;
        case 'ex-mode-6-next-network':
            feedbackFragment = await _buildMode6Feedback(problem);
            break;
        default:
            feedbackFragment = _buildModeStub('fb_not_available');
    }

    // Crea el contenedor principal del feedback con el estilo correcto
    const feedbackContainer = document.createElement('div');
    feedbackContainer.className = 'feedback-container mt-4'; // Usando la clase de theme.css
    feedbackContainer.setAttribute('role', 'region');
    feedbackContainer.setAttribute('aria-live', 'polite');

    if (feedbackFragment) {
        feedbackContainer.appendChild(feedbackFragment); // Añadimos el contenido del template
    }

    dom.exFeedback.innerHTML = ''; // Limpiar
    dom.exFeedback.appendChild(feedbackContainer); // Añadir el nuevo contenedor

    // Llama a i1n para traducir el nuevo HTML inyectado
    if (typeof i1n.translatePage === 'function') {
        i1n.translatePage();
    }
}

/**
 * Limpia el contenedor de feedback.
 */
function clear() {
    dom.exFeedback.innerHTML = '';
}

// --- CONSTRUCTORES DE FEEDBACK PRIVADOS ---

/**
 * Crea un fragmento de "Próximamente" para modos no implementados.
 * @param {string} key - La clave i18n a mostrar.
 * @returns {DocumentFragment}
 */
function _buildModeStub(key) {
    const fragment = document.createDocumentFragment();
    const p = document.createElement('p');
    p.dataset.i18n = key;
    p.textContent = i1n.get(key, 'Explicación no disponible.');

    // Añadir el título "Solución Detallada"
    const h5 = document.createElement('h5');
    h5.className = 'alert-heading';
    h5.dataset.i18n = 'fb_detailed_solution';
    h5.textContent = i1n.get('fb_detailed_solution', 'Solución Detallada');

    const hr = document.createElement('hr');

    fragment.appendChild(h5);
    fragment.appendChild(hr);
    fragment.appendChild(p);
    return fragment;
}


/**
 * Construye el DocumentFragment de feedback para el Modo 2 (Análisis de Red)
 * (VERSIÓN REFACTORIZADA - Solo usa textContent)
 * @param {Object} problem - El objeto currentProblem.
 * @returns {Promise<DocumentFragment | null>}
 */
async function _buildMode2Feedback(problem) {
    const templateFragment = await _loadTemplate('ex-mode-2-feedback');
    if (!templateFragment) return null;

    const { feedbackData } = problem;
    const {
        ipStr, maskDDN, ipBin: ipBinRaw, maskBin: maskBinRaw, prefix, wildcardDDN,
        wildcardBin: wildcardBinRaw,
        networkBin: networkBinRaw, networkDDN, broadcastDDN, firstHostDDN, lastHostDDN,
        interestingOctet, interestingOctetValue, magicNumber, magicNumber2x,
        ipInterestingOctetValue, // <--- Necesitábamos esta variable
        networkInterestingOctetValue, maskInputFormat
    } = feedbackData;

    // --- 1. Formatear valores usando net-utils ---
    const ipBin = NetUtils.formatBinaryWithNibbles(ipBinRaw);
    const maskBin = NetUtils.formatBinaryWithNibbles(maskBinRaw);
    const networkBin = NetUtils.formatBinaryWithNibbles(networkBinRaw);
    const wildcardBin = NetUtils.formatBinaryWithNibbles(wildcardBinRaw);

    // Formato alineado para <pre>
    const ddnAligned = NetUtils.formatDecimalAsOctets(maskDDN);
    const ipAligned = NetUtils.formatDecimalAsOctets(ipStr);
    const networkAligned = NetUtils.formatDecimalAsOctets(networkDDN);
    const wildcardAligned = NetUtils.formatDecimalAsOctets(wildcardDDN);
    const broadcastAligned = NetUtils.formatDecimalAsOctets(broadcastDDN);
    const all255Aligned = NetUtils.formatDecimalAsOctets("255.255.255.255");

    // --- 2. Lógica Condicional para el PASO 1 (d-none) ---
    const panelFromDDN = templateFragment.querySelector('#fb-m2-step1-from-ddn');
    const panelFromCIDR = templateFragment.querySelector('#fb-m2-step1-from-cidr');

    if (maskInputFormat === 'ddn') {
        panelFromDDN.classList.remove('d-none');
        panelFromCIDR.classList.add('d-none');
        panelFromDDN.querySelector('#fb-m2-ddn-1-mask').textContent = maskDDN;
        panelFromDDN.querySelector('#fb-m2-ddn-1-ddn').textContent = ddnAligned;
        panelFromDDN.querySelector('#fb-m2-ddn-1-bin').textContent = maskBin;
        panelFromDDN.querySelector('#fb-m2-ddn-1-bin-count').textContent = maskBinRaw.substring(0, prefix);
        panelFromDDN.querySelector('#fb-m2-ddn-1-prefix').textContent = prefix;
        panelFromDDN.querySelector('#fb-m2-ddn-1-cidr-ans').textContent = `/${prefix}`;
    } else { // 'cidr'
        panelFromDDN.classList.add('d-none');
        panelFromCIDR.classList.remove('d-none');
        panelFromCIDR.querySelector('#fb-m2-cidr-1-cidr-in').textContent = `/${prefix}`;
        panelFromCIDR.querySelector('#fb-m2-cidr-1-prefix').textContent = prefix;
        panelFromCIDR.querySelector('#fb-m2-cidr-1-cidr').textContent = `/${prefix}`;
        panelFromCIDR.querySelector('#fb-m2-cidr-1-bin').textContent = maskBin;
        panelFromCIDR.querySelector('#fb-m2-cidr-1-bin-2').textContent = maskBin;
        panelFromCIDR.querySelector('#fb-m2-cidr-1-ddn').textContent = ddnAligned;
    }

    // --- 3. Poblar Paso 2: Wildcard ---
    templateFragment.querySelector('#fb-m2-wildcard-all255').textContent = all255Aligned;
    templateFragment.querySelector('#fb-m2-wildcard-mask-ddn').textContent = ddnAligned;
    templateFragment.querySelector('#fb-m2-wildcard-result-ddn').textContent = wildcardAligned;
    templateFragment.querySelector('#fb-m2-wildcard-mask-bin').textContent = maskBin;
    templateFragment.querySelector('#fb-m2-wildcard-inverted-bin').textContent = wildcardBin;
    templateFragment.querySelector('#fb-m2-wildcard-result-ddn-2').textContent = wildcardAligned;

    // --- 4. Poblar Paso 3: Network ID ---
    // El texto estático se rellena con data-i18n-html
    templateFragment.querySelector('#fb-m2-netid-ip-bin').textContent = ipBin;
    templateFragment.querySelector('#fb-m2-netid-ip-ddn').textContent = ipStr;
    templateFragment.querySelector('#fb-m2-netid-mask-bin').textContent = maskBin;
    templateFragment.querySelector('#fb-m2-netid-mask-ddn').textContent = maskDDN;
    templateFragment.querySelector('#fb-m2-netid-net-bin').textContent = networkBin;
    templateFragment.querySelector('#fb-m2-netid-net-ddn').textContent = networkDDN;

    // --- 5. Poblar Paso 4: Broadcast ---
    // Método A (Wildcard)
    templateFragment.querySelector('#fb-m2-broadcast-net-ddn').textContent = networkAligned;
    templateFragment.querySelector('#fb-m2-broadcast-wild-ddn').textContent = wildcardAligned;
    templateFragment.querySelector('#fb-m2-broadcast-result-ddn').textContent = broadcastAligned;

    // Método B (Magic Number) - REFACTORIZADO
    templateFragment.querySelector('#fb-m2-s4-m1-octet').textContent = interestingOctet;
    templateFragment.querySelector('#fb-m2-s4-m1-value').textContent = interestingOctetValue;
    templateFragment.querySelector('#fb-m2-s4-m2-octetval').textContent = interestingOctetValue;
    templateFragment.querySelector('#fb-m2-s4-m2-magic').textContent = magicNumber;
    templateFragment.querySelector('#fb-m2-s4-m3-magic').textContent = magicNumber;
    templateFragment.querySelector('#fb-m2-s4-m3-magic2x').textContent = magicNumber2x;
    templateFragment.querySelector('#fb-m2-s4-m3-netoctet').textContent = networkInterestingOctetValue;
    templateFragment.querySelector('#fb-m2-s4-m4-magic').textContent = magicNumber; // O (networkInterestingOctetValue + magicNumber) si prefieres
    templateFragment.querySelector('#fb-m2-s4-m5-broadcast').textContent = broadcastDDN;

    // --- 6. Poblar Paso 5: Rango ---
    // REFACTORIZADO
    templateFragment.querySelector('#fb-m2-s5-r1-net').textContent = networkDDN;
    templateFragment.querySelector('#fb-m2-s5-r1-first').textContent = firstHostDDN;
    templateFragment.querySelector('#fb-m2-s5-r2-bcast').textContent = broadcastDDN;
    templateFragment.querySelector('#fb-m2-s5-r2-last').textContent = lastHostDDN;

    return templateFragment;
}


/**
 * Construye el DocumentFragment de feedback para el Modo 3 (Calcular Máscara)
 * @param {Object} problem - El objeto currentProblem.
 * @returns {Promise<DocumentFragment | null>}
 */
async function _buildMode3Feedback(problem) {
    const templateFragment = await _loadTemplate('ex-mode-3-feedback');
    if (!templateFragment) return null;

    const { feedbackData } = problem;
    const f = feedbackData; // Alias corto

    // --- 1. Poblar Paso 1: Identificar Clase ---
    templateFragment.querySelector('#fb-m3-base-net').textContent = f.baseNetwork;
    templateFragment.querySelector('#fb-m3-first-octet').textContent = f.firstOctet;
    templateFragment.querySelector('#fb-m3-class').textContent = f.ipClass;
    templateFragment.querySelector('#fb-m3-class-2').textContent = f.ipClass;
    templateFragment.querySelector('#fb-m3-default-mask').textContent = f.defaultMask;
    templateFragment.querySelector('#fb-m3-default-cidr').textContent = f.defaultCidr;
    templateFragment.querySelector('#fb-m3-default-host-bits').textContent = f.defaultHostBits;

    // --- 2. Poblar Paso 2: Calcular Bits (Lógica condicional) ---
    const hostsPanel = templateFragment.querySelector('#fb-m3-step2-hosts');
    const subnetsPanel = templateFragment.querySelector('#fb-m3-step2-subnets');

    if (f.reqType === 'hosts') {
        hostsPanel.classList.remove('d-none');
        hostsPanel.querySelector('#fb-m3-hosts-req').textContent = f.reqValue; // <-- CORREGIDO (Req 2.1)
        hostsPanel.querySelector('#fb-m3-h-bits').textContent = f.finalBits;
        hostsPanel.querySelector('#fb-m3-h-calc').textContent = f.formulaResult;
        hostsPanel.querySelector('#fb-m3-h-bits-2').textContent = f.finalBits;
    } else { // reqType === 'subnets'
        subnetsPanel.classList.remove('d-none');
        subnetsPanel.querySelector('#fb-m3-subnets-req').textContent = f.reqValue; // <-- CORREGIDO (Req 2.1)
        subnetsPanel.querySelector('#fb-m3-s-bits').textContent = f.finalBits;
        subnetsPanel.querySelector('#fb-m3-s-calc').textContent = f.formulaResult;
        subnetsPanel.querySelector('#fb-m3-s-bits-2').textContent = f.finalBits;
    }

    // --- 3. Poblar Paso 3: Nueva Máscara (Lógica condicional) ---
    const step3Hosts = templateFragment.querySelector('#fb-m3-step3-hosts');
    const step3Subnets = templateFragment.querySelector('#fb-m3-step3-subnets');

    if (f.reqType === 'hosts') {
        step3Hosts.classList.remove('d-none');
        step3Hosts.querySelector('#fb-m3-h-bits-3').textContent = f.hostBits;
        step3Hosts.querySelector('#fb-m3-new-prefix').textContent = f.newPrefix;
    } else { // reqType === 'subnets'
        step3Subnets.classList.remove('d-none');
        // REQ. 3.1: Rellenar el CIDR por defecto
        step3Subnets.querySelector('#fb-m3-default-cidr-2').textContent = f.defaultCidr; // <-- CORREGIDO (Req 3.1)
        step3Subnets.querySelector('#fb-m3-s-bits-3').textContent = f.subnetBits;
        step3Subnets.querySelector('#fb-m3-new-prefix-2').textContent = f.newPrefix;
    }
    // Rellenar parte común
    templateFragment.querySelector('#fb-m3-new-cidr-3').textContent = f.newCidr; // (ej. "/28")
    templateFragment.querySelector('#fb-m3-new-mask-ddn').textContent = f.maskDDN;

    // --- 4. Poblar Paso 4: Totales (NUEVA LÓGICA) ---

    // 4.1: Bits de Subred
    templateFragment.querySelector('#fb-m3-calc-s-cidr').textContent = f.newCidr;
    templateFragment.querySelector('#fb-m3-calc-s-default').textContent = f.defaultCidr;
    templateFragment.querySelector('#fb-m3-calc-s-bits').textContent = f.subnetBits;
    templateFragment.querySelector('#fb-m3-calc-s-bits-2').textContent = f.subnetBits;
    templateFragment.querySelector('#fb-m3-total-subnets').textContent = f.totalSubnets;

    // 4.2: Bits de Host
    templateFragment.querySelector('#fb-m3-calc-h-cidr').textContent = f.newCidr;
    templateFragment.querySelector('#fb-m3-calc-h-bits').textContent = f.hostBits;
    templateFragment.querySelector('#fb-m3-calc-h-bits-2').textContent = f.hostBits;
    templateFragment.querySelector('#fb-m3-usable-hosts').textContent = f.totalHosts;

    // 4.3: La explicación del "-2" ya está en la plantilla con su clave i18n.

    return templateFragment;
}


/**
 * Construye el DocumentFragment de feedback para el Modo 6 (Siguiente Red)
 * @param {Object} problem - El objeto currentProblem.
 * @returns {Promise<DocumentFragment | null>}
 */
async function _buildMode6Feedback(problem) {
    const templateFragment = await _loadTemplate('ex-mode-6-feedback');
    if (!templateFragment) return null;

    const { feedbackData } = problem;
    const f = feedbackData; // Alias corto

    // Intro
    templateFragment.querySelector('#fb-m6-intro-net').textContent = f.networkCidr;

    // Paso 1: Identificar Octeto
    templateFragment.querySelector('#fb-m6-s1-prefix').textContent = `/${f.prefix}`;
    templateFragment.querySelector('#fb-m6-s1-octet').textContent = f.octet;

    // Paso 2: Número Mágico
    templateFragment.querySelector('#fb-m6-s2-prefix').textContent = `/${f.prefix}`;
    templateFragment.querySelector('#fb-m6-s2-mask').textContent = f.maskDDN;
    templateFragment.querySelector('#fb-m6-s2-octet').textContent = f.octet;
    templateFragment.querySelector('#fb-m6-s2-octetval').textContent = f.octetValue;
    templateFragment.querySelector('#fb-m6-s2-octetval-2').textContent = f.octetValue;
    templateFragment.querySelector('#fb-m6-s2-magic').textContent = f.magicNumber;

    // Paso 3: Siguiente Salto
    templateFragment.querySelector('#fb-m6-s3-netoctet').textContent = f.networkOctet;
    templateFragment.querySelector('#fb-m6-s3-netoctet-2').textContent = f.networkOctet;
    templateFragment.querySelector('#fb-m6-s3-magic').textContent = f.magicNumber;
    templateFragment.querySelector('#fb-m6-s3-nextoctet').textContent = f.nextNetworkOctet;

    // Paso 4: Definir Red
    templateFragment.querySelector('#fb-m6-s4-nextnet').textContent = f.nextNetwork;

    return templateFragment;
}

/**
 * Formatea un binario de 8 bits con colores, separador y espacio de nibble.
 * Re-usa clases de bit-workshop.css que ya están cargadas.
 * @param {string} bin - La cadena binaria de 8 bits (ej: "00000100")
 * @param {number} commonBits - El número de bits comunes (ej: 6)
 * @returns {string} - El HTML formateado (ej: "<span...</span>...")
 */
function _formatSummarizationBinary(bin, commonBits) {
    let html = '';
    let nibbleSpaceAdded = false;

    // 1. Bits Comunes (Color Primario)
    html += '<span class="bit-network">';
    for (let i = 0; i < commonBits; i++) {
        if (i === 4) {
            html += ' ';
            nibbleSpaceAdded = true;
        }
        html += bin[i];
    }
    html += '</span>';

    // 2. Separador (Color Cyan)
    if (commonBits > 0 && commonBits < 8) {
        html += '<span class="bit-sep-char">|</span>';
    }

    // 3. Bits Diferentes (Color Acento/Host)
    html += '<span class="bit-host">';
    for (let i = commonBits; i < 8; i++) {
        if (i === 4 && !nibbleSpaceAdded) {
            // Añade espacio si el separador estaba ANTES del nibble
            html += ' ';
        }
        html += bin[i];
    }
    html += '</span>';

    // Caso especial: 0 bits comunes
    if (commonBits === 0) {
        html = '<span class="bit-sep-char">|</span>' + html;
    }

    return html;
}


/**
 * Construye el DocumentFragment de feedback para el Modo 4 (Sumarización)
 * (VERSIÓN CORREGIDA v5 - Implementa el análisis de eficiencia v6)
 * @param {Object} problem - El objeto currentProblem.
 * @returns {Promise<DocumentFragment | null>}
 */
async function _buildMode4Feedback(problem) {
    const templateFragment = await _loadTemplate('ex-mode-4-feedback');
    if (!templateFragment) return null;

    const { feedbackData } = problem;
    const f = feedbackData; // Alias corto

    // --- Paso 1: Listar Redes e Identificar Octeto (CORREGIDO) ---
    const desc1_main = i1n.get('fb_mode4_step1_desc_main').replace('{fixedOctets}', f.fixedOctets);
    templateFragment.querySelector('#fb-m4-s1-fixedoctets').parentElement.innerHTML = desc1_main;

    const desc1_3 = i1n.get('fb_mode4_step1_desc_3').replace('{octet}', f.interestingOctet);
    templateFragment.querySelector('#fb-m4-s1-desc-3').innerHTML = desc1_3;

    // Rellena la lista de redes (usa originalNetworkList que son las redes *usadas*)
    const networkList = f.originalNetworkList.join('\n');
    templateFragment.querySelector('#fb-m4-list-networks').textContent = networkList;

    // --- Paso 2: Convertir Octeto a Binario ---
    const tableEl = templateFragment.querySelector('#fb-m4-binary-table');
    let tableHTML = '';

    f.binaryList.forEach(item => {
        const octetValue = item.ip.split('.')[f.interestingOctet - 1];
        const formattedOctet = octetValue.padEnd(3, ' ');
        const formattedBin = _formatSummarizationBinary(item.bin, f.commonBits);
        tableHTML += `${formattedOctet} = <code class="text-primary">${formattedBin}</code>\n`;
    });
    tableEl.innerHTML = tableHTML.trim();

    // --- Paso 3: Encontrar Bits Comunes ---
    const desc3 = i1n.get('fb_mode4_step3_desc_2')
        .replace('{commonBits}', f.commonBits)
        .replace('{commonBitsPattern}', f.commonBitsPattern);
    templateFragment.querySelector('#fb-m4-s3-desc-2').innerHTML = desc3;

    // --- Paso 4: Calcular Nueva Máscara ---
    const desc4_1 = i1n.get('fb_mode4_step4_desc_1').replace('{octet}', f.interestingOctet);
    templateFragment.querySelector('#fb-m4-s4-desc-1').innerHTML = desc4_1;
    templateFragment.querySelector('#fb-m4-s4-basebits').textContent = f.baseBits;

    const desc4_2 = i1n.get('fb_mode4_step4_desc_2').replace('{octet}', f.interestingOctet);
    templateFragment.querySelector('#fb-m4-s4-desc-2').innerHTML = desc4_2;
    templateFragment.querySelector('#fb-m4-s4-commonbits').textContent = f.commonBits;

    templateFragment.querySelector('#fb-m4-s4-calc-base').textContent = f.baseBits;
    templateFragment.querySelector('#fb-m4-s4-calc-common').textContent = f.commonBits;
    templateFragment.querySelector('#fb-m4-s4-newprefix').textContent = f.summaryMask;

    const desc4_4 = i1n.get('fb_mode4_step4_desc_4')
        .replace('{newMask}', f.summaryMask)
        .replace('{newMaskDDN}', f.newMaskDDN);
    templateFragment.querySelector('#fb-m4-s4-desc-4').innerHTML = desc4_4;

    // --- Paso 5: Calcular ID de Red y Respuesta ---
    const desc5_2 = i1n.get('fb_mode4_step5_desc_2')
        .replace('{summaryRoute}', f.summaryRoute)
        .replace('{summaryMask}', f.summaryMask);
    templateFragment.querySelector('#fb-m4-s5-desc-2').innerHTML = desc5_2;

    // --- Verificación (Opcional) ---
    const verifyDesc1 = i1n.get('fb_mode4_verify_desc_1')
        .replace('{summaryRoute}', f.summaryRoute)
        .replace('{summaryMask}', f.summaryMask)
        .replace('{summaryRange}', f.summaryRange);
    templateFragment.querySelector('#fb-m4-verify-desc-1').innerHTML = verifyDesc1;

    const originalNetListHTML = f.originalNetworkList.map(net => `<li><code>${net}</code></li>`).join('');
    templateFragment.querySelector('#fb-m4-verify-list').innerHTML = originalNetListHTML;

    // --- NUEVO: Rellenar la Nota de Diseño (CON LÓGICA CONDICIONAL) ---

    // Rellenar porcentaje y categoría (siempre visible)
    templateFragment.querySelector('#fb-m4-eff-percentage').textContent = f.efficiencyPercentage;
    const effCategoryKey = `fb_mode4_eff_cat_${f.efficiencyCategory}`;
    templateFragment.querySelector('#fb-m4-eff-category').textContent = i1n.get(effCategoryKey, f.efficiencyCategory);

    if (f.isInefficient) {
        // --- Caso Ineficiente ---
        templateFragment.querySelector('#fb-m4-design-inefficient').classList.remove('d-none');

        const desc_ineff_2 = i1n.get('fb_mode4_design_note_inefficient_2')
            .replace('{summaryMask}', f.summaryMask)
            .replace('{totalIPs}', f.summaryTotalIPs)
            .replace('{usedIPs}', f.summaryUsedIPs)
            .replace('{numNetworks}', f.numNetworks);
        templateFragment.querySelector('#fb-m4-design-desc-inefficient-2').innerHTML = desc_ineff_2;

        // Rellenar la lista de "agujeros"
        const holesListHTML = f.removedNetworksList.map(net => `<li><code>${net}</code></li>`).join('');
        templateFragment.querySelector('#fb-m4-design-holes-list').innerHTML = holesListHTML;

    } else {
        // --- Caso Perfecto (100%) ---
        templateFragment.querySelector('#fb-m4-design-perfect').classList.remove('d-none');

        const desc_perfect_2 = i1n.get('fb_mode4_design_note_perfect_2')
            .replace('{numNetworks}', f.numNetworks)
            .replace('{basePrefix}', `/${f.basePrefix}`)
            .replace('{usedIPs}', f.summaryUsedIPs)
            .replace('{summaryMask}', f.summaryMask)
            .replace('{totalIPs}', f.summaryTotalIPs);
        templateFragment.querySelector('#fb-m4-design-desc-perfect-2').innerHTML = desc_perfect_2;
    }

    return templateFragment;
}


/**
 * Construye el DocumentFragment de feedback para el Modo 1 (Classful)
 * @param {Object} problem - El objeto currentProblem.
 * @returns {Promise<DocumentFragment | null>}
 */
async function _buildMode1Feedback(problem) {
    const templateFragment = await _loadTemplate('ex-mode-1-feedback');
    if (!templateFragment) return null;

    const { feedbackData } = problem;
    const f = feedbackData; // Alias corto

    // --- Controlar paneles condicionales ---
    const s1Subnets = templateFragment.querySelector('#fb-m1-s1-subnets');
    const s1Hosts = templateFragment.querySelector('#fb-m1-s1-hosts');
    const s2Subnets = templateFragment.querySelector('#fb-m1-s2-subnets');
    const s2Hosts = templateFragment.querySelector('#fb-m1-s2-hosts');

    if (f.reqType === 'subnets') {
        s1Subnets.classList.remove('d-none');
        s2Subnets.classList.remove('d-none');
        s1Hosts.classList.add('d-none');
        s2Hosts.classList.add('d-none');

        // --- Rellenar Paso 1 (Subredes) ---
        templateFragment.querySelector('#fb-m1-s1-subnets-req').textContent = f.reqValue;
        templateFragment.querySelector('#fb-m1-s1-subnets-req-2').textContent = f.reqValue;
        templateFragment.querySelector('#fb-m1-s1-subnets-total').textContent = f.totalSubnetsNeeded;

        // --- Rellenar Paso 2 (Subredes) ---
        templateFragment.querySelector('#fb-m1-s2-subnets-formula').textContent = f.formula;
        templateFragment.querySelector('#fb-m1-s2-subnets-total').textContent = f.totalSubnetsNeeded;
        templateFragment.querySelector('#fb-m1-s2-subnets-result').textContent = f.formulaResult;
        templateFragment.querySelector('#fb-m1-s2-subnets-bits').textContent = f.bitsNeeded;

    } else { // reqType === 'hosts'
        s1Subnets.classList.add('d-none');
        s2Subnets.classList.add('d-none');
        s1Hosts.classList.remove('d-none');
        s2Hosts.classList.remove('d-none');

        // --- Rellenar Paso 1 (Hosts) ---
        templateFragment.querySelector('#fb-m1-s1-hosts-req').textContent = f.reqValue;

        // --- Rellenar Paso 2 (Hosts) ---
        templateFragment.querySelector('#fb-m1-s2-hosts-formula').textContent = f.formula;
        templateFragment.querySelector('#fb-m1-s2-hosts-req').textContent = f.reqValue;
        templateFragment.querySelector('#fb-m1-s2-hosts-result').textContent = f.formulaResult;
        templateFragment.querySelector('#fb-m1-s2-hosts-bits-H').textContent = f.hostBitsNeeded;
        templateFragment.querySelector('#fb-m1-s2-hosts-defaulthost').textContent = f.defaultHostBits;
        templateFragment.querySelector('#fb-m1-s2-hosts-bits-H-2').textContent = f.hostBitsNeeded;
        templateFragment.querySelector('#fb-m1-s2-hosts-bits-n').textContent = f.bitsNeeded;
    }

    // --- Rellenar Paso 3 (Común) ---
    templateFragment.querySelector('#fb-m1-s3-defaultcidr').textContent = f.defaultCidr;
    templateFragment.querySelector('#fb-m1-s3-defaultcidr-2').textContent = f.defaultCidr;
    templateFragment.querySelector('#fb-m1-s3-bitsneeded').textContent = f.bitsNeeded;
    templateFragment.querySelector('#fb-m1-s3-newcidr').textContent = `/${f.newCidr}`;
    templateFragment.querySelector('#fb-m1-s3-newcidr-2').textContent = `/${f.newCidr}`;
    templateFragment.querySelector('#fb-m1-s3-newmaskddn').textContent = f.maskDDN;

    // --- Rellenar Paso 4 (Común) ---
    templateFragment.querySelector('#fb-m1-s4-bitsneeded').textContent = f.bitsNeeded;
    templateFragment.querySelector('#fb-m1-s4-totalsubnets').textContent = f.totalSubnets;
    templateFragment.querySelector('#fb-m1-s4-totalsubnets-2').textContent = f.totalSubnets;
    templateFragment.querySelector('#fb-m1-s4-usablesubnets').textContent = f.usableSubnets;
    templateFragment.querySelector('#fb-m1-s4-newcidr').textContent = f.newCidr;
    templateFragment.querySelector('#fb-m1-s4-hostbits').textContent = f.hostBitsFinal;
    templateFragment.querySelector('#fb-m1-s4-hostbits-2').textContent = f.hostBitsFinal;
    templateFragment.querySelector('#fb-m1-s4-usablehosts').textContent = f.usableHosts;

    return templateFragment;
}

// Exportar el objeto público
export const FeedbackRenderer = {
    render,
    clear,
    // (Opcional) Exportar una función de renderizado de errores
    renderError: (i18nKey) => {
        const i18n = window.i18n || { get: key => key };
        dom.exFeedback.innerHTML = `<div class="alert alert-danger" role="alert" data-i18n="${i18nKey}">${i18n.get(i18nKey)}</div>`;
        if (typeof i1n.translatePage === 'function') i1n.translatePage();
    }
};