const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/cursos - Listar cursos
router.get('/', async (req, res) => {
  try {
    const { activo, q } = req.query;
    let query = 'SELECT * FROM cursos WHERE 1=1';
    const params = [];

    if (activo !== undefined) {
      params.push(activo === 'true');
      query += ` AND activo = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (nombre ILIKE $${params.length} OR codigo ILIKE $${params.length} OR docente ILIKE $${params.length})`;
    }

    query += ' ORDER BY nombre ASC';
    const result = await db.query(query, params);
    res.json({
      success: true,
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al listar cursos:', error);
    res.status(500).json({ success: false, message: 'Error interno al obtener cursos' });
  }
});

// GET /api/cursos/:id - Obtener un curso por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM cursos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener curso:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// POST /api/cursos - Crear nuevo curso
router.post('/', async (req, res) => {
  try {
    const { codigo, nombre, docente, seccion, ciclo, creditos } = req.body;

    if (!codigo || !nombre || !docente) {
      return res.status(400).json({
        success: false,
        message: 'Código, nombre del curso y docente son campos obligatorios',
      });
    }

    const existing = await db.query('SELECT id FROM cursos WHERE codigo = $1', [codigo.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un curso registrado con ese código',
      });
    }

    const result = await db.query(
      `INSERT INTO cursos (codigo, nombre, docente, seccion, ciclo, creditos)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        codigo.trim(),
        nombre.trim(),
        docente.trim(),
        seccion ? seccion.trim() : 'T5BN',
        ciclo ? ciclo.trim() : 'V',
        creditos ? parseInt(creditos, 10) : 4,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Curso creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al crear curso:', error);
    res.status(500).json({ success: false, message: 'Error al registrar curso' });
  }
});

// PUT /api/cursos/:id - Modificar curso
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, docente, seccion, ciclo, creditos, activo } = req.body;

    if (!codigo || !nombre || !docente) {
      return res.status(400).json({
        success: false,
        message: 'Código, nombre y docente son campos obligatorios',
      });
    }

    const check = await db.query('SELECT id FROM cursos WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    const duplicate = await db.query(
      'SELECT id FROM cursos WHERE codigo = $1 AND id <> $2',
      [codigo.trim(), id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe otro curso con el mismo código',
      });
    }

    const result = await db.query(
      `UPDATE cursos
       SET codigo = $1, nombre = $2, docente = $3, seccion = $4, ciclo = $5,
           creditos = $6, activo = COALESCE($7, activo)
       WHERE id = $8
       RETURNING *`,
      [
        codigo.trim(),
        nombre.trim(),
        docente.trim(),
        seccion || 'T5BN',
        ciclo || 'V',
        creditos ? parseInt(creditos, 10) : 4,
        activo,
        id,
      ]
    );

    res.json({
      success: true,
      message: 'Curso actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar curso:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar curso' });
  }
});

// DELETE /api/cursos/:id - Eliminar curso
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM cursos WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Curso no encontrado' });
    }

    await db.query('DELETE FROM cursos WHERE id = $1', [id]);
    res.json({
      success: true,
      message: 'Curso eliminado exitosamente junto con sus asistencias registradas',
    });
  } catch (error) {
    console.error('Error al eliminar curso:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar curso' });
  }
});

module.exports = router;
