// Módulo de Comentarios - Cliente Demo, Customizer 534 & Panel Admin

window.switchMainView = function(viewName) {
    const btnComp = document.getElementById('view-components-btn');
    const btnAdmin = document.getElementById('view-admin-btn');
    const viewComp = document.getElementById('main-view-components');
    const viewAdmin = document.getElementById('main-view-admin');

    if (viewName === 'admin') {
        btnAdmin.classList.add('active');
        btnComp.classList.remove('active');
        viewComp.style.display = 'none';
        viewAdmin.style.display = 'block';
        loadAdminDashboard();
    } else {
        btnComp.classList.add('active');
        btnAdmin.classList.remove('active');
        viewAdmin.style.display = 'none';
        viewComp.style.display = 'block';
    }
};

async function loadAdminDashboard() {
    try {
        // Cargar métricas
        const resStats = await fetch('/api/stats');
        if (resStats.ok) {
            const stats = await resStats.json();
            document.getElementById('admin-total-reviews').textContent = stats.total_count || 0;
            document.getElementById('admin-avg-rating').textContent = (stats.average_rating > 0 ? stats.average_rating.toFixed(1) : '0.0') + ' ★';
        }

        // Cargar sugerencias y feedback de usuarios
        const resFeed = await fetch('/api/comments?category=feedback');
        if (resFeed.ok) {
            const tickets = await resFeed.json();
            const listEl = document.getElementById('admin-feedback-list');
            listEl.innerHTML = '';

            const pendingCount = tickets.filter(t => t.status === 'pending').length;
            document.getElementById('admin-pending-feedback').textContent = pendingCount;

            if (tickets.length === 0) {
                listEl.innerHTML = '<div style="color:var(--lego-text-muted); text-align:center; padding:1.5rem;">No hay mensajes de feedback recibidos aún.</div>';
                return;
            }

            tickets.forEach(ticket => {
                const card = document.createElement('div');
                card.className = 'ticket-card';
                const isPending = ticket.status === 'pending';

                card.innerHTML = `
                    <div class="ticket-header">
                        <div>
                            <strong>👤 ${escapeHTML(ticket.user_name)}</strong> 
                            <span style="font-size:0.75rem; color:var(--lego-text-muted);">(${ticket.app_name} / ${ticket.entity_type})</span>
                        </div>
                        <span class="status-tag ${isPending ? 'status-pending' : 'status-resolved'}">
                            ${isPending ? '⏳ Pendiente' : '✅ Resuelto'}
                        </span>
                    </div>
                    <div style="margin:0.5rem 0; font-size:0.92rem;">${escapeHTML(ticket.comment_text)}</div>
                    
                    ${ticket.replies && ticket.replies.length > 0 ? `
                        <div style="margin-top:0.5rem; padding-left:0.75rem; border-left:2px solid var(--lego-primary); font-size:0.85rem; color:var(--lego-text-muted);">
                            <strong>Respuesta oficial:</strong> ${escapeHTML(ticket.replies[0].comment_text)}
                        </div>
                    ` : ''}

                    <div style="margin-top:0.75rem; display:flex; gap:0.5rem;">
                        ${isPending ? `
                            <button class="preset-btn" onclick="resolveTicket(${ticket.id})">Marcar como Resuelto</button>
                        ` : ''}
                    </div>
                `;
                listEl.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Error al cargar dashboard admin:', err);
    }
}

window.resolveTicket = async function(id) {
    try {
        const res = await fetch('/api/comments/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, status: 'resolved' })
        });
        if (res.ok) {
            loadAdminDashboard();
        } else {
            alert('Error al actualizar ticket');
        }
    } catch (err) {
        alert('Error de conexión');
    }
};

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Manejo de Pestañas de Modos para el Web Component
    const modeTabs = document.querySelectorAll('.mode-tabs .tab-btn');
    const container = document.getElementById('webComponentContainer');
    const codeSnippet = document.getElementById('codeSnippet');

    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const app = tab.dataset.app;
            const type = tab.dataset.type;
            const id = tab.dataset.id;
            const mode = tab.dataset.mode;

            container.innerHTML = `<lego-comments app-name="${app}" entity-type="${type}" entity-id="${id}" mode="${mode}"></lego-comments>`;
            codeSnippet.textContent = `<lego-comments app-name="${app}" entity-type="${type}" entity-id="${id}" mode="${mode}"></lego-comments>`;
        });
    });

    // 2. Personalizador de Temas 534 (Theme Customizer Drawer & Sliders)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themePanelContent = document.querySelector('.theme-panel-content');
    const primaryColorPicker = document.getElementById('primaryColorPicker');
    const radiusRange = document.getElementById('radiusRange');
    const radiusVal = document.getElementById('radiusVal');
    const glassOpacityRange = document.getElementById('glassOpacityRange');
    const opacityVal = document.getElementById('opacityVal');
    const presetBtns = document.querySelectorAll('.preset-btn');

    themeToggleBtn.addEventListener('click', () => {
        themePanelContent.classList.toggle('open');
    });

    primaryColorPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        document.documentElement.style.setProperty('--lego-primary', color);
        document.documentElement.style.setProperty('--lego-primary-hover', adjustColor(color, -20));
    });

    radiusRange.addEventListener('input', (e) => {
        const val = e.target.value + 'px';
        radiusVal.textContent = val;
        document.documentElement.style.setProperty('--lego-radius', val);
    });

    glassOpacityRange.addEventListener('input', (e) => {
        const opacity = e.target.value / 100;
        opacityVal.textContent = opacity.toFixed(2);
        const currentBg = getComputedStyle(document.documentElement).getPropertyValue('--lego-card-bg').trim();
        if (currentBg.startsWith('rgba')) {
            const parts = currentBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (parts) {
                const newBg = `rgba(${parts[1]}, ${parts[2]}, ${parts[3]}, ${opacity})`;
                document.documentElement.style.setProperty('--lego-card-bg', newBg);
            }
        }
    });

    const presets = {
        dark: {
            '--lego-bg': '#0a0e17',
            '--lego-card-bg': 'rgba(30, 41, 59, 0.75)',
            '--lego-text-main': '#f8fafc',
            '--lego-text-muted': '#94a3b8',
            '--lego-border': 'rgba(255, 255, 255, 0.12)',
            '--lego-primary': '#6366f1',
            '--lego-primary-hover': '#4f46e5',
            '--lego-star-color': '#fbbf24'
        },
        light: {
            '--lego-bg': '#f1f5f9',
            '--lego-card-bg': 'rgba(255, 255, 255, 0.9)',
            '--lego-text-main': '#0f172a',
            '--lego-text-muted': '#64748b',
            '--lego-border': 'rgba(0, 0, 0, 0.1)',
            '--lego-primary': '#2563eb',
            '--lego-primary-hover': '#1d4ed8',
            '--lego-star-color': '#d97706'
        },
        cyberpunk: {
            '--lego-bg': '#0f051d',
            '--lego-card-bg': 'rgba(32, 14, 58, 0.85)',
            '--lego-text-main': '#00f6ff',
            '--lego-text-muted': '#bd93f9',
            '--lego-border': 'rgba(255, 0, 127, 0.4)',
            '--lego-primary': '#ff007f',
            '--lego-primary-hover': '#d00068',
            '--lego-star-color': '#ffea00'
        },
        emerald: {
            '--lego-bg': '#022c22',
            '--lego-card-bg': 'rgba(6, 78, 59, 0.8)',
            '--lego-text-main': '#ecfdf5',
            '--lego-text-muted': '#6ee7b7',
            '--lego-border': 'rgba(16, 185, 129, 0.3)',
            '--lego-primary': '#10b981',
            '--lego-primary-hover': '#059669',
            '--lego-star-color': '#f59e0b'
        }
    };

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const presetKey = btn.dataset.preset;
            const themeProps = presets[presetKey];
            if (themeProps) {
                for (const [prop, val] of Object.entries(themeProps)) {
                    document.documentElement.style.setProperty(prop, val);
                }
                if (themeProps['--lego-primary']) {
                    primaryColorPicker.value = themeProps['--lego-primary'];
                }
            }
        });
    });

    function adjustColor(col, amt) {
        let usePound = false;
        if (col[0] === "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    }
});
