// Al principio del archivo:
const scriptUrl = new URL(import.meta.url);
const ROOT_PATH = new URL('../../', scriptUrl).pathname.replace(/\/$/, '');

export const Data = { // <<<--- AÑADIDO 'export'
    // Cache for fetched questions to avoid refetching same category
    _questionCache: {},

    async fetchQuestions(categoryIds = [], topicIds = []) {
        // TODO: Implement filtering by topicIds if provided
        const uniqueCategoryIds = [...new Set(categoryIds)]; // Ensure no duplicates
        // Determina qué categorías faltan en el caché
        const categoriesToFetch = uniqueCategoryIds.filter(id => !this._questionCache[id]);

        if (categoriesToFetch.length > 0) {
            console.log("Fetching categories:", categoriesToFetch);
            const fetchPromises = categoriesToFetch.map(id =>
                // Usa ruta relativa a la raíz del sitio
                fetch(`${ROOT_PATH}/data/${id}.json`)
                    .then(response => {
                        if (!response.ok) throw new Error(`Failed to load: ${id} (${response.status})`);
                        // Maneja archivos potencialmente vacíos
                        return response.text().then(text => text ? JSON.parse(text) : []);
                    })
                    .then(questions => {
                        this._questionCache[id] = questions; // Almacena en caché
                        return questions;
                    })
                    .catch(error => {
                        console.warn(`Could not load or parse ${id}:`, error);
                        this._questionCache[id] = []; // Cachea array vacío en error
                        return [];
                    })
            );
            // Espera a que todas las nuevas cargas finalicen
            await Promise.all(fetchPromises);
        }

        // Combina preguntas de las categorías solicitadas desde el caché
        let combinedQuestions = [];
        uniqueCategoryIds.forEach(id => {
            if (this._questionCache[id]) {
                combinedQuestions.push(...this._questionCache[id]);
            }
        });

        // TODO: Añadir lógica de filtrado por topicIds aquí si es necesario
        // combinedQuestions = combinedQuestions.filter(q => topicIds.includes(q.topic?.id) || topicIds.includes(q.topic?.subtopic_id));

        return combinedQuestions;
    },

    shuffleArray(array) {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    saveAttempt(attemptData) {
        // Guarda el intento en localStorage
        const attempt = {
            date: new Date().toISOString(),
            stats: attemptData.stats,
            totalQuestions: attemptData.currentExamQuestions.length,
            mode: attemptData.examMode,
            // Podrías añadir performanceData aquí también
        };
        try {
            // Obtiene historial, añade intento, limita tamaño y guarda
            const history = JSON.parse(localStorage.getItem('CCNA_examHistory')) || [];
            history.push(attempt);
            if (history.length > 50) history.shift(); // Limita a 50 intentos
            localStorage.setItem('CCNA_examHistory', JSON.stringify(history));
        } catch (e) {
            console.error("Could not save exam result.", e);
        }
    },
    
    /**
     * Carga la estructura de temas desde el archivo JSON correspondiente al idioma actual.
     * Cachea la estructura una vez cargada para evitar recargas.
     * @returns {Promise<Array | null>} Una promesa que resuelve con el array de la estructura de temas o null si hay error.
     */
    async loadTopicsStructure() {
        const lang = (typeof i1n !== 'undefined' && i1n.currentLanguage) ? i1n.currentLanguage : 'es'; // Obtiene idioma actual o usa 'es' por defecto
        const cacheKey = `topics_${lang}`; // Clave para el caché

        // Revisa si ya está en caché (usamos _questionCache por conveniencia, podría ser un caché separado)
        if (this._questionCache[cacheKey]) {
            console.log(`Estructura de temas (${lang}) cargada desde caché.`);
            return this._questionCache[cacheKey];
        }

        // Si no, carga desde archivo
        const filePath = `${ROOT_PATH}/data/structure/topics_structure_${lang}.json`;
        console.log(`Cargando estructura de temas desde: ${filePath}`);

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Error ${response.status} al cargar ${filePath}`);
            }
            const structureData = await response.json();
            // Guarda en caché antes de devolver
            this._questionCache[cacheKey] = structureData;
            return structureData;
        } catch (error) {
            console.error(`Fallo al cargar la estructura de temas (${lang}):`, error);
            return null; // Devuelve null en caso de error
        }
    },
};
