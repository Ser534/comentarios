-- Esquema DDL para Producción del Módulo Transversal de Comentarios y Puntuaciones
-- Aplicado sobre /home/ser/534/db/inmobiliaria.db

CREATE TABLE IF NOT EXISTS comm_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    app_name VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'review', -- 'review', 'question', 'feedback'
    parent_id INTEGER NULL,
    rating INTEGER NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    comment_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published', -- 'published', 'pending', 'resolved'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comm_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comm_target ON comm_comments (app_name, entity_type, entity_id, category);
CREATE INDEX IF NOT EXISTS idx_comm_user ON comm_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comm_parent ON comm_comments (parent_id);

