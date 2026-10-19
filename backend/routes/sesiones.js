const express = require('express');
const router = express.Router();
const db = require('../db');

// Comprueba que la fecha tenga formato YYYY-MM-DD y sea una fecha real.
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

// Devuelve el estado real de la sesión.
// Si se agotó el tiempo, la devuelve como CERRADA.
const SELECT_SESION = `
    SELECT
        id,
        curso_id,
        fecha,
        nombre,
        inicio_at,
        fin_at,
        CASE
            WHEN estado = 'CERRADA' OR fin_at <= CURRENT_TIMESTAMP
                THEN 'CERRADA'
            ELSE 'ABIERTA'
        END AS estado,
        GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (fin_at - CURRENT_TIMESTAMP)))
        )::INTEGER AS segundos_restantes
    FROM sesiones_asistencia
`;

// POST /api/sesiones
// Crea una sesión independiente de las demás sesiones del curso.
router.post('/', async (req, res) => {
    try {
        const { curso_id, fecha, nombre } = req.body;

        if (
            !curso_id ||
            !Number.isInteger(Number(curso_id)) ||
            Number(curso_id) <= 0 ||
            !fechaValida(fecha)
        ) {
            return res.status(400).json({
                success: false,
                message: 'curso_id válido y fecha real en formato YYYY-MM-DD son obligatorios'
            });
        }

        const nombreSesion = typeof nombre === 'string' && nombre.trim()
            ? nombre.trim()
            : 'Clase';

        if (nombreSesion.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la sesión no puede superar los 100 caracteres'
            });
        }

        const curso = await db.query(
            'SELECT id FROM cursos WHERE id = $1',
            [Number(curso_id)]
        );

        if (curso.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'El curso no existe'
            });
        }

        const creada = await db.query(
            `INSERT INTO sesiones_asistencia
                (curso_id, fecha, nombre)
             VALUES ($1, $2::DATE, $3)
             RETURNING
                id, curso_id, fecha, nombre,
                inicio_at, fin_at, estado`,
            [Number(curso_id), fecha, nombreSesion]
        );

        const sesion = creada.rows[0];

        return res.status(201).json({
            success: true,
            message: 'Sesión de asistencia iniciada',
            data: {
                ...sesion,
                segundos_restantes: 10800
            }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al iniciar la sesión'
        });
    }
});

// GET /api/sesiones/actual?curso_id=1&fecha=2026-10-18
// Devuelve las sesiones de un curso en una fecha.
// Puede haber varias sesiones, por ejemplo, clase normal y recuperación.
router.get('/actual', async (req, res) => {
    try {
        const { curso_id, fecha } = req.query;

        if (
            !curso_id ||
            !Number.isInteger(Number(curso_id)) ||
            Number(curso_id) <= 0 ||
            !fechaValida(fecha)
        ) {
            return res.status(400).json({
                success: false,
                message: 'curso_id válido y fecha real en formato YYYY-MM-DD son obligatorios'
            });
        }

        const resultado = await db.query(
            `${SELECT_SESION}
             WHERE curso_id = $1
               AND fecha = $2::DATE
             ORDER BY inicio_at DESC, id DESC`,
            [Number(curso_id), fecha]
        );

        return res.json({
            success: true,
            data: resultado.rows
        });
    } catch (error) {
        console.error('Error al consultar sesiones:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al consultar las sesiones'
        });
    }
});

// GET /api/sesiones/:id
// Consulta una sesión específica por su identificador.
router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El identificador de sesión no es válido'
            });
        }

        const resultado = await db.query(
            `${SELECT_SESION} WHERE id = $1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'La sesión no existe'
            });
        }

        return res.json({
            success: true,
            data: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al consultar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al consultar la sesión'
        });
    }
});

// POST /api/sesiones/:id/cerrar
// Cierra anticipadamente una sesión de forma definitiva.
router.post('/:id/cerrar', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El identificador de sesión no es válido'
            });
        }

        const resultado = await db.query(
            `UPDATE sesiones_asistencia
             SET estado = 'CERRADA',
                 fin_at = LEAST(fin_at, CURRENT_TIMESTAMP)
             WHERE id = $1
               AND estado = 'ABIERTA'
               AND fin_at > CURRENT_TIMESTAMP
             RETURNING id, curso_id, fecha, nombre,
                       inicio_at, fin_at, estado`,
            [id]
        );

        if (resultado.rowCount === 0) {
            const existente = await db.query(
                `${SELECT_SESION} WHERE id = $1`,
                [id]
            );

            if (existente.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'La sesión no existe'
                });
            }

            return res.status(409).json({
                success: false,
                message: 'La sesión ya está cerrada o ha vencido',
                data: existente.rows[0]
            });
        }

        return res.json({
            success: true,
            message: 'La sesión se cerró correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno al cerrar la sesión'
        });
    }
});

module.exports = router;
