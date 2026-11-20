package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// ==========================================
// ESTRUCTURAS DE DATOS Y DOMINIO
// ==========================================

type CommentItem struct {
	ID          int64         `json:"id"`
	UserID      int64         `json:"user_id"`
	UserName    string        `json:"user_name"`
	AppName     string        `json:"app_name"`
	EntityType  string        `json:"entity_type"`
	EntityID    string        `json:"entity_id"`
	Category    string        `json:"category"`            // review, question, feedback
	ParentID    *int64        `json:"parent_id,omitempty"`  // NULL if top-level
	Rating      *int          `json:"rating,omitempty"`     // 1-5 for review, NULL for question/feedback
	CommentText string        `json:"comment_text"`
	Status      string        `json:"status"`               // published, pending, resolved
	CreatedAt   time.Time     `json:"created_at"`
	Replies     []CommentItem `json:"replies"`              // Respuestas anidadas
}

type CommentStats struct {
	AverageRating float64     `json:"average_rating"`
	TotalCount    int         `json:"total_count"`
	Distribution  map[int]int `json:"distribution"`
}

type CreateCommentPayload struct {
	UserID      int64  `json:"user_id"`
	AppName     string `json:"app_name"`
	EntityType  string `json:"entity_type"`
	EntityID    string `json:"entity_id"`
	Category    string `json:"category"`            // review, question, feedback
	ParentID    *int64 `json:"parent_id,omitempty"`
	Rating      *int   `json:"rating,omitempty"`
	CommentText string `json:"comment_text"`
	Status      string `json:"status,omitempty"`
}

// ==========================================
// MAIN & CONFIGURACIÓN DE SERVIDOR
// ==========================================

func main() {
	loadEnv()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3003"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "../db/inmobiliaria.db"
	}

	// 1. Conexión SQLite en modo WAL con timeout
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		log.Fatalf("Fatal: No se pudo abrir la conexión SQLite: %v", err)
	}
	defer db.Close()

	// 2. Comprobación Pasiva de Esquema (Regla AGENTS.md)
	if err := verifyPassiveSchema(db); err != nil {
		log.Fatalf("Fatal de Esquema: %v", err)
	}

	mux := http.NewServeMux()

	// Handlers de Archivos Estáticos Nativo
	mux.HandleFunc("GET /", handleStatic("index.html", "text/html; charset=utf-8"))
	mux.HandleFunc("GET /index.css", handleStatic("index.css", "text/css; charset=utf-8"))
	mux.HandleFunc("GET /app.js", handleStatic("app.js", "application/javascript; charset=utf-8"))
	mux.HandleFunc("GET /lego-comments.js", handleStatic("lego-comments.js", "application/javascript; charset=utf-8"))

	// Handlers API REST JSON con Middleware CORS
	mux.HandleFunc("GET /api/comments", enableCORS(handleGetComments(db)))
	mux.HandleFunc("POST /api/comments", enableCORS(handlePostComment(db)))
	mux.HandleFunc("POST /api/comments/status", enableCORS(handleUpdateStatus(db)))
	mux.HandleFunc("OPTIONS /api/comments", enableCORS(handleOptions()))
	mux.HandleFunc("OPTIONS /api/comments/status", enableCORS(handleOptions()))
	mux.HandleFunc("GET /api/stats", enableCORS(handleGetStats(db)))
	mux.HandleFunc("OPTIONS /api/stats", enableCORS(handleOptions()))

	serverAddr := ":" + port
	log.Printf("🚀 Servidor Módulo Comentarios escuchando en http://localhost%s (DB: %s)", serverAddr, dbPath)
	if err := http.ListenAndServe(serverAddr, mux); err != nil {
		log.Fatalf("Fatal Servidor HTTP: %v", err)
	}
}

// ==========================================
// MIDDLEWARE CORS
// ==========================================

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func handleOptions() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}
}

// ==========================================
// PARSER DE VARIABLES DE ENTORNO
// ==========================================

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		return // Lee del entorno del sistema si no hay .env local
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
	}
}

// ==========================================
// COMPROBACIÓN PASIVA DE ESQUEMA
// ==========================================

