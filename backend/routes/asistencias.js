const express = require('express');
const router = express.Router();
const db = require('../db');

const MAX_POSTGRES_INT = 2147483647;

const esObjeto = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizarId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[0-9]+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_POSTGRES_INT ? id : null;
}

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (anio < 1 || mes < 1 || mes > 12) return false;

  const diasPorMes = [31, anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia >= 1 && dia <= diasPorMes[mes - 1];
}

function fechaRegistroValida(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/i.test(value) ||
    !fechaValida(value.slice(0, 10))
  ) {
    return null;
  }

  const fechaDate = new Date(value.replace(' ', 'T'));
  return Number.isNaN(fechaDate.getTime()) ? null : fechaDate;
}

function normalizarEstado(estado) {
  if (typeof estado !== 'string') return null;

  const upper = estado.trim().toUpperCase();
  return ['PRESENTE', 'AUSENTE', 'TARDANZA'].includes(upper) ? upper : null;
}

function fechaDeBaseDeDatos(fecha) {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return typeof fecha === 'string' ? fecha.slice(0, 10) : '';
}

// Comprueba el ID, el curso, la fecha y el período exacto de la sesión.
async function comprobarSesionActiva(sesionId, cursoId, fecha) {
  const sesionIdNorm = normalizarId(sesionId);
  const cursoIdNorm = normalizarId(cursoId);
  if (sesionIdNorm === null || cursoIdNorm === null || !fechaValida(fecha)) return false;

  const resultado = await db.query(
    `SELECT id
     FROM sesiones_asistencia
     WHERE id = $1
       AND curso_id = $2
       AND fecha = $3::DATE
       AND estado = 'ABIERTA'
       AND inicio_at <= CURRENT_TIMESTAMP
       AND fin_at > CURRENT_TIMESTAMP`,
    [sesionIdNorm, cursoIdNorm, fecha]
  );

  return resultado.rowCount > 0;
}

// GET /api/asistencias
// Consulta asistencias con filtros por curso, alumno, fecha, estado o sesión.
router.get('/', async (req, res) => {
  try {
    const { curso_id, alumno_id, fecha, estado, q, sesion_id } = req.query;
    const cursoId = curso_id === undefined ? null : normalizarId(curso_id);
    const alumnoId = alumno_id === undefined ? null : normalizarId(alumno_id);
    const sesionId = sesion_id === undefined ? null : normalizarId(sesion_id);

    if ((curso_id !== undefined && cursoId === null) ||
        (alumno_id !== undefined && alumnoId === null) ||
        (sesion_id !== undefined && sesionId === null)) {
      return res.status(400).json({
        success: false,
        message: 'curso_id, alumno_id y sesion_id deben ser enteros positivos válidos'
      });
    }
    if (fecha !== undefined && !fechaValida(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha debe tener formato YYYY-MM-DD y ser válida'
      });
    }
    if (estado !== undefined && !normalizarEstado(estado)) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
      });
    }
    if (q !== undefined && typeof q !== 'string') {
      return res.status(400).json({ success: false, message: 'q debe ser texto' });
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
        a.sesion_id,
        s.nombre AS sesion_nombre,
        TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
        a.estado,
        a.observacion,
        a.sincronizado,
        a.created_at,
        a.updated_at
      FROM asistencias a
      INNER JOIN alumnos al ON a.alumno_id = al.id
      INNER JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN sesiones_asistencia s ON a.sesion_id = s.id
      WHERE 1 = 1
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
      params.push(normalizarEstado(estado));
      query += ` AND a.estado = $${params.length}`;
    }
    if (sesion_id !== undefined) {
      params.push(sesionId);
      query += ` AND a.sesion_id = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (
        al.nombres ILIKE $${params.length}
        OR al.apellidos ILIKE $${params.length}
        OR al.codigo ILIKE $${params.length}
        OR c.nombre ILIKE $${params.length}
      )`;
    }

    query += ' ORDER BY a.fecha DESC, c.nombre ASC, al.apellidos ASC';
    const result = await db.query(query, params);
    return res.json({ success: true, total: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error al consultar asistencias:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar asistencias'
    });
  }
});

