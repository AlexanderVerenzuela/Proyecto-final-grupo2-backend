const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/estadisticas - Obtener resumen y estadísticas globales
router.get('/', async (req, res) => {
  try {
    // 1. Conteo de alumnos
    const alumnosRes = await db.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE activo = TRUE) AS activos FROM alumnos');
    
    // 2. Conteo de cursos
    const cursosRes = await db.query('SELECT COUNT(*) AS total FROM cursos');

    // 3. Conteo de asistencias y estados
    const asistenciasRes = await db.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE UPPER(estado) = 'PRESENTE') AS presentes,
        COUNT(*) FILTER (WHERE UPPER(estado) = 'AUSENTE') AS ausentes,
        COUNT(*) FILTER (WHERE UPPER(estado) = 'TARDANZA') AS tardanzas
      FROM asistencias
    `);

    // 4. Asistencias por curso
    const porCursoRes = await db.query(`
      SELECT 
        c.id AS curso_id,
        c.nombre AS curso_nombre,
        c.codigo AS curso_codigo,
        COUNT(a.id) AS total_asistencias,
        COUNT(a.id) FILTER (WHERE UPPER(a.estado) = 'PRESENTE') AS presentes,
        COUNT(a.id) FILTER (WHERE UPPER(a.estado) = 'AUSENTE') AS ausentes,
        COUNT(a.id) FILTER (WHERE UPPER(a.estado) = 'TARDANZA') AS tardanzas
      FROM cursos c
      LEFT JOIN asistencias a ON c.id = a.curso_id
      GROUP BY c.id, c.nombre, c.codigo
      ORDER BY c.nombre ASC
    `);

    const asistenciasData = asistenciasRes.rows[0];
    const totalAsistencias = parseInt(asistenciasData.total || '0', 10);
    const presentes = parseInt(asistenciasData.presentes || '0', 10);
    const ausentes = parseInt(asistenciasData.ausentes || '0', 10);
    const tardanzas = parseInt(asistenciasData.tardanzas || '0', 10);

    const porcentajeAsistencia = totalAsistencias > 0
      ? Math.round(((presentes + tardanzas) / totalAsistencias) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        alumnos: {
          total: parseInt(alumnosRes.rows[0].total || '0', 10),
          activos: parseInt(alumnosRes.rows[0].activos || '0', 10),
        },
        cursos: {
          total: parseInt(cursosRes.rows[0].total || '0', 10),
        },
        asistencias: {
          total: totalAsistencias,
          presentes,
          ausentes,
          tardanzas,
          porcentaje_asistencia: porcentajeAsistencia,
        },
        por_curso: porCursoRes.rows,
      },
    });
  } catch (error) {
    console.error('Error al generar estadísticas:', error);
    res.status(500).json({ success: false, message: 'Error al generar estadísticas' });
  }
});

module.exports = router;
