/*
 * Archivo: /tools/subnetting-gen/modules/calculator.js
 * Lógica y manejadores de eventos para la pestaña "Calculadora".
 */
"use strict";

import { dom } from './dom-selectors.js';
import * as NetUtils from './net-utils.js';
import * as SubnetLogic from './subnet-logic.js';

// --- Caché para Plantillas ---
const templateCache = {};

/**
 * Carga una plantilla HTML desde un archivo o desde el caché local.
 */
async function loadTemplate(templateName) {
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

// --- Funciones de Renderizado (Calculadora) ---

function clearResults() {
    dom.resultsContainer.innerHTML = `<p class="text-muted" data-i18n="subnet_gen_results_placeholder">Introduce los datos y haz clic en calcular.</p>`;
    const summaryPlaceholder = dom.resultsCard?.querySelector('.results-summary-placeholder');
    if (summaryPlaceholder) summaryPlaceholder.innerHTML = '';

    dom.copyArea.classList.add('d-none');
    dom.copyFeedback.style.display = 'none';
    if (dom.resultsCard) {
        dom.resultsCard.classList.add('d-none');
    }
    clearInputErrors();
}

function renderError(message) {
    if (dom.resultsCard) {
        dom.resultsCard.classList.remove('d-none');
    }
    dom.resultsContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>${message}
        </div>
    `;
    const summaryPlaceholder = dom.resultsCard?.querySelector('.results-summary-placeholder');
    if (summaryPlaceholder) summaryPlaceholder.innerHTML = '';
    dom.copyArea.classList.add('d-none');

    if (typeof window.initializeOrReinitializeTooltips === 'function') {
        window.initializeOrReinitializeTooltips();
    }
}

function showInputError(inputEl, message) {
    inputEl.classList.add('is-invalid');
    const errorEl = inputEl.nextElementSibling;
    if (errorEl && errorEl.classList.contains('invalid-feedback')) {
        errorEl.textContent = message;
    }
}

function clearInputErrors() {
    [dom.classfulIp, dom.vlsmCidr, dom.classfulSubnets, dom.classfulHosts].forEach(el => {
        el.classList.remove('is-invalid');
    });
    dom.vlsmReqList.querySelectorAll('input').forEach(el => el.classList.remove('is-invalid'));
}

export async function renderResults(data) {
    const { subnets, summary } = data;

    if (dom.resultsCard) {
        dom.resultsCard.classList.remove('d-none');
    }
    dom.resultsContainer.innerHTML = '';

    if (!subnets || subnets.length === 0) {
        renderError('No se pudieron generar subredes con esos criterios.');
        return;
    }

    const templateContent = await loadTemplate('subnet-results-table');
    if (!templateContent) {
        renderError('Error al cargar la plantilla de la tabla de resultados.');
        return;
    }

    const tableWrapper = templateContent.querySelector('.table-responsive-wrapper');
    const theadRow = templateContent.querySelector('thead tr');
    const tbody = templateContent.querySelector('tbody');
    const summaryPlaceholder = templateContent.querySelector('.results-summary-placeholder');

    if (!tableWrapper || !theadRow || !tbody || !summaryPlaceholder) {
        renderError('La plantilla de la tabla de resultados está incompleta.');
        return;
    }

    const isVlsm = summary.hasOwnProperty('totalAvailable');

    if (isVlsm) {
        const vlsmHeaders = [
            { key: 'subnet_gen_header_requested', defaultText: 'Hosts Pedidos' },
            { key: 'subnet_gen_header_efficiency', defaultText: 'Eficiencia' }
        ];

        vlsmHeaders.forEach(headerInfo => {
            const th = document.createElement('th');
            th.dataset.i18n = headerInfo.key;
            th.innerHTML = (typeof i1n !== 'undefined') ? i1n.get(headerInfo.key, headerInfo.defaultText) : headerInfo.defaultText;
            theadRow.appendChild(th);
        });
    }

    for (const subnet of subnets) {
        const tr = document.createElement('tr');
        let rowClass = '';
        let cellsHTML = '';

        let commonCells = [];
        if (isVlsm) {
            if (subnet.status === 'assigned') rowClass = 'subnet-row-assigned';
            if (subnet.status === 'unused') rowClass = 'subnet-row-unused';
            if (subnet.status === 'error') rowClass = 'subnet-row-error';

            if (subnet.status === 'error') {
                const totalHeaders = theadRow.querySelectorAll('th').length;
                commonCells = [`<td colspan="${totalHeaders}"><strong>Error:</strong> ${subnet.errorMsg} (Req: ${subnet.name} - ${subnet.hosts} hosts)</td>`];
            } else {
                commonCells = [
                    `<td>${subnet.name}</td>`,
                    `<td><code>${subnet.network}</code></td>`,
                    `<td>/${subnet.cidr} (${subnet.mask})</td>`,
                    `<td>${subnet.hostRange}</td>`,
                    `<td>${subnet.broadcast}</td>`,
                    `<td>${subnet.usableHosts}</td>`
                ];
            }
        } else { // Classful
            let legendHtml = '';
            if (subnet.status === 'zero-subnet') {
                rowClass = 'subnet-row-reserved';
                legendHtml = '<span class="subnet-legend" data-i18n="subnet_gen_label_zero">Zero Subnet</span>';
            } else if (subnet.status === 'all-ones-subnet') {
                rowClass = 'subnet-row-reserved';
                legendHtml = '<span class="subnet-legend" data-i18n="subnet_gen_label_all_ones">All-Ones Subnet</span>';
            }
            commonCells = [
                `<td>${subnet.name}</td>`,
                `<td><code>${subnet.network}</code>${legendHtml}</td>`,
                `<td>/${subnet.cidr} (${subnet.mask})</td>`,
                `<td>${subnet.hostRange}</td>`,
                `<td>${subnet.broadcast}</td>`,
                `<td>${subnet.usableHosts}</td>`
            ];
        }

        cellsHTML += commonCells.join('');

        if (isVlsm && subnet.status === 'assigned') {
            const efficiency = subnet.efficiency || 0;
            const efficiencyThreshold = 70;
            const efficiencyRounded = efficiency.toFixed(0);
            const efficiencyClass = (efficiency < efficiencyThreshold) ? 'bar-inefficient' : 'bar-efficient';

            const efficiencyBar = `
                <div class="progress efficiency-bar-container" title="${efficiency.toFixed(1)}% (${subnet.reqHosts} / ${subnet.usableHosts})">
                  <div class="progress-bar efficiency-bar ${efficiencyClass}"
                       role="progressbar"
                       style="width: ${efficiency}%;"
                       aria-valuenow="${efficiency}"
                       aria-valuemin="0"
                       aria-valuemax="100">
                       ${efficiencyRounded}% </div>
                </div>
            `;
            cellsHTML += `<td>${subnet.reqHosts}</td>`;
            cellsHTML += `<td>${efficiencyBar}</td>`;
        }

        tr.className = rowClass;
        tr.innerHTML = cellsHTML;
        tbody.appendChild(tr);
    }

    let summaryHtml = '';
    if (isVlsm) {
        summaryHtml = `
            <strong><span data-i18n="subnet_gen_summary_original">Red Original:</span></strong> ${summary.originalNetwork} (${summary.totalAvailable} IPs) | 
            <strong><span data-i18n="subnet_gen_summary_allocated">Total Asignado:</span></strong> ${summary.totalAllocated} IPs (${summary.efficiency.toFixed(1)}% <span data-i18n="subnet_gen_summary_utilization">de utilización</span>)
        `;
        if (summary.totalRemaining > 0) {
            summaryHtml += `
                <br><strong><span data-i18n="subnet_gen_summary_remaining">Espacio Restante:</span></strong> ${summary.totalRemaining} <span data-i18n="subnet_gen_summary_remaining_ips">IPs</span> 
                (<strong><span data-i18n="subnet_gen_summary_range">Rango:</span></strong> ${summary.remainingRange})
            `;
        }
    } else {
        summaryHtml = `
            <strong><span data-i18n="subnet_gen_summary_original">Red Original:</span></strong> ${summary.originalNetwork} | 
            <strong><span data-i18n="subnet_gen_summary_mask">Máscara Aplicada:</span></strong> ${summary.newMask} | 
            <strong><span data-i18n="subnet_gen_summary_subnets">Subredes Creadas:</span></strong> ${summary.totalSubnetsGenerated} | 
            <strong><span data-i18n="subnet_gen_summary_hosts">Hosts por Subred:</span></strong> ${summary.usableHostsPerSubnet}
        `;
    }
    summaryPlaceholder.innerHTML = summaryHtml;

    dom.resultsContainer.appendChild(templateContent);

    dom.copyArea.classList.remove('d-none');
    if (typeof i1n !== 'undefined') {
        i1n.translatePage();
    }
    if (typeof window.initializeOrReinitializeTooltips === 'function') {
        window.initializeOrReinitializeTooltips();
    }
}

// --- Manejadores de Eventos (Calculadora) ---

function toggleMode() {
    const selectedMode = document.querySelector('input[name="calculationType"]:checked').value;

    // Oculta todos los formularios
    dom.classfulForm.classList.add('d-none');
    dom.vlsmForm.classList.add('d-none');
    dom.summaryForm.classList.add('d-none');

    // Muestra el seleccionado
    if (selectedMode === 'classful') {
        dom.classfulForm.classList.remove('d-none');
        dom.classfulIp.focus();
    } else if (selectedMode === 'vlsm') {
        dom.vlsmForm.classList.remove('d-none');
        dom.vlsmCidr.focus();
    } else if (selectedMode === 'summary') {
        dom.summaryForm.classList.remove('d-none');
        dom.summaryIpList.focus();
    }
    clearResults();
}

function addVlsmRequirement() {
    const newItem = document.createElement('div');
    newItem.className = 'input-group mb-2 vlsm-requirement-item';
    newItem.innerHTML = `
        <input type="number" class="form-control" min="1" required 
               aria-label="Número de hosts" 
               data-i18n-placeholder="subnet_gen_vlsm_hosts_placeholder" 
               placeholder="Hosts">
        <input type="text" class="form-control" 
               aria-label="Nombre opcional de subred" 
               data-i18n-placeholder="subnet_gen_vlsm_name_placeholder" 
               placeholder="Nombre (Opcional)">
        <button type="button" class="btn btn-outline-danger remove-vlsm-req-btn" 
                aria-label="Eliminar requisito">
            <i class="fas fa-times"></i>
        </button>
    `;
    dom.vlsmReqList.appendChild(newItem);

    // Busca el primer input (el de hosts) DENTRO del elemento que acabamos de crear
    const newHostsInput = newItem.querySelector('input[type="number"]');
    if (newHostsInput) {
        newHostsInput.focus(); // Mueve el cursor (foco) a ese input
    }

    updateVlsmRemoveButtons();
}

function removeVlsmRequirement(e) {
    const removeBtn = e.target.closest('.remove-vlsm-req-btn');
    if (!removeBtn) return;
    const itemToRemove = removeBtn.closest('.vlsm-requirement-item');
    if (itemToRemove) {
        itemToRemove.remove();
        updateVlsmRemoveButtons();
    }
}

function updateVlsmRemoveButtons() {
    const allReqs = dom.vlsmReqList.querySelectorAll('.vlsm-requirement-item');
    allReqs.forEach((item, index) => {
        const btn = item.querySelector('.remove-vlsm-req-btn');
        if (btn) {
            btn.style.display = (allReqs.length === 1) ? 'none' : 'block';
        }
    });
}

function handleClassfulSubmit(e) {
    e.preventDefault();
    clearInputErrors();

    const ip = dom.classfulIp.value.trim();
    if (!NetUtils.validateIp(ip)) {
        showInputError(dom.classfulIp, 'Formato de IP inválido. Ejemplo: 192.168.1.0');
        return;
    }

    const reqType = document.querySelector('input[name="classfulRequirementType"]:checked').value;
    let reqValue, inputEl;

    if (reqType === 'subnets') {
        inputEl = dom.classfulSubnets;
        reqValue = parseInt(inputEl.value, 10);
    } else {
        inputEl = dom.classfulHosts;
        reqValue = parseInt(inputEl.value, 10);
    }

    if (isNaN(reqValue) || reqValue < 1) {
        showInputError(inputEl, 'Debe ser un número positivo.');
        return;
    }

    const result = SubnetLogic.calculateClassful(ip, reqType, reqValue);

    if (result.error) {
        renderError(result.error);
    } else {
        renderResults(result);
    }
}

function handleVlsmSubmit(e) {
    e.preventDefault();
    clearInputErrors();

    const cidrStr = dom.vlsmCidr.value.trim();
    if (!NetUtils.validateCidr(cidrStr)) {
        showInputError(dom.vlsmCidr, 'Formato CIDR inválido. Ejemplo: 172.16.0.0/22');
        return;
    }

    const requirements = [];
    const reqItems = dom.vlsmReqList.querySelectorAll('.vlsm-requirement-item');
    let hasError = false;

    reqItems.forEach((item, index) => {
        const hostInput = item.querySelector('input[type="number"]');
        const nameInput = item.querySelector('input[type="text"]');
        const hosts = parseInt(hostInput.value, 10);
        const name = nameInput.value.trim() || `Subred #${index + 1}`;

        if (isNaN(hosts) || hosts < 1) {
            hostInput.classList.add('is-invalid');
            hasError = true;
        } else {
            requirements.push({ name, hosts });
        }
    });

    if (hasError) {
        renderError('Revise los requisitos de hosts. Deben ser números positivos.');
        return;
    }
    if (requirements.length === 0) {
        renderError('Debe añadir al menos un requisito de subred.');
        return;
    }

    const result = SubnetLogic.calculateVlsm(cidrStr, requirements);

    if (result.error) {
        renderError(result.error);
    } else {
        renderResults(result);
    }
}

