package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	dbPath := "./comentarios_test.db"
	os.Remove(dbPath)

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		t.Fatalf("Falló apertura de BD de test: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS comm_comments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		app_name VARCHAR(50) NOT NULL,
		entity_type VARCHAR(50) NOT NULL,
		entity_id VARCHAR(100) NOT NULL,
		category VARCHAR(30) NOT NULL DEFAULT 'review',
		parent_id INTEGER NULL,
		rating INTEGER NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
		comment_text TEXT NOT NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'published',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	INSERT INTO users (id, email) VALUES (1, 'carlos@inmobiliaria.com');
	`

	_, err = db.Exec(schema)
	if err != nil {
		t.Fatalf("Falló creación de esquema en BD de test: %v", err)
	}

	t.Cleanup(func() {
		db.Close()
		os.Remove(dbPath)
		os.Remove(dbPath + "-wal")
		os.Remove(dbPath + "-shm")
	})

	return db
}

func TestVerifyPassiveSchema(t *testing.T) {
	db := setupTestDB(t)
	if err := verifyPassiveSchema(db); err != nil {
		t.Errorf("Esperaba verificación pasiva exitosa, obtuvo: %v", err)
	}
}

func TestPostAndGetComments(t *testing.T) {
	db := setupTestDB(t)

	postHandler := handlePostComment(db)
	getHandler := handleGetComments(db)
	statsHandler := handleGetStats(db)

	rating5 := 5
	// 1. Probar inserción de reseña (POST /api/comments)
	payload := CreateCommentPayload{
		UserID:      1,
		AppName:     "mapa",
		EntityType:  "property",
		EntityID:    "100",
		Category:    "review",
		Rating:      &rating5,
		CommentText: "Excelente propiedad de prueba",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/comments", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	postHandler.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Esperaba HTTP 201 Created, obtuvo %d. Respuesta: %s", w.Code, w.Body.String())
	}

	// 2. Probar inserción de pregunta (MercadoLibre style - Rating NULL)
	payloadQ := CreateCommentPayload{
		UserID:      1,
		AppName:     "mapa",
		EntityType:  "property",
		EntityID:    "100",
		Category:    "question",
		Rating:      nil,
		CommentText: "¿Tiene cochera privada?",
	}
	bodyQ, _ := json.Marshal(payloadQ)

	reqQ := httptest.NewRequest("POST", "/api/comments", bytes.NewBuffer(bodyQ))
	wQ := httptest.NewRecorder()

	postHandler.ServeHTTP(wQ, reqQ)
	if wQ.Code != http.StatusCreated {
		t.Fatalf("Esperaba HTTP 201 Created para pregunta, obtuvo %d", wQ.Code)
	}

	// 3. Probar listar comentarios por categoría 'review'
	reqGet := httptest.NewRequest("GET", "/api/comments?app_name=mapa&entity_type=property&entity_id=100&category=review", nil)
	wGet := httptest.NewRecorder()

	getHandler.ServeHTTP(wGet, reqGet)

	if wGet.Code != http.StatusOK {
		t.Fatalf("Esperaba HTTP 200 OK, obtuvo %d", wGet.Code)
	}

	var items []CommentItem
	json.NewDecoder(wGet.Body).Decode(&items)

	if len(items) != 1 {
		t.Fatalf("Esperaba 1 comentario de categoría review, obtuvo %d", len(items))
	}

	if items[0].Rating == nil || *items[0].Rating != 5 || items[0].CommentText != "Excelente propiedad de prueba" {
		t.Errorf("Los datos guardados no coinciden con la carga útil enviada: %+v", items[0])
	}

	// 4. Probar estadísticas (GET /api/stats?app_name=mapa&entity_type=property&entity_id=100)
	reqStats := httptest.NewRequest("GET", "/api/stats?app_name=mapa&entity_type=property&entity_id=100", nil)
	wStats := httptest.NewRecorder()

	statsHandler.ServeHTTP(wStats, reqStats)

	if wStats.Code != http.StatusOK {
		t.Fatalf("Esperaba HTTP 200 OK en stats, obtuvo %d", wStats.Code)
	}

	var stats CommentStats
	json.NewDecoder(wStats.Body).Decode(&stats)

	if stats.TotalCount != 1 || stats.AverageRating != 5.0 {
		t.Errorf("Estadísticas incorrectas. Esperaba totalCount=1 avg=5.0, obtuvo %+v", stats)
	}
}

func TestValidationErrors(t *testing.T) {
	db := setupTestDB(t)
	postHandler := handlePostComment(db)

	rating6 := 6
	// Rating fuera de rango (6 estrellas) en una reseña
	payload := CreateCommentPayload{
		UserID:      1,
		AppName:     "mapa",
		EntityType:  "property",
		EntityID:    "100",
		Category:    "review",
		Rating:      &rating6,
		CommentText: "Comentario inválido",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/comments", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	postHandler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Esperaba HTTP 400 Bad Request por rating fuera de rango, obtuvo %d", w.Code)
	}
}
