# Asiste+ — API REST & Portal Web Administrativo

Repositorio oficial del servidor backend, la base de datos relacional PostgreSQL y el portal web administrativo del sistema **Asiste+**, desarrollado para el curso **Desarrollo de Aplicaciones Móviles I** de **Cibertec**.

- **Repositorio de la Aplicación Móvil Android:** [AlexanderVerenzuela/Proyecto-Final-Grupo2](https://github.com/AlexanderVerenzuela/Proyecto-Final-Grupo2)

---

## 🏗️ Componentes de este Repositorio

1. **API REST (Node.js & Express):**
   - Endpoints para gestión de alumnos, cursos, asistencias y estadísticas.
   - Sincronización en lote (`POST /api/asistencias/sincronizar`) con operación `UPSERT ON CONFLICT`.
   - Control estricto de duplicados por alumno, curso y fecha (`HTTP 409 Conflict`).
   - Pool de conexiones a PostgreSQL mediante `pg.Pool`.

2. **Portal Web Administrativo (Web Admin):**
   - Panel de control responsivo servido directamente en el puerto 3000 (`http://localhost:3000/`).
   - Métricas en tiempo real: conteo de alumnos, cursos, total de asistencias y tasas porcentuales.
   - Módulos CRUD completos para estudiantes y cursos.
   - Gestión y filtros interactivos de asistencias por curso, estudiante, estado y fecha.

3. **Base de Datos Relacional (PostgreSQL):**
   - Scripts DDL con claves primarias, foráneas en cascada, restricciones `CHECK` e índices.
   - Datos semilla con cursos y alumnos reales de 5to ciclo.

---

## 📁 Estructura del Proyecto

```text
Proyecto-final-grupo2-backend/
├── backend/                  # Servidor Express y Rutas REST
│   ├── routes/               # alumnos.js, cursos.js, asistencias.js, estadisticas.js
│   ├── db.js                 # Conexión con PostgreSQL
│   ├── index.js              # Servidor principal y servicio de estáticos
│   ├── .env.example          # Plantilla de variables de entorno
│   └── package.json          # Dependencias (express, cors, pg, dotenv)
├── database/                 # Scripts SQL
│   ├── schema.sql            # DDL PostgreSQL
│   ├── seeds.sql             # Datos de prueba para Cibertec
│   └── schema_sqlite.sql     # Esquema de referencia SQLite
├── docs/                     # Documentación Técnica
│   ├── api_endpoints.md      # Especificación completa de endpoints REST
│   ├── diagrama_er.md        # Diagrama Entidad-Relación y restricciones
│   ├── flujo_informacion.md  # Arquitectura y sincronización offline
│   └── pruebas_verificacion.md # Informe de pruebas y resultados
├── web-admin/                # Portal Web SPA
│   ├── index.html            # Dashboard y vistas de gestión
│   ├── styles.css            # Estilos del portal
│   └── app.js                # Lógica del cliente y consumo de API REST
├── .gitignore                # Reglas de exclusión para Git
└── README.md                 # Documentación del repositorio
```

---

## 🚀 Guía de Instalación y Ejecución

### 1. Configurar la Base de Datos PostgreSQL

1. Crear la base de datos `asiste_plus`:
   ```bash
   psql -U postgres -c "CREATE DATABASE asiste_plus;"
   ```
2. Ejecutar el esquema DDL:
   ```bash
   psql -U postgres -d asiste_plus -f "database/schema.sql"
   ```
3. Insertar los datos semilla iniciales:
   ```bash
   psql -U postgres -d asiste_plus -f "database/seeds.sql"
   ```

`database/schema.sql` prepara una base nueva y elimina las tablas existentes antes de crearlas. Para una instalación que ya contiene datos, aplica la migración aditiva de sesiones en lugar de volver a ejecutar el esquema:
```bash
psql -U postgres -d asiste_plus -f "database/migrations/20261018_add_attendance_sessions.sql"
```
La migración conserva las asistencias históricas asignándoles `sesion_id = NULL`; estas no se pueden modificar ni eliminar mediante los endpoints que requieren una sesión activa.

Para las instalaciones que ya aplicaron la migración de sesiones, aplica también el índice parcial que protege contra duplicados al sincronizar históricos sin sesión:
```bash
psql -U postgres -d asiste_plus -f "database/migrations/20261019_add_legacy_attendance_unique.sql"
```

---

### 2. Configurar y Ejecutar el Servidor Backend

1. Entrar a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instalar las dependencias:
   ```bash
   npm install
   ```
3. Crear el archivo `.env` a partir de `.env.example`:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_contrasena_aqui
   DB_NAME=asiste_plus
   ```
4. Iniciar el servidor:
   ```bash
   npm start
   ```

El servidor iniciará en:
- **API REST:** `http://localhost:3000/api/health`
- **Portal Web:** `http://localhost:3000/`

---

## 📡 Endpoints Principales

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del servidor y conexión con PostgreSQL |
| `GET` | `/api/cursos` | Listar asignaturas disponibles |
| `POST` | `/api/cursos` | Crear nuevo curso |
| `GET` | `/api/alumnos` | Listar estudiantes matriculados |
| `POST` | `/api/alumnos` | Registrar nuevo alumno |
| `GET` | `/api/asistencias` | Consultar asistencias con filtros |
| `POST` | `/api/asistencias` | Registrar asistencia individual |
| `PUT` | `/api/asistencias/:id` | Modificar estado u observación |
| `DELETE` | `/api/asistencias/:id` | Eliminar registro de asistencia |
| `POST` | `/api/asistencias/sincronizar` | Sincronización en lote desde la app móvil |
| `GET` | `/api/estadisticas` | Métricas y resumen para el Dashboard |

Para mayores detalles sobre payloads y respuestas, consulte [docs/api_endpoints.md](docs/api_endpoints.md).
