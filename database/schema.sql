-- =====================================================================
-- PROYECTO ACADÉMICO CIBERTEC: ASISTE+
-- Sistema de Control de Asistencias para Móviles I
-- Script DDL para PostgreSQL
-- =====================================================================

-- 1. Eliminar tablas previas si existen (orden de dependencias)
DROP TABLE IF EXISTS asistencias CASCADE;
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

-- 4. Tabla ASISTENCIAS
CREATE TABLE asistencias (
    id SERIAL PRIMARY KEY,
    alumno_id INT NOT NULL,
    curso_id INT NOT NULL,
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
        
    -- Restricción de negocio: valores permitidos para estado
    CONSTRAINT chk_asistencia_estado CHECK (
        UPPER(estado) IN ('PRESENTE', 'AUSENTE', 'TARDANZA')
    ),
    
    -- Restricción de unicidad: un estudiante no puede tener doble registro en el mismo curso y fecha
    CONSTRAINT uq_asistencia_alumno_curso_fecha UNIQUE (alumno_id, curso_id, fecha)
);

-- 5. Índices para optimizar búsquedas y reportes
CREATE INDEX idx_asistencias_alumno ON asistencias(alumno_id);
CREATE INDEX idx_asistencias_curso ON asistencias(curso_id);
CREATE INDEX idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX idx_asistencias_estado ON asistencias(estado);
