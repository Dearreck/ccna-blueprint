(async () => {
    if (typeof i1n !== 'undefined') {
        await i1n.loadNamespaces(['pw_cracker']);
        // i1n.translatePage(); // Vuelve a traducir por si la página cargó antes
    }
})();

// Importa showAlertModal desde la ubicación correcta
import { showAlertModal } from '../../components/confirm-modal/confirmModal.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM
    const crackerForm = document.getElementById('passwordCrackerForm');
    const encryptedInput = document.getElementById('encryptedPasswordInput');
    const decryptedOutput = document.getElementById('decryptedPasswordOutput');
    const decryptButton = document.getElementById('decryptButton'); // Botón Descubrir
    const copyButton = document.getElementById('copyButton');       // Botón Copiar
    const inputValidationFeedback = document.getElementById('inputValidationFeedback'); // Feedback de validación
    const copyFeedback = document.getElementById('copyFeedback'); // Feedback de copia

    // Clave Vigenere
    const vigenereKey = [
        0x64, 0x73, 0x66, 0x64, 0x3b, 0x6b, 0x66, 0x6f, 0x41, 0x2c, 0x2e,
        0x69, 0x79, 0x65, 0x77, 0x72, 0x6b, 0x6c, 0x64, 0x4a, 0x4b, 0x44,
        0x48, 0x53, 0x55, 0x42, 0x73, 0x67, 0x76, 0x63, 0x61, 0x36, 0x39,
        0x38, 0x33, 0x34, 0x6e, 0x63, 0x78, 0x76, 0x39, 0x38, 0x37, 0x33,
        0x32, 0x35, 0x34, 0x6b, 0x66, 0x67, 0x38, 0x37
    ];

    /**
     * Valida el formato de la contraseña Type 7 en tiempo real.
     * @param {string} encrypted - La cadena cifrada.
     * @returns {boolean} - True si el formato es potencialmente válido, False si no.
     */
    function isValidType7Format(encrypted) {
        if (!encrypted) return true; // Vacío es "válido" hasta que se envíe
        // Solo caracteres hexadecimales
        if (!/^[0-9a-fA-F]*$/.test(encrypted)) return false;
        // Longitud mínima 2 (para el índice)
        if (encrypted.length < 2) return true; // Aún podría ser válido
        // Longitud par después del índice
        if ((encrypted.length - 2) % 2 !== 0) return false;
        // Índice inicial debe ser un hex válido
        const startIndexHex = encrypted.substring(0, 2);
        const startIndex = parseInt(startIndexHex, 16);
        if (isNaN(startIndex) || startIndex < 0 || startIndex >= vigenereKey.length) return false;

        return true; // Pasa validaciones preliminares
    }

    /**
     * Descifra una contraseña Cisco Type 7.
     * Muestra alertas en caso de error.
     * @param {string} encrypted - La cadena cifrada en hexadecimal.
     * @returns {string|null} La contraseña descifrada o null si hubo un error.
     */
    function decodeType7(encrypted) {
        const i18nAvailable = typeof i1n !== 'undefined';

        function getErrorMessage(key, fallback, replacements = {}) {
            let messageTemplate = fallback;
            if (i18nAvailable) messageTemplate = i1n.get(key, fallback);
            for (const placeholder in replacements) {
                messageTemplate = messageTemplate.replace(`\${${placeholder}}`, replacements[placeholder]);
            }
            return messageTemplate;
        }

        // Validación final antes de descifrar (más estricta que la de tiempo real)
        if (!encrypted || encrypted.length < 4 || !/^[0-9a-fA-F]+$/.test(encrypted) || (encrypted.length - 2) % 2 !== 0) {
            const errorMsg = getErrorMessage('pw_cracker_error_format_final', 'Error: Formato o longitud inválidos.'); // Nueva clave i18n
            showAlertModal('alert_title_error', errorMsg);
            return null;
        }

        try {
            const startIndexHex = encrypted.substring(0, 2);
            let startIndex = parseInt(startIndexHex, 16);

            if (isNaN(startIndex) || startIndex < 0 || startIndex >= vigenereKey.length) {
                const errorMsg = getErrorMessage('pw_cracker_error_index', 'Error: Invalid start index (${startIndexHex}).', { startIndexHex });
                showAlertModal('alert_title_error', errorMsg);
                return null;
            }

            let decrypted = '';
            for (let i = 2; i < encrypted.length; i += 2) {
                const hexPair = encrypted.substring(i, i + 2);
                const encryptedCharCode = parseInt(hexPair, 16);

                if (isNaN(encryptedCharCode)) {
                    const errorMsg = getErrorMessage('pw_cracker_error_char', 'Error: Invalid character found (\'${hexPair}\' at position ${i}).', { hexPair, i });
                    showAlertModal('alert_title_error', errorMsg);
                    return null;
                }

                const decryptedCharCode = encryptedCharCode ^ vigenereKey[startIndex % vigenereKey.length];
                decrypted += String.fromCharCode(decryptedCharCode);
                startIndex++;
            }
            return decrypted;

        } catch (e) {
            console.error("Error inesperado durante la decodificación:", e);
            const errorMsg = getErrorMessage('pw_cracker_error_unexpected', 'Unexpected error during decoding. Details: ${message}', { message: e.message });
            showAlertModal('alert_title_error', errorMsg);
            return null;
        }
    }

    /**
     * Muestra feedback visual en el textarea de salida.
     */
    function showOutputFeedback() {
        if (!decryptedOutput) return;
        decryptedOutput.classList.add('success');
        // Quita la clase después de un tiempo para que el efecto sea temporal
        setTimeout(() => {
            decryptedOutput.classList.remove('success');
        }, 1000); // 1 segundo de highlight
    }

    /**
     * Maneja el estado del botón Descubrir (spinner/texto).
     * @param {boolean} isLoading - True para mostrar estado de carga, False para estado normal.
     */
    function setDecryptButtonState(isLoading) {
        if (!decryptButton) return;
        const originalIconHTML = '<i class="fas fa-lock-open me-2"></i>';
        const originalTextKey = 'pw_cracker_decrypt_button';
        const loadingTextKey = 'pw_cracker_decrypting_button'; // Nueva clave i18n
        const spinnerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>';

        if (isLoading) {
            decryptButton.disabled = true;
            const loadingText = (typeof i1n !== 'undefined') ? i1n.get(loadingTextKey, 'Descubriendo...') : 'Decrypting...';
            decryptButton.innerHTML = `${spinnerHTML}${loadingText}`;
        } else {
            decryptButton.disabled = false;
            const originalText = (typeof i1n !== 'undefined') ? i1n.get(originalTextKey, 'Descubrir') : 'Decrypt';
            decryptButton.innerHTML = `${originalIconHTML}${originalText}`;
        }
    }

    // --- Event Listeners ---

    // Validación en tiempo real del input
    if (encryptedInput && inputValidationFeedback) {
        encryptedInput.addEventListener('input', () => {
            const isValid = isValidType7Format(encryptedInput.value);
            if (!isValid && encryptedInput.value.length > 0) {
                encryptedInput.classList.add('is-invalid'); // Usa clase Bootstrap para borde
                inputValidationFeedback.classList.remove('visually-hidden'); // Muestra hint
            } else {
                encryptedInput.classList.remove('is-invalid');
                inputValidationFeedback.classList.add('visually-hidden'); // Oculta hint
            }
        });
    }

    // Envío del formulario
    if (crackerForm) {
        crackerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!encryptedInput || !decryptedOutput || !decryptButton || !copyButton) return;

            const encryptedPassword = encryptedInput.value.trim();

            // Poner botón en estado "cargando" (aunque sea rápido)
            setDecryptButtonState(true);
            decryptedOutput.value = ''; // Limpia salida anterior
            copyButton.disabled = true; // Deshabilita copiar
            copyFeedback.style.display = 'none'; // Oculta feedback copia

            // Simula un pequeño retraso para que se vea el spinner (opcional)
            setTimeout(() => {
                const decryptedResult = decodeType7(encryptedPassword);

                if (decryptedResult !== null) {
                    decryptedOutput.value = decryptedResult;
                    copyButton.disabled = false; // Habilita copiar
                    showOutputFeedback(); // Feedback visual verde
                } else {
                    decryptedOutput.value = ''; // Asegura que esté vacío si hubo error
                    copyButton.disabled = true;
                }

                // Restaurar botón a estado normal
                setDecryptButtonState(false);

            }, 50); // Pequeño retraso de 50ms

        });
    }

    // Botón Copiar
    if (copyButton && decryptedOutput && copyFeedback) {
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(decryptedOutput.value);
                copyFeedback.style.display = 'block'; // Muestra "¡Copiado!"
                // Oculta el mensaje después de un tiempo
                setTimeout(() => {
                    copyFeedback.style.display = 'none';
                }, 2000); // 2 segundos
            } catch (err) {
                console.error('Error al copiar al portapapeles:', err);
                // Opcional: Mostrar un modal de error si falla la copia
                const errorMsg = (typeof i1n !== 'undefined') ? i1n.get('pw_cracker_error_copy', 'Error al copiar.') : 'Error copying.';
                showAlertModal('alert_title_error', errorMsg);
            }
        });
    }

    // Listener para i18n (solo para actualizar textos de botones si cambian)
    if (typeof i1n !== 'undefined') {
        i1n.registerDynamicRenderer(() => {
            // Actualiza texto del botón Descubrir (si no está cargando)
            if (decryptButton && !decryptButton.disabled) {
                const originalIconHTML = '<i class="fas fa-lock-open me-2"></i>';
                const originalText = i1n.get('pw_cracker_decrypt_button', 'Descubrir');
                decryptButton.innerHTML = `${originalIconHTML}${originalText}`;
            }
            // Actualiza texto del botón Copiar
            if (copyButton) {
                const copyText = i1n.get('pw_cracker_copy_button', 'Copiar');
                // Reconstruye el HTML interno para mantener el icono
                copyButton.innerHTML = `<i class="fas fa-copy me-1"></i> ${copyText}`;
            }
            // Actualiza hint de validación (si es visible)
            if (inputValidationFeedback && !inputValidationFeedback.classList.contains('visually-hidden')) {
                inputValidationFeedback.textContent = i1n.get('pw_cracker_invalid_input_hint', 'Formato inválido...');
            }
            // Actualiza feedback de copia (si es visible)
            if (copyFeedback && copyFeedback.style.display !== 'none') {
                copyFeedback.textContent = i1n.get('pw_cracker_copied_feedback', '¡Copiado!');
            }
        });
    }

}); // Fin DOMContentLoaded