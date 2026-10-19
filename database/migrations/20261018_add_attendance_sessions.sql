BEGIN;

CREATE TABLE IF NOT EXISTS sesiones_asistencia (
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

CREATE INDEX IF NOT EXISTS idx_sesiones_asistencia_curso_fecha
    ON sesiones_asistencia(curso_id, fecha);

ALTER TABLE asistencias
    ADD COLUMN IF NOT EXISTS sesion_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_asistencia_sesion'
          AND conrelid = 'asistencias'::regclass
    ) THEN
        ALTER TABLE asistencias
            ADD CONSTRAINT fk_asistencia_sesion
            FOREIGN KEY (sesion_id)
            REFERENCES sesiones_asistencia(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

ALTER TABLE asistencias
    DROP CONSTRAINT IF EXISTS uq_asistencia_alumno_curso_fecha;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencia_alumno_sesion
    ON asistencias(alumno_id, sesion_id);

COMMIT;
