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
- `sesion_id` (numérico)
- `fecha` (YYYY-MM-DD)
- `estado` (PRESENTE | TARDANZA | AUSENTE)
- `q` (búsqueda de texto)

Los filtros `curso_id`, `alumno_id`, `sesion_id`, `fecha` y `estado`, cuando se envían, deben ser válidos. Los filtros inválidos responden HTTP 400 y no se ignoran.

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
      "sesion_id": 3,
      "sesion_nombre": "Clase",
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
  "sesion_id": 3,
  "fecha": "2026-10-14",
  "estado": "PRESENTE",
  "observacion": "Participó en laboratorio"
}
```
- **HTTP 201:** Asistencia registrada.
- **HTTP 400:** Datos, identificadores, fecha o estado inválidos.
- **HTTP 404:** El alumno o curso indicado no existe.
- **HTTP 403:** La sesión no existe, no corresponde al curso y fecha, o no está abierta y dentro del horario.
- **HTTP 409 Conflict:** Ya existe asistencia para ese estudiante en la misma sesión (no se sobrescribe).

### `PUT /api/asistencias/:id`
Modifica el estado u observación de una asistencia vinculada a una sesión activa. La fecha no se puede cambiar.
- **HTTP 200:** Asistencia modificada.
- **HTTP 403:** La sesión está cerrada/vencida o la asistencia histórica no tiene sesión.

### `DELETE /api/asistencias/:id`
Elimina el registro de asistencia especificado si pertenece a una sesión activa.
- **HTTP 200:** Eliminado exitosamente.
- **HTTP 403:** La sesión está cerrada/vencida o la asistencia histórica no tiene sesión.

### `POST /api/asistencias/sincronizar` (Sincronización en Lote para Móvil)
Recibe un arreglo con registros offline. Los registros nuevos requieren `sesion_id` y `fecha_registro`; la hora de registro debe estar dentro del horario de esa sesión y coincidir con su curso y fecha. Los registros históricos guardados antes de introducir sesiones pueden omitir `sesion_id`: se sincronizan con `sesion_id = NULL` sin asignarles una sesión. En ambos casos, los duplicados solo se confirman si coinciden exactamente; los datos diferentes no se sobrescriben. Si se envía `remoto_id`, la modificación solo se acepta con sesión activa y si el registro remoto coincide; registros históricos sin sesión no se modifican.

**Body:**
```json
{
  "items": [
    {
      "local_id": 101,
      "alumno_id": 1,
      "curso_id": 1,
      "fecha": "2026-10-14",
      "fecha_registro": "2026-10-14T10:30:00.000Z",
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
      "sesion_id": 3,
      "fecha": "2026-10-14",
      "success": true,
      "message": "Sincronizado correctamente"
    }
  ]
}
```

`success` es `false` si uno o más elementos no pudieron sincronizarse. En ese caso, `items` conserva un resultado individual por entrada y los elementos válidos se procesan igualmente. Cada elemento requiere `local_id` positivo, identificadores positivos de alumno y curso, fecha válida `YYYY-MM-DD`, estado admitido y `fecha_registro` válida; si incluye sesión, el identificador debe ser positivo y la fecha de registro debe estar en su horario. Si `items` falta, no es un arreglo o está vacío, la API responde HTTP 400.

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
