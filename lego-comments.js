/**
 * Módulo Transversal Estilo Lego 534 - Web Component <lego-comments>
 * Permite incrustar Reseñas con Estrellas, Preguntas al Vendedor (MercadoLibre Style) 
 * o Feedback al Desarrollador con 1 sola línea de HTML.
 * 
 * Basado en Tokens CSS Dinámicos para soporte de Temas Claro, Oscuro y Sliders.
 */

(function () {
    // Determinar la URL del servidor backend basada en la ubicación del script
    const scriptSrc = document.currentScript ? document.currentScript.src : 'http://localhost:3003/lego-comments.js';
    const baseUrl = new URL(scriptSrc).origin;

    class LegoComments extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this.state = {
                appName: 'mapa',
                entityType: 'property',
                entityId: '1',
                mode: 'review', // 'review', 'question', 'feedback'
                comments: [],
                stats: { average_rating: 0, total_count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
                loading: true,
                error: null,
                selectedRating: 5,
                commentText: '',
                activeReplyTo: null,
                replyText: ''
            };
        }

        static get observedAttributes() {
            return ['app-name', 'entity-type', 'entity-id', 'mode'];
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (oldValue !== newValue) {
                if (name === 'app-name') this.state.appName = newValue;
                if (name === 'entity-type') this.state.entityType = newValue;
                if (name === 'entity-id') this.state.entityId = newValue;
                if (name === 'mode') this.state.mode = newValue;
                this.loadData();
            }
        }

        connectedCallback() {
            this.state.appName = this.getAttribute('app-name') || 'mapa';
            this.state.entityType = this.getAttribute('entity-type') || 'property';
            this.state.entityId = this.getAttribute('entity-id') || '1';
            this.state.mode = this.getAttribute('mode') || 'review';
            this.loadData();
        }

        async loadData() {
            this.state.loading = true;
            this.render();

            try {
                const category = this.state.mode;
                const commentsUrl = `${baseUrl}/api/comments?app_name=${encodeURIComponent(this.state.appName)}&entity_type=${encodeURIComponent(this.state.entityType)}&entity_id=${encodeURIComponent(this.state.entityId)}&category=${encodeURIComponent(category)}`;
                const res = await fetch(commentsUrl);
                if (!res.ok) throw new Error('Error al cargar comentarios');
                this.state.comments = await res.json();

                if (this.state.mode === 'review') {
                    const statsUrl = `${baseUrl}/api/stats?app_name=${encodeURIComponent(this.state.appName)}&entity_type=${encodeURIComponent(this.state.entityType)}&entity_id=${encodeURIComponent(this.state.entityId)}`;
                    const resStats = await fetch(statsUrl);
                    if (resStats.ok) {
                        this.state.stats = await resStats.json();
                    }
                }
                this.state.loading = false;
            } catch (err) {
                this.state.error = err.message;
                this.state.loading = false;
            }
            this.render();
        }

        async submitComment(parentId = null, text = null, rating = null) {
            const commentText = text || this.state.commentText;
            if (!commentText || !commentText.trim()) return;

            const payload = {
                user_id: 1, // Simulación de usuario autenticado en demo
                app_name: this.state.appName,
                entity_type: this.state.entityType,
                entity_id: this.state.entityId,
                category: this.state.mode,
                comment_text: commentText.trim(),
                parent_id: parentId
            };

            if (this.state.mode === 'review' && !parentId) {
                payload.rating = rating || this.state.selectedRating;
            }

            try {
                const res = await fetch(`${baseUrl}/api/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const errData = await res.json();
                    alert(errData.error || 'Error al guardar comentario');
                    return;
                }
                this.state.commentText = '';
                this.state.activeReplyTo = null;
                this.state.replyText = '';
                await this.loadData();
            } catch (err) {
                alert('Error de conexión con el servidor de comentarios');
            }
        }

        render() {
            const styles = `
                :host {
                    display: block;
                    font-family: var(--lego-font-family, 'Outfit', system-ui, sans-serif);
                    color: var(--lego-text-main, #f8fafc);
                }

                .lego-container {
                    background: var(--lego-card-bg, rgba(30, 41, 59, 0.75));
                    backdrop-filter: blur(12px);
                    border: 1px solid var(--lego-border, rgba(255, 255, 255, 0.12));
                    border-radius: var(--lego-radius, 16px);
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                }

                .lego-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1.25rem;
                    border-bottom: 1px solid var(--lego-border, rgba(255, 255, 255, 0.1));
                    padding-bottom: 0.75rem;
                }

                .lego-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .lego-badge {
                    font-size: 0.75rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: 9999px;
                    background: var(--lego-primary, #6366f1);
                    color: #fff;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                /* Banner de Estadísticas */
                .lego-stats-grid {
                    display: grid;
                    grid-template-columns: 140px 1fr;
                    gap: 1.5rem;
                    background: rgba(15, 23, 42, 0.5);
                    padding: 1rem 1.25rem;
                    border-radius: calc(var(--lego-radius, 16px) - 4px);
                    margin-bottom: 1.5rem;
                }

                .lego-score-box {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }

                .lego-score-num {
                    font-size: 2.75rem;
                    font-weight: 800;
                    color: var(--lego-star-color, #fbbf24);
                    line-height: 1;
                }

                .lego-stars {
                    color: var(--lego-star-color, #fbbf24);
                    margin: 0.25rem 0;
                    font-size: 1.1rem;
                }

                .lego-dist-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    margin-bottom: 0.25rem;
                }

                .lego-progress-bg {
                    flex: 1;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .lego-progress-fill {
                    height: 100%;
                    background: var(--lego-star-color, #fbbf24);
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }

                /* Formularios */
                .lego-form {
                    margin-bottom: 1.5rem;
                }

                .lego-star-picker {
                    display: flex;
                    gap: 0.4rem;
                    margin-bottom: 0.75rem;
                    font-size: 1.5rem;
                    cursor: pointer;
                }

                .lego-star-picker span {
                    color: rgba(255, 255, 255, 0.2);
                    transition: transform 0.15s ease, color 0.15s ease;
                }

                .lego-star-picker span.active {
                    color: var(--lego-star-color, #fbbf24);
                }

                .lego-star-picker span:hover {
                    transform: scale(1.2);
                }

                .lego-textarea {
                    width: 100%;
                    box-sizing: border-box;
                    background: rgba(15, 23, 42, 0.7);
                    border: 1px solid var(--lego-border, rgba(255, 255, 255, 0.15));
                    border-radius: calc(var(--lego-radius, 16px) - 4px);
                    color: var(--lego-text-main, #f8fafc);
                    padding: 0.75rem 1rem;
                    font-size: 0.95rem;
                    font-family: inherit;
                    resize: vertical;
                    min-height: 80px;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .lego-textarea:focus {
                    border-color: var(--lego-primary, #6366f1);
                }

                .lego-btn {
                    background: var(--lego-primary, #6366f1);
                    color: #ffffff;
                    border: none;
                    border-radius: calc(var(--lego-radius, 16px) - 4px);
                    padding: 0.6rem 1.25rem;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    margin-top: 0.5rem;
                    transition: background 0.2s, transform 0.1s;
                }

                .lego-btn:hover {
                    background: var(--lego-primary-hover, #4f46e5);
                    transform: translateY(-1px);
                }

                .lego-btn-sm {
                    padding: 0.35rem 0.75rem;
                    font-size: 0.8rem;
                }

                /* Lista de Comentarios */
                .lego-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .lego-card {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid var(--lego-border, rgba(255, 255, 255, 0.08));
                    border-radius: calc(var(--lego-radius, 16px) - 4px);
                    padding: 1rem;
                }

                .lego-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.4rem;
                }

                .lego-user-info {
                    font-weight: 600;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .lego-date {
                    font-size: 0.75rem;
                    color: var(--lego-text-muted, #94a3b8);
                }

                .lego-text {
                    font-size: 0.92rem;
                    line-height: 1.5;
                    color: var(--lego-text-main, #e2e8f0);
                    margin: 0.4rem 0;
                }

                /* Respuestas Anidadas (Estilo MercadoLibre) */
                .lego-replies {
                    margin-top: 0.75rem;
                    margin-left: 1.25rem;
                    padding-left: 0.75rem;
                    border-left: 2px solid var(--lego-primary, #6366f1);
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                }

                .lego-reply-card {
                    background: rgba(30, 41, 59, 0.6);
                    padding: 0.6rem 0.8rem;
                    border-radius: 8px;
                    font-size: 0.88rem;
                }

                .lego-reply-badge {
                    font-size: 0.7rem;
                    background: rgba(99, 102, 241, 0.2);
                    color: var(--lego-primary, #818cf8);
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    font-weight: 600;
                }
            `;

            let modeTitle = 'Opiniones y Reseñas';
            let modeBadge = 'Estrellas';
            if (this.state.mode === 'question') {
                modeTitle = 'Preguntas y Respuestas';
                modeBadge = 'MercadoLibre Style';
            } else if (this.state.mode === 'feedback') {
                modeTitle = 'Sugerencias e Inquietudes';
                modeBadge = 'Feedback Dev';
            }

            const { average_rating, total_count, distribution } = this.state.stats;

            // Renderizado HTML
            let html = `
                <style>${styles}</style>
                <div class="lego-container">
                    <div class="lego-header">
                        <h3 class="lego-title">
                            💬 ${modeTitle}
                        </h3>
                        <span class="lego-badge">${modeBadge}</span>
                    </div>
            `;

            // Si es modo 'review', mostrar el banner de estadísticas
            if (this.state.mode === 'review') {
                html += `
                    <div class="lego-stats-grid">
                        <div class="lego-score-box">
                            <div class="lego-score-num">${average_rating > 0 ? average_rating : '-'}</div>
                            <div class="lego-stars">
                                ${'★'.repeat(Math.round(average_rating))}${'☆'.repeat(5 - Math.round(average_rating))}
                            </div>
                            <div class="lego-date">${total_count} ${total_count === 1 ? 'reseña' : 'reseñas'}</div>
                        </div>
                        <div>
                `;
                for (let s = 5; s >= 1; s--) {
                    const count = distribution[s] || 0;
                    const pct = total_count > 0 ? (count / total_count) * 100 : 0;
                    html += `
                        <div class="lego-dist-item">
                            <span>${s} ★</span>
                            <div class="lego-progress-bg">
                                <div class="lego-progress-fill" style="width: ${pct}%"></div>
                            </div>
                            <span>${count}</span>
                        </div>
                    `;
                }
                html += `</div></div>`;
            }

            // Formulario principal de envío
            html += `<div class="lego-form">`;
            if (this.state.mode === 'review') {
                html += `
                    <div class="lego-star-picker" id="starPicker">
                        ${[1, 2, 3, 4, 5].map(s => `
                            <span class="${s <= this.state.selectedRating ? 'active' : ''}" data-star="${s}">★</span>
                        `).join('')}
                    </div>
                `;
            }

            const placeholder = this.state.mode === 'review'
                ? 'Escribe tu reseña sobre esta publicación...'
                : this.state.mode === 'question'
                ? 'Hazle una pregunta al vendedor/martillero...'
                : 'Envía tus comentarios o sugerencias directamente al equipo...';

            html += `
                <textarea class="lego-textarea" id="mainTextarea" placeholder="${placeholder}">${this.state.commentText}</textarea>
                <button class="lego-btn" id="btnSubmit">
                    ${this.state.mode === 'question' ? 'Preguntar' : 'Publicar Comentario'}
                </button>
            </div>`;

            // Listado de comentarios
            if (this.state.loading) {
                html += `<div style="text-align:center; padding: 1.5rem; color: #94a3b8;">Cargando comentarios...</div>`;
            } else if (this.state.comments.length === 0) {
                html += `<div style="text-align:center; padding: 1.5rem; color: #94a3b8;">Aún no hay ${this.state.mode === 'question' ? 'preguntas' : 'comentarios'} aquí. ¡Sé el primero!</div>`;
            } else {
                html += `<div class="lego-list">`;
                this.state.comments.forEach(item => {
                    const starsStr = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '';
                    html += `
                        <div class="lego-card">
                            <div class="lego-card-header">
                                <div class="lego-user-info">
                                    👤 ${item.user_name}
                                    ${item.rating ? `<span style="color:#fbbf24; margin-left:0.3rem;">${starsStr}</span>` : ''}
                                </div>
                                <div class="lego-date">${new Date(item.created_at).toLocaleDateString()}</div>
                            </div>
                            <div class="lego-text">${this.escapeHTML(item.comment_text)}</div>
                            <button class="lego-btn lego-btn-sm btn-reply" data-id="${item.id}" style="background:transparent; border:1px solid var(--lego-border); color:var(--lego-text-muted);">
                                ↩ Responder
                            </button>

                            <!-- Respuestas Anidadas -->
                            ${item.replies && item.replies.length > 0 ? `
                                <div class="lego-replies">
                                    ${item.replies.map(rep => `
                                        <div class="lego-reply-card">
                                            <div class="lego-card-header">
                                                <span class="lego-reply-badge">
                                                    ${this.state.mode === 'question' ? 'Vendedor / Martillero' : 'Respuesta Oficial'}
                                                </span>
                                                <span class="lego-date">${new Date(rep.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div class="lego-text">${this.escapeHTML(rep.comment_text)}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            <!-- Formulario de Respuesta In-line si está activo -->
                            ${this.state.activeReplyTo === item.id ? `
                                <div style="margin-top:0.75rem; margin-left:1.25rem;">
                                    <textarea class="lego-textarea" id="replyTextarea-${item.id}" placeholder="Escribe tu respuesta..."></textarea>
                                    <div style="display:flex; gap:0.5rem; margin-top:0.4rem;">
                                        <button class="lego-btn lego-btn-sm btn-send-reply" data-parent="${item.id}">Enviar Respuesta</button>
                                        <button class="lego-btn lego-btn-sm btn-cancel-reply" style="background:#ef4444;">Cancelar</button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                html += `</div>`;
            }

            html += `</div>`;
            this.shadowRoot.innerHTML = html;
            this.attachEvents();
        }

        attachEvents() {
            // Star Picker
            const starPicker = this.shadowRoot.getElementById('starPicker');
            if (starPicker) {
                starPicker.querySelectorAll('span').forEach(starEl => {
                    starEl.addEventListener('click', (e) => {
                        this.state.selectedRating = parseInt(e.target.dataset.star, 10);
                        this.render();
                    });
                });
            }

            // Main Textarea
            const mainTextarea = this.shadowRoot.getElementById('mainTextarea');
            if (mainTextarea) {
                mainTextarea.addEventListener('input', (e) => {
                    this.state.commentText = e.target.value;
                });
            }

            // Submit Button
            const btnSubmit = this.shadowRoot.getElementById('btnSubmit');
            if (btnSubmit) {
                btnSubmit.addEventListener('click', () => {
                    this.submitComment();
                });
            }

            // Botones Responder
            this.shadowRoot.querySelectorAll('.btn-reply').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id, 10);
                    this.state.activeReplyTo = this.state.activeReplyTo === id ? null : id;
                    this.render();
                });
            });

            // Cancelar Respuesta
            this.shadowRoot.querySelectorAll('.btn-cancel-reply').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.state.activeReplyTo = null;
                    this.render();
                });
            });

            // Enviar Respuesta Anidada
            this.shadowRoot.querySelectorAll('.btn-send-reply').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const parentId = parseInt(e.target.dataset.parent, 10);
                    const txtArea = this.shadowRoot.getElementById(`replyTextarea-${parentId}`);
                    if (txtArea && txtArea.value.trim()) {
                        this.submitComment(parentId, txtArea.value.trim());
                    }
                });
            });
        }

        escapeHTML(str) {
            return str.replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }
    }

    if (!customElements.get('lego-comments')) {
        customElements.define('lego-comments', LegoComments);
    }
})();
