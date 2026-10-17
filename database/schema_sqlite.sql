-- =====================================================================
-- PROYECTO ACADÉMICO CIBERTEC: ASISTE+
-- Esquema SQLite Local (para Android SQLiteOpenHelper y almacenamiento local)
-- =====================================================================

DROP TABLE IF EXISTS asistencias;
DROP TABLE IF EXISTS cursos;
DROP TABLE IF EXISTS alumnos;

-- =====================================================================
-- TABLA CURSOS
-- =====================================================================

CREATE TABLE cursos (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    docente TEXT NOT NULL,
    seccion TEXT,
    ciclo TEXT,
    creditos INTEGER
);

-- =====================================================================
-- TABLA ALUMNOS
-- =====================================================================

CREATE TABLE alumnos (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    correo TEXT,
    telefono TEXT
);

-- =====================================================================
-- TABLA ASISTENCIAS
-- =====================================================================

CREATE TABLE asistencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remoto_id INTEGER,
    alumno_id INTEGER NOT NULL,
    alumno_codigo TEXT,
    alumno_nombre TEXT NOT NULL,
    curso_id INTEGER NOT NULL,
    curso_codigo TEXT,
    curso_nombre TEXT NOT NULL,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL,
    observacion TEXT,
    sincronizado INTEGER DEFAULT 0,
    fecha_registro TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(alumno_id, curso_id, fecha)
);