// GET /api/asistencias/:id
// Obtiene una asistencia por su ID.
router.get('/:id', async (req, res) => {
  try {
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        success: false,
        message: 'El identificador de asistencia no es válido'
      });
    }

    const result = await db.query(
      `SELECT
         a.id,
         a.alumno_id,
         al.codigo AS alumno_codigo,
         al.nombres AS alumno_nombres,
         al.apellidos AS alumno_apellidos,
         (al.apellidos || ', ' || al.nombres) AS alumno_nombre_completo,
         a.curso_id,
         c.codigo AS curso_codigo,
         c.nombre AS curso_nombre,
         a.sesion_id,
         s.nombre AS sesion_nombre,
         TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
         a.estado,
         a.observacion,
         a.sincronizado,
         a.created_at,
         a.updated_at
       FROM asistencias a
       INNER JOIN alumnos al ON a.alumno_id = al.id
       INNER JOIN cursos c ON a.curso_id = c.id
       LEFT JOIN sesiones_asistencia s ON a.sesion_id = s.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Asistencia no encontrada' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener asistencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/asistencias
// Registra una asistencia vinculada a una sesión concreta.
router.post('/', async (req, res) => {
  try {
    if (!esObjeto(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'El cuerpo de la solicitud debe ser un objeto JSON'
      });
    }

    const { alumno_id, curso_id, sesion_id, fecha, estado, observacion } = req.body;
    const alumnoId = normalizarId(alumno_id);
    const cursoId = normalizarId(curso_id);
    const sesionId = normalizarId(sesion_id);

    if (alumnoId === null || cursoId === null || sesionId === null ||
        !fechaValida(fecha) || estado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'alumno_id, curso_id, sesion_id, fecha válida y estado son obligatorios'
      });
    }
    if (observacion !== undefined && observacion !== null && typeof observacion !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'La observación debe ser texto o null'
      });
    }

    const estadoNorm = normalizarEstado(estado);
    if (!estadoNorm) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
      });
    }

    const alumnoCheck = await db.query('SELECT id FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumnoCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El alumno especificado no existe'
      });
    }

    const cursoCheck = await db.query('SELECT id FROM cursos WHERE id = $1', [cursoId]);
    if (cursoCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El curso especificado no existe'
      });
    }

    const sesionActiva = await comprobarSesionActiva(sesionId, cursoId, fecha);
    if (!sesionActiva) {
      return res.status(403).json({
        success: false,
        message: 'No se puede registrar la asistencia: la sesión no existe, no corresponde al curso y fecha o está cerrada o vencida.'
      });
    }

    const result = await db.query(
      `INSERT INTO asistencias
         (alumno_id, curso_id, sesion_id, fecha, estado, observacion, sincronizado)
       VALUES ($1, $2, $3, $4::DATE, $5, $6, TRUE)
       ON CONFLICT (alumno_id, sesion_id) DO NOTHING
       RETURNING
         id, alumno_id, curso_id, sesion_id,
         TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
         estado, observacion, sincronizado, created_at`,
      [
        alumnoId,
        cursoId,
        sesionId,
        fecha,
        estadoNorm,
        typeof observacion === 'string' ? observacion.trim() || null : null
      ]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'Este alumno ya tiene una asistencia registrada en esta sesión.'
      });
    }
    return res.status(201).json({
      success: true,
      message: 'Asistencia registrada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Este alumno ya tiene una asistencia registrada en esta sesión.'
      });
    }
    if (error.code === '23503') {
      return res.status(404).json({
        success: false,
        message: 'El alumno, curso o sesión especificado no existe'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar asistencia'
    });
  }
});

// PUT /api/asistencias/:id
// Solo modifica registros vinculados a una sesión que continúa activa.
router.put('/:id', async (req, res) => {
  try {
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        success: false,
        message: 'El identificador de asistencia no es válido'
      });
    }
    if (!esObjeto(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'El cuerpo de la solicitud debe ser un objeto JSON'
      });
    }

    const { estado, observacion, fecha } = req.body;
    if (estado === undefined && observacion === undefined && fecha === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar estado, observacion o fecha para actualizar'
      });
    }
    if (estado !== undefined && !normalizarEstado(estado)) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
      });
    }
    if (fecha !== undefined && !fechaValida(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha debe tener formato YYYY-MM-DD y ser válida'
      });
    }
    if (observacion !== undefined && observacion !== null && typeof observacion !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'La observación debe ser texto o null'
      });
    }

    const check = await db.query('SELECT * FROM asistencias WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de asistencia no encontrado'
      });
    }

    const current = check.rows[0];
    const fechaActual = fechaDeBaseDeDatos(current.fecha);
    if (fecha !== undefined && fecha !== fechaActual) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cambiar la fecha de una asistencia.'
      });
    }
    if (current.sesion_id === null) {
      return res.status(403).json({
        success: false,
        message: 'Esta asistencia histórica no tiene una sesión asignada y no se puede modificar.'
      });
    }

    const sesionActiva = await comprobarSesionActiva(
      current.sesion_id,
      current.curso_id,
      fechaActual
    );
    if (!sesionActiva) {
      return res.status(403).json({
        success: false,
        message: 'No se puede modificar la asistencia: la sesión está cerrada o vencida.'
      });
    }

    const estadoNorm = estado === undefined ? current.estado : normalizarEstado(estado);
    const observacionNueva = observacion === undefined
      ? current.observacion
      : typeof observacion === 'string'
        ? observacion.trim() || null
        : null;

    const result = await db.query(
      `UPDATE asistencias
       SET estado = $1,
           observacion = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING
         id, alumno_id, curso_id, sesion_id,
         TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
         estado, observacion, updated_at`,
      [estadoNorm, observacionNueva, id]
    );

    return res.json({
      success: true,
      message: 'Asistencia modificada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al modificar asistencia:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Conflicto al modificar la asistencia'
      });
    }
    if (error.code === '23503') {
      return res.status(404).json({
        success: false,
        message: 'El alumno, curso o sesión especificado no existe'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al modificar asistencia'
    });
  }
});

// DELETE /api/asistencias/:id
// Solo permite eliminar asistencias de una sesión activa.
router.delete('/:id', async (req, res) => {
  try {
    const id = normalizarId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        success: false,
        message: 'El identificador de asistencia no es válido'
      });
    }

    const check = await db.query(
      'SELECT id, curso_id, sesion_id, fecha FROM asistencias WHERE id = $1',
      [id]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asistencia no encontrada'
      });
    }

    const asistencia = check.rows[0];
    if (asistencia.sesion_id === null) {
      return res.status(403).json({
        success: false,
        message: 'Esta asistencia histórica no tiene una sesión asignada y no se puede eliminar.'
      });
    }

    const sesionActiva = await comprobarSesionActiva(
      asistencia.sesion_id,
      asistencia.curso_id,
      fechaDeBaseDeDatos(asistencia.fecha)
    );
    if (!sesionActiva) {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar la asistencia: la sesión está cerrada o vencida.'
      });
    }

    await db.query('DELETE FROM asistencias WHERE id = $1', [id]);
    return res.json({
      success: true,
      message: 'Asistencia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar asistencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar asistencia'
    });
  }
});

// POST /api/asistencias/sincronizar
// Sincroniza registros offline sin sobrescribir asistencias distintas existentes.
router.post('/sincronizar', async (req, res) => {
  try {
    const items = esObjeto(req.body) ? req.body.items : undefined;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un arreglo "items" con las asistencias a sincronizar'
      });
    }

    const resultados = [];
    for (const item of items) {
      const local_id = esObjeto(item) && (typeof item.local_id === 'number' || typeof item.local_id === 'string')
        ? item.local_id
        : null;
      if (!esObjeto(item)) {
        resultados.push({
          local_id,
          success: false,
          message: 'Cada elemento debe ser un objeto JSON válido'
        });
        continue;
      }

      const {
        remoto_id,
        alumno_id,
        curso_id,
        sesion_id,
        fecha,
        estado,
        observacion,
        fecha_registro
      } = item;
      const alumnoId = normalizarId(alumno_id);
      const cursoId = normalizarId(curso_id);
      const sesionId = normalizarId(sesion_id);
      const localIdValido = typeof local_id === 'number' &&
        Number.isSafeInteger(local_id) && local_id > 0;
      const estadoNorm = normalizarEstado(estado);

      if (!localIdValido || alumnoId === null || cursoId === null ||
          sesionId === null || !fechaValida(fecha) || !estadoNorm ||
          (observacion !== undefined && observacion !== null && typeof observacion !== 'string')) {
        resultados.push({
          local_id,
          success: false,
          message: 'Datos incompletos o inválidos. Se requiere sesion_id y una fecha válida.'
        });
        continue;
      }

      const fechaRegistroDate = fechaRegistroValida(fecha_registro);
      if (!fechaRegistroDate) {
        resultados.push({
          local_id,
          success: false,
          message: 'Sincronización rechazada: falta una fecha y hora de registro válida.'
        });
        continue;
      }

      const remotoId = remoto_id === undefined || remoto_id === null
        ? null
        : normalizarId(remoto_id);
      if (remoto_id !== undefined && remoto_id !== null && remotoId === null) {
        resultados.push({
          local_id,
          success: false,
          message: 'El ID remoto no es válido.'
        });
        continue;
      }

      try {
        const sesionResult = await db.query(
          `SELECT id, inicio_at, fin_at
           FROM sesiones_asistencia
           WHERE id = $1
             AND curso_id = $2
             AND fecha = $3::DATE
             AND inicio_at <= $4::TIMESTAMPTZ
             AND fin_at >= $4::TIMESTAMPTZ`,
          [sesionId, cursoId, fecha, fechaRegistroDate.toISOString()]
        );
        if (sesionResult.rowCount === 0) {
          resultados.push({
            local_id,
            success: false,
            message: 'Sincronización rechazada: la hora de registro no corresponde al período de la sesión.'
          });
          continue;
        }

        const observacionNorm = typeof observacion === 'string'
          ? observacion.trim() || null
          : null;

        if (remotoId !== null) {
          const sesionActiva = await comprobarSesionActiva(sesionId, cursoId, fecha);
          if (!sesionActiva) {
            resultados.push({
              local_id,
              success: false,
              message: 'No se puede sincronizar la modificación: la sesión está cerrada o vencida.'
            });
            continue;
          }

          const actualizacion = await db.query(
            `UPDATE asistencias
             SET estado = $1,
                 observacion = $2,
                 sincronizado = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
               AND alumno_id = $4
               AND curso_id = $5
               AND sesion_id = $6
               AND fecha = $7::DATE
             RETURNING id, sesion_id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha`,
            [estadoNorm, observacionNorm, remotoId, alumnoId, cursoId, sesionId, fecha]
          );

          if (actualizacion.rowCount === 0) {
            resultados.push({
              local_id,
              success: false,
              message: 'Conflicto: el registro remoto no coincide con el alumno, curso, sesión y fecha indicados. No se modificó.'
            });
            continue;
          }

          resultados.push({
            local_id,
            remoto_id: actualizacion.rows[0].id,
            sesion_id: actualizacion.rows[0].sesion_id,
            fecha: actualizacion.rows[0].fecha,
            success: true,
            message: 'Modificación sincronizada correctamente.'
          });
          continue;
        }

        const resInsert = await db.query(
          `INSERT INTO asistencias
             (alumno_id, curso_id, sesion_id, fecha, estado, observacion, sincronizado)
           VALUES ($1, $2, $3, $4::DATE, $5, $6, TRUE)
           ON CONFLICT (alumno_id, sesion_id) DO NOTHING
           RETURNING id, sesion_id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha`,
          [alumnoId, cursoId, sesionId, fecha, estadoNorm, observacionNorm]
        );

        if (resInsert.rowCount === 0) {
          const existenteResult = await db.query(
            `SELECT id, curso_id, sesion_id,
                    TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
                    estado, observacion
             FROM asistencias
             WHERE alumno_id = $1 AND sesion_id = $2`,
            [alumnoId, sesionId]
          );
          if (existenteResult.rowCount === 0) {
            resultados.push({
              local_id,
              success: false,
              message: 'No se pudo confirmar el registro remoto.'
            });
            continue;
          }

          const existente = existenteResult.rows[0];
          const coincide = Number(existente.curso_id) === cursoId &&
            Number(existente.sesion_id) === sesionId &&
            existente.fecha === fecha &&
            existente.estado === estadoNorm &&
            (existente.observacion || null) === observacionNorm;

          resultados.push({
            local_id,
            remoto_id: existente.id,
            sesion_id: existente.sesion_id,
            fecha: existente.fecha,
            success: coincide,
            message: coincide
              ? 'La asistencia ya existía y coincide con el registro local.'
              : 'Conflicto: la asistencia remota ya existe con datos diferentes. No se sobrescribió.'
          });
          continue;
        }

        resultados.push({
          local_id,
          remoto_id: resInsert.rows[0].id,
          sesion_id: resInsert.rows[0].sesion_id,
          fecha: resInsert.rows[0].fecha,
          success: true,
          message: 'Sincronizado correctamente'
        });
      } catch (error) {
        console.error('Error al sincronizar asistencia:', error);
        resultados.push({
          local_id,
          success: false,
          message: error.code === '23503'
            ? 'El alumno, curso o sesión especificado no existe'
            : error.code === '23505'
              ? 'Conflicto al sincronizar la asistencia'
              : 'Error interno al sincronizar la asistencia'
        });
      }
    }

    const sincronizadosOk = resultados.filter((resultado) => resultado.success).length;
    return res.json({
      success: sincronizadosOk === items.length,
      total_procesados: items.length,
      total_sincronizados: sincronizadosOk,
      items: resultados
    });
  } catch (error) {
    console.error('Error general en sincronización:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en sincronización'
    });
  }
});

module.exports = router;
