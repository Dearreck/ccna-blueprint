// assets/js/exam-engine.js (Versión Refactorizada y Completa)

document.addEventListener('DOMContentLoaded', () => {

    // =================================================================================
    // MÓDULO DE CONFIGURACIÓN Y ESTADO
    // =================================================================================

    const DOM = {
        setup: document.getElementById('exam-setup-container'),
        questions: document.getElementById('exam-questions-container'),
        results: document.getElementById('exam-results-container'),
        review: document.getElementById('exam-review-container'),
        categorySelection: document.getElementById('category-selection-container'),
        startBtn: document.getElementById('start-exam-btn'),
        questionCountSelect: document.getElementById('question-count-select')
    };

    const CONFIG = {
        categories: [
            { id: '1.0-network-fundamentals', i18nKey: 'category_1_0' },
            { id: '2.0-network-access', i18nKey: 'category_2_0' },
            { id: '3.0-ip-connectivity', i18nKey: 'category_3_0' },
            { id: '4.0-ip-services', i18nKey: 'category_4_0' },
            { id: '5.0-security-fundamentals', i18nKey: 'category_5_0' },
            { id: '6.0-automation-programmability', i18nKey: 'category_6_0' }
        ],
        categoryVisuals: {
            '1.0-network-fundamentals': { color: '#0d6efd', icon: 'fa-sitemap' },
            '2.0-network-access': { color: '#198754', icon: 'fa-network-wired' },
            '3.0-ip-connectivity': { color: '#6f42c1', icon: 'fa-route' },
            '4.0-ip-services': { color: '#fd7e14', icon: 'fa-cogs' },
            '5.0-security-fundamentals': { color: '#dc3545', icon: 'fa-shield-alt' },
            '6.0-automation-programmability': { color: '#0dcaf0', icon: 'fa-code' }
        },
        timePerQuestion: 90 // en segundos
    };

    let state = {};

    function resetState() {
        state = {
            allQuestions: [],
            currentExamQuestions: [],
            currentQuestionIndex: 0,
            currentReviewIndex: 0,
            stats: { correct: 0, incorrect: 0, skipped: 0 },
            examMode: 'study',
            timerInterval: null,
            timeRemaining: 0
        };
    }

    // =================================================================================
    // MÓDULO DE DATOS
    // =================================================================================

    const Data = {
        async fetchQuestions(categoryIds) {
            const fetchPromises = categoryIds.map(id =>
                fetch(`../data/${id}.json`).then(response => {
                    if (!response.ok) throw new Error(`Failed to load: ${id}`);
                    return response.text().then(text => text ? JSON.parse(text) : []);
                })
            );

            const results = await Promise.allSettled(fetchPromises);
            const allFetchedQuestions = [];
            results.forEach(result => {
                if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                    allFetchedQuestions.push(...result.value);
                } else if (result.status === 'rejected') {
                    console.warn(`Skipped file due to error: ${result.reason.message}`);
                }
            });
            return allFetchedQuestions;
        },
        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },
        saveAttempt() {
            const attempt = {
                date: new Date().toISOString(),
                stats: state.stats,
                totalQuestions: state.currentExamQuestions.length,
                mode: state.examMode
            };
            try {
                const history = JSON.parse(localStorage.getItem('CCNA_examHistory')) || [];
                history.push(attempt);
                localStorage.setItem('CCNA_examHistory', JSON.stringify(history));
            } catch (e) {
                console.error("Could not save exam result.", e);
            }
        }
    };

    // =================================================================================
    // MÓDULO DEL TEMPORIZADOR
    // =================================================================================

    const Timer = {
        start() {
            Timer.stop();
            const timePerQuestion = CONFIG.timePerQuestion;
            state.timeRemaining = state.currentExamQuestions.length * timePerQuestion;
            state.timerInterval = setInterval(() => {
                state.timeRemaining--;
                UI.updateTimerDisplay();
                if (state.timeRemaining <= 0) {
                    Exam.finish();
                }
            }, 1000);
        },
        stop() {
            clearInterval(state.timerInterval);
        }
    };
    
    // =================================================================================
    // MÓDULO DE UI (MANIPULACIÓN DEL DOM)
    // =================================================================================
    const UI = {

        /**
         * Calcula un color en HSL que va de rojo a verde según un porcentaje.
         * @param {number} percentage - Un valor de 0 a 100.
         * @returns {string} Una cadena de color HSL, ej: 'hsl(120, 80%, 45%)'.
         */
        _getProportionalColor(percentage) {
            // Mapea el porcentaje (0-100) a un matiz (hue) en el círculo de color (0=rojo, 120=verde).
            const hue = (percentage / 100) * 120;
            const saturation = 80; // Saturación constante para colores vivos.
            const lightness = 45;  // Luminosidad constante para un buen contraste.
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        },
        
        /**
         * Oculta todas las pantallas principales y muestra solo la especificada.
         * @param {string} screenName - El nombre de la pantalla a mostrar ('setup', 'questions', 'results', 'review').
         */
        showScreen(screenName) {
            ['setup', 'questions', 'results', 'review'].forEach(key => {
                if (DOM[key]) DOM[key].classList.add('d-none');
            });
            if (DOM[screenName]) {
                DOM[screenName].classList.remove('d-none');
            }
        },
    
        /**
         * Carga las preguntas para obtener el conteo y muestra las categorías en la pantalla de configuración.
         */
        async loadAndDisplayCategories() {
            if (!DOM.categorySelection) return;
            DOM.categorySelection.innerHTML = `<p class="text-muted">${i1n.get('loading_questions')}</p>`;
            
            const allCategoryIds = CONFIG.categories.map(cat => cat.id);
            const allQuestionsData = await Data.fetchQuestions(allCategoryIds);
            
            DOM.categorySelection.innerHTML = '';
            CONFIG.categories.forEach(category => {
                const questionCount = allQuestionsData.filter(q => q.category === category.id).length;
                const categoryInfo = CONFIG.categoryVisuals[category.id] || { color: '#6c757d' };
                const categoryHTML = `
                    <div class="col-12 col-md-6 mb-2">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${category.id}" id="check-${category.id}" checked>
                            <label class="form-check-label d-flex justify-content-between align-items-center" for="check-${category.id}">
                                <span>${i1n.get(category.i18nKey) || category.id}</span>
                                <span class="badge rounded-pill" style="background-color: ${categoryInfo.color}; min-width: 28px;">${questionCount}</span>
                            </label>
                        </div>
                    </div>`;
                DOM.categorySelection.innerHTML += categoryHTML;
            });

            const totalCount = allQuestionsData.length;
            const countDisplay = totalCount > 999 ? '999+' : totalCount;
        
            const badgeCountElement = document.getElementById('total-questions-count');
            if (badgeCountElement) {
                badgeCountElement.textContent = countDisplay;
            }
        },
    
        /**
         * Renderiza la vista de la pregunta activa durante el examen.
         */
        displayQuestion() {
            const question = state.currentExamQuestions[state.currentQuestionIndex];
            const lang = i1n.currentLanguage || 'es';
            
            const headerHTML = this._createQuestionHeader(question, lang, state.currentQuestionIndex, state.currentExamQuestions.length);
            const bodyHTML = this._createQuestionBody(question, lang);
            const footerHTML = this._createQuestionFooter(lang);
            const timerHTML = state.examMode === 'exam' ? `<div id="timer-display" class="fs-5 fw-bold text-primary"></div>` : '';
    
            const cardHTML = `
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-transparent border-0 pt-4 px-4">
                        <div class="d-flex justify-content-between align-items-center">
                            ${headerHTML} ${timerHTML}
                        </div>
                    </div>
                    ${bodyHTML}
                    ${footerHTML}
                </div>`;
            DOM.questions.innerHTML = cardHTML;
    
            const isAlreadyAnswered = question.userAnswerIndex !== null && state.examMode === 'study';
            if (isAlreadyAnswered) {
                this._showAnsweredState(question, lang);
            } else {
                document.getElementById('check-answer-btn').textContent = (state.examMode === 'study' ? i1n.get('btn_verify') : i1n.get('btn_next'));
                document.getElementById('check-answer-btn').onclick = Exam.handleAnswerSubmission;
            }
    
            if (state.examMode === 'exam') this.updateTimerDisplay();
            this._attachCommonButtonListeners();
            this._initPopovers();
        },
        
        /**
         * Renderiza la pantalla de resultados finales del examen.
         */
        displayResults() {
             const stats = state.stats;
             const totalQuestions = state.currentExamQuestions.length;
             this.showScreen('results');
             const scorePercentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;
    
             document.getElementById('results-score').textContent = `${scorePercentage}%`;
             document.getElementById('results-summary').textContent = `${i1n.get('results_summary_part1')} ${stats.correct} ${i1n.get('results_summary_part2')} ${totalQuestions} ${i1n.get('results_summary_part3')}`;
             document.getElementById('results-correct').textContent = stats.correct;
             document.getElementById('results-incorrect').textContent = stats.incorrect;
             document.getElementById('results-skipped').textContent = stats.skipped;
             
             document.querySelector('#results-correct + small').textContent = i1n.get('results_correct');
             document.querySelector('#results-incorrect + small').textContent = i1n.get('results_incorrect');
             document.querySelector('#results-skipped + small').textContent = i1n.get('results_skipped');
             document.getElementById('review-exam-btn').textContent = i1n.get('btn_review');
             document.getElementById('restart-exam-btn').textContent = i1n.get('btn_restart');
             document.querySelector('#exam-results-container a').textContent = i1n.get('btn_back_home');
    
             const resultsScoreElement = document.getElementById('results-score');
             resultsScoreElement.classList.remove('text-success', 'text-danger');
             if (scorePercentage >= 85) {
                 resultsScoreElement.classList.add('text-success');
                 document.getElementById('results-title').textContent = i1n.get('results_title_excellent');
             } else {
                 resultsScoreElement.classList.add('text-danger');
                 document.getElementById('results-title').textContent = i1n.get('results_title_practice');
             }
             
             document.getElementById('review-exam-btn').onclick = () => { state.currentReviewIndex = 0; this.renderReviewPage(); };
             document.getElementById('restart-exam-btn').onclick = Exam.resetToSetup;

            this._renderDetailedResults();
        },
    
        /**
         * Renderiza la vista de una pregunta específica en la pantalla de revisión.
         */
        renderReviewPage() {
            this.showScreen('review');
            const question = state.currentExamQuestions[state.currentReviewIndex];
            const lang = i1n.currentLanguage || 'es';
    
            const navHTML = this._createReviewNav();
            const headerHTML = this._createQuestionHeader(question, lang, state.currentReviewIndex, state.currentExamQuestions.length, true);
            const bodyHTML = this._createReviewBody(question, lang);
            const footerHTML = this._createReviewFooter();
    
            const reviewHTML = `
                <div class="row">
                    <div class="col-12 col-lg-8 offset-lg-2">
                        <h2 class="text-center mb-4">${i1n.get('review_title')}</h2>
                        ${navHTML}
                        <div class="card review-question-card">
                            ${headerHTML}
                            ${bodyHTML}
                        </div>
                        ${footerHTML}
                    </div>
                </div>`;
            DOM.review.innerHTML = reviewHTML;
    
            this._attachReviewNavListeners();
            this._initPopovers();
        },
    
        // --- MÉTODOS PRIVADOS DE AYUDA PARA UI (NO SE LLAMAN DESDE FUERA) ---
        
        _createQuestionHeader(question, lang, index, total, isReview = false) {
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
             const finalHeaderText = isReview ? `${headerText}:` : headerText;
             const headerContent = `<h5 class="mb-0 d-flex align-items-center">${categoryBadgeHTML} <span class="ms-2">${finalHeaderText}</span></h5>`;
    
             if (isReview) {
                 const skippedBadge = (question.userAnswerIndex === 'skipped') ? `<div class="skipped-question-badge">${i1n.get('review_skipped_badge')}</div>` : '';
                 return `${skippedBadge}<div class="card-header d-flex align-items-center">${headerContent}</div>`;
             }
             return headerContent;
        },
    
        _createQuestionBody(question, lang) {
            const questionText = marked.parseInline(question[`question_${lang}`] || question.question_en);
            let imageHTML = '', codeHTML = '';
            if (question.image) imageHTML = `<div class="text-center my-3"><img src="../data/images/${question.image}" class="img-fluid rounded border"></div>`;
            if (question.code) codeHTML = `<pre class="code-block"><code>${question.code}</code></pre>`;
    
            let optionsHTML = '';
            const inputType = question.isMultipleChoice ? 'checkbox' : 'radio';
            question.shuffledOptions.forEach((option, index) => {
                const optionText = marked.parseInline(option[`text_${lang}`] || option.text_en || option.text_es);
                optionsHTML += `
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="${inputType}" name="questionOptions" id="option${index}" value="${index}">
                        <label class="form-check-label" for="option${index}">${optionText}</label>
                    </div>`;
            });
    
            return `
                <div class="card-body p-4 p-md-5">
                    <p class="question-text lead">${questionText}</p>
                    ${imageHTML}
                    ${codeHTML}
                    <div id="options-container" class="mt-4">${optionsHTML}</div>
                </div>`;
        },
        
        _createQuestionFooter(lang) {
            const skipButtonText = i1n.get('btn_skip');
            const endButtonText = i1n.get('btn_end_exam');
            return `
                <div class="card-footer bg-transparent border-0 pb-4 px-4 d-flex justify-content-between align-items-center">
                    <div><button id="end-exam-btn" class="btn btn-sm btn-outline-danger">${endButtonText}</button></div>
                    <div>
                        <button id="skip-question-btn" class="btn btn-secondary me-2">${skipButtonText}</button>
                        <button id="check-answer-btn" class="btn btn-primary"></button>
                    </div>
                </div>`;
        },
        
        _showAnsweredState(question, lang) {
            document.querySelectorAll('#options-container .form-check-input').forEach(input => input.disabled = true);
            question.shuffledOptions.forEach((option, index) => {
                const label = document.querySelector(`label[for="option${index}"]`);
                const userSelectedThis = Array.isArray(question.userAnswerIndex) ? question.userAnswerIndex.includes(index) : question.userAnswerIndex === index;
                if (option.isCorrect) {
                    label.classList.add('correct');
                    if (userSelectedThis) document.getElementById(`option${index}`).checked = true;
                } else if (userSelectedThis) {
                    label.classList.add('incorrect');
                    document.getElementById(`option${index}`).checked = true;
                }
            });
    
            const explanationText = question[`explanation_${lang}`] || question.explanation_en;
            if (explanationText) {
                const explanationDiv = document.createElement('div');
                explanationDiv.className = 'alert alert-info mt-4 explanation-box';
                explanationDiv.innerHTML = `<strong>${i1n.get('explanation_label')}:</strong> ${marked.parse(explanationText)}`;
                document.querySelector('.card-body #options-container').insertAdjacentElement('afterend', explanationDiv);
            }
    
            document.getElementById('check-answer-btn').textContent = i1n.get('btn_next');
            document.getElementById('check-answer-btn').onclick = Exam.proceedToNextQuestion;
            document.getElementById('skip-question-btn').disabled = true;
        },
        
        _createReviewNav() {
            let navHTML = '<div id="question-nav-container" class="d-flex flex-wrap justify-content-center gap-2 mb-4">';
            state.currentExamQuestions.forEach((q, index) => {
                let statusClass = 'status-skipped';
                if (q.userAnswerIndex !== null && q.userAnswerIndex !== 'skipped') {
                    let isCorrect = false;
                    if (q.isMultipleChoice) {
                        const correct = new Set(q.shuffledOptions.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1));
                        const selected = new Set(q.userAnswerIndex);
                        isCorrect = correct.size === selected.size && [...correct].every(i => selected.has(i));
                    } else {
                        const selectedOpt = q.shuffledOptions[q.userAnswerIndex];
                        isCorrect = selectedOpt && selectedOpt.isCorrect;
                    }
                    statusClass = isCorrect ? 'status-correct' : 'status-incorrect';
                }
                const activeClass = (index === state.currentReviewIndex) ? 'active' : '';
                navHTML += `<div class="question-nav-circle ${statusClass} ${activeClass}" data-index="${index}">${index + 1}</div>`;
            });
            return navHTML + '</div>';
        },
        
        _createReviewBody(question, lang) {
            const questionText = marked.parseInline(question[`question_${lang}`] || question.question_en);
            let imageHTML = '', codeHTML = '';
            if (question.image) imageHTML = `<div class="text-center my-3"><img src="../data/images/${question.image}" class="img-fluid rounded border"></div>`;
            if (question.code) codeHTML = `<pre class="code-block"><code>${question.code}</code></pre>`;
    
            let optionsHTML = '';
            question.shuffledOptions.forEach((option, index) => {
                let optionText = marked.parseInline(option[`text_${lang}`] || option.text_en);
                let optionClass = 'review-option';
                const userSelected = Array.isArray(question.userAnswerIndex) ? question.userAnswerIndex.includes(index) : question.userAnswerIndex === index;
                if (option.isCorrect) {
                    optionClass += ' correct-answer';
                } else if (userSelected) {
                    optionClass += ' incorrect-answer';
                }
                optionsHTML += `<div class="${optionClass}">${optionText}</div>`;
            });
    
            const explanationText = question[`explanation_${lang}`] || question.explanation_en;
            const explanationHTML = explanationText ? `
                <div class="alert alert-info mt-3 explanation-box">
                    <strong>${i1n.get('explanation_label')}:</strong> ${marked.parse(explanationText)}
                </div>` : '';
    
            return `
                <div class="card-body">
                    <p class="question-text lead">${questionText}</p>
                    ${imageHTML} ${codeHTML}
                    ${optionsHTML}
                    ${explanationHTML}
                </div>`;
        },
    
        _createReviewFooter() {
            const prevDisabled = state.currentReviewIndex === 0 ? 'disabled' : '';
            const nextDisabled = state.currentReviewIndex === state.currentExamQuestions.length - 1 ? 'disabled' : '';
            return `
                <div class="d-flex justify-content-between mt-4">
                    <button id="prev-review-btn" class="btn btn-secondary" ${prevDisabled}>&laquo; ${i1n.get('btn_previous')}</button>
                    <button id="back-to-results-btn" class="btn btn-outline-primary">${i1n.get('review_back_button')}</button>
                    <button id="next-review-btn" class="btn btn-secondary" ${nextDisabled}>${i1n.get('btn_next')} &raquo;</button>
                </div>`;
        },
    
        _attachReviewNavListeners() {
            document.getElementById('question-nav-container').addEventListener('click', (e) => {
                if (e.target && e.target.classList.contains('question-nav-circle')) {
                    state.currentReviewIndex = parseInt(e.target.dataset.index, 10);
                    this.renderReviewPage();
                }
            });
            document.getElementById('prev-review-btn').onclick = () => { if(state.currentReviewIndex > 0) { state.currentReviewIndex--; this.renderReviewPage(); } };
            document.getElementById('next-review-btn').onclick = () => { if(state.currentReviewIndex < state.currentExamQuestions.length - 1) { state.currentReviewIndex++; this.renderReviewPage(); } };
            document.getElementById('back-to-results-btn').onclick = () => this.showScreen('results');
        },
    
        _initPopovers() {
            const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
            popoverTriggerList.map(el => new bootstrap.Popover(el));
        },
        
        _attachCommonButtonListeners() {
            const skipBtn = document.getElementById('skip-question-btn');
            const endBtn = document.getElementById('end-exam-btn');
            if(skipBtn) skipBtn.addEventListener('click', Exam.skipQuestion);
            if(endBtn) endBtn.addEventListener('click', Exam.finish);
        },
    
        translateQuestionCountOptions() {
            if (!DOM.questionCountSelect) return;
            Array.from(DOM.questionCountSelect.options).forEach(option => {
                const key = `q_count_${option.value}`;
                const translation = i1n.get(key);
                if (translation !== key) {
                    option.textContent = translation;
                }
            });
        },
        
        updateTimerDisplay() {
            const minutes = Math.floor(state.timeRemaining / 60);
            const seconds = state.timeRemaining % 60;
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        },

        _renderDetailedResults() {
            const container = document.getElementById('performance-accordion');
            if (!container || !state.detailedPerformance) {
                if (container) container.innerHTML = '';
                return;
            }
    
            const lang = i1n.currentLanguage || 'es';
            
            // 1. Agrupar los resultados de subtemas por su categoría principal
            const performanceByCategory = {};
            state.detailedPerformance.forEach(subtopicResult => {
                const question = state.currentExamQuestions.find(q => q.topic && q.topic.subtopic_id === subtopicResult.id);
                if (question) {
                    const categoryId = question.category;
                    if (!performanceByCategory[categoryId]) {
                        performanceByCategory[categoryId] = [];
                    }
                    performanceByCategory[categoryId].push(subtopicResult);
                }
            });
    
            let accordionHTML = `<h3 class="text-center mb-4">${i1n.get('results_performance_analysis')}</h3>`;
            let categoryIndex = 0;
    
            // 2. Iterar en el orden definido en CONFIG para asegurar el orden correcto (Cat 1, Cat 2, ...)
            CONFIG.categories.forEach(categoryConfig => {
                const categoryId = categoryConfig.id;
                if (!performanceByCategory[categoryId]) return; // Si no hay preguntas de esta categoría, la saltamos.
    
                const subtopics = performanceByCategory[categoryId];
                if (subtopics.length === 0) return;
    
                // Calcular el rendimiento promedio de la categoría
                const categoryTotal = subtopics.reduce((sum, s) => sum + s.total, 0);
                const categoryCorrect = subtopics.reduce((sum, s) => sum + s.correct, 0);
                const categoryPercentage = categoryTotal > 0 ? Math.round((categoryCorrect / categoryTotal) * 100) : 0;
                const categoryName = i1n.get(categoryConfig.i18nKey || categoryId);
    
                // 3. Obtener el color proporcional para el badge de la categoría
                const badgeColor = this._getProportionalColor(categoryPercentage);
    
                accordionHTML += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading-${categoryIndex}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${categoryIndex}">
                                <div class="w-100 d-flex justify-content-between align-items-center pe-3">
                                    <span>${categoryName}</span>
                                    <span class="badge rounded-pill" style="background-color: ${badgeColor}; color: white;">${categoryCorrect}/${categoryTotal}  -  ${categoryPercentage}%</span>
                                </div>
                            </button>
                        </h2>
                        <div id="collapse-${categoryIndex}" class="accordion-collapse collapse" data-bs-parent="#performance-accordion">
                            <div class="accordion-body">`;
    
                subtopics.sort((a,b) => a.percentage - b.percentage).forEach(topic => {
                     let topicBarClass = 'bg-warning';
                     if (topic.percentage >= 80) topicBarClass = 'bg-success';
                     else if (topic.percentage < 60) topicBarClass = 'bg-danger';
    
                     accordionHTML += `
                        <div class="topic-performance-item">
                            <div class="d-flex justify-content-between">
                                <span>${topic.id} - ${topic[`description_${lang}`]}</span>
                                <span class="fw-bold">${topic.correct}/${topic.total}</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar ${topicBarClass}" role="progressbar" style="width: ${topic.percentage}%" aria-valuenow="${topic.percentage}">
                                    ${topic.percentage}%
                                </div>
                            </div>
                        </div>`;
                });
    
                accordionHTML += `</div></div></div>`;
                categoryIndex++;
            });
    
            container.innerHTML = accordionHTML;
        },
    };

    // =================================================================================
    // MÓDULO DEL EXAMEN (LÓGICA PRINCIPAL)
    // =================================================================================
    const Exam = {
        /**
         * Inicia el examen basándose en la configuración del usuario.
         */
        async start() {
            const selectedMode = document.querySelector('input[name="examMode"]:checked').value;
            const selectedCats = document.querySelectorAll('#category-selection-container input:checked');
            const totalQuestionCount = DOM.questionCountSelect.value;
            
            if (selectedCats.length === 0) {
                return alert(i1n.get('alert_select_category'));
            }
        
            resetState();
            state.examMode = selectedMode;
            const selectedCategoryIds = Array.from(selectedCats).map(el => el.value);
        
            try {
                const allFetchedQuestions = await Data.fetchQuestions(selectedCategoryIds);
                if (allFetchedQuestions.length === 0) return alert(i1n.get('alert_no_questions'));
        
                let examPool = [];
                const categoryWeights = {
                    '1.0-network-fundamentals': 0.20,
                    '2.0-network-access': 0.20,
                    '3.0-ip-connectivity': 0.25,
                    '4.0-ip-services': 0.10,
                    '5.0-security-fundamentals': 0.15,
                    '6.0-automation-programmability': 0.10
                };
        
                if (totalQuestionCount === 'all') {
                    examPool = Data.shuffleArray(allFetchedQuestions);
                } else {
                    const numQuestions = parseInt(totalQuestionCount, 10);
                    const questionsByCategory = {};
                    selectedCategoryIds.forEach(id => {
                        questionsByCategory[id] = Data.shuffleArray(allFetchedQuestions.filter(q => q.category === id));
                    });
        
                    // --- INICIO DE LA LÓGICA DE DISTRIBUCIÓN MEJORADA ---
                    const questionsToTake = {};
                    const categoryFractions = {};
                    let assignedQuestions = 0;
                    
                    // 1. Asigna el número base de preguntas y guarda los decimales
                    selectedCategoryIds.forEach(id => {
                        const exactCount = numQuestions * categoryWeights[id];
                        questionsToTake[id] = Math.floor(exactCount);
                        categoryFractions[id] = exactCount - Math.floor(exactCount);
                        assignedQuestions += questionsToTake[id];
                    });
                    
                    // 2. Distribuye las preguntas restantes basándose en la parte decimal más alta
                    let remaining = numQuestions - assignedQuestions;
                    const sortedFractions = Object.keys(categoryFractions).sort((a, b) => categoryFractions[b] - categoryFractions[a]);
        
                    for (let i = 0; i < remaining; i++) {
                        const categoryId = sortedFractions[i % sortedFractions.length];
                        questionsToTake[categoryId]++;
                    }
                    // --- FIN DE LA LÓGICA DE DISTRIBUCIÓN MEJORADA ---
        
                    // Construye el pool final
                    for (const categoryId in questionsToTake) {
                        const takeCount = questionsToTake[categoryId];
                        const availableQuestions = questionsByCategory[categoryId];
                        examPool.push(...availableQuestions.slice(0, takeCount));
                    }
                    
                    examPool = Data.shuffleArray(examPool);
                }
        
                examPool.forEach(q => {
                    q.shuffledOptions = Data.shuffleArray([...q.options]);
                    q.userAnswerIndex = null;
                });
                state.currentExamQuestions = examPool;
                
                if (state.currentExamQuestions.length === 0) {
                     return alert(i1n.get('alert_no_questions'));
                }
                
                UI.showScreen('questions');
                if (state.examMode === 'exam') Timer.start();
                UI.displayQuestion();
        
            } catch (error) {
                console.error('Error starting exam:', error);
                return alert(i1n.get('alert_load_error'));
            }
        },
    
        /**
         * Avanza al siguiente índice de pregunta y decide si mostrarla o finalizar el examen.
         */
        proceedToNextQuestion() {
            state.currentQuestionIndex++;
            if (state.currentQuestionIndex >= state.currentExamQuestions.length) {
                Exam.finish();
            } else {
                UI.displayQuestion();
            }
        },
    
        /**
         * Finaliza el examen, calcula las preguntas omitidas, guarda y muestra los resultados.
         */
        // Dentro del Módulo 'const Exam = { ... }'

        finish() {
            Timer.stop();
            // Marca como omitidas las preguntas restantes no respondidas
            for (let i = state.currentQuestionIndex; i < state.currentExamQuestions.length; i++) {
                const q = state.currentExamQuestions[i];
                if (q.userAnswerIndex === null) {
                    q.userAnswerIndex = 'skipped';
                    state.stats.skipped++;
                }
            }
        
            const topicPerformance = {};
            state.currentExamQuestions.forEach(q => {
                // ===== INICIO DE LA MODIFICACIÓN =====
                // Ahora incluimos TODAS las preguntas que tienen un subtema, respondidas u omitidas
                if (q.topic && q.topic.subtopic_id) {
                    const subtopicKey = q.topic.subtopic_id;
                    
                    if (!topicPerformance[subtopicKey]) {
                        topicPerformance[subtopicKey] = {
                            correct: 0,
                            total: 0,
                            description_es: q.topic.subtopic_description,
                            description_en: q.topic.subtopic_description
                        };
                    }
                    
                    // Cada pregunta cuenta para el total del tema, sin importar si fue respondida u omitida
                    topicPerformance[subtopicKey].total++;
                    
                    // Solo si la pregunta fue respondida, verificamos si es correcta
                    if (q.userAnswerIndex !== 'skipped' && q.userAnswerIndex !== null) {
                        let isCorrect = false;
                        if (q.isMultipleChoice) {
                            const correct = new Set(q.shuffledOptions.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1));
                            const selected = new Set(q.userAnswerIndex);
                            isCorrect = correct.size === selected.size && [...correct].every(i => selected.has(i));
                        } else {
                            isCorrect = q.shuffledOptions[q.userAnswerIndex] && q.shuffledOptions[q.userAnswerIndex].isCorrect;
                        }
        
                        if (isCorrect) {
                            topicPerformance[subtopicKey].correct++;
                        }
                    }
                    // Si la pregunta fue omitida (skipped), simplemente no se suma 'correct',
                    // lo que efectivamente la cuenta como un intento incorrecto para el porcentaje.
                }
                // ===== FIN DE LA MODIFICACIÓN =====
            });
        
            // Convierte el objeto a un array antes de guardarlo en el estado
            const performanceArray = Object.entries(topicPerformance).map(([key, value]) => ({
                id: key,
                ...value,
                percentage: (value.total > 0) ? Math.round((value.correct / value.total) * 100) : 0
            }));
            
            state.detailedPerformance = performanceArray;
        
            Data.saveAttempt();
            UI.displayResults();
        },
    
        /**
         * Procesa la respuesta del usuario, la califica y actualiza el estado.
         */
        handleAnswerSubmission() {
            const selectedInputs = document.querySelectorAll('input[name="questionOptions"]:checked');
            if (selectedInputs.length === 0) return alert(i1n.get('alert_select_answer'));
    
            const selectedIndices = Array.from(selectedInputs).map(input => parseInt(input.value, 10));
            const question = state.currentExamQuestions[state.currentQuestionIndex];
            question.userAnswerIndex = question.isMultipleChoice ? selectedIndices : selectedIndices[0];
    
            let isCorrect = false;
            if (question.isMultipleChoice) {
                const correct = new Set(question.shuffledOptions.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1));
                const selected = new Set(selectedIndices);
                isCorrect = correct.size === selected.size && [...correct].every(i => selected.has(i));
            } else {
                isCorrect = question.shuffledOptions[selectedIndices[0]].isCorrect;
            }
    
            // Actualiza las estadísticas
            state.stats[isCorrect ? 'correct' : 'incorrect']++;
            
            if (state.examMode === 'study') {
                // En modo estudio, le pide a la UI que muestre el feedback
                UI._showAnsweredState(question, i1n.currentLanguage || 'es');
            } else {
                // En modo examen, simplemente avanza
                Exam.proceedToNextQuestion();
            }
        },
    
        /**
         * Marca la pregunta actual como omitida y avanza a la siguiente.
         */
        skipQuestion() {
            state.currentExamQuestions[state.currentQuestionIndex].userAnswerIndex = 'skipped';
            state.stats.skipped++; //Exam.proceedToNextQuestion
            Exam.proceedToNextQuestion();
        },
        
        /**
         * Resetea la interfaz a la pantalla de configuración inicial.
         */
        resetToSetup() {
            UI.showScreen('setup');
            UI.loadAndDisplayCategories();
            UI.translateQuestionCountOptions();
        }
    };

    // =================================================================================
    // INICIALIZACIÓN DE LA APLICACIÓN
    // =================================================================================
    
    /**
     * Función principal que se ejecuta al cargar el script para inicializar la aplicación.
     */
    function init() {
        // 1. Establece el estado inicial por defecto.
        resetState();
    
        // 2. Asigna los manejadores de eventos principales a los botones.
        if (DOM.startBtn) {
            DOM.startBtn.addEventListener('click', Exam.start);
        }
    
        // 3. Espera a que el motor de internacionalización (i18n) esté listo.
        document.addEventListener('i18n-loaded', () => {
            // Una vez cargado, muestra y traduce los elementos de la pantalla de inicio.
            UI.loadAndDisplayCategories();
            UI.translateQuestionCountOptions();
        });
    
        // 4. Registra un "renderizador dinámico" que se activa cada vez que cambia el idioma.
        i1n.registerDynamicRenderer(() => {
            // Busca cuál de las pantallas principales está visible actualmente.
            const currentScreen = document.body.querySelector(
                '#exam-setup-container:not(.d-none), #exam-questions-container:not(.d-none), #exam-results-container:not(.d-none), #exam-review-container:not(.d-none)'
            );
    
            // Si no hay ninguna pantalla activa, no hace nada.
            if (!currentScreen) return;
    
            // Según la pantalla activa, llama a la función de UI correspondiente para redibujarla.
            switch (currentScreen.id) {
                case 'exam-questions-container':
                    UI.displayQuestion();
                    break;
                case 'exam-results-container':
                    UI.displayResults();
                    break;
                case 'exam-review-container':
                    UI.renderReviewPage();
                    break;
                case 'exam-setup-container':
                default:
                    UI.loadAndDisplayCategories();
                    UI.translateQuestionCountOptions();
                    break;
            }
        });
    }
    
    // Llama a la función de inicialización para arrancar la aplicación.
    init();
});
