# Documentación de la API REST — Asiste+

La API REST de **Asiste+** permite conectar la aplicación móvil Android y el portal web administrativo con la base de datos central PostgreSQL.

- **Servidor Base:** `http://localhost:3000`
- **Acceso desde Emulador Android:** `http://10.0.2.2:3000`
- **Formato de Intercambio:** `application/json`
- **Codificación:** UTF-8

---

## 1. Salud del Servidor

### `GET /api/health`
Comprueba el estado del servidor Express y la conexión activa con PostgreSQL.

**Respuesta Exitosa (HTTP 200):**
```json
{
  "status": "OK",
  "sistema": "Asiste+ API REST",
  "institucion": "Cibertec - DAM I",
  "base_datos": "PostgreSQL Conectado",
  "servidor_tiempo": "2026-10-15T01:25:52.000Z",
  "nombre_bd": "asiste_plus"
}
```

---

## 2. Módulo de Cursos

### `GET /api/cursos`
Lista todas las asignaturas registradas. Admite filtros opcionales por query string: `activo=true` y `q=texto`.

**Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "total": 4,
  "data": [
    {
      "id": 1,
      "codigo": "DAM-501",
      "nombre": "Desarrollo de Aplicaciones Móviles I",
      "docente": "Mg. Carlos Mendoza Paredes",
      "seccion": "T5BN",
      "ciclo": "V",
      "creditos": 4,
      "activo": true
    }
  ]
}
```

### `GET /api/cursos/:id`
Obtiene los detalles de un curso por su ID numérico.
- **HTTP 200:** Curso encontrado.
- **HTTP 404:** `{"success": false, "message": "Curso no encontrado"}`

### `POST /api/cursos`
Crea una nueva asignatura.
**Body:**
```json
{
  "codigo": "DSW-502",
  "nombre": "Desarrollo de Servicios Web I",
  "docente": "Ing. Patricia Villanueva",
  "seccion": "T5BN",
  "ciclo": "V",
  "creditos": 4
}
```
- **HTTP 201:** `{"success": true, "message": "Curso creado exitosamente", "data": {...}}`
- **HTTP 400:** Campos faltantes o código duplicado.

### `PUT /api/cursos/:id`
Modifica los datos de un curso existente.
- **HTTP 200:** Modificado exitosamente.
- **HTTP 404:** Curso no encontrado.

### `DELETE /api/cursos/:id`
Elimina un curso y sus asistencias asociadas (en cascada).
- **HTTP 200:** `{"success": true, "message": "Curso eliminado exitosamente"}`

---

## 3. Módulo de Estudiantes (Alumnos)

### `GET /api/alumnos`
Lista todos los estudiantes. Admite filtros: `activo=true` y `q=termino_busqueda`.

**Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "total": 8,
  "data": [
    {
      "id": 1,
      "codigo": "I20231001",
      "nombres": "Alexander",
      "apellidos": "Verenzuela López",
      "correo": "alexander.verenzuela@cibertec.edu.pe",
      "telefono": "987654321",
      "activo": true
    }
  ]
}
```

### `POST /api/alumnos`
Registra un nuevo alumno con validación de unicidad de código y correo.
- **HTTP 201:** Creado.
- **HTTP 400:** Código o correo ya existente.

### `PUT /api/alumnos/:id`
Actualiza la información personal o estado activo del estudiante.

### `DELETE /api/alumnos/:id`
Elimina al estudiante y sus registros de asistencia.

---

## 4. Módulo de Asistencias

### `GET /api/asistencias`
Consulta asistencias con filtros opcionales cruzados:
- `curso_id` (numérico)
- `alumno_id` (numérico)
- `fecha` (YYYY-MM-DD)
- `estado` (PRESENTE | TARDANZA | AUSENTE)
- `q` (búsqueda de texto)

**Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "total": 17,
  "data": [
    {
      "id": 1,
      "alumno_id": 1,
      "alumno_codigo": "I20231001",
      "alumno_nombres": "Alexander",
      "alumno_apellidos": "Verenzuela López",
      "alumno_nombre_completo": "Verenzuela López, Alexander",
      "curso_id": 1,
      "curso_codigo": "DAM-501",
      "curso_nombre": "Desarrollo de Aplicaciones Móviles I",
      "fecha": "2026-10-14",
      "estado": "PRESENTE",
      "observacion": "Asistencia registrada desde app móvil",
      "sincronizado": true
    }
  ]
}
```

### `POST /api/asistencias`
Registra una asistencia individual.
**Body:**
```json
{
  "alumno_id": 1,
  "curso_id": 1,
  "fecha": "2026-10-14",
  "estado": "PRESENTE",
  "observacion": "Participó en laboratorio"
}
```
- **HTTP 201:** Asistencia registrada.
- **HTTP 400:** Datos faltantes o estado inválido.
- **HTTP 409 Conflict:** Ya existe asistencia para ese estudiante en la misma sesión/fecha (evita duplicados).

### `PUT /api/asistencias/:id`
Modifica el estado, fecha u observación de una asistencia.
- **HTTP 200:** Asistencia modificada.

### `DELETE /api/asistencias/:id`
Elimina el registro de asistencia especificado.
- **HTTP 200:** Eliminado exitosamente.

### `POST /api/asistencias/sincronizar` (Sincronización en Lote para Móvil)
Recibe un arreglo con múltiples registros tomados offline en SQLite y los sincroniza mediante una operación UPSERT segura (`ON CONFLICT (alumno_id, curso_id, fecha) DO UPDATE`).

**Body:**
```json
{
  "items": [
    {
      "local_id": 101,
      "alumno_id": 1,
      "curso_id": 1,
      "fecha": "2026-10-14",
      "estado": "PRESENTE",
      "observacion": "Registro offline sincronizado"
    }
  ]
}
```

**Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "total_procesados": 1,
  "total_sincronizados": 1,
  "items": [
    {
      "local_id": 101,
      "remoto_id": 19,
      "fecha": "2026-10-14",
      "success": true,
      "message": "Sincronizado correctamente"
    }
  ]
}
```

---

## 5. Módulo de Estadísticas

### `GET /api/estadisticas`
Genera las métricas consolidadas en tiempo real para el Dashboard web.

**Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "alumnos": { "total": 8, "activos": 8 },
    "cursos": { "total": 4 },
    "asistencias": {
      "total": 17,
      "presentes": 11,
      "ausentes": 3,
      "tardanzas": 3,
      "porcentaje_asistencia": 82
    },
    "por_curso": [
      {
        "curso_id": 1,
        "curso_nombre": "Desarrollo de Aplicaciones Móviles I",
        "curso_codigo": "DAM-501",
        "total_asistencias": 12,
        "presentes": 8,
        "tardanzas": 2,
        "ausentes": 2
      }
    ]
  }
}
```
