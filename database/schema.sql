-- =====================================================================
-- PROYECTO ACADÉMICO CIBERTEC: ASISTE+
-- Sistema de Control de Asistencias para Móviles I
-- Script DDL para PostgreSQL
-- =====================================================================

-- 1. Eliminar tablas previas si existen (orden de dependencias)
DROP TABLE IF EXISTS asistencias CASCADE;
DROP TABLE IF EXISTS sesiones_asistencia CASCADE;
DROP TABLE IF EXISTS cursos CASCADE;
DROP TABLE IF EXISTS alumnos CASCADE;

-- 2. Tabla ALUMNOS
CREATE TABLE alumnos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo VARCHAR(120) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla CURSOS
CREATE TABLE cursos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    docente VARCHAR(120) NOT NULL,
    seccion VARCHAR(20) DEFAULT 'T3BN',
    ciclo VARCHAR(20) DEFAULT 'V',
    creditos INT DEFAULT 4,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla SESIONES DE ASISTENCIA
CREATE TABLE sesiones_asistencia (
    id SERIAL PRIMARY KEY,
    curso_id INT NOT NULL,
    fecha DATE NOT NULL,
    nombre VARCHAR(100) NOT NULL DEFAULT 'Clase',
    inicio_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fin_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '3 hours'),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sesion_asistencia_curso FOREIGN KEY (curso_id)
        REFERENCES cursos(id) ON DELETE CASCADE,
    CONSTRAINT chk_sesion_asistencia_estado CHECK (estado IN ('ABIERTA', 'CERRADA')),
    CONSTRAINT chk_sesion_asistencia_horario CHECK (fin_at > inicio_at)
);

CREATE INDEX idx_sesiones_asistencia_curso_fecha
    ON sesiones_asistencia(curso_id, fecha);

-- 5. Tabla ASISTENCIAS
CREATE TABLE asistencias (
    id SERIAL PRIMARY KEY,
    alumno_id INT NOT NULL,
    curso_id INT NOT NULL,
    sesion_id INT,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL,
    observacion TEXT,
    sincronizado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricción de integridad referencial
    CONSTRAINT fk_asistencia_alumno FOREIGN KEY (alumno_id) 
        REFERENCES alumnos(id) ON DELETE CASCADE,
    CONSTRAINT fk_asistencia_curso FOREIGN KEY (curso_id) 
        REFERENCES cursos(id) ON DELETE CASCADE,
    CONSTRAINT fk_asistencia_sesion FOREIGN KEY (sesion_id)
        REFERENCES sesiones_asistencia(id) ON DELETE SET NULL,
        
    -- Restricción de negocio: valores permitidos para estado
    CONSTRAINT chk_asistencia_estado CHECK (
        UPPER(estado) IN ('PRESENTE', 'AUSENTE', 'TARDANZA')
    ),
    
    -- Una asistencia por estudiante en cada sesión; NULL conserva registros históricos.
    CONSTRAINT uq_asistencia_alumno_sesion UNIQUE (alumno_id, sesion_id)
);

-- 6. Índices para optimizar búsquedas y reportes
CREATE INDEX idx_asistencias_alumno ON asistencias(alumno_id);
CREATE INDEX idx_asistencias_curso ON asistencias(curso_id);
CREATE INDEX idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX idx_asistencias_estado ON asistencias(estado);