func verifyPassiveSchema(db *sql.DB) error {
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='comm_comments';").Scan(&tableName)
	if err == sql.ErrNoRows || tableName == "" {
		return fmt.Errorf("la tabla 'comm_comments' no existe en la base de datos. Se requiere inicialización previa (ej: sqlite3 ../db/inmobiliaria.db < setup_dev.sql)")
	} else if err != nil {
		return fmt.Errorf("error al verificar esquema: %w", err)
	}

	// Verificar columna category
	var colCategory string
	err = db.QueryRow("SELECT name FROM pragma_table_info('comm_comments') WHERE name='category';").Scan(&colCategory)
	if err == sql.ErrNoRows || colCategory == "" {
		return fmt.Errorf("la tabla 'comm_comments' no tiene la columna 'category'. Por favor ejecute setup_dev.sql")
	}

	return nil
}

// ==========================================
// HANDLERS HTTP
// ==========================================

func handleStatic(filename, contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		http.ServeFile(w, r, filepath.Clean(filename))
	}
}

// GET /api/comments?app_name=mapa&entity_type=property&entity_id=1&category=review
func handleGetComments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appName := r.URL.Query().Get("app_name")
		entityType := r.URL.Query().Get("entity_type")
		entityID := r.URL.Query().Get("entity_id")
		category := r.URL.Query().Get("category")

		query := `
			SELECT c.id, c.user_id, COALESCE(u.email, 'Usuario #' || c.user_id), 
			       c.app_name, c.entity_type, c.entity_id, c.category, c.parent_id,
			       c.rating, c.comment_text, c.status, c.created_at
			FROM comm_comments c
			LEFT JOIN users u ON c.user_id = u.id
			WHERE 1=1`

		var args []interface{}

		if appName != "" {
			query += " AND c.app_name = ?"
			args = append(args, appName)
		}
		if entityType != "" {
			query += " AND c.entity_type = ?"
			args = append(args, entityType)
		}
		if entityID != "" {
			query += " AND c.entity_id = ?"
			args = append(args, entityID)
		}
		if category != "" {
			query += " AND c.category = ?"
			args = append(args, category)
		}

		query += " ORDER BY c.created_at ASC"

		rows, err := db.Query(query, args...)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Error al consultar comentarios: %v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		allComments := []CommentItem{}
		commentMap := make(map[int64]*CommentItem)

		for rows.Next() {
			var item CommentItem
			var parentIDVal sql.NullInt64
			var ratingVal sql.NullInt64
			var createdAtStr string

			if err := rows.Scan(
				&item.ID, &item.UserID, &item.UserName, &item.AppName, &item.EntityType, &item.EntityID,
				&item.Category, &parentIDVal, &ratingVal, &item.CommentText, &item.Status, &createdAtStr,
			); err != nil {
				http.Error(w, fmt.Sprintf(`{"error": "Error de escaneo de fila: %v"}`, err), http.StatusInternalServerError)
				return
			}

			if parentIDVal.Valid {
				pid := parentIDVal.Int64
				item.ParentID = &pid
			}
			if ratingVal.Valid {
				rVal := int(ratingVal.Int64)
				item.Rating = &rVal
			}

			t, err := time.Parse("2006-01-02 15:04:05", createdAtStr)
			if err != nil {
				t, _ = time.Parse(time.RFC3339, createdAtStr)
			}
			item.CreatedAt = t
			item.Replies = []CommentItem{}

			allComments = append(allComments, item)
		}

		// Construir árbol de comentarios anidados (Padres y Respuestas)
		rootComments := []CommentItem{}
		for i := range allComments {
			commentMap[allComments[i].ID] = &allComments[i]
		}

		for _, item := range allComments {
			if item.ParentID == nil {
				ptr := commentMap[item.ID]
				if ptr != nil {
					rootComments = append(rootComments, *ptr)
				}
			} else {
				parentPtr, exists := commentMap[*item.ParentID]
				if exists {
					parentPtr.Replies = append(parentPtr.Replies, item)
				} else {
					rootComments = append(rootComments, item)
				}
			}
		}

		// Re-sincronizar los rootComments con las respuestas añadidas en el mapa
		finalRoots := []CommentItem{}
		for _, rc := range rootComments {
			if ptr, ok := commentMap[rc.ID]; ok {
				finalRoots = append(finalRoots, *ptr)
			} else {
				finalRoots = append(finalRoots, rc)
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(finalRoots)
	}
}

