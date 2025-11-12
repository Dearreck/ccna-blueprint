    // =========================================================================
    // 1. EVENT BUS (Pub/Sub Pattern)
    // Facilitates communication between modules without direct dependencies.
    // =========================================================================
    export const EventBus = {
        events: {},
        on(eventName, fn) {
            this.events[eventName] = this.events[eventName] || [];
            this.events[eventName].push(fn);
        },
        off(eventName, fn) {
            if (this.events[eventName]) {
                this.events[eventName] = this.events[eventName].filter(f => f !== fn);
            }
        },
        emit(eventName, data) {
            if (this.events[eventName]) {
                this.events[eventName].forEach(fn => fn(data));
            }
        }
    };