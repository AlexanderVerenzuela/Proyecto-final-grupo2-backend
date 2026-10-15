-- =====================================================================
-- PROYECTO ACADÉMICO CIBERTEC: ASISTE+
-- Datos de prueba iniciales (Seeds)
-- =====================================================================

-- 1. Inserción de Cursos de la carrera de Computación e Informática
INSERT INTO cursos (codigo, nombre, docente, seccion, ciclo, creditos) VALUES
('DAM-501', 'Desarrollo de Aplicaciones Móviles I', 'Mg. Carlos Mendoza Paredes', 'T5BN', 'V', 4),
('DSW-502', 'Desarrollo de Servicios Web I', 'Ing. Patricia Villanueva Flores', 'T5BN', 'V', 4),
('BDA-503', 'Base de Datos Avanzado', 'Lic. Roberto Gómez Salazar', 'T5BN', 'V', 3),
('GES-504', 'Gestión de Proyectos de Software', 'Dra. Elena Ruiz Castillo', 'T5BN', 'V', 3);

-- 2. Inserción de Alumnos de prueba
INSERT INTO alumnos (codigo, nombres, apellidos, correo, telefono) VALUES
('I20231001', 'Alexander', 'Verenzuela López', 'alexander.verenzuela@cibertec.edu.pe', '987654321'),
('I20231002', 'María Fernanda', 'Quispe Ramos', 'maria.quispe@cibertec.edu.pe', '987112233'),
('I20231003', 'Juan Carlos', 'Torres Benítez', 'juan.torres@cibertec.edu.pe', '987223344'),
('I20231004', 'Lucía Andrea', 'Chávez Huamán', 'lucia.chavez@cibertec.edu.pe', '987334455'),
('I20231005', 'Diego Alonso', 'Morales Vega', 'diego.morales@cibertec.edu.pe', '987445566'),
('I20231006', 'Valeria Nicole', 'Sánchez Castro', 'valeria.sanchez@cibertec.edu.pe', '987556677'),
('I20231007', 'Mateo Sebastián', 'Flores Cárdenas', 'mateo.flores@cibertec.edu.pe', '987667788'),
('I20231008', 'Camila Belén', 'Reyes Medina', 'camila.reyes@cibertec.edu.pe', '987778899');

-- 3. Inserción de Asistencias para demostración (Sesiones recientes)
INSERT INTO asistencias (alumno_id, curso_id, fecha, estado, observacion) VALUES
(1, 1, '2026-10-10', 'PRESENTE', 'Participó activamente en la sesión práctica'),
(2, 1, '2026-10-10', 'PRESENTE', 'Puntual'),
(3, 1, '2026-10-10', 'TARDANZA', 'Ingresó 15 minutos tarde por inconvenientes de transporte'),
(4, 1, '2026-10-10', 'AUSENTE', 'Falta justificada con receta médica'),
(5, 1, '2026-10-10', 'PRESENTE', 'Entrega de laboratorio 1'),
(6, 1, '2026-10-10', 'PRESENTE', 'Puntual'),
(7, 1, '2026-10-10', 'TARDANZA', 'Demora en conexión'),
(8, 1, '2026-10-10', 'AUSENTE', 'Sin justificación'),

(1, 2, '2026-10-11', 'PRESENTE', 'Presentó avance de API REST'),
(2, 2, '2026-10-11', 'PRESENTE', 'Puntual'),
(3, 2, '2026-10-11', 'AUSENTE', 'No asistió a la sesión teórica'),
(4, 2, '2026-10-11', 'PRESENTE', 'Puntual'),
(5, 2, '2026-10-11', 'TARDANZA', 'Tardanza de 10 minutos'),

(1, 1, '2026-10-14', 'PRESENTE', 'Asistencia registrada desde app móvil'),
(2, 1, '2026-10-14', 'PRESENTE', 'Asistencia registrada desde app móvil'),
(3, 1, '2026-10-14', 'TARDANZA', 'Llegó durante la explicación del ejercicio'),
(5, 1, '2026-10-14', 'PRESENTE', 'Puntual');
