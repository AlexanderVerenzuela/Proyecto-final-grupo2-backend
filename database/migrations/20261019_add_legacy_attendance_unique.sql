BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencia_historica_alumno_curso_fecha
    ON asistencias(alumno_id, curso_id, fecha)
    WHERE sesion_id IS NULL;

COMMIT;
