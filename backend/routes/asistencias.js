
const express = require('express');
const router = express.Router();
const db = require('../db');

// Normaliza y valida el estado de una asistencia.
const normalizarEstado = (estado) => {
  if (!estado) return null;

  const upper = estado.toString().trim().toUpperCase();

  return ['PRESENTE', 'AUSENTE', 'TARDANZA'].includes(upper)
      ? upper
      : null;
};

// Valida que la fecha exista y tenga formato YYYY-MM-DD.
function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  return fechaUTC.getUTCFullYear() === anio
      && fechaUTC.getUTCMonth() === mes - 1
      && fechaUTC.getUTCDate() === dia;
}

// Comprueba la sesión EXACTA de una asistencia.
// Debe coincidir el ID, el curso, la fecha y el tiempo disponible.
async function comprobarSesionActiva(sesionId, cursoId, fecha) {
  if (
      sesionId === undefined ||
      sesionId === null ||
      !Number.isInteger(Number(sesionId)) ||
      Number(sesionId) <= 0 ||
      !Number.isInteger(Number(cursoId)) ||
      Number(cursoId) <= 0 ||
      !fechaValida(fecha)
  ) {
    return false;
  }

  const resultado = await db.query(
      `SELECT id
     FROM sesiones_asistencia
     WHERE id = $1
       AND curso_id = $2
       AND fecha = $3::DATE
       AND estado = 'ABIERTA'
       AND inicio_at <= CURRENT_TIMESTAMP
       AND fin_at > CURRENT_TIMESTAMP`,
      [Number(sesionId), Number(cursoId), fecha]
  );

  return resultado.rowCount > 0;
}

