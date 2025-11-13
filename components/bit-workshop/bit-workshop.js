/*
 * Módulo "Taller de Bits"
 * Controla la lógica del panel lateral (offcanvas)
 * (MODIFICADO: Ahora carga su propio CSS)
 */

// Importa las utilidades de red
import * as NetUtils from '../../tools/subnetting-gen/modules/net-utils.js';

// Calculamos la raíz basándonos en la ubicación de este archivo script
const scriptUrl = new URL(import.meta.url);
// bit-workshop.js está en /components/bit-workshop/, así que subimos 2 niveles
const ROOT_PATH = new URL('../../', scriptUrl).pathname.replace(/\/$/, '');

// Estado del módulo
let bsOffcanvas = null; // Instancia de Bootstrap Offcanvas
let elements = {}; // Caché de elementos del DOM

/**
 * Inserta el HTML y el CSS del panel en la página y lo inicializa.
 * Se debe llamar una vez al cargar la página (ej. en main.js).
 */
async function load() {
    // 1. Evitar cargas duplicadas (buena práctica)
    if (document.getElementById('bitWorkshopPanel')) return;

    try {
        // 1. Cargar el lang / CSS
        // --- Cargar el idioma dinámicamente ---
        if (typeof i1n !== 'undefined') {
            // Esto cargará Y disparará la traducción
            // de la página principal (que ya está cargada)
            await i1n.loadNamespaces(['bit_workshop']);
        }
        // ------------------------------

        // --- Cargar el CSS dinámicamente ---
        const cssPath = '${ROOT_PATH}/components/bit-workshop/bit-workshop.css';
        // Comprobar si ya está cargado para evitar duplicados
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            console.log("Cargando bit-workshop.css...");
        }
        // ------------------------------------------------

        // 2. Cargar el HTML
        const response = await fetch('${ROOT_PATH}/components/bit-workshop/bit-workshop.html'); //
        if (!response.ok) throw new Error('No se pudo cargar bit-workshop.html');
        const html = await response.text();

        const placeholder = document.getElementById('modal-placeholder') || document.body;
        placeholder.insertAdjacentHTML('beforeend', html);
        // ------------------------------------------------

        // 3. Inicializar la instancia de Bootstrap
        const panel = document.getElementById('bitWorkshopPanel');
        if (!panel) throw new Error('El elemento #bitWorkshopPanel no se encontró después de cargar');

        bsOffcanvas = new bootstrap.Offcanvas(panel);
        // ------------------------------------------------

        // 4. Cachear los elementos del DOM
        elements = {
            panel,
            ipInput: panel.querySelector('#workshop-ip'),
            cidrInput: panel.querySelector('#workshop-cidr'),
            maskInput: panel.querySelector('#workshop-mask'),
            binaryIp: panel.querySelector('#workshop-binary-ip'),
            binaryMask: panel.querySelector('#workshop-binary-mask'),
            binaryNetwork: panel.querySelector('#workshop-binary-network'),
            binaryBroadcast: panel.querySelector('#workshop-binary-broadcast'),
            summaryNetwork: panel.querySelector('#workshop-summary-network'),
            summaryBroadcast: panel.querySelector('#workshop-summary-broadcast'),
            summaryWildcard: panel.querySelector('#workshop-summary-wildcard'),
            summaryHosts: panel.querySelector('#workshop-summary-hosts'),
        };
        // ------------------------------------------------

        // 5. Añadir listeners para el modo standalone
        elements.ipInput.addEventListener('input', calculateAndRender);
        elements.cidrInput.addEventListener('input', () => {
            const cidr = parseInt(elements.cidrInput.value, 10);
            if (!isNaN(cidr) && cidr >= 0 && cidr <= 32) {
                elements.maskInput.value = NetUtils.longToIp(NetUtils.cidrToMaskLong(cidr)); //
                calculateAndRender();
            } else if (elements.cidrInput.value === '') {
                elements.maskInput.value = '';
                calculateAndRender();
            }
        });
        elements.maskInput.addEventListener('input', () => {
            try {
                const maskLong = NetUtils.ipToLong(elements.maskInput.value); //
                const cidr = NetUtils.maskLongToCidr(maskLong); //
                elements.cidrInput.value = cidr;
                calculateAndRender();
            } catch (e) {
                elements.cidrInput.value = ''; // No es una máscara válida
                calculateAndRender();
            }
        });
        // ------------------------------------------------

        console.log("Taller de Bits cargado e inicializado.");

    } catch (error) {
        console.error("Error al cargar el Taller de Bits:", error);
    }
}

/**
 * Función pública para abrir el panel.
 * - Si se llama con argumentos (contextual), pre-rellena los datos.
 * - Si se llama sin argumentos (standalone), abre el panel vacío.
 * @param {string} [ipStr=null] - La dirección IP del problema (opcional)
 * @param {string} [maskStr=null] - La máscara/CIDR del problema (opcional)
 */
