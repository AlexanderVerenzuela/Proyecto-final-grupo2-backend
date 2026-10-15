const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/alumnos - Listar alumnos
router.get('/', async (req, res) => {
  try {
    const { q, activo } = req.query;
    let query = 'SELECT * FROM alumnos WHERE 1=1';
    const params = [];

    if (activo !== undefined) {
      params.push(activo === 'true');
      query += ` AND activo = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (nombres ILIKE $${params.length} OR apellidos ILIKE $${params.length} OR codigo ILIKE $${params.length})`;
    }

    query += ' ORDER BY apellidos ASC, nombres ASC';
    const result = await db.query(query, params);
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al listar alumnos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al obtener alumnos' });
  }
});

// GET /api/alumnos/:id - Obtener un alumno por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM alumnos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// POST /api/alumnos - Crear nuevo alumno
router.post('/', async (req, res) => {
  try {
    const { codigo, nombres, apellidos, correo, telefono } = req.body;

    if (!codigo || !nombres || !apellidos || !correo) {
      return res.status(400).json({
        success: false,
        message: 'Código, nombres, apellidos y correo son campos obligatorios',
      });
    }

    // Verificar unicidad de código o correo
    const existing = await db.query(
      'SELECT id FROM alumnos WHERE codigo = $1 OR correo = $2',
      [codigo.trim(), correo.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un alumno con ese código o correo institucional',
      });
    }

    const result = await db.query(
      `INSERT INTO alumnos (codigo, nombres, apellidos, correo, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [codigo.trim(), nombres.trim(), apellidos.trim(), correo.trim(), telefono ? telefono.trim() : null]
    );

    res.status(201).json({
      success: true,
      message: 'Alumno registrado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al registrar alumno:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar alumno' });
  }
});

// PUT /api/alumnos/:id - Modificar alumno
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombres, apellidos, correo, telefono, activo } = req.body;

    if (!codigo || !nombres || !apellidos || !correo) {
      return res.status(400).json({
        success: false,
        message: 'Código, nombres, apellidos y correo son requeridos',
      });
    }

    const check = await db.query('SELECT id FROM alumnos WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
    }

    const duplicate = await db.query(
      'SELECT id FROM alumnos WHERE (codigo = $1 OR correo = $2) AND id <> $3',
      [codigo.trim(), correo.trim(), id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Otro alumno ya utiliza ese código o correo',
      });
    }

    const result = await db.query(
      `UPDATE alumnos 
       SET codigo = $1, nombres = $2, apellidos = $3, correo = $4, telefono = $5,
           activo = COALESCE($6, activo)
       WHERE id = $7
       RETURNING *`,
      [codigo.trim(), nombres.trim(), apellidos.trim(), correo.trim(), telefono ? telefono.trim() : null, activo, id]
    );

    res.json({
      success: true,
      message: 'Alumno actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar alumno:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar alumno' });
  }
});

// DELETE /api/alumnos/:id - Eliminar alumno
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM alumnos WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
    }

    await db.query('DELETE FROM alumnos WHERE id = $1', [id]);
    res.json({
      success: true,
      message: 'Alumno eliminado exitosamente junto con sus registros asociados',
    });
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar alumno' });
  }
});

module.exports = router;
