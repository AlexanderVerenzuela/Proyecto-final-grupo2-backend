const express = require('express');
const router = express.Router();
const db = require('../db');

const MAX_POSTGRES_INT = 2147483647;

const esObjeto = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizarId = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[0-9]+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_POSTGRES_INT ? id : null;
};

const esFechaValida = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const esObservacionValida = (value) => value === undefined || value === null || typeof value === 'string';

// Función auxiliar para normalizar estado
const normalizarEstado = (estado) => {
  if (typeof estado !== 'string') return null;
  const upper = estado.trim().toUpperCase();
  if (['PRESENTE', 'AUSENTE', 'TARDANZA'].includes(upper)) {
    return upper;
  }
  return null;
};

// GET /api/asistencias - Consultar asistencias con filtros
router.get('/', async (req, res) => {
  try {
    const { curso_id, alumno_id, fecha, estado, q } = req.query;
    const cursoId = curso_id === undefined ? null : normalizarId(curso_id);
    const alumnoId = alumno_id === undefined ? null : normalizarId(alumno_id);

    if ((curso_id !== undefined && cursoId === null) ||
        (alumno_id !== undefined && alumnoId === null)) {
      return res.status(400).json({ success: false, message: 'curso_id y alumno_id deben ser enteros positivos válidos' });
    }
    if (fecha !== undefined && !esFechaValida(fecha)) {
      return res.status(400).json({ success: false, message: 'fecha debe tener formato YYYY-MM-DD y ser una fecha válida' });
    }
    if (estado !== undefined && !normalizarEstado(estado)) {
      return res.status(400).json({ success: false, message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA' });
    }

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

    if (curso_id !== undefined) {
      params.push(cursoId);
      query += ` AND a.curso_id = $${params.length}`;
    }

    if (alumno_id !== undefined) {
      params.push(alumnoId);
      query += ` AND a.alumno_id = $${params.length}`;
    }

    if (fecha !== undefined) {
      params.push(fecha);
      query += ` AND a.fecha = $${params.length}::DATE`;
    }

    if (estado !== undefined) {
      const norm = normalizarEstado(estado);
      params.push(norm);
      query += ` AND a.estado = $${params.length}`;
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
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, message: 'El identificador de asistencia debe ser un entero positivo válido' });
    }
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
    if (!esObjeto(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'El cuerpo de la solicitud debe ser un objeto JSON',
      });
    }

    const { alumno_id, curso_id, fecha, estado, observacion } = req.body;
    const alumnoId = normalizarId(alumno_id);
    const cursoId = normalizarId(curso_id);
    if (alumnoId === null || cursoId === null || !esFechaValida(fecha) || estado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'alumno_id, curso_id, fecha y estado son obligatorios y deben tener un formato válido',
      });
    }
    if (!esObservacionValida(observacion)) {
      return res.status(400).json({ success: false, message: 'observacion debe ser una cadena de texto o null' });
    }

    const estadoNorm = normalizarEstado(estado);
    if (!estadoNorm) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA',
      });
    }

    // Validar que el alumno existe
    const alumnoCheck = await db.query('SELECT id, nombres, apellidos FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumnoCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'El alumno especificado no existe' });
    }

    // Validar que el curso existe
    const cursoCheck = await db.query('SELECT id, nombre FROM cursos WHERE id = $1', [cursoId]);
    if (cursoCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'El curso especificado no existe' });
    }

    // Verificar si ya existe asistencia para esa fecha y sesión
    const duplicate = await db.query(
      'SELECT id FROM asistencias WHERE alumno_id = $1 AND curso_id = $2 AND fecha = $3::DATE',
      [alumnoId, cursoId, fecha]
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
      [alumnoId, cursoId, fecha, estadoNorm, typeof observacion === 'string' ? observacion.trim() : null]
    );

    res.status(201).json({
      success: true,
      message: 'Asistencia registrada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un registro de asistencia para este alumno en este curso y fecha',
      });
    }
    if (error.code === '23503') {
      return res.status(404).json({ success: false, message: 'El alumno o curso especificado no existe' });
    }
    res.status(500).json({ success: false, message: 'Error interno al registrar asistencia' });
  }
});