// GET /api/asistencias
// Consulta asistencias y permite filtrar por curso, alumno, fecha o estado.
router.get('/', async (req, res) => {
  try {
    const { curso_id, alumno_id, fecha, estado, q, sesion_id } = req.query;

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

    if (curso_id) {
      params.push(Number(curso_id));
      query += ` AND a.curso_id = $${params.length}`;
    }

    if (alumno_id) {
      params.push(Number(alumno_id));
      query += ` AND a.alumno_id = $${params.length}`;
    }

    if (fecha) {
      if (!fechaValida(fecha)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha debe tener formato YYYY-MM-DD y ser válida'
        });
      }

      params.push(fecha);
      query += ` AND a.fecha = $${params.length}::DATE`;
    }

    if (estado) {
      const estadoNorm = normalizarEstado(estado);

      if (!estadoNorm) {
        return res.status(400).json({
          success: false,
          message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
        });
      }

      params.push(estadoNorm);
      query += ` AND a.estado = $${params.length}`;
    }

    if (sesion_id !== undefined) {
      const sesionId = Number(sesion_id);

      if (!Number.isInteger(sesionId) || sesionId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El identificador de sesión no es válido'
        });
      }

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

    return res.json({
      success: true,
      total: result.rowCount,
      data: result.rows
    });
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
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
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
      return res.status(404).json({
        success: false,
        message: 'Asistencia no encontrada'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
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
    const {
      alumno_id,
      curso_id,
      sesion_id,
      fecha,
      estado,
      observacion
    } = req.body;

    if (
        !alumno_id ||
        !Number.isInteger(Number(alumno_id)) ||
        Number(alumno_id) <= 0 ||
        !curso_id ||
        !Number.isInteger(Number(curso_id)) ||
        Number(curso_id) <= 0 ||
        !sesion_id ||
        !Number.isInteger(Number(sesion_id)) ||
        Number(sesion_id) <= 0 ||
        !fechaValida(fecha) ||
        !estado
    ) {
      return res.status(400).json({
        success: false,
        message: 'alumno_id, curso_id, sesion_id, fecha válida y estado son obligatorios'
      });
    }

    const estadoNorm = normalizarEstado(estado);

    if (!estadoNorm) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
      });
    }

    const alumnoCheck = await db.query(
        'SELECT id FROM alumnos WHERE id = $1',
        [Number(alumno_id)]
    );

    if (alumnoCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El alumno especificado no existe'
      });
    }

    const cursoCheck = await db.query(
        'SELECT id FROM cursos WHERE id = $1',
        [Number(curso_id)]
    );

    if (cursoCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El curso especificado no existe'
      });
    }

    const sesionActiva = await comprobarSesionActiva(
        sesion_id,
        Number(curso_id),
        fecha
    );

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
          Number(alumno_id),
          Number(curso_id),
          Number(sesion_id),
          fecha,
          estadoNorm,
          observacion ? String(observacion).trim() : null
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
    const id = Number(req.params.id);
    const { estado, observacion, fecha } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El identificador de asistencia no es válido'
      });
    }

    const check = await db.query(
        'SELECT * FROM asistencias WHERE id = $1',
        [id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de asistencia no encontrado'
      });
    }

    const current = check.rows[0];

    if (fecha !== undefined && fecha !== null) {
      const fechaActual = current.fecha instanceof Date
          ? current.fecha.toISOString().slice(0, 10)
          : String(current.fecha).slice(0, 10);

      if (String(fecha).trim() !== fechaActual) {
        return res.status(400).json({
          success: false,
          message: 'No se puede cambiar la fecha de una asistencia.'
        });
      }
    }

    if (current.sesion_id === null) {
      return res.status(403).json({
        success: false,
        message: 'Esta asistencia histórica no tiene una sesión asignada y no se puede modificar.'
      });
    }

    const fechaActual = current.fecha instanceof Date
        ? current.fecha.toISOString().slice(0, 10)
        : String(current.fecha).slice(0, 10);

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

    let estadoNorm = current.estado;

    if (estado !== undefined) {
      estadoNorm = normalizarEstado(estado);

      if (!estadoNorm) {
        return res.status(400).json({
          success: false,
          message: 'El estado debe ser PRESENTE, AUSENTE o TARDANZA'
        });
      }
    }

    let observacionNueva = current.observacion;

    if (observacion !== undefined) {
      if (observacion !== null && typeof observacion !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'La observación debe ser texto o null'
        });
      }

      observacionNueva = observacion === null
          ? null
          : observacion.trim() || null;
    }

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
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
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

    const fechaActual = asistencia.fecha instanceof Date
        ? asistencia.fecha.toISOString().slice(0, 10)
        : String(asistencia.fecha).slice(0, 10);

    const sesionActiva = await comprobarSesionActiva(
        asistencia.sesion_id,
        asistencia.curso_id,
        fechaActual
    );

    if (!sesionActiva) {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar la asistencia: la sesión está cerrada o vencida.'
      });
    }

    await db.query(
        'DELETE FROM asistencias WHERE id = $1',
        [id]
    );

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
// Sincroniza asistencias locales sin sobrescribir registros existentes.
router.post('/sincronizar', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un arreglo "items" con las asistencias a sincronizar'
      });
    }

    const resultados = [];

    for (const item of items) {
      const {
        local_id,
        remoto_id,
        alumno_id,
        curso_id,
        sesion_id,
        fecha,
        estado,
        observacion,
        fecha_registro
      } = item;

      const estadoNorm = normalizarEstado(estado);

      if (
          !alumno_id ||
          !Number.isInteger(Number(alumno_id)) ||
          Number(alumno_id) <= 0 ||
          !curso_id ||
          !Number.isInteger(Number(curso_id)) ||
          Number(curso_id) <= 0 ||
          !sesion_id ||
          !Number.isInteger(Number(sesion_id)) ||
          Number(sesion_id) <= 0 ||
          !fechaValida(fecha) ||
          !estadoNorm
      ) {
        resultados.push({
          local_id,
          success: false,
          message: 'Datos incompletos o inválidos. Se requiere sesion_id y una fecha válida.'
        });

        continue;
      }

      try {
        const fechaRegistroDate = new Date(fecha_registro);

        if (
            typeof fecha_registro !== 'string' ||
            !fecha_registro.trim() ||
            Number.isNaN(fechaRegistroDate.getTime())
        ) {
          resultados.push({
            local_id,
            success: false,
            message: 'Sincronización rechazada: falta una fecha y hora de registro válida.'
          });

          continue;
        }

        const sesionResult = await db.query(
            `SELECT id, inicio_at, fin_at
             FROM sesiones_asistencia
             WHERE id = $1
               AND curso_id = $2
               AND fecha = $3::DATE
                AND inicio_at <= $4::TIMESTAMPTZ
               AND fin_at >= $4::TIMESTAMPTZ`,
            [
              Number(sesion_id),
              Number(curso_id),
              fecha,
              fechaRegistroDate.toISOString()
            ]
        );

        if (sesionResult.rowCount === 0) {
          resultados.push({
            local_id,
            success: false,
            message: 'Sincronización rechazada: la hora de registro no corresponde al período de la sesión.'
          });

          continue;
        }


        const observacionNorm = observacion
            ? String(observacion).trim() || null
            : null;

        // Si ya existe un ID remoto, se trata de una edición local.
        if (remoto_id !== undefined && remoto_id !== null) {
          const remotoId = Number(remoto_id);

          if (!Number.isInteger(remotoId) || remotoId <= 0) {
            resultados.push({
              local_id,
              success: false,
              message: 'El ID remoto no es válido.'
            });
            continue;
          }

          // Las ediciones remotas solo se permiten con la sesión abierta.
          const sesionActiva = await comprobarSesionActiva(
              Number(sesion_id),
              Number(curso_id),
              fecha
          );

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
             RETURNING id, sesion_id,
                       TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha`,
              [
                estadoNorm,
                observacionNorm,
                remotoId,
                Number(alumno_id),
                Number(curso_id),
                Number(sesion_id),
                fecha
              ]
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

        // Si no hay ID remoto, es una asistencia nueva.
        const insertQuery = `
          INSERT INTO asistencias
            (alumno_id, curso_id, sesion_id, fecha, estado, observacion, sincronizado)
          VALUES ($1, $2, $3, $4::DATE, $5, $6, TRUE)
          ON CONFLICT (alumno_id, sesion_id) DO NOTHING
          RETURNING id, sesion_id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha
        `;

        const resInsert = await db.query(insertQuery, [
          Number(alumno_id),
          Number(curso_id),
          Number(sesion_id),
          fecha,
          estadoNorm,
          observacionNorm
        ]);

        if (resInsert.rowCount === 0) {
          const existenteResult = await db.query(
              `SELECT id, curso_id, sesion_id,
                    TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
                    estado, observacion
             FROM asistencias
             WHERE alumno_id = $1 AND sesion_id = $2`,
              [Number(alumno_id), Number(sesion_id)]
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

          const coincide =
              Number(existente.curso_id) === Number(curso_id) &&
              Number(existente.sesion_id) === Number(sesion_id) &&
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

      } catch (err) {
        console.error('Error al sincronizar item:', local_id, err);

        resultados.push({
          local_id,
          success: false,
          message: err.message || 'Error en inserción'
        });
      }
    }

    const sincronizadosOk = resultados.filter((r) => r.success).length;

    return res.json({
      success: true,
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
