// exam-simulator/modules/timer.js

// --- IMPORTACIONES ---
import { Store } from './store.js';
import { EventBus } from './eventBus.js';
// --- FIN IMPORTACIONES ---

export const Timer = { // <<<--- AÑADIDO 'export'
    intervalId: null,

    start(totalSeconds) {
        this.stop(); // Clear any existing timer
        if (totalSeconds === null || totalSeconds <= 0) return; // No timer needed

        // Usa Store para inicializar el tiempo
        Store._setTimeRemaining(totalSeconds); // <<<--- DEPENDE DE Store
        // Emite evento inicial
        EventBus.emit('timer:tick', totalSeconds); // <<<--- DEPENDE DE EventBus

        this.intervalId = setInterval(() => {
            // Usa Store para actualizar y obtener el tiempo restante
            const remaining = Store.updateTime(); // <<<--- DEPENDE DE Store
            // Notifica a la UI (u otros)
            EventBus.emit('timer:tick', remaining); // <<<--- DEPENDE DE EventBus
            if (remaining <= 0) {
                this.stop();
                // Notifica al módulo Exam (u otros) que el tiempo terminó
                EventBus.emit('timer:finished'); // <<<--- DEPENDE DE EventBus
            }
        }, 1000);
    },

    stop() {
        clearInterval(this.intervalId);
        this.intervalId = null;
    }
};