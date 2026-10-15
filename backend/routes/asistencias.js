const express = require('express');
const router = express.Router();
const db = require('../db');

// Función auxiliar para normalizar estado
const normalizarEstado = (estado) => {
  if (!estado) return null;
  const upper = estado.toString().trim().toUpperCase();
  if (['PRESENTE', 'AUSENTE', 'TARDANZA'].includes(upper)) {
    return upper;
  }
  return null;
};

// GET /api/asistencias - Consultar asistencias con filtros
router.get('/', async (req, res) => {
  try {
    const { curso_id, alumno_id, fecha, estado, q } = req.query;

    let query = `
      SELECT 
        a.id,
        a.alumno_id,
        al.codigo AS alumno_codigo,
        al.nombres AS alumno_nombres,
        al.apellidos AS alumno_apellidos,
        (al.apellidos || ', ' || al.nombres) AS alumno_nombre_completo,
        al.correo AS alumno_correo,
        a.curso_id,
        c.codigo AS curso_codigo,
        c.nombre AS curso_nombre,
        c.docente AS curso_docente,
        TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
        a.estado,
        a.observacion,
        a.sincronizado,
        a.created_at,
        a.updated_at
      FROM asistencias a
      INNER JOIN alumnos al ON a.alumno_id = al.id
      INNER JOIN cursos c ON a.curso_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (curso_id) {
      params.push(parseInt(curso_id, 10));
      query += ` AND a.curso_id = $${params.length}`;
    }

    if (alumno_id) {
      params.push(parseInt(alumno_id, 10));
      query += ` AND a.alumno_id = $${params.length}`;
    }

    if (fecha) {
      params.push(fecha.trim());
      query += ` AND a.fecha = $${params.length}::DATE`;
    }

    if (estado) {
      const norm = normalizarEstado(estado);
      if (norm) {
        params.push(norm);
        query += ` AND a.estado = $${params.length}`;
      }
    }

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (al.nombres ILIKE $${params.length} OR al.apellidos ILIKE $${params.length} OR al.codigo ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;
    }

    query += ' ORDER BY a.fecha DESC, c.nombre ASC, al.apellidos ASC';
    const result = await db.query(query, params);

    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al consultar asistencias:', error);
    res.status(500).json({ success: false, message: 'Error interno al consultar asistencias' });
  }
});

// GET /api/asistencias/:id - Obtener asistencia por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        a.id,
        a.alumno_id,
        al.codigo AS alumno_codigo,
        al.nombres AS alumno_nombres,
        al.apellidos AS alumno_apellidos,
        (al.apellidos || ', ' || al.nombres) AS alumno_nombre_completo,
        a.curso_id,
        c.codigo AS curso_codigo,
        c.nombre AS curso_nombre,
        TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
        a.estado,
        a.observacion,
        a.sincronizado,
        a.created_at
      FROM asistencias a
      INNER JOIN alumnos al ON a.alumno_id = al.id
      INNER JOIN cursos c ON a.curso_id = c.id
      WHERE a.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Asistencia no encontrada' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener asistencia:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// POST /api/asistencias - Registrar una asistencia
router.post('/', async (req, res) => {
  try {
    const { alumno_id, curso_id, fecha, estado, observacion } = req.body;

    if (!alumno_id || !curso_id || !fecha || !estado) {
      return res.status(400).json({
        success: false,
        message: 'alumno_id, curso_id, fecha y estado son campos obligatorios',
      });
    }

    const estadoNorm = normalizarEstado(estado);
    if (!estadoNorm) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA',
      });
    }

    // Validar que el alumno existe
    const alumnoCheck = await db.query('SELECT id, nombres, apellidos FROM alumnos WHERE id = $1', [alumno_id]);
    if (alumnoCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'El alumno especificado no existe' });
    }

    // Validar que el curso existe
    const cursoCheck = await db.query('SELECT id, nombre FROM cursos WHERE id = $1', [curso_id]);
    if (cursoCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'El curso especificado no existe' });
    }

    // Verificar si ya existe asistencia para esa fecha y sesión
    const duplicate = await db.query(
      'SELECT id FROM asistencias WHERE alumno_id = $1 AND curso_id = $2 AND fecha = $3::DATE',
      [alumno_id, curso_id, fecha]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un registro de asistencia para este alumno en este curso y fecha',
        existente_id: duplicate.rows[0].id,
      });
    }

    const result = await db.query(
      `INSERT INTO asistencias (alumno_id, curso_id, fecha, estado, observacion, sincronizado)
       VALUES ($1, $2, $3::DATE, $4, $5, TRUE)
       RETURNING id, alumno_id, curso_id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, estado, observacion, sincronizado, created_at`,
      [alumno_id, curso_id, fecha, estadoNorm, observacion ? observacion.trim() : null]
    );

    res.status(201).json({
      success: true,
      message: 'Asistencia registrada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar asistencia' });
  }
});

// PUT /api/asistencias/:id - Modificar asistencia
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observacion, fecha } = req.body;

    const check = await db.query('SELECT * FROM asistencias WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro de asistencia no encontrado' });
    }

    const current = check.rows[0];
    let estadoNorm = current.estado;
    if (estado !== undefined) {
      estadoNorm = normalizarEstado(estado);
      if (!estadoNorm) {
        return res.status(400).json({
          success: false,
          message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA',
        });
      }
    }

    const fechaNueva = fecha ? fecha : current.fecha;

    // Si cambió la fecha, validar unicidad
    if (fecha && fecha !== current.fecha) {
      const dup = await db.query(
        'SELECT id FROM asistencias WHERE alumno_id = $1 AND curso_id = $2 AND fecha = $3::DATE AND id <> $4',
        [current.alumno_id, current.curso_id, fechaNueva, id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un registro para esa nueva fecha',
        });
      }
    }

    const result = await db.query(
      `UPDATE asistencias
       SET estado = $1, observacion = $2, fecha = $3::DATE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, alumno_id, curso_id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, estado, observacion, updated_at`,
      [estadoNorm, observacion !== undefined ? observacion : current.observacion, fechaNueva, id]
    );

    res.json({
      success: true,
      message: 'Asistencia modificada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al modificar asistencia:', error);
    res.status(500).json({ success: false, message: 'Error al modificar asistencia' });
  }
});

// DELETE /api/asistencias/:id - Eliminar asistencia
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM asistencias WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Asistencia no encontrada' });
    }

    await db.query('DELETE FROM asistencias WHERE id = $1', [id]);
    res.json({
      success: true,
      message: 'Asistencia eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar asistencia:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar asistencia' });
  }
});

// POST /api/asistencias/sincronizar - Sincronización masiva desde app móvil
router.post('/sincronizar', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un arreglo "items" con las asistencias a sincronizar',
      });
    }

    const resultados = [];

    for (const item of items) {
      const { local_id, alumno_id, curso_id, fecha, estado, observacion } = item;
      const estadoNorm = normalizarEstado(estado);

      if (!alumno_id || !curso_id || !fecha || !estadoNorm) {
        resultados.push({
          local_id,
          success: false,
          message: 'Datos incompletos o estado inválido',
        });
        continue;
      }

      try {
        // UPSERT usando ON CONFLICT
        const upsertQuery = `
          INSERT INTO asistencias (alumno_id, curso_id, fecha, estado, observacion, sincronizado)
          VALUES ($1, $2, $3::DATE, $4, $5, TRUE)
          ON CONFLICT (alumno_id, curso_id, fecha)
          DO UPDATE SET 
            estado = EXCLUDED.estado,
            observacion = EXCLUDED.observacion,
            sincronizado = TRUE,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha;
        `;
        const resUpsert = await db.query(upsertQuery, [
          alumno_id,
          curso_id,
          fecha,
          estadoNorm,
          observacion || null,
        ]);

        resultados.push({
          local_id,
          remoto_id: resUpsert.rows[0].id,
          fecha: resUpsert.rows[0].fecha,
          success: true,
          message: 'Sincronizado correctamente',
        });
      } catch (err) {
        console.error('Error al sincronizar item:', item, err);
        resultados.push({
          local_id,
          success: false,
          message: err.message || 'Error en inserción',
        });
      }
    }

    const sincronizadosOk = resultados.filter((r) => r.success).length;

    res.json({
      success: true,
      total_procesados: items.length,
      total_sincronizados: sincronizadosOk,
      items: resultados,
    });
  } catch (error) {
    console.error('Error general en sincronización:', error);
    res.status(500).json({ success: false, message: 'Error interno en sincronización' });
  }
});

module.exports = router;