// PUT /api/asistencias/:id - Modificar asistencia
router.put('/:id', async (req, res) => {
  try {
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, message: 'El identificador de asistencia debe ser un entero positivo válido' });
    }
    if (!esObjeto(req.body)) {
      return res.status(400).json({ success: false, message: 'El cuerpo de la solicitud debe ser un objeto JSON' });
    }
    const { estado, observacion, fecha } = req.body;
    if (estado === undefined && observacion === undefined && fecha === undefined) {
      return res.status(400).json({ success: false, message: 'Debe proporcionar estado, observacion o fecha para actualizar' });
    }
    if (estado !== undefined && !normalizarEstado(estado)) {
      return res.status(400).json({ success: false, message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA' });
    }
    if (fecha !== undefined && !esFechaValida(fecha)) {
      return res.status(400).json({ success: false, message: 'fecha debe tener formato YYYY-MM-DD y ser una fecha válida' });
    }
    if (observacion !== undefined && !esObservacionValida(observacion)) {
      return res.status(400).json({ success: false, message: 'observacion debe ser una cadena de texto o null' });
    }

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

    const fechaNueva = fecha !== undefined ? fecha : current.fecha;

    // Si cambió la fecha, validar unicidad
    if (fecha !== undefined && fecha !== current.fecha) {
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
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe un registro para esa nueva fecha' });
    }
    if (error.code === '23503') {
      return res.status(404).json({ success: false, message: 'El alumno o curso especificado no existe' });
    }
    res.status(500).json({ success: false, message: 'Error al modificar asistencia' });
  }
});

// DELETE /api/asistencias/:id - Eliminar asistencia
router.delete('/:id', async (req, res) => {
  try {
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, message: 'El identificador de asistencia debe ser un entero positivo válido' });
    }
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
    const items = esObjeto(req.body) ? req.body.items : undefined;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un arreglo "items" con las asistencias a sincronizar',
      });
    }

    const resultados = [];

    for (const item of items) {
      const local_id = esObjeto(item) ? item.local_id : undefined;
      if (!esObjeto(item)) {
        resultados.push({
          local_id,
          success: false,
          message: 'Cada elemento debe ser un objeto JSON válido',
        });
        continue;
      }

      const { alumno_id, curso_id, fecha, estado, observacion } = item;
      const alumnoId = normalizarId(alumno_id);
      const cursoId = normalizarId(curso_id);
      const estadoNorm = normalizarEstado(estado);
      const validLocalId = typeof local_id === 'number' &&
        Number.isSafeInteger(local_id) && local_id > 0;

      if (!validLocalId || alumnoId === null || cursoId === null ||
          !esFechaValida(fecha) || !estadoNorm || !esObservacionValida(observacion)) {
        resultados.push({
          local_id,
          success: false,
          message: 'Datos incompletos o inválidos',
        });
        continue;
      }

      try {
        const alumnoCheck = await db.query('SELECT id FROM alumnos WHERE id = $1', [alumnoId]);
        if (alumnoCheck.rows.length === 0) {
          resultados.push({ local_id, success: false, message: 'El alumno especificado no existe' });
          continue;
        }
        const cursoCheck = await db.query('SELECT id FROM cursos WHERE id = $1', [cursoId]);
        if (cursoCheck.rows.length === 0) {
          resultados.push({ local_id, success: false, message: 'El curso especificado no existe' });
          continue;
        }

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
          alumnoId,
          cursoId,
          fecha,
          estadoNorm,
          typeof observacion === 'string' ? observacion : null,
        ]);

        resultados.push({
          local_id,
          remoto_id: resUpsert.rows[0].id,
          fecha: resUpsert.rows[0].fecha,
          success: true,
          message: 'Sincronizado correctamente',
        });
      } catch (err) {
        console.error('Error al sincronizar asistencia:', err);
        resultados.push({
          local_id,
          success: false,
          message: err.code === '23503'
            ? 'El alumno o curso especificado no existe'
            : err.code === '23505'
              ? 'Conflicto al sincronizar la asistencia'
              : 'Error interno al sincronizar la asistencia',
        });
      }
    }

    const sincronizadosOk = resultados.filter((r) => r.success).length;

    res.json({
      success: sincronizadosOk === items.length,
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