function open(ipStr = null, maskStr = null) {

    if (ipStr && maskStr) {
        // --- MODO CONTEXTUAL (pre-rellenado) ---
        let cidr, ip;

        if (!NetUtils.validateIp(ipStr)) ip = "192.168.1.1";
        else ip = ipStr;

        if (maskStr.startsWith('/')) {
            cidr = parseInt(maskStr.substring(1), 10);
            elements.cidrInput.value = cidr;
            elements.maskInput.value = NetUtils.longToIp(NetUtils.cidrToMaskLong(cidr));
        } else if (NetUtils.validateIp(maskStr)) {
            cidr = NetUtils.maskLongToCidr(NetUtils.ipToLong(maskStr));
            elements.cidrInput.value = cidr;
            elements.maskInput.value = maskStr;
        } else {
            cidr = 24; // Default
            elements.cidrInput.value = 24;
            elements.maskInput.value = "255.255.255.0";
        }

        elements.ipInput.value = ip;

    } else {
        // --- MODO STANDALONE (vacío) ---
        elements.ipInput.value = '';
        elements.cidrInput.value = '';
        elements.maskInput.value = '';
    }

    // Calcular (o limpiar) y mostrar
    calculateAndRender();
    bsOffcanvas.show();
}

/**
 * Formatea una cadena binaria de 32 bits en una fila de <span>s
 * que simulan una tabla, incluyendo nibbles, octetos y el separador.
 * @param {string} binaryStr - Ej: "1010110000010100..."
 * @param {number} cidr - Ej: 22
 * @returns {string} - El HTML con la fila de bits.
 */
function formatBinaryString(binaryStr, cidr) {
    let html = '';
    for (let i = 0; i < 32; i++) {
        const bit = binaryStr[i];
        const className = (i < cidr) ? 'bit-network' : 'bit-host';

        let classes = `bit-cell ${className}`;

        // Aplica tu borde separador (cyan)
        if (i === cidr - 1) {
            classes += ' bit-separator';
        }

        // Añade el bit
        html += `<span class="${classes}">${bit}</span>`;

        // Petición 4: Añadir separadores de Nibble y Octeto
        if ((i + 1) % 8 === 0 && i !== 31) {
            // Petición 2: Separador de Octeto (punto)
            html += '<span class="octet-spacer">.</span>';
        } else if ((i + 1) % 4 === 0) {
            // Petición 2: Separador de Nibble (espacio)
            html += '<span class="nibble-spacer"></span>';
        }
    }
    return html;
}

/**
 * Lee los inputs, calcula todos los valores y actualiza el DOM del panel.
 */
function calculateAndRender() {
    try {
        const ipStr = elements.ipInput.value;
        const cidrStr = elements.cidrInput.value;
        if (!NetUtils.validateIp(ipStr) || cidrStr === '') { //
            // Limpiar si el input es inválido o está vacío
            clearDisplay();
            return;
        }

        const cidr = parseInt(cidrStr, 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            clearDisplay();
            return;
        }

        const ipLong = NetUtils.ipToLong(ipStr); //
        const maskLong = NetUtils.cidrToMaskLong(cidr); //
        const networkLong = (ipLong & maskLong) >>> 0;
        const wildcardLong = (~maskLong) >>> 0;
        const broadcastLong = (networkLong | wildcardLong) >>> 0;
        const hostBits = 32 - cidr;
        const hosts = (hostBits <= 1) ? 0 : (Math.pow(2, hostBits) - 2);

        // Convertir a binario (usando la función de net-utils.js)
        const ipBinary = NetUtils.longToPaddedBinaryString(ipLong); //
        const maskBinary = NetUtils.longToPaddedBinaryString(maskLong); //
        const networkBinary = NetUtils.longToPaddedBinaryString(networkLong); //
        const broadcastBinary = NetUtils.longToPaddedBinaryString(broadcastLong); //

        // Actualizar el DOM
        elements.binaryIp.innerHTML = formatBinaryString(ipBinary, cidr);
        elements.binaryMask.innerHTML = formatBinaryString(maskBinary, cidr);
        elements.binaryNetwork.innerHTML = formatBinaryString(networkBinary, cidr);
        elements.binaryBroadcast.innerHTML = formatBinaryString(broadcastBinary, cidr);

        elements.summaryNetwork.textContent = NetUtils.longToIp(networkLong); //
        elements.summaryBroadcast.textContent = NetUtils.longToIp(broadcastLong); //
        elements.summaryWildcard.textContent = NetUtils.longToIp(wildcardLong); //
        elements.summaryHosts.textContent = (hostBits <= 1) ? `2^${hostBits} = ${hosts} (N/A)` : `2^${hostBits} - 2 = ${hosts}`;

    } catch (e) {
        console.error("Error en calculateAndRender:", e);
        clearDisplay();
    }
}

/**
 * Limpia la pantalla del taller.
 */
function clearDisplay() {
    const na = "N/A";

    elements.binaryIp.innerHTML = '';
    elements.binaryMask.innerHTML = '';
    elements.binaryNetwork.innerHTML = '';
    elements.binaryBroadcast.innerHTML = '';

    elements.summaryNetwork.textContent = na;
    elements.summaryBroadcast.textContent = na;
    elements.summaryWildcard.textContent = na;
    elements.summaryHosts.textContent = na;
}

// Exportar las funciones públicas
export const BitWorkshop = {
    load,
    open

};