// POST /api/comments
func handlePostComment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload CreateCommentPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error": "JSON inválido en la petición"}`, http.StatusBadRequest)
			return
		}

		// Validaciones de Entrada
		payload.AppName = strings.TrimSpace(payload.AppName)
		payload.EntityType = strings.TrimSpace(payload.EntityType)
		payload.EntityID = strings.TrimSpace(payload.EntityID)
		payload.Category = strings.TrimSpace(payload.Category)
		payload.CommentText = strings.TrimSpace(payload.CommentText)

		if payload.Category == "" {
			payload.Category = "review"
		}
		if payload.Status == "" {
			payload.Status = "published"
		}

		if payload.AppName == "" || payload.EntityType == "" || payload.EntityID == "" {
			http.Error(w, `{"error": "Debe especificar app_name, entity_type y entity_id"}`, http.StatusBadRequest)
			return
		}

		if payload.Category == "review" && payload.ParentID == nil {
			if payload.Rating == nil || *payload.Rating < 1 || *payload.Rating > 5 {
				http.Error(w, `{"error": "Las reseñas requieren una puntuación (rating) entre 1 y 5 estrellas"}`, http.StatusBadRequest)
				return
			}
		}

		if payload.CommentText == "" {
			http.Error(w, `{"error": "El texto del comentario no puede estar vacío"}`, http.StatusBadRequest)
			return
		}

		if payload.UserID <= 0 {
			payload.UserID = 1 // Usuario por defecto en demo
		}

		// Parameter Binding Obligatorio (Regla AGENTS.md Anti-Inyecciones)
		stmt := `INSERT INTO comm_comments (user_id, app_name, entity_type, entity_id, category, parent_id, rating, comment_text, status, created_at) 
		         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`

		var ratingParam interface{} = nil
		if payload.Rating != nil {
			ratingParam = *payload.Rating
		}

		var parentParam interface{} = nil
		if payload.ParentID != nil {
			parentParam = *payload.ParentID
		}

		res, err := db.Exec(stmt, payload.UserID, payload.AppName, payload.EntityType, payload.EntityID, payload.Category, parentParam, ratingParam, payload.CommentText, payload.Status)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Error al insertar comentario: %v"}`, err), http.StatusInternalServerError)
			return
		}

		newID, _ := res.LastInsertId()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"id":      newID,
			"message": "Comentario guardado exitosamente",
		})
	}
}

// GET /api/stats?app_name=mapa&entity_type=property&entity_id=1
func handleGetStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appName := r.URL.Query().Get("app_name")
		entityType := r.URL.Query().Get("entity_type")
		entityID := r.URL.Query().Get("entity_id")

		query := `SELECT rating, COUNT(*) FROM comm_comments WHERE category='review' AND rating IS NOT NULL`
		var args []interface{}

		if appName != "" {
			query += " AND app_name = ?"
			args = append(args, appName)
		}
		if entityType != "" {
			query += " AND entity_type = ?"
			args = append(args, entityType)
		}
		if entityID != "" {
			query += " AND entity_id = ?"
			args = append(args, entityID)
		}

		query += " GROUP BY rating"

		rows, err := db.Query(query, args...)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Error al calcular estadísticas: %v"}`, err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		distribution := map[int]int{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
		totalCount := 0
		totalSum := 0

		for rows.Next() {
			var rating, count int
			if err := rows.Scan(&rating, &count); err == nil {
				distribution[rating] = count
				totalCount += count
				totalSum += rating * count
			}
		}

		var avg float64
		if totalCount > 0 {
			avg = float64(totalSum) / float64(totalCount)
			avg, _ = strconv.ParseFloat(fmt.Sprintf("%.1f", avg), 64)
		}

		stats := CommentStats{
			AverageRating: avg,
			TotalCount:    totalCount,
			Distribution:  distribution,
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(stats)
	}
}

// POST /api/comments/status
func handleUpdateStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			ID     int64  `json:"id"`
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error": "JSON inválido"}`, http.StatusBadRequest)
			return
		}

		if payload.ID <= 0 || payload.Status == "" {
			http.Error(w, `{"error": "Debe especificar id y status"}`, http.StatusBadRequest)
			return
		}

		stmt := `UPDATE comm_comments SET status = ? WHERE id = ?`
		res, err := db.Exec(stmt, payload.Status, payload.ID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Error al actualizar estado: %v"}`, err), http.StatusInternalServerError)
			return
		}

		rowsAff, _ := res.RowsAffected()
		if rowsAff == 0 {
			http.Error(w, `{"error": "No se encontró el comentario especificado"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Estado actualizado exitosamente",
		})
	}
}
