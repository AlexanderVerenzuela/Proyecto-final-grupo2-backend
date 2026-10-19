const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const alumnosRoutes = require('./routes/alumnos');
const cursosRoutes = require('./routes/cursos');
const asistenciasRoutes = require('./routes/asistencias');
const estadisticasRoutes = require('./routes/estadisticas');
const sesionesRoutes = require('./routes/sesiones');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging básico para depuración de peticiones
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint de estado y comprobación de salud
app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await db.query('SELECT NOW() AS hora_servidor, current_database() AS base_datos');
    res.json({
      status: 'OK',
      sistema: 'Asiste+ API REST',
      institucion: 'Cibertec - DAM I',
      base_datos: 'PostgreSQL Conectado',
      servidor_tiempo: dbTest.rows[0].hora_servidor,
      nombre_bd: dbTest.rows[0].base_datos,
    });
  } catch (error) {
    console.error('Error al comprobar la conexión con la base de datos:', error);
    res.status(500).json({
      status: 'ERROR',
      mensaje: 'Fallo al conectar con la base de datos',
    });
  }
});

// Rutas de la API REST
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/sesiones', sesionesRoutes);

// Servir portal web administrativo estático si existe
const webAdminPath = path.join(__dirname, '..', 'web-admin');
app.use(express.static(webAdminPath));

// Ruta comodín para SPA / frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(webAdminPath, 'index.html'));
});

// Manejador de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.url}`,
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud contiene JSON inválido',
    });
  }
  res.status(500).json({
    success: false,
    message: 'Error interno en el servidor',
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`  🚀 ASISTE+ API REST Servidor iniciado`);
  console.log(`  📍 Local:    http://localhost:${PORT}`);
  console.log(`  📱 Red/WiFi: http://0.0.0.0:${PORT}`);
  console.log(`  📚 Cibertec - Desarrollo de Apps Móviles I`);
  console.log('====================================================');
});
