-- Esquema y datos semilla de Desarrollo para el Módulo Transversal de Comentarios y Puntuaciones
-- Aplicado sobre /home/ser/534/db/inmobiliaria.db

DROP TABLE IF EXISTS comm_comments;

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

-- Datos semilla para pruebas:
-- 1. Reseñas con estrellas (Review)
INSERT INTO comm_comments (id, user_id, app_name, entity_type, entity_id, category, parent_id, rating, comment_text, created_at)
VALUES 
(1, 1, 'mapa', 'property', '1', 'review', NULL, 5, 'Excelente propiedad. Ubicación inmejorable y la atención del martillero fue impoluta.', '2026-09-04 10:30:00'),
(2, 2, 'mapa', 'property', '1', 'review', NULL, 4, 'Muy buena casa, luminosa y amplia. La comisión transparente.', '2026-09-04 14:15:00'),
(3, 1, 'core', 'shop', '10', 'review', NULL, 5, 'Gran experiencia de servicio en la tienda. 100% recomendable.', '2026-09-05 09:00:00');

-- 2. Preguntas al Vendedor / Estilo MercadoLibre (Question - Answer)
INSERT INTO comm_comments (id, user_id, app_name, entity_type, entity_id, category, parent_id, rating, comment_text, created_at)
VALUES 
(4, 2, 'mapa', 'property', '1', 'question', NULL, NULL, '¿Hola! ¿Aceptan permutas por un departamento de menor valor en zona norte?', '2026-09-05 11:00:00'),
(5, 1, 'mapa', 'property', '1', 'question', 4, NULL, 'Hola! Sí, el dueño evalúa departamento de 2 ambientes hasta U$S 70.000.', '2026-09-05 11:25:00'),
(6, 2, 'mapa', 'property', '1', 'question', NULL, NULL, '¿Tiene expensas actualmente y cuál es la antigüedad?', '2026-09-05 12:10:00');

-- 3. Feedback al Desarrollador / Plataforma (Feedback)
INSERT INTO comm_comments (id, user_id, app_name, entity_type, entity_id, category, parent_id, rating, comment_text, status, created_at)
VALUES 
(7, 2, 'mapa', 'platform', 'general', 'feedback', NULL, NULL, 'Sería excelente agregar un filtro por cantidad de cocheras en el mapa.', 'pending', '2026-09-05 15:00:00'),
(8, 1, 'mapa', 'platform', 'general', 'feedback', 7, NULL, '¡Gracias por la sugerencia! Está agendada para el próximo release de mapa.', 'resolved', '2026-09-05 15:30:00');