function copyResults() {
    const table = dom.resultsContainer.querySelector('table');
    if (!table) return;

    let text = '';
    table.querySelectorAll('thead th').forEach(th => text += th.textContent.trim() + '\t');
    text += '\n';

    table.querySelectorAll('tbody tr').forEach(tr => {
        tr.querySelectorAll('td').forEach(td => {
            text += td.textContent.trim().replace(/\s+/g, ' ') + '\t';
        });
        text = text.trim() + '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
        dom.copyFeedback.style.display = 'inline';
        setTimeout(() => { dom.copyFeedback.style.display = 'none'; }, 2000);
    }).catch(err => {
        console.error('Error al copiar al portapapeles: ', err);
    });
}

function handleSummarySubmit(e) {
    e.preventDefault();
    clearInputErrors();

    const ipList = dom.summaryIpList.value.split('\n')
        .map(ip => ip.trim())
        .filter(ip => NetUtils.validateIp(ip)); // Filtra IPs válidas

    if (ipList.length < 2) {
        showInputError(dom.summaryIpList, 'Debes introducir al menos dos direcciones IP válidas.');
        renderError('No hay suficientes IPs válidas para calcular un resumen.');
        return;
    }

    const result = NetUtils.findSummaryRoute(ipList); // Llama a la lógica

    if (result) {
        // Mostramos el resultado de forma simple (no necesitas la tabla)
        dom.resultsCard.classList.remove('d-none');
        dom.copyArea.classList.add('d-none');
        dom.resultsContainer.innerHTML = `
            <div class="alert alert-success text-center">
                <h5 class="alert-heading">Ruta de Resumen Calculada</h5>
                <p class="display-6 mb-0" style="font-family: 'Courier New', monospace;">
                    ${result.network}/${result.prefix}
                </p>
                <hr>
                <p class="mb-0">Máscara: ${result.mask}</p>
            </div>
        `;
    } else {
        renderError('No se pudo calcular una ruta de resumen para esas IPs.');
    }
}

