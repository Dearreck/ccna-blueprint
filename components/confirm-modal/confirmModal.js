// Variable para la instancia del modal, encapsulada dentro de este módulo
let confirmationModalInstance = null;
let modalElement = null; // Guardamos referencia al elemento

/**
 * Carga el HTML del modal y lo inicializa.
 * Se puede llamar una vez al inicio de la aplicación.
 * @returns {Promise<void>}
 */
export async function initializeConfirmationModal() {
    // Evita recargar si ya existe
    if (document.getElementById('confirmationModal')) {
        modalElement = document.getElementById('confirmationModal');
        if (!confirmationModalInstance && bootstrap.Modal) { // Asegúrate que Bootstrap esté cargado
            confirmationModalInstance = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            // Añadir listener de foco aquí si es necesario (como antes)
            modalElement.addEventListener('hide.bs.modal', () => {
                document.body.focus();
            });
        }
        return;
    }

    try {
        const response = await fetch('/components/confirm-modal/confirm-modal.html'); // Ruta raíz
        if (!response.ok) throw new Error('Failed to load confirm modal HTML');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        modalElement = document.getElementById('confirmationModal');
        if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            confirmationModalInstance = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            console.log("Instancia del Modal de Confirmación creada desde módulo.");
            // Añadir listener de foco aquí
            modalElement.addEventListener('hide.bs.modal', () => {
                document.body.focus();
            });
        } else {
            if (!modalElement) console.error("Elemento #confirmationModal no encontrado tras inserción.");
            if (typeof bootstrap === 'undefined' || !bootstrap.Modal) console.error("Bootstrap Modal no está disponible globalmente.");
        }
    } catch (error) {
        console.error("Error al cargar o inicializar el modal de confirmación:", error);
    }
}

/**
 * Muestra un modal de confirmación personalizable.
 * ASUME que initializeConfirmationModal() ya ha sido llamado.
 * @param {string} titleKey Clave i18n para el título.
 * @param {string} messageKey Clave i18n para el mensaje.
 * @param {string} confirmBtnKey Clave i18n para el botón de confirmar.
 * @param {string} cancelBtnKey Clave i18n para el botón de cancelar.
 * @param {function} confirmCallback Función a ejecutar si se confirma.
 * @param {function} [cancelCallback] Función opcional a ejecutar si se cancela.
 */
export function showConfirmationModal(titleKey, messageKey, confirmBtnKey, cancelBtnKey, confirmCallback, cancelCallback = null) {

    if (!confirmationModalInstance || !modalElement) {
        console.error("Modal de confirmación no inicializado. Llama a initializeConfirmationModal() primero.");
        // Fallback al confirm nativo
        if (confirm(i1n.get(messageKey))) {
            if (confirmCallback) confirmCallback();
        } else {
            if (cancelCallback) cancelCallback();
        }
        return;
    }

    const titleEl = modalElement.querySelector('#confirmationModalLabel');
    const bodyEl = modalElement.querySelector('#confirmationModalBody');
    const confirmBtn = modalElement.querySelector('#confirmationModalConfirmBtn');
    const cancelBtn = modalElement.querySelector('#confirmationModalCancelBtn');

    // Traducir textos
    if (titleEl) titleEl.textContent = i1n.get(titleKey);
    if (bodyEl) bodyEl.textContent = i1n.get(messageKey);
    if (confirmBtn) confirmBtn.textContent = i1n.get(confirmBtnKey);
    if (cancelBtn) cancelBtn.textContent = i1n.get(cancelBtnKey);

    // --- Manejo de Event Listeners ---
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        confirmationModalInstance.hide();
    });
    newCancelBtn.addEventListener('click', () => {
        if (cancelCallback) cancelCallback();
        // hide() es llamado automáticamente por data-bs-dismiss="modal" en el HTML
    });

    // Listener para cierre con 'x' o Esc (si keyboard no fuera false)
    const onModalHidden = () => {
        modalElement.removeEventListener('hidden.bs.modal', onModalHidden);
    };
    modalElement.addEventListener('hidden.bs.modal', onModalHidden, { once: true });

    confirmationModalInstance.show();
}

/**
 * MUESTRA UN MODAL DE ALERTA SIMPLE (solo botón OK).
 * ASUME que initializeConfirmationModal() ya ha sido llamado.
 * @param {string} titleKey Clave i18n para el título.
 * @param {string} messageKey Clave i18n para el mensaje.
 * @param {string} [okBtnKey='btn_ok'] Clave i18n para el botón OK (opcional).
 */
export function showAlertModal(titleKey, messageKey, okBtnKey = 'btn_ok') { // <<<--- NUEVA FUNCIÓN EXPORTADA
    if (!confirmationModalInstance || !modalElement) {
        console.error("Modal no inicializado. Llama a initializeConfirmationModal() primero.");
        // Fallback al alert nativo si el modal falla
        alert(i1n.get(messageKey));
        return;
    }

    const titleEl = modalElement.querySelector('#confirmationModalLabel');
    const bodyEl = modalElement.querySelector('#confirmationModalBody');
    const confirmBtn = modalElement.querySelector('#confirmationModalConfirmBtn');
    const cancelBtn = modalElement.querySelector('#confirmationModalCancelBtn');

    // Traducir textos
    if (titleEl) titleEl.textContent = i1n.get(titleKey);
    if (bodyEl) bodyEl.textContent = i1n.get(messageKey);
    if (confirmBtn) confirmBtn.textContent = i1n.get(okBtnKey); // Botón OK

    // Ocultar el botón de cancelar
    if (cancelBtn) cancelBtn.style.display = 'none';
    // Asegurarse de que el botón OK esté visible (si se ocultó antes)
    if (confirmBtn) confirmBtn.style.display = 'inline-block';

    // --- Manejo de Event Listener para el botón OK ---
    // Clonar para limpiar listeners previos
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Listener simple: solo cierra el modal
    newConfirmBtn.addEventListener('click', () => {
        confirmationModalInstance.hide();
    }, { once: true }); // { once: true } es buena práctica aquí

    confirmationModalInstance.show();
}