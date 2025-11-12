// exam-simulator/modules/ui.js

// --- IMPORTACIONES ---
import { Store } from './store.js';
import { EventBus } from './eventBus.js';
import { Data } from './data.js';
import { CONFIG } from './config.js';
import { Exam } from './exam.js';
import { showAlertModal } from '../../components/confirm-modal/confirmModal.js';

// --- FIN IMPORTACIONES ---

// =========================================================================
// 3. UI MODULE (DOM Manipulation)
// =========================================================================
export const UI = { // <<<--- AÑADIDO 'export'
    // --- Caché para Plantillas HTML ---
    _templateCache: {},

    // --- Bandera para evitar ejecuciones concurrentes ---
    _isPopulatingCategories: false,

    // --- Referencia a CONFIG (se asignará en init) ---
    CONFIG: null,
    // --- Referencia a Exam (se asignará en init) ---
    Exam: null,


    // --- DOM Element References ---
    elements: {
        setupContainer: document.getElementById('exam-setup-container'),
        questionsContainer: document.getElementById('exam-questions-container'),
        resultsContainer: document.getElementById('exam-results-container'),
        reviewContainer: document.getElementById('exam-review-container'),
        categorySelection: document.getElementById('category-selection-container'),
        topicAccordion: document.getElementById('topic-accordion'),
        startBtn: document.getElementById('start-exam-btn'),
        selectAllCategoriesBtn: document.getElementById('select-all-categories'),
        deselectAllCategoriesBtn: document.getElementById('deselect-all-categories'),
        startCustomBtn: document.getElementById('start-custom-exam-btn'),
        questionCountSelect: document.getElementById('question-count-select'),
        totalQuestionsBadge: document.getElementById('total-questions-count'),
        // Añadir referencias faltantes si las hay (ej. #performance-accordion)
        performanceAccordion: document.getElementById('performance-accordion'),
    },

    /**
     * Inicializa el módulo UI, guardando referencias necesarias.
     */
    init(configRef, examRef) {
        this.CONFIG = configRef; // Guarda referencia a CONFIG
        this.Exam = examRef; // Guarda referencia a Exam
        // Podrías inicializar this.elements aquí si prefieres en lugar de definirlos estáticamente
    },

    /**
     * Carga una plantilla HTML desde un archivo o desde el caché.
     * @param {string} templateName - El nombre del archivo de plantilla (sin .html). Ej: 'question-card'.
     * @returns {Promise<DocumentFragment | null>} Una promesa que resuelve con el contenido clonado de la plantilla o null si hay error.
     */
    async _loadTemplate(templateName) {
        const templateId = `${templateName}-template`; // Ej: 'question-card-template'

        // 1. Revisa si la plantilla ya está en el caché
        if (this._templateCache[templateId]) {
            // Clona el contenido del template cacheado
            return this._templateCache[templateId].content.cloneNode(true);
        }

        // 2. Si no está en caché, intenta cargarla desde el archivo
        try {
            const response = await fetch(`/exam-simulator/templates/${templateName}.html`);
            if (!response.ok) {
                throw new Error(`Error ${response.status} al cargar ${templateName}.html`);
            }
            const htmlText = await response.text();

            // 3. Parsea el texto HTML para encontrar el <template>
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const templateElement = doc.getElementById(templateId);

            if (!templateElement || !(templateElement instanceof HTMLTemplateElement)) {
                console.error(`Elemento <template> con id "${templateId}" no encontrado en ${templateName}.html`);
                return null;
            }

            // 4. Guarda el elemento <template> en el caché
            this._templateCache[templateId] = templateElement;
            console.log(`Plantilla "${templateId}" cargada y cacheada.`);

            // 5. Clona y devuelve el contenido
            return templateElement.content.cloneNode(true);

        } catch (error) {
            console.error(`Fallo al cargar o procesar la plantilla "${templateName}":`, error);
            return null; // Devuelve null en caso de error
        }
    },

    // --- Core UI Functions ---
    showScreen(screenName) {
        ['setup', 'questions', 'results', 'review'].forEach(key => {
            const container = this.elements[`${key}Container`];
            if (container) container.classList.add('d-none');
        });
        const activeContainer = this.elements[`${screenName}Container`];
        if (activeContainer) {
            activeContainer.classList.remove('d-none');
            window.scrollTo(0, 0); // Scroll to top when changing screens
        }
    },

    // --- Setup Screen Rendering ---
    async renderSetupScreen() {
        this.showScreen('setup');
        // TODO: Load categories/topics dynamically using Data module
        await this._populateCategories();
        await this._populateTopics(); // Will populate the accordion
        this._translateSetupOptions();
        this._attachSetupListeners();
    },

    async _populateCategories() {
        // Verifica si ya está en ejecución o si falta el elemento
        if (!this.elements.categorySelection || this._isPopulatingCategories) {
            console.log("Skipping _populateCategories execution (already running or element missing).");
            return;
        }

        this._isPopulatingCategories = true; // <<<=== ESTABLECER BANDERA
        console.log("Starting _populateCategories..."); // Log para depuración

        try { // Usar try...finally para asegurar que la bandera se resetee
            this.elements.categorySelection.innerHTML = `<div class="col-12"><p class="text-muted">${i1n.get('loading_categories', 'Cargando categorías...')}</p></div>`;

            const allCategoryIds = CONFIG.categories.map(cat => cat.id);
            const allQuestionsData = await Data.fetchQuestions(allCategoryIds);
            Store._setAllQuestions(allQuestionsData);

            this.elements.categorySelection.innerHTML = ''; // Limpia contenedor
            console.log("Category container cleared."); // Log para depuración

            let totalCount = 0;

            for (const category of CONFIG.categories) {
                const questionCount = allQuestionsData.filter(q => q.category === category.id).length;
                totalCount += questionCount;

                if (questionCount > 0) {
                    const templateFragment = await this._loadTemplate('setup-category-item');
                    if (templateFragment) {
                        const inputElement = templateFragment.querySelector('.category-checkbox');
                        const labelElement = templateFragment.querySelector('.form-check-label');
                        const nameSpan = templateFragment.querySelector('.category-name');
                        const countBadge = templateFragment.querySelector('.category-count');
                        const categoryInfo = CONFIG.categoryVisuals[category.id] || { color: '#6c757d', icon: 'fa-question-circle' };

                        if (inputElement) {
                            inputElement.value = category.id;
                            inputElement.id = `check-${category.id}`;
                            inputElement.checked = true; // Aseguramos que estén marcadas por defecto
                        }
                        if (labelElement) {
                            labelElement.setAttribute('for', `check-${category.id}`);
                        }
                        if (nameSpan) {
                            nameSpan.textContent = i1n.get(category.i18nKey) || category.id;
                        }
                        if (countBadge) {
                            countBadge.textContent = questionCount;
                            countBadge.style.backgroundColor = categoryInfo.color;
                        }
                        // Log antes de añadir
                        // console.log("Appending category:", category.id);
                        this.elements.categorySelection.appendChild(templateFragment);
                    }
                }
            }

            this._attachSetupListeners();

            if (this.elements.totalQuestionsBadge) {
                this.elements.totalQuestionsBadge.textContent = totalCount > 999 ? '999+' : totalCount;
            }
            // Validar estado inicial del botón Comenzar
            this._checkCategorySelection(); // Llamamos a la función helper

        } catch (error) {
            console.error("Error during _populateCategories:", error); // Añadir manejo de errores
        } finally {
            this._isPopulatingCategories = false; // <<<=== RESETEAR BANDERA
            console.log("Finished _populateCategories."); // Log para depuración
        }
    },

    _checkCategorySelection() {
        if (!this.elements.startBtn || !this.elements.categorySelection) return;
        const anyChecked = this.elements.categorySelection.querySelector('.category-checkbox:checked');
        this.elements.startBtn.disabled = !anyChecked;
        // Añadir lógica similar para el botón custom si es necesario
    },

    async _populateTopics() {
        if (!this.elements.topicAccordion) return; // Salir si el elemento no existe

        // Muestra mensaje de carga usando i18n
        this.elements.topicAccordion.innerHTML = `<p class="text-muted small">${i1n.get('loading_topics', 'Cargando temas...')}</p>`; // Asegúrate de tener la clave 'loading_topics' en tus JSON de idioma

        // 1. Carga la estructura de temas traducida usando el módulo Data
        const topicsStructure = await Data.loadTopicsStructure(); // <<<--- Llama a la función en Data.js
        if (!topicsStructure || !Array.isArray(topicsStructure)) {
            // Muestra error si falla la carga
            this.elements.topicAccordion.innerHTML = `<p class="text-danger">${i1n.get('error_loading_topics', 'Error al cargar la estructura de temas.')}</p>`; // Añade clave i18n
            return;
        }

        // Accede a todas las preguntas ya cargadas en el Store
        const allQuestions = Store.state.allQuestions || [];

        // Limpia el contenedor antes de añadir el acordeón
        this.elements.topicAccordion.innerHTML = '';

        let categoryIndex = 0; // Para IDs únicos del acordeón

        // 2. Itera sobre las categorías definidas en CONFIG para mantener el orden oficial
        for (const categoryConfig of this.CONFIG.categories) {
            // Busca los datos de esta categoría en la estructura cargada
            const categoryData = topicsStructure.find(cat => cat.categoryId === categoryConfig.id);
            // Salta si no hay temas definidos para esta categoría en los archivos de estructura
            if (!categoryData || !categoryData.topics || categoryData.topics.length === 0) {
                console.warn(`No se encontraron temas para la categoría ${categoryConfig.id} en la estructura cargada.`);
                continue;
            }

            // --- CÁLCULO CONTEO CATEGORÍA ---
            const categoryQuestionCount = allQuestions.filter(q => q.category === categoryConfig.id).length;
            // --- FIN CÁLCULO ---

            // 3. Carga la plantilla para el item de acordeón de categoría
            const categoryTemplateFragment = await this._loadTemplate('setup-topic-accordion-item');
            if (!categoryTemplateFragment) {
                console.error(`No se pudo cargar la plantilla 'setup-topic-accordion-item'.`);
                continue; // Salta esta categoría si la plantilla falla
            }

            // --- Selecciona elementos de la plantilla de categoría ---
            const header = categoryTemplateFragment.querySelector('.accordion-header');
            const button = categoryTemplateFragment.querySelector('.accordion-button');
            const collapseDiv = categoryTemplateFragment.querySelector('.accordion-collapse');
            const masterCheckbox = categoryTemplateFragment.querySelector('.category-master-checkbox');
            const categoryTitleLabel = categoryTemplateFragment.querySelector('.category-accordion-title');
            const topicListContainer = categoryTemplateFragment.querySelector('.topic-list-container');

            // --- Configura IDs y atributos para el acordeón ---
            const uniqueHeadingId = `heading-category-${categoryIndex}`;
            const uniqueCollapseId = `collapse-category-${categoryIndex}`;
            const uniqueMasterCheckId = `master-check-${categoryConfig.id}`; // Usa ID de categoría para ID del checkbox
            if (header) header.id = uniqueHeadingId;
            if (button) {
                button.setAttribute('data-bs-target', `#${uniqueCollapseId}`);
                button.setAttribute('aria-controls', uniqueCollapseId);
            }
            if (collapseDiv) {
                collapseDiv.id = uniqueCollapseId;
                collapseDiv.setAttribute('aria-labelledby', uniqueHeadingId);
            }
            if (masterCheckbox) {
                masterCheckbox.id = uniqueMasterCheckId;
                masterCheckbox.value = categoryConfig.id; // Guardamos el ID de categoría
                masterCheckbox.setAttribute('data-category-id', categoryConfig.id);
            }
            if (categoryTitleLabel) {
                // Obtiene el nombre traducido de la categoría y añade el peso
                const categoryName = i1n.get(categoryConfig.i18nKey) || categoryConfig.id;
                // --- INYECTA BADGE EN CATEGORÍA ---
                // Crea el badge dinámicamente
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'badge rounded-pill ms-2 category-topic-count'; // Nueva clase para estilo
                badgeSpan.textContent = categoryQuestionCount;
                // Aplica color si quieres (opcional, podrías usar CSS)
                const categoryInfoColor = this.CONFIG.categoryVisuals[categoryConfig.id]?.color || '#6c757d';
                badgeSpan.style.backgroundColor = categoryInfoColor;
                badgeSpan.style.color = '#fff'; // Asegura contraste

                categoryTitleLabel.textContent = categoryName; // Establece el nombre primero
                categoryTitleLabel.appendChild(badgeSpan); // Añade el badge después del texto
                // --- FIN INYECCIÓN BADGE ---
                categoryTitleLabel.setAttribute('for', uniqueMasterCheckId);
            }


            const categoryInfo = this.CONFIG.categoryVisuals[categoryConfig.id] || { color: '#6c757d' };
            if (button) {
                // Aplica el color al borde izquierdo
                button.style.borderLeft = `5px solid ${categoryInfo.color}`;
                // Resetea el fondo por si acaso
                button.style.backgroundColor = '';

                // Opcional: Ajusta el color del icono de flecha (si aún lo quieres)
                button.style.setProperty('--bs-accordion-btn-icon', `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23${categoryInfo.color.substring(1)}'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e")`);
                button.style.setProperty('--bs-accordion-btn-active-icon', `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23${categoryInfo.color.substring(1)}'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e")`);
            }


            // 4. Itera sobre los temas y subtemas de esta categoría
            if (topicListContainer && categoryData.topics) {
                for (const topic of categoryData.topics) {
                    // Carga y configura la plantilla para el tema principal
                    // Pasamos topic directamente ya que tiene 'id' y 'description'
                    await this._appendTopicCheckbox(topicListContainer, topic, categoryConfig.id, false, allQuestions); // false = no indentar

                    // Si hay subtemas, itera sobre ellos
                    if (topic.subtopics && topic.subtopics.length > 0) {
                        for (const subtopic of topic.subtopics) {
                            // Carga y configura la plantilla para el subtema (con indentación)
                            // Pasamos subtopic directamente
                            await this._appendTopicCheckbox(topicListContainer, subtopic, categoryConfig.id, true, allQuestions); // true = indentar
                        }
                    }
                }
            }

            // 5. Añade el elemento de categoría completo al contenedor del acordeón
            this.elements.topicAccordion.appendChild(categoryTemplateFragment);
            categoryIndex++; // Incrementa índice para la siguiente categoría
        } // Fin del bucle de categorías

        // 6. Añade listeners para la lógica de checkboxes después de construir todo el acordeón
        this._attachTopicSelectionListeners();

    }, // Fin de _populateTopics

    /**
     * Función auxiliar para añadir un checkbox de tema/subtema al contenedor.
     * @param {HTMLElement} container - El div .topic-list-container donde añadir el checkbox.
     * @param {object} topicData - El objeto con { id, description } del tema/subtema.
     * @param {string} categoryId - El ID de la categoría padre.
     * @param {boolean} isSubtopic - True si se debe aplicar indentación.
     * @param {number} allQuestions - Cantidad de preguntas.
     */
    async _appendTopicCheckbox(container, topicData, categoryId, isSubtopic, allQuestions) {
        const itemTemplateFragment = await this._loadTemplate('setup-topic-checkbox-item');
        if (!itemTemplateFragment) return;

        const topicItemDiv = itemTemplateFragment.querySelector('.topic-item');
        const checkbox = itemTemplateFragment.querySelector('.topic-checkbox');
        const topicIdSpan = itemTemplateFragment.querySelector('.topic-id');
        const topicDescSpan = itemTemplateFragment.querySelector('.topic-description');

        // Modifica la condición para quitar 'label'
        if (checkbox && topicIdSpan && topicDescSpan && topicItemDiv) {
            // --- CÁLCULO CONTEO TEMA/SUBTEMA ---
            let questionCount = 0;
            if (isSubtopic) {
                // Cuenta solo para este subtopic específico
                questionCount = allQuestions.filter(q => q.topic?.subtopic_id === topicData.id).length;
            } else {
                // Cuenta para el tema principal Y TODOS sus subtemas
                questionCount = allQuestions.filter(q => q.topic?.id === topicData.id || q.topic?.subtopic_id?.startsWith(topicData.id + '.')).length;
                // Corrección: Asegura que solo cuente subtemas que empiecen con el ID del tema principal seguido de un punto.
                // Ejemplo: Si topicData.id es "1.1", contará preguntas de "1.1" (si existen) y "1.1.a", "1.1.b", etc.
                // No contará "1.10" por error.
                // Ajuste más preciso:
                questionCount = allQuestions.filter(q => {
                    // Verifica si la pregunta pertenece directamente al tema principal (si no tiene subtopic_id o si coincide)
                    const belongsToMainTopic = q.topic?.id === topicData.id && (!q.topic.subtopic_id || q.topic.subtopic_id === topicData.id);
                    // Verifica si la pregunta pertenece a un subtema de este tema principal
                    const belongsToSubtopic = q.topic?.subtopic_id?.startsWith(topicData.id + '.') ?? false;
                    return belongsToMainTopic || belongsToSubtopic;
                }).length;


            }
            // --- FIN CÁLCULO ---

            const uniqueCheckboxId = `check-${topicData.id.replace(/\./g, '-')}`;

            checkbox.value = topicData.id;
            checkbox.id = uniqueCheckboxId;
            checkbox.setAttribute('data-topic-id', topicData.id);
            checkbox.setAttribute('data-category-id', categoryId);
            topicIdSpan.textContent = topicData.id;
            topicDescSpan.textContent = topicData.description;

            // --- INYECTA BADGE EN TEMA/SUBTEMA ---
            if (questionCount > 0) { // Solo muestra badge si hay preguntas
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'badge rounded-pill bg-secondary ms-2 topic-subtopic-count'; // Clase genérica
                badgeSpan.textContent = questionCount;
                topicDescSpan.appendChild(badgeSpan); // Añade el badge al final de la descripción
            }
            // --- FIN INYECCIÓN BADGE ---

            if (isSubtopic) {
                topicItemDiv.classList.add('subtopic-item');
            }

            container.appendChild(itemTemplateFragment);
        } else {
            // Actualiza el mensaje de error si quieres
            console.error("Faltan elementos (.checkbox, .topic-id, .topic-description, .topic-item) en la plantilla 'setup-topic-checkbox-item'.");
        }
    },


    _attachTopicSelectionListeners() {
        if (!this.elements.topicAccordion) return;

        // Limpia listeners previos clonando y reemplazando (más seguro)
        const newAccordion = this.elements.topicAccordion.cloneNode(true);
        this.elements.topicAccordion.parentNode.replaceChild(newAccordion, this.elements.topicAccordion);
        this.elements.topicAccordion = newAccordion; // Actualiza la referencia

        // Listener usando delegación de eventos en el contenedor del acordeón
        this.elements.topicAccordion.addEventListener('change', (event) => {
            const target = event.target; // El checkbox que cambió

            if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;

            const categoryId = target.getAttribute('data-category-id');
            if (!categoryId) return;

            const parentAccordionItem = target.closest('.accordion-item');
            if (!parentAccordionItem) return;

            // --- Lógica si se cambió un Checkbox Maestro (Categoría) ---
            if (target.classList.contains('category-master-checkbox')) {
                const isChecked = target.checked;
                parentAccordionItem
                    .querySelectorAll(`.topic-checkbox[data-category-id="${categoryId}"]`)
                    .forEach(cb => cb.checked = isChecked);
                target.indeterminate = false; // Quita estado indeterminado si existe
            }
            // --- Lógica si se cambió un Checkbox Individual (Tema/Subtema) ---
            else if (target.classList.contains('topic-checkbox')) {
                const topicId = target.getAttribute('data-topic-id');
                const isChecked = target.checked;

                // *** LÓGICA JERÁRQUICA ***
                const topicParts = topicId.split('.');
                // Un tema principal tiene 2 partes y la segunda es numérica (ej: "1.1", "1.10")
                const isMainTopic = topicParts.length === 2 && /^\d+$/.test(topicParts[1]);
                // Un subtema tiene más de 2 partes (ej: "1.1.a", "6.3.b")
                const isSubtopic = topicParts.length > 2;

                // Si es un TEMA PRINCIPAL, seleccionar/deseleccionar sus SUBTEMAS
                if (isMainTopic) {
                    parentAccordionItem
                        .querySelectorAll(`.topic-checkbox[data-topic-id^="${topicId}."][data-category-id="${categoryId}"]`) // Subtemas que empiezan con "ID."
                        .forEach(subCb => {
                            subCb.checked = isChecked; // Aplica el mismo estado
                        });
                }
                // Si es un SUBTEMA, actualizar estado del TEMA PADRE
                else if (isSubtopic) {
                    const parentTopicId = `${topicParts[0]}.${topicParts[1]}`; // Ej. "1.1" o "6.3"
                    const parentTopicCheckbox = parentAccordionItem.querySelector(`.topic-checkbox[data-topic-id="${parentTopicId}"][data-category-id="${categoryId}"]`);
                    if (parentTopicCheckbox) {
                        // Selecciona todos los subtemas hermanos (incluido el actual)
                        const siblingSubtopics = parentAccordionItem.querySelectorAll(`.topic-checkbox[data-topic-id^="${parentTopicId}."][data-category-id="${categoryId}"]`);
                        let checkedSubtopics = 0;
                        let indeterminate = false;
                        siblingSubtopics.forEach(subCb => { if (subCb.checked) checkedSubtopics++; });

                        if (checkedSubtopics === siblingSubtopics.length) { // Todos marcados
                            parentTopicCheckbox.checked = true;
                            parentTopicCheckbox.indeterminate = false;
                        } else if (checkedSubtopics === 0) { // Ninguno marcado
                            parentTopicCheckbox.checked = false;
                            parentTopicCheckbox.indeterminate = false;
                        } else { // Algunos marcados
                            parentTopicCheckbox.checked = false; // El estado visual indeterminado requiere que 'checked' sea false
                            parentTopicCheckbox.indeterminate = true;
                        }
                    }
                }
                // *** FIN LÓGICA JERÁRQUICA ***

                // Actualizar estado del Checkbox Maestro (Categoría) - Siempre se ejecuta al cambiar un hijo
                const masterCheckbox = parentAccordionItem.querySelector(`.category-master-checkbox[data-category-id="${categoryId}"]`);
                if (masterCheckbox) {
                    // Considera TODOS los checkboxes (temas y subtemas) de la categoría
                    const allTopicCheckboxes = parentAccordionItem.querySelectorAll(`.topic-checkbox[data-category-id="${categoryId}"]`);
                    const total = allTopicCheckboxes.length;
                    let checkedCount = 0;
                    allTopicCheckboxes.forEach(cb => { if (cb.checked) checkedCount++; });

                    if (checkedCount === total) {
                        masterCheckbox.checked = true;
                        masterCheckbox.indeterminate = false;
                    } else if (checkedCount === 0) {
                        masterCheckbox.checked = false;
                        masterCheckbox.indeterminate = false;
                    } else {
                        masterCheckbox.checked = false;
                        masterCheckbox.indeterminate = true;
                    }
                }
            } // Fin else if (topic-checkbox)

            // Habilitar/deshabilitar botón "Comenzar Examen Personalizado"
            if (this.elements.startCustomBtn) {
                // Habilita si al menos UN checkbox de TEMA/SUBTEMA está marcado en TODO el acordeón
                const anyTopicChecked = this.elements.topicAccordion.querySelector('.topic-checkbox:checked');
                this.elements.startCustomBtn.disabled = !anyTopicChecked;
            }

        }); // Fin addEventListener 'change'
    },


    _translateSetupOptions() {
        // Translate dropdown options for question count
        if (this.elements.questionCountSelect) {
            Array.from(this.elements.questionCountSelect.options).forEach(option => {
                const key = `q_count_${option.value}`;
                option.textContent = i1n.get(key); // Use i18n.get directly
            });
        }
        // Add translations for custom inputs if needed
    },

    // --- Question Screen Rendering ---
    async renderQuestion(question) { // Añadimos 'async' porque ahora usa _loadTemplate
        if (!question || !this.elements.questionsContainer) return;
        this.showScreen('questions');
        const lang = i1n.currentLanguage || 'es';

        // 1. Carga y clona la plantilla
        const templateFragment = await this._loadTemplate('question-card');
        if (!templateFragment) {
            console.error("No se pudo cargar la plantilla 'question-card'.");
            this.elements.questionsContainer.innerHTML = '<p class="text-danger">Error: Falta la plantilla de pregunta.</p>';
            return;
        }

        // --- Selecciona los elementos DENTRO del fragmento clonado ---
        const cardHeader = templateFragment.querySelector('.card-header');
        const questionTextEl = templateFragment.querySelector('.question-text');
        const imageContainer = templateFragment.querySelector('.question-image-container');
        const imageEl = templateFragment.querySelector('.question-image');
        const codeContainer = templateFragment.querySelector('.question-code-container');
        const codeEl = templateFragment.querySelector('.code-block code');
        const optionsContainer = templateFragment.querySelector('.options-container');
        // Nota: Los elementos de explicación se manejan en showFeedback

        // 2. Poblar el encabezado
        const headerHTML = this._createQuestionHeaderHTML(question, lang, Store.state.currentQuestionIndex, Store.state.currentExamQuestions.length);
        const timerHTML = Store.state.examMode === 'exam' ? `<div id="timer-display" class="fs-5 fw-bold text-primary">${this._formatTime(Store.state.timeRemaining)}</div>` : '';
        if (cardHeader) {
            cardHeader.innerHTML = `<div class="d-flex justify-content-between align-items-center">${headerHTML}${timerHTML}</div>`;
        }

        // 3. Poblar el cuerpo (Texto, Imagen, Código)
        if (questionTextEl) {
            // Usamos innerHTML aquí porque marked.parseInline devuelve HTML
            questionTextEl.innerHTML = marked.parseInline(question[`question_${lang}`] || question.question_en);
        }

        if (question.image && imageContainer && imageEl) {
            // Asumiendo que las imágenes están en /data/images/ relativo a la raíz del sitio
            imageEl.src = `/data/images/${question.image}`;
            imageContainer.style.display = 'block'; // Mostrar contenedor de imagen
        } else if (imageContainer) {
            imageContainer.style.display = 'none'; // Ocultar si no hay imagen
        }

        if (question.code && codeContainer && codeEl) {
            codeEl.textContent = question.code; // Usar textContent para el código preformateado
            codeContainer.style.display = 'block'; // Mostrar contenedor de código
        } else if (codeContainer) {
            codeContainer.style.display = 'none'; // Ocultar si no hay código
        }

        // 4. Poblar las opciones
        if (optionsContainer) {
            let optionsHTML = '';
            // Determina el tipo de input basado en questionType
            let inputType = CONFIG.questionTypes[question.questionType]?.inputType || 'radio';
            question.shuffledOptions.forEach((option, index) => {
                const optionText = marked.parseInline(option[`text_${lang}`] || option.text_en || option.text_es); // Parsear texto de opción
                optionsHTML += `
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}" data-index="${index}">
                            <label class="form-check-label" for="option${index}">${optionText}</label>
                        </div>`;
            });
            optionsContainer.innerHTML = optionsHTML; // Insertar todas las opciones
        }

        // 5. Borrar el contenido anterior e insertar la nueva tarjeta
        this.elements.questionsContainer.innerHTML = ''; // Limpiar contenedor
        this.elements.questionsContainer.appendChild(templateFragment); // Añadir la tarjeta completa

        // 6. Traducir textos estáticos de la plantilla (botones) si es necesario
        //    (Se asume que i18n.js los maneja si tienen data-i18n, como en la plantilla)
        i1n.translatePage(); // Llama a i18n para traducir los nuevos elementos

        // 7. Adjuntar listeners a los NUEVOS botones DENTRO del contenedor
        this._attachQuestionListeners();
        this._initPopovers(); // Re-inicializar popovers para la insignia de categoría

        // 8. Volver a aplicar el feedback si la pregunta ya fue respondida (al cambiar idioma)
        const currentState = Store.getState();
        if (question.userAnswerIndex !== null && currentState.examMode === 'study') {
            this.showFeedback(question, lang);
        }
    },

    _createQuestionHeaderHTML(question, lang, index, total) {
        // (Reuses logic similar to your previous _createQuestionHeader)
        const categoryInfo = CONFIG.categoryVisuals[question.category] || { color: '#6c757d', icon: 'fa-question-circle' };
        const categoryName = i1n.get(CONFIG.categories.find(c => c.id === question.category)?.i18nKey || question.category);
        const topicDescription = question.topic ? (question.topic[`description_${lang}`] || question.topic.description_en) : '';
        const popoverTitle = categoryName;
        const popoverContent = question.topic
            ? `<strong>${question.topic.id}:</strong> ${topicDescription}<br><small class='text-muted'>${question.topic.subtopic_id}: ${question.topic.subtopic_description}</small>`
            : 'Subtopic information not available.';

        const categoryBadgeHTML = `
                 <div class="category-badge" style="background-color: ${categoryInfo.color};"
                      data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true"
                      title="${popoverTitle}" data-bs-content="${popoverContent}">
                     <i class="fas ${categoryInfo.icon}"></i>
                 </div>`;

        const headerText = `${i1n.get('question_header')} ${index + 1}/${total}`;
        return `<h5 class="mb-0 d-flex align-items-center">${categoryBadgeHTML} <span class="ms-2">${headerText}</span></h5>`;
    },

    _createOptionsHTML(question, lang, inputType) {
        let html = '';
        question.shuffledOptions.forEach((option, index) => {
            const optionText = marked.parseInline(option[`text_${lang}`] || option.text_en || option.text_es);
            // Important: Use data-index attribute to easily get the original index
            html += `
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}" data-index="${index}">
                        <label class="form-check-label" for="option${index}">${optionText}</label>
                    </div>`;
        });
        return html;
    },

    _createQuestionFooterHTML(lang) {
        const buttonText = (Store.state.examMode === 'study') ? i1n.get('btn_verify') : i1n.get('btn_next');
        return `
                <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                    <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${i1n.get('btn_end_exam')}</button></div>
                    <div>
                        <button id="skip-question-btn" class="btn btn-secondary me-2">${i1n.get('btn_skip')}</button>
                        <button id="check-answer-btn" class="btn btn-primary">${buttonText}</button>
                    </div>
                </div>`;
    },

    _attachQuestionListeners() {
        // Busca los botones DENTRO del contenedor de preguntas actual
        const checkBtn = this.elements.questionsContainer.querySelector('.check-answer-btn');
        const skipBtn = this.elements.questionsContainer.querySelector('.skip-question-btn');
        const endBtn = this.elements.questionsContainer.querySelector('.end-exam-btn');

        if (checkBtn) {
            // Configura el texto inicial del botón check/next según el modo
            checkBtn.textContent = (Store.state.examMode === 'study') ? i1n.get('btn_verify') : i1n.get('btn_next');

            // Añade el listener para enviar la respuesta
            checkBtn.addEventListener('click', () => {
                // Busca las opciones seleccionadas DENTRO del contenedor actual
                const selectedInputs = this.elements.questionsContainer.querySelectorAll('input[name="questionOptions"]:checked');
                if (selectedInputs.length === 0) {
                    // Usa i18n.get para el mensaje de alerta
                    showAlertModal('alert_title_info', 'alert_select_answer');
                    return;
                }
                // Mapea los valores (índices) seleccionados
                const selectedIndices = Array.from(selectedInputs).map(input => parseInt(input.value, 10));
                // Emite el evento con los índices seleccionados
                EventBus.emit('ui:answerSubmitted', selectedIndices);
            });
        }

        if (skipBtn) {
            // Añade el listener para omitir la pregunta
            skipBtn.addEventListener('click', () => EventBus.emit('ui:skipClicked'));

            // Habilita/Deshabilita el botón skip basado en si la pregunta ya fue respondida
            // (Se volverá a evaluar en showFeedback también)
            const currentQuestion = Store.getCurrentQuestion();
            skipBtn.disabled = currentQuestion?.userAnswerIndex !== null;
        }

        if (endBtn) {
            // Añade el listener para finalizar el examen
            endBtn.addEventListener('click', () => EventBus.emit('ui:endExamClicked'));
        }
    },

    showFeedback(question, lang) {
        // Obtiene una referencia al contenedor principal de la pregunta actual
        const container = this.elements.questionsContainer;
        if (!container) return; // Salir si el contenedor no existe

        // 1. Deshabilitar inputs y marcar respuestas
        // Busca todos los inputs de opciones DENTRO del contenedor actual
        container.querySelectorAll('.options-container .form-check-input').forEach(input => {
            input.disabled = true; // Deshabilita el input
        });

        question.shuffledOptions.forEach((option, index) => {
            // Busca la etiqueta correspondiente DENTRO del contenedor actual
            const label = container.querySelector(`label[for="option${index}"]`);
            if (!label) return; // Si no encuentra la etiqueta, salta a la siguiente

            // Determina si el usuario seleccionó esta opción
            let userSelectedThis = false;
            if (Array.isArray(question.userAnswerIndex)) { // Para multiple-choice
                userSelectedThis = question.userAnswerIndex.includes(index);
            } else { // Para single-choice
                userSelectedThis = (question.userAnswerIndex === index);
            }

            // Aplica clases CSS para feedback visual
            if (option.isCorrect) {
                label.classList.add('correct'); // Marca la correcta
                // Si el usuario acertó, asegúrate de que el input esté marcado (checked)
                if (userSelectedThis) {
                    const input = container.querySelector(`#option${index}`);
                    if (input) input.checked = true;
                }
            } else if (userSelectedThis) {
                label.classList.add('incorrect'); // Marca la incorrecta que seleccionó el usuario
                // Asegúrate de que el input incorrecto seleccionado esté marcado
                const input = container.querySelector(`#option${index}`);
                if (input) input.checked = true;
            }
        });

        // 2. Mostrar Explicación
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
        // Busca los elementos de explicación DENTRO del contenedor actual
        const explanationContainer = container.querySelector('.explanation-container');
        const explanationContent = container.querySelector('.explanation-content');

        if (explanationText && explanationContainer && explanationContent) {
            // Usa marked.parse para procesar el Markdown de la explicación
            explanationContent.innerHTML = marked.parse(explanationText);
            explanationContainer.style.display = 'block'; // Muestra el contenedor
        } else if (explanationContainer) {
            explanationContainer.style.display = 'none'; // Oculta si no hay explicación
        }

        // 3. Cambiar botón "Verificar" a "Siguiente" y reasignar evento
        // Busca el botón DENTRO del contenedor actual
        const checkBtn = container.querySelector('.check-answer-btn');
        if (checkBtn) {
            checkBtn.textContent = i1n.get('btn_next'); // Cambia el texto

            // --- IMPORTANTE: Reemplazar el botón para quitar listeners antiguos ---
            // Clonamos el botón existente. Esto crea una copia SIN los event listeners.
            const newCheckBtn = checkBtn.cloneNode(true);
            // Reemplazamos el botón viejo por el nuevo en el DOM.
            checkBtn.parentNode.replaceChild(newCheckBtn, checkBtn);
            // Añadimos el NUEVO listener al botón clonado para que emita 'ui:proceedClicked'.
            newCheckBtn.addEventListener('click', () => EventBus.emit('ui:proceedClicked'));
        }

        // 4. Deshabilitar botón "Omitir"
        // Busca el botón DENTRO del contenedor actual
        const skipBtn = container.querySelector('.skip-question-btn');
        if (skipBtn) {
            skipBtn.disabled = true; // Deshabilita el botón Omitir
        }
    },

    // --- Results Screen Rendering ---
    renderResults(stateData) {
        // (Similar logic to your previous displayResults)
        this.showScreen('results');
        const { stats, currentExamQuestions } = stateData;
        const totalQuestions = currentExamQuestions.length;
        const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;

        document.getElementById('results-score').textContent = `${scorePercentage}%`;
        document.getElementById('results-summary').textContent = `${i1n.get('results_summary_part1')} ${stats.correct} ${i1n.get('results_summary_part2')} ${totalQuestions} ${i1n.get('results_summary_part3')}`;
        document.getElementById('results-correct').textContent = stats.correct;
        document.getElementById('results-incorrect').textContent = stats.incorrect;
        document.getElementById('results-skipped').textContent = stats.skipped;

        // Translate labels
        document.querySelector('#results-correct + small').textContent = i1n.get('results_correct');
        document.querySelector('#results-incorrect + small').textContent = i1n.get('results_incorrect');
        document.querySelector('#results-skipped + small').textContent = i1n.get('results_skipped');
        document.getElementById('review-exam-btn').textContent = i1n.get('btn_review');
        document.getElementById('restart-exam-btn').textContent = i1n.get('btn_restart');
        document.querySelector('#exam-results-container a[href="../"]').textContent = i1n.get('btn_back_home'); // More specific selector


        // Update title and score color
        const resultsScoreElement = document.getElementById('results-score');
        resultsScoreElement.classList.remove('text-success', 'text-danger');
        if (scorePercentage >= 85) {
            resultsScoreElement.classList.add('text-success');
            document.getElementById('results-title').textContent = i1n.get('results_title_excellent');
        } else {
            resultsScoreElement.classList.add('text-danger');
            document.getElementById('results-title').textContent = i1n.get('results_title_practice');
        }

        // Attach button listeners
        document.getElementById('review-exam-btn').onclick = () => EventBus.emit('ui:reviewExamClicked');
        document.getElementById('restart-exam-btn').onclick = () => EventBus.emit('ui:restartExamClicked');

        // Render detailed performance
        this._renderDetailedResultsAccordion(stateData.detailedPerformance);
    },

    // --- Review Screen Rendering ---
    async renderReviewScreen(question, index, total) {
        this.showScreen('review'); // Muestra el contenedor de revisión
        const lang = i1n.currentLanguage || 'es';

        // 1. Carga y clona la plantilla de la tarjeta de revisión
        const cardTemplateFragment = await this._loadTemplate('review-card');
        if (!cardTemplateFragment) {
            this.elements.reviewContainer.innerHTML = '<p class="text-danger">Error: Falta la plantilla de revisión.</p>';
            return;
        }

        // --- Selecciona elementos DENTRO del fragmento clonado ---
        const skippedBadge = cardTemplateFragment.querySelector('.skipped-question-badge');
        const cardHeader = cardTemplateFragment.querySelector('.card-header');
        const questionTextEl = cardTemplateFragment.querySelector('.question-text');
        const imageContainer = cardTemplateFragment.querySelector('.question-image-container');
        const imageEl = cardTemplateFragment.querySelector('.question-image');
        const codeContainer = cardTemplateFragment.querySelector('.question-code-container');
        const codeEl = cardTemplateFragment.querySelector('.code-block code');
        const reviewOptionsContainer = cardTemplateFragment.querySelector('.review-options-container');
        const explanationContainer = cardTemplateFragment.querySelector('.explanation-container');
        const explanationContent = cardTemplateFragment.querySelector('.explanation-content');

        // 2. Configura la insignia "Omitida"
        if (skippedBadge) {
            skippedBadge.style.display = (question.userAnswerIndex === 'skipped') ? 'block' : 'none';
        }

        // 3. Pobla el encabezado (usando la función auxiliar _createQuestionHeaderHTML)
        const headerHTML = this._createQuestionHeaderHTML(question, lang, index, total); // Reutilizamos esta función
        if (cardHeader) {
            cardHeader.innerHTML = headerHTML; // Insertamos el HTML del encabezado
        }

        // 4. Pobla el cuerpo (Texto, Imagen, Código)
        if (questionTextEl) {
            questionTextEl.innerHTML = marked.parseInline(question[`question_${lang}`] || question.question_en);
        }
        if (question.image && imageContainer && imageEl) {
            imageEl.src = `/data/images/${question.image}`; // Ajusta la ruta si es necesario
            imageContainer.style.display = 'block';
        } else if (imageContainer) {
            imageContainer.style.display = 'none';
        }
        if (question.code && codeContainer && codeEl) {
            codeEl.textContent = question.code;
            codeContainer.style.display = 'block';
        } else if (codeContainer) {
            codeContainer.style.display = 'none';
        }

        // 5. Pobla las opciones de revisión (con clases correct/incorrect)
        if (reviewOptionsContainer) {
            let optionsHTML = '';
            question.shuffledOptions.forEach((option, idx) => {
                let optionText = marked.parseInline(option[`text_${lang}`] || option.text_en);
                let optionClass = 'review-option'; // Clase base

                // Determina si el usuario seleccionó esta opción
                let userSelected = false;
                if (Array.isArray(question.userAnswerIndex)) {
                    userSelected = question.userAnswerIndex.includes(idx);
                } else {
                    userSelected = (question.userAnswerIndex === idx);
                }

                // Aplica clases de feedback
                if (option.isCorrect) {
                    optionClass += ' correct-answer';
                } else if (userSelected) { // Solo si NO es correcta pero fue seleccionada
                    optionClass += ' incorrect-answer';
                }
                optionsHTML += `<div class="${optionClass}">${optionText}</div>`;
            });
            reviewOptionsContainer.innerHTML = optionsHTML; // Inserta todas las opciones formateadas
        }

        // 6. Pobla la explicación
        const explanationText = question[`explanation_${lang}`] || question.explanation_en;
        if (explanationText && explanationContainer && explanationContent) {
            explanationContent.innerHTML = marked.parse(explanationText);
            explanationContainer.style.display = 'block'; // Asegura que sea visible
        } else if (explanationContainer) {
            explanationContainer.style.display = 'none'; // Oculta si no hay explicación
        }

        // 7. Genera la barra de navegación de preguntas (ahora devuelve un Elemento DOM)
        const navElement = await this._createReviewNavHTML(Store.state.currentExamQuestions, index);

        // 8. Genera los botones de navegación Anterior/Siguiente/Volver
        const footerHTML = this._createReviewFooterHTML(index, total); // Esta función ya genera HTML string

        // 9. Construye el HTML final y lo inserta en el contenedor principal
        this.elements.reviewContainer.innerHTML = `
                 <div class="row">
                     <div class="col-12 col-lg-8 offset-lg-2">
                         <h2 class="text-center mb-4">${i1n.get('review_title')}</h2>
                         <div id="review-nav-placeholder"></div>
                         <div id="review-card-placeholder"></div>
                         ${footerHTML} </div>
                 </div>`;

        // Inserta los elementos DOM generados en sus placeholders
        const navPlaceholder = this.elements.reviewContainer.querySelector('#review-nav-placeholder');
        const cardPlaceholder = this.elements.reviewContainer.querySelector('#review-card-placeholder');

        if (navPlaceholder && navElement) {
            navPlaceholder.appendChild(navElement); // Añade el elemento DOM de la barra de navegación
        }
        if (cardPlaceholder) {
            cardPlaceholder.appendChild(cardTemplateFragment); // Añade el elemento DOM de la tarjeta
        }

        // 10. Adjunta listeners para la navegación (círculos y botones)
        this._attachReviewListeners(); // Esta función busca los elementos recién añadidos
        this._initPopovers(); // Para la insignia de categoría en el encabezado
    },

    // --- Helper functions for Review Screen ---
    _createReviewFooterHTML(index, total) {
        // (Sin cambios, esta función ya generaba HTML string para los botones externos)
        const prevDisabled = index === 0 ? 'disabled' : '';
        const nextDisabled = index === total - 1 ? 'disabled' : '';
        return `
                  <div class="d-flex justify-content-between mt-4">
                      <button id="prev-review-btn" class="btn btn-secondary" ${prevDisabled}>&laquo; ${i1n.get('btn_previous')}</button>
                      <button id="back-to-results-btn" class="btn btn-outline-primary">${i1n.get('review_back_button')}</button>
                      <button id="next-review-btn" class="btn btn-secondary" ${nextDisabled}>${i1n.get('btn_next')} &raquo;</button>
                  </div>`;
    },

    // ccna-blueprint/exam-simulator/modules/ui.js
    _attachReviewListeners() {
        // Busca listeners DENTRO del contenedor de revisión
        const navContainer = this.elements.reviewContainer.querySelector('#question-nav-container');
        if (navContainer) {
            // Limpia listeners anteriores (buena práctica si esta función se llama múltiples veces)
            const newNavContainer = navContainer.cloneNode(true);
            navContainer.parentNode.replaceChild(newNavContainer, navContainer);

            // Añade listener al nuevo contenedor
            newNavContainer.addEventListener('click', (e) => {
                if (e.target?.classList.contains('question-nav-circle')) {
                    const index = parseInt(e.target.dataset.index, 10);
                    if (!isNaN(index)) { // Asegurarse de que el índice es válido
                        EventBus.emit('ui:reviewNavigate', index);
                    }
                }
            });
        }

        // Para los botones, clonar y reemplazar es la forma más segura de limpiar listeners
        const prevBtn = this.elements.reviewContainer.querySelector('#prev-review-btn');
        if (prevBtn) {
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', () => EventBus.emit('ui:reviewPrevious'));
        }

        const nextBtn = this.elements.reviewContainer.querySelector('#next-review-btn');
        if (nextBtn) {
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', () => EventBus.emit('ui:reviewNext'));
        }

        const backBtn = this.elements.reviewContainer.querySelector('#back-to-results-btn');
        if (backBtn) {
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            newBackBtn.addEventListener('click', () => EventBus.emit('ui:backToResults'));
        }
    },

    // --- Timer Update ---
    updateTimerDisplay(seconds) {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = this._formatTime(seconds);
            // Optional: Add visual indicator for low time
            if (seconds !== null && seconds <= 60) {
                timerDisplay.classList.add('text-danger');
            } else {
                timerDisplay.classList.remove('text-danger');
            }
        }
    },

    async _renderDetailedResultsAccordion(performanceData) {
        const container = document.getElementById('performance-accordion');
        if (!container) return; // Salir si el contenedor principal no existe

        // Vacía el contenedor antes de empezar
        container.innerHTML = '';

        // Añade el título del acordeón
        const titleHTML = `<h3 class="text-center mb-4">${i1n.get('results_performance_analysis')}</h3>`;
        container.insertAdjacentHTML('beforeend', titleHTML);

        // Verifica si hay datos de rendimiento
        if (!performanceData || performanceData.length === 0) {
            const noResultsHTML = `<p class="text-muted text-center">${i1n.get('no_detailed_results', 'No hay resultados detallados disponibles.')}</p>`; // Añadir clave i1n
            container.insertAdjacentHTML('beforeend', noResultsHTML);
            return;
        }

        const lang = i1n.currentLanguage || 'es';

        // Agrupa los resultados por categoría (usando el orden de CONFIG)
        const performanceByCategory = CONFIG.categories.reduce((acc, categoryConfig) => {
            acc[categoryConfig.id] = {
                name: i1n.get(categoryConfig.i18nKey),
                topics: []
            };
            return acc;
        }, {});

        performanceData.forEach(topicResult => {
            // Encuentra la pregunta para determinar su categoría (ineficiente, pero necesario por ahora)
            const question = Store.state.currentExamQuestions.find(q => q.topic && q.topic.subtopic_id === topicResult.id);
            if (question && performanceByCategory[question.category]) {
                performanceByCategory[question.category].topics.push(topicResult);
            } else {
                // Podríamos agrupar temas sin categoría o loggear un aviso
                console.warn(`Topic ${topicResult.id} no pudo ser asociado a una categoría.`);
            }
        });

        let categoryIndex = 0; // Para generar IDs únicos para el acordeón

        // Itera sobre las categorías agrupadas
        for (const categoryId in performanceByCategory) {
            const categoryData = performanceByCategory[categoryId];
            const topics = categoryData.topics;

            // Salta categorías sin temas asociados en este examen
            if (topics.length === 0) continue;

            // --- Renderiza el item de categoría usando la plantilla ---
            const categoryTemplateFragment = await this._loadTemplate('results-performance-item');
            if (!categoryTemplateFragment) continue; // Salta si la plantilla falla

            // Calcula el rendimiento de la categoría
            const categoryTotal = topics.reduce((sum, t) => sum + t.total, 0);
            const categoryCorrect = topics.reduce((sum, t) => sum + t.correct, 0);
            const categoryPercentage = categoryTotal > 0 ? Math.round((categoryCorrect / categoryTotal) * 100) : 0;
            const badgeColor = this._getProportionalColor(categoryPercentage); // Obtiene color HSL

            // Selecciona elementos dentro del fragmento de categoría
            const accordionItem = categoryTemplateFragment.querySelector('.accordion-item'); // El div raíz
            const header = categoryTemplateFragment.querySelector('.accordion-header');
            const button = categoryTemplateFragment.querySelector('.accordion-button');
            const collapseDiv = categoryTemplateFragment.querySelector('.accordion-collapse');
            const categoryNameSpan = categoryTemplateFragment.querySelector('.category-performance-name');
            const categoryBadgeSpan = categoryTemplateFragment.querySelector('.category-performance-badge');
            const accordionBody = categoryTemplateFragment.querySelector('.accordion-body');

            // Configura IDs y atributos para el acordeón
            const uniqueHeadingId = `heading-category-${categoryIndex}`;
            const uniqueCollapseId = `collapse-category-${categoryIndex}`;
            if (header) header.id = uniqueHeadingId;
            if (button) {
                button.setAttribute('data-bs-target', `#${uniqueCollapseId}`);
                button.setAttribute('aria-controls', uniqueCollapseId);
            }
            if (collapseDiv) {
                collapseDiv.id = uniqueCollapseId;
                collapseDiv.setAttribute('aria-labelledby', uniqueHeadingId);
            }

            // Rellena nombre y badge de la categoría
            if (categoryNameSpan) categoryNameSpan.textContent = categoryData.name;
            if (categoryBadgeSpan) {
                categoryBadgeSpan.textContent = `${categoryCorrect}/${categoryTotal} - ${categoryPercentage}%`;
                categoryBadgeSpan.style.backgroundColor = badgeColor;
            }

            // --- Renderiza los items de tema DENTRO del cuerpo del acordeón ---
            if (accordionBody) {
                // Ordena los temas por porcentaje (opcional, como antes)
                topics.sort((a, b) => a.percentage - b.percentage);

                for (const topic of topics) {
                    const topicTemplateFragment = await this._loadTemplate('results-topic-item');
                    if (!topicTemplateFragment) continue; // Salta si la plantilla de tema falla

                    // Selecciona elementos dentro del fragmento de tema
                    const descriptionSpan = topicTemplateFragment.querySelector('.topic-performance-description');
                    const scoreSpan = topicTemplateFragment.querySelector('.topic-performance-score');
                    const progressBar = topicTemplateFragment.querySelector('.topic-performance-bar');
                    const percentageSpan = topicTemplateFragment.querySelector('.topic-performance-percentage');

                    // Determina la clase de la barra de progreso
                    let topicBarClass = 'bg-warning';
                    if (topic.percentage >= 80) topicBarClass = 'bg-success';
                    else if (topic.percentage < 60) topicBarClass = 'bg-accent';

                    // Rellena los datos del tema
                    if (descriptionSpan) {
                        // Intenta obtener descripción traducida, si no, usa la inglesa o el ID
                        const topicDesc = topic[`description_${lang}`] || topic.description_en || topic.id;
                        descriptionSpan.textContent = `${topic.id} - ${topicDesc}`;
                    }
                    if (scoreSpan) scoreSpan.textContent = `${topic.correct}/${topic.total}`;
                    if (progressBar) {
                        // Quita clases de color anteriores y añade la nueva
                        progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-success');
                        progressBar.classList.add(topicBarClass);
                        // Establece el ancho y aria-valuenow
                        progressBar.style.width = `${topic.percentage}%`;
                        progressBar.setAttribute('aria-valuenow', topic.percentage);
                    }
                    if (percentageSpan) percentageSpan.textContent = `${topic.percentage}%`;

                    // Añade el fragmento del tema al cuerpo del acordeón de categoría
                    accordionBody.appendChild(topicTemplateFragment);
                }
            }

            // Añade el fragmento completo de la categoría al contenedor principal del acordeón
            container.appendChild(categoryTemplateFragment);
            categoryIndex++; // Incrementa el índice para IDs únicos
        } // Fin del bucle for (categorías)
    }, // Fin de _renderDetailedResultsAccordion

    // --- Helper functions for Review Screen ---
    async _createReviewNavHTML(questions, currentIndex) {
        // Crea el contenedor principal para los círculos de navegación
        const navContainer = document.createElement('div');
        navContainer.id = 'question-nav-container';
        navContainer.className = 'd-flex flex-wrap justify-content-center gap-2 mb-4'; // Clases de Bootstrap

        // Itera sobre todas las preguntas del examen
        for (let index = 0; index < questions.length; index++) {
            const q = questions[index];

            // Carga la plantilla para el círculo de navegación
            const templateFragment = await this._loadTemplate('review-nav-item');
            if (!templateFragment) continue; // Salta si la plantilla falla

            // Selecciona el div principal dentro del fragmento
            const navCircle = templateFragment.querySelector('.question-nav-circle');
            if (!navCircle) continue; // Salta si no encuentra el elemento

            // 1. Determina la clase de estado (correcta, incorrecta, omitida)
            let statusClass = 'status-skipped'; // Por defecto
            if (q.userAnswerIndex !== null && q.userAnswerIndex !== 'skipped') {
                // Recalcula si fue correcta o incorrecta usando la lógica de Exam
                let isCorrect = Exam._isAnswerCorrect(q, q.userAnswerIndex);
                statusClass = isCorrect ? 'status-correct' : 'status-incorrect';
            }

            // 2. Limpia clases de estado por defecto y añade la correcta
            navCircle.classList.remove('status-skipped', 'status-correct', 'status-incorrect', 'active'); // Limpia clases previas
            navCircle.classList.add(statusClass); // Añade la clase de estado calculada

            // 3. Añade la clase 'active' si es el índice actual
            if (index === currentIndex) {
                navCircle.classList.add('active');
            }

            // 4. Establece el data-index y el número de pregunta
            navCircle.dataset.index = index; // Establece el atributo data-index
            navCircle.textContent = index + 1; // Establece el número visible

            // 5. Añade el círculo configurado al contenedor
            navContainer.appendChild(templateFragment);
        } // Fin del bucle for

        // Devuelve el contenedor con todos los círculos
        return navContainer; // Devuelve el elemento DOM, no HTML string
    },

    /**
     * Calcula un color en HSL que va de rojo a verde según un porcentaje.
     * @param {number} percentage - Un valor de 0 a 100.
     * @returns {string} Una cadena de color HSL, ej: 'hsl(120, 80%, 45%)'.
     */
    _getProportionalColor(percentage) {
        // Mapea 0-100% a Matiz(27(Naranja) - 120(Verde))
        const hue = 27 + (percentage * 0.93);
        const saturation = 80; // Saturación constante para colores vivos.
        const lightness = 45;  // Luminosidad constante para un buen contraste.
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    },

    _formatTime(totalSeconds) {
        if (totalSeconds === null || totalSeconds < 0) return "--:--";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    // --- Popover Initialization ---
    _initPopovers() {
        // Ensure any existing popovers are destroyed before creating new ones
        const existingPopovers = bootstrap.Popover.getInstance(document.body); // Check if any exist
        if (existingPopovers) {
            // This might be too broad; ideally target only previous popovers.
            // For simplicity now, destroy all. Consider refining later.
            // console.warn("Need to refine popover destruction");
        }

        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(el => new bootstrap.Popover(el));
    },

    /**
     * Adjunta los event listeners a los controles de la pantalla de configuración.
     * (VERSIÓN UNIFICADA)
     */
    _attachSetupListeners() {
        const self = this; // Guardar referencia a 'this' (el objeto UI)

        // --- Nuevas Referencias a Elementos ---
        const modeRadios = document.querySelectorAll('input[name="examMode"]');
        const optionsFieldset = document.getElementById('exam-options-fieldset');
        const timeLimitWrapper = document.getElementById('time-limit-wrapper');
        const questionCountWrapper = document.getElementById('question-count-wrapper');
        const startBtn = document.getElementById('start-exam-btn');
        const contentTabs = document.querySelectorAll('#content-selection-tabs button[data-bs-toggle="tab"]');

        // --- Helper 1: Habilitar/Deshabilitar Botón de Inicio ---
        function checkStartButtonState() {
            if (!startBtn) return;

            const categoryPaneActive = document.getElementById('category-pane')?.classList.contains('active');
            let contentSelected = false;

            if (categoryPaneActive) {
                // Modo Categoría: ¿hay algún checkbox marcado?
                contentSelected = self.elements.categorySelection?.querySelector('.category-checkbox:checked') !== null;
            } else {
                // Modo Tema: ¿hay algún checkbox marcado?
                contentSelected = self.elements.topicAccordion?.querySelector('.topic-checkbox:checked') !== null;
            }

            startBtn.disabled = !contentSelected;
        }

        // --- Helper 2: Mostrar/Ocultar Opciones según el Modo ---
        function handleModeChange(selectedValue) {
            const isFlashcard = selectedValue === 'flashcard';
            const isStudy = selectedValue === 'study';

            if (optionsFieldset) {
                // Oculta TODO el fieldset de Opciones si es Flashcard
                optionsFieldset.style.display = isFlashcard ? 'none' : 'block';
            }

            if (timeLimitWrapper) {
                // Oculta el Límite de Tiempo si es Modo Estudio (o Flashcard)
                timeLimitWrapper.style.display = (isStudy || isFlashcard) ? 'none' : 'block';
            }

            if (questionCountWrapper) {
                // Vuelve a mostrar el contador de preguntas (por si acaso)
                questionCountWrapper.style.display = 'block';
            }

            // Re-evalúa el estado del botón, ya que la selección puede ser válida
            checkStartButtonState();
        }

        // --- Asignación de Listeners ---

        // 1. Listeners de Modo (Study, Exam, Flashcard)
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                handleModeChange(event.target.value);
            });
        });

        // 2. Listeners de Contenido (Categoría vs Tema)
        contentTabs.forEach(tab => {
            // Cuando la pestaña TERMINA de mostrarse, re-evalúa el botón
            tab.addEventListener('shown.bs.tab', checkStartButtonState);
        });

        // 3. Listeners de Selección (Checkboxes)
        if (this.elements.categorySelection) {
            this.elements.categorySelection.addEventListener('change', (event) => {
                if (event.target.classList.contains('category-checkbox')) {
                    checkStartButtonState();
                }
            });
        }
        // Nota: El listener del acordeón de temas ya está en `_attachTopicSelectionListeners`
        // ¡Debemos asegurarnos de que TAMBIÉN llame a `checkStartButtonState`!
        // (Modificaremos `_attachTopicSelectionListeners` para esto)

        // 4. Listeners de Botones (Todas/Ninguna)
        if (this.elements.selectAllCategoriesBtn) {
            this.elements.selectAllCategoriesBtn.addEventListener('click', () => {
                this.elements.categorySelection?.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = true);
                checkStartButtonState();
            });
        }
        if (this.elements.deselectAllCategoriesBtn) {
            this.elements.deselectAllCategoriesBtn.addEventListener('click', () => {
                this.elements.categorySelection?.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
                checkStartButtonState();
            });
        }

        // 5. Listener del Botón de Inicio
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                // `Exam._getExamConfiguration` ahora leerá este nuevo layout
                EventBus.emit('ui:startExamClicked');
            });
        }

        // --- Llamadas Iniciales ---
        // Llama una vez para establecer el estado inicial de las opciones
        const initialMode = document.querySelector('input[name="examMode"]:checked')?.value || 'study';
        handleModeChange(initialMode);

        // Llama una vez para establecer el estado inicial del botón
        checkStartButtonState();
    },

    // --- MODIFICACIÓN ADICIONAL en `_attachTopicSelectionListeners` ---
    // En `ui.js`, busca tu función `_attachTopicSelectionListeners` y 
    // asegúrate de que llame a `this._checkStartButtonState()`

    _attachTopicSelectionListeners() {
        if (!this.elements.topicAccordion) return;

        // (Tu lógica de clonado de nodo para limpiar listeners está bien)
        const newAccordion = this.elements.topicAccordion.cloneNode(true);
        this.elements.topicAccordion.parentNode.replaceChild(newAccordion, this.elements.topicAccordion);
        this.elements.topicAccordion = newAccordion;

        this.elements.topicAccordion.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;

            // ... (TODA tu lógica existente de checkbox maestro/hijo va aquí) ...
            // (Esta lógica no necesita cambiar)

            // --- INICIO DE LA MODIFICACIÓN ---
            // Al final de la lógica de 'change', después de actualizar el estado de los checkboxes:

            // Habilitar/deshabilitar botón "Comenzar Examen"
            if (this.elements.startBtn) { // Usa la referencia al botón de inicio unificado
                // Habilita si al menos UN checkbox de TEMA/SUBTEMA está marcado
                const anyTopicChecked = this.elements.topicAccordion.querySelector('.topic-checkbox:checked');
                this.elements.startBtn.disabled = !anyTopicChecked;
            }
            // --- FIN DE LA MODIFICACIÓN ---

        }); // Fin addEventListener 'change'
    },

    /**
     * Renderiza una única flashcard en el contenedor.
     * (VERSIÓN FINAL PULIDA)
     * @param {object} question - El objeto de la pregunta actual del Store.
     */
    async _renderFlashcard(question) {
        if (!question || !this.elements.questionsContainer) return;
        this.showScreen('questions');
        const lang = i1n.currentLanguage || 'es';
        const index = Store.state.currentQuestionIndex;
        const total = Store.state.currentExamQuestions.length;

        // 1. Recordar estado de "volteo"
        const answerWasVisible = this.elements.questionsContainer.querySelector('.flashcard-answer-area:not(.d-none)') !== null;

        // 2. Cargar plantilla
        const templateFragment = await this._loadTemplate('flashcard-card');
        if (!templateFragment) {
            console.error("No se pudo cargar la plantilla 'flashcard-card'.");
            this.elements.questionsContainer.innerHTML = '<p class="text-danger">Error: Falta la plantilla de flashcard.</p>';
            return;
        }

        // 3. Seleccionar elementos
        const cardHeader = templateFragment.querySelector('.flashcard-header');
        const questionTextEl = templateFragment.querySelector('.question-text');
        const imageContainer = templateFragment.querySelector('.question-image-container');
        const imageEl = templateFragment.querySelector('.question-image');
        const codeContainer = templateFragment.querySelector('.question-code-container');
        const codeEl = templateFragment.querySelector('.code-block code');
        const answerArea = templateFragment.querySelector('.flashcard-answer-area');
        const correctAnswerEl = templateFragment.querySelector('.correct-answer-text');
        const explanationContent = templateFragment.querySelector('.explanation-content');
        const showAnswerBtn = templateFragment.querySelector('.btn-flip-card');

        // 4. Poblar Encabezado
        if (cardHeader) {
            const headerHTML = this._createQuestionHeaderHTML(question, lang, index, total);
            cardHeader.innerHTML = `<div class="d-flex justify-content-between align-items-center">${headerHTML}</div>`;
        }

        // 5. Poblar Área de Pregunta (CON LIMPIEZA DE TEXTO)
        if (questionTextEl) {
            let questionString = question[`question_${lang}`] || question.question_en || "Error: Pregunta no encontrada.";

            // --- Regex para limpiar el texto de la pregunta ---
            const multiChoiceRegex = /\s*\((?:Elija|Choose)\s+(?:dos|tres|two|three|cuatro|four)\.\)\s*$/i;
            questionString = questionString.replace(multiChoiceRegex, ''); // Limpia la variable

            questionTextEl.innerHTML = marked.parseInline(questionString);
        }

        // (Renderizado de imagen y código - sin cambios)
        if (question.image && imageContainer && imageEl) {
            imageEl.src = `/data/images/${question.image}`;
            imageContainer.style.display = 'block';
        } else if (imageContainer) {
            imageContainer.style.display = 'none';
        }
        if (question.code && codeContainer && codeEl) {
            codeEl.textContent = question.code;
            codeContainer.style.display = 'block';
        } else if (codeContainer) {
            codeContainer.style.display = 'none';
        }

        // 6. Poblar Área de Respuesta
        if (answerArea && correctAnswerEl && explanationContent) {

            // (A) Lógica de Respuesta
            const correctOptions = question.shuffledOptions
                .filter(opt => opt.isCorrect === true)
                .map(opt => opt[`text_${lang}`] || opt.text_en || opt.text_es);

            let correctAnswerHtml = '';
            if (correctOptions.length > 1) {
                correctAnswerHtml = '<ul>' + correctOptions.map(txt => `<li>${marked.parseInline(txt)}</li>`).join('') + '</ul>';
            } else if (correctOptions.length === 1) {
                correctAnswerHtml = marked.parseInline(correctOptions[0]);
            } else {
                correctAnswerHtml = '<i>No se especificó una respuesta correcta.</i>';
            }
            correctAnswerEl.innerHTML = correctAnswerHtml;

            // (B) Lógica de Explicación (con limpieza)
            let explanationText = question[`explanation_${lang}`] || question.explanation_en;
            if (explanationText) {
                const splitRegex = /^(?:##|###)\s*(?:Análisis de las Opciones|Options Analysis|Análisis de Opciones|Option Analysis)/im;
                const pureExplanation = explanationText.split(splitRegex)[0].trim();

                if (pureExplanation) {
                    explanationContent.innerHTML = marked.parse(pureExplanation);
                } else {
                    explanationContent.innerHTML = '<i>Explicación no disponible (solo análisis de opciones).</i>';
                }
            } else {
                explanationContent.innerHTML = '<i>No hay explicación disponible.</i>';
            }
        }

        // 7. Aplicar estado de "volteo" recordado
        if (answerWasVisible) {
            if (answerArea) answerArea.classList.remove('d-none');
            if (showAnswerBtn) showAnswerBtn.style.display = 'none';
        }

        // 8. Insertar en DOM
        this.elements.questionsContainer.innerHTML = '';
        this.elements.questionsContainer.appendChild(templateFragment);

        // 9. Traducir y adjuntar listeners
        i1n.translatePage();
        this._attachFlashcardListeners();
        if (cardHeader) this._initPopovers();
    },

    /**
     * Adjunta listeners a los botones de la flashcard actual.
     */
    _attachFlashcardListeners() {
        // Busca elementos DENTRO del contenedor actual
        const container = this.elements.questionsContainer;
        const showBtn = container.querySelector('.btn-flip-card');
        const hideBtn = container.querySelector('.btn-hide-answer');
        const answerArea = container.querySelector('.flashcard-answer-area');
        const questionArea = container.querySelector('.flashcard-question-area'); // Para ocultar el botón 'Mostrar'
        const prevBtn = container.querySelector('.btn-prev-flashcard');
        const nextBtn = container.querySelector('.btn-next-flashcard');

        if (showBtn && answerArea && questionArea) {
            // Limpia listener anterior clonando (más seguro)
            const newShowBtn = showBtn.cloneNode(true);
            showBtn.parentNode.replaceChild(newShowBtn, showBtn);
            newShowBtn.addEventListener('click', () => {
                answerArea.classList.remove('d-none'); // Muestra respuesta
                newShowBtn.style.display = 'none'; // Oculta botón "Mostrar"
                // Opcional: Ocultar toda el area de la pregunta si quieres simular volteo
                // questionArea.classList.add('d-none');
            });
        }

        if (hideBtn && answerArea && showBtn) { // Necesita showBtn para volver a mostrarlo
            // Limpia listener anterior clonando
            const newHideBtn = hideBtn.cloneNode(true);
            hideBtn.parentNode.replaceChild(newHideBtn, hideBtn);
            newHideBtn.addEventListener('click', () => {
                answerArea.classList.add('d-none'); // Oculta respuesta
                const currentShowBtn = container.querySelector('.btn-flip-card'); // Busca el botón actual
                if (currentShowBtn) currentShowBtn.style.display = 'inline-block'; // Muestra botón "Mostrar" de nuevo
                // Opcional: Vuelve a mostrar el area de pregunta si la ocultaste
                // questionArea.classList.remove('d-none');
            });
        }

        // Navegación
        if (prevBtn) {
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            // Habilita/deshabilita según índice
            newPrevBtn.disabled = (Store.state.currentQuestionIndex === 0);
            newPrevBtn.addEventListener('click', () => EventBus.emit('ui:flashcardPrevious'));
        }
        if (nextBtn) {
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            // Habilita/deshabilita según índice
            newNextBtn.disabled = (Store.state.currentQuestionIndex === Store.state.currentExamQuestions.length - 1);
            newNextBtn.addEventListener('click', () => EventBus.emit('ui:flashcardNext'));
        }
    },

    /**
     * Pre-selecciona el radio button del modo de examen y dispara su evento change.
     * Debe llamarse DESPUÉS de renderSetupScreen.
     * @param {string} modeValue - El valor ('study', 'exam', 'flashcard') a seleccionar.
     */
    preselectMode(modeValue) {
        // Busca el radio button específico usando su valor en CUALQUIERA de las pestañas
        // Asumiendo que usas el mismo `name` ('examMode' o 'examModeCustom') y `value`
        const radioToSelect = document.querySelector(`input[name="examMode"][value="${modeValue}"], input[name="examModeCustom"][value="${modeValue}"]`);

        if (radioToSelect) {
            radioToSelect.checked = true;
            console.log(`Pre-selected mode radio: ${modeValue}`);

            // IMPORTANTE: Dispara manualmente el evento 'change'
            // para que la lógica en _attachSetupListeners (handleModeChange) se ejecute
            // y oculte/muestre los fieldsets correctamente.
            radioToSelect.dispatchEvent(new Event('change', { bubbles: true }));

            // Opcional: Asegurarse de que la pestaña correcta esté visible
            // (Si tienes radios separados por pestaña, esto es crucial)
            const parentTabPane = radioToSelect.closest('.tab-pane');
            if (parentTabPane && !parentTabPane.classList.contains('active')) {
                const tabButton = document.querySelector(`button[data-bs-target="#${parentTabPane.id}"]`);
                if (tabButton) {
                    const tab = new bootstrap.Tab(tabButton);
                    tab.show();
                    console.log(`Switched to tab: ${parentTabPane.id}`);
                }
            }

        } else {
            console.warn(`Could not find radio button for mode: ${modeValue}`);
        }
    },

}; // Fin del objeto UI