/**
 * Inicializa todos los event listeners de la CALCULADORA.
 */
export function initCalculator() {
    dom.modeRadios.forEach(radio => radio.addEventListener('change', toggleMode));
    dom.classfulForm.addEventListener('submit', handleClassfulSubmit);
    dom.vlsmForm.addEventListener('submit', handleVlsmSubmit);
    dom.summaryForm.addEventListener('submit', handleSummarySubmit);
    dom.classfulForm.addEventListener('reset', clearResults);
    dom.vlsmForm.addEventListener('reset', clearResults);
    dom.summaryForm.addEventListener('reset', clearResults);
    dom.addVlsmBtn.addEventListener('click', addVlsmRequirement);
    dom.vlsmReqList.addEventListener('click', removeVlsmRequirement); // Delegación
    dom.copyBtn.addEventListener('click', copyResults);

    dom.classfulReqType.forEach(radio => {
        radio.addEventListener('change', () => {
            const type = radio.value;
            dom.classfulSubnets.disabled = (type !== 'subnets');
            dom.classfulHosts.disabled = (type !== 'hosts');
            if (type === 'subnets') dom.classfulHosts.value = '';
            if (type === 'hosts') dom.classfulSubnets.value = '';
        });
    });

    // Estado Inicial
    toggleMode();
    updateVlsmRemoveButtons();
    dom.classfulSubnets.disabled = false;
    dom.classfulHosts.disabled = true;
}