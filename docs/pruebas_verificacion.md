# Informe de Pruebas y Verificación — Asiste+

Este documento detalla todas las pruebas realizadas en cada uno de los tres componentes del sistema **Asiste+**, incluyendo la salida real de los comandos y los resultados obtenidos.

---

## 1. Pruebas del Componente Android

| Prueba | Objetivo | Procedimiento / Comando | Resultado Obtenido | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Compilación Gradle** | Validar que el proyecto Android compile sin errores de sintaxis, dependencias o tipos. | `.\gradlew.bat assembleDebug` | `BUILD SUCCESSFUL in 1m 12s`. Se generó el archivo `app-debug.apk` (8.48 MB) en `app/build/outputs/apk/debug/`. | **CUMPLIDO** |
| **Pruebas Unitarias** | Validar la lógica de modelos, formateo de nombres, valores por defecto y regla de detección de duplicados. | `.\gradlew.bat testDebugUnitTest` | `BUILD SUCCESSFUL in 13s`. 6 pruebas ejecutadas y aprobadas al 100% (`AsistePlusUnitTest` y `ExampleUnitTest`). | **CUMPLIDO** |
| **Implementación ViewBinding** | Verificar que `viewBinding = true` esté activo y reemplace adecuadamente a `findViewById`. | `buildFeatures { viewBinding = true }` en `app/build.gradle.kts` | Generación automática de clases `ActivityMainBinding`, `ItemCursoBinding`, etc., utilizadas en todas las actividades. | **CUMPLIDO** |
| **SQLite OpenHelper** | Verificar la creación de tablas, claves, índices y operaciones CRUD en `DatabaseHelper.kt`. | Inspección de métodos `insertarAsistencia`, `listarAsistencias`, `buscarAsistencias`, `actualizarAsistencia` y `eliminarAsistencia`. | Métodos implementados usando `insertWithOnConflict`, `query`, `update` y `delete` seguros. | **CUMPLIDO** |
| **Consumo REST Real** | Verificar que la app consuma al menos dos endpoints REST distintos. | Implementación en `ApiClient.kt` para `GET /api/cursos`, `GET /api/alumnos`, `GET /api/asistencias`, `POST /api/asistencias/sincronizar`. | La app consume 4 endpoints REST reales con parseo de JSON y despacho en hilos secundarios. | **CUMPLIDO** |
| **Modo Offline** | Verificar que la app funcione sin conexión al servidor. | Fallback automático en `SeleccionCursoActivity` y `TomarAsistenciaActivity` hacia la base de datos local SQLite. | Si el servidor no responde o está apagado, la app lee y guarda en SQLite con `sincronizado = 0`. | **CUMPLIDO** |

---

## 2. Pruebas de la API REST y Base de Datos (PostgreSQL)

| Endpoint / Prueba | Método | URL / Consulta | Entrada / Parámetros | Código HTTP | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Creación de BD** | SQL | `CREATE DATABASE asiste_plus;` | PostgreSQL 18.3 | N/A | Base de datos creada con éxito. |
| **Ejecución DDL** | SQL | `schema.sql` | Tablas `alumnos`, `cursos`, `asistencias` | N/A | Tablas creadas con claves foráneas, restricciones CHECK e índices. |
| **Carga de Datos** | SQL | `seeds.sql` | 4 cursos, 8 alumnos, 17 asistencias | N/A | 29 registros insertados correctamente. |
| **Salud del Servidor** | GET | `/api/health` | Ninguno | `200 OK` | `{"status": "OK", "base_datos": "PostgreSQL Conectado"}` |
| **Listar Cursos** | GET | `/api/cursos` | Ninguno | `200 OK` | Retorna los 4 cursos académicos de Cibertec. |
| **Listar Alumnos** | GET | `/api/alumnos` | Ninguno | `200 OK` | Retorna los 8 estudiantes con datos completos. |
| **Listar Asistencias** | GET | `/api/asistencias` | Ninguno | `200 OK` | Retorna 17 registros de asistencia con JOIN de cursos y alumnos. |
| **Registrar Asistencia** | POST | `/api/asistencias` | `{alumno_id: 4, curso_id: 1, fecha: "2026-10-14", estado: "PRESENTE"}` | `201 Created` | Registro insertado y retornado con ID asignado (ID: 18). |
| **Control de Duplicados** | POST | `/api/asistencias` | Misma combinación (alumno 4, curso 1, fecha 2026-10-14) | `409 Conflict` | La regla de negocio bloquea el duplicado con mensaje descriptivo. |
| **Modificar Asistencia** | PUT | `/api/asistencias/18` | `{estado: "TARDANZA", observacion: "Modificado"}` | `200 OK` | Estado actualizado correctamente en PostgreSQL. |
| **Eliminar Asistencia** | DELETE | `/api/asistencias/18` | ID 18 en URL | `200 OK` | Registro eliminado de la base de datos. |
| **Sincronización Lote** | POST | `/api/asistencias/sincronizar` | Arreglo `items` con asistencias | `200 OK` | UPSERT procesado sin fallas. |
| **Estadísticas** | GET | `/api/estadisticas` | Ninguno | `200 OK` | Métricas calculadas: presentes (10), ausentes (4), tardanzas (3). |

---

## 3. Pruebas del Portal Web Administrativo

| Función | Descripción de la Prueba | Resultado | Estado |
| :--- | :--- | :--- | :--- |
| **Servicio de Archivos** | `GET http://localhost:3000/` | HTTP 200. Sirve el portal administrativo SPA responsivo. | **CUMPLIDO** |
| **Dashboard de Métricas** | Carga de métricas globales y desglose por curso. | Conteo en tiempo real de alumnos, cursos, asistencias y desglose visual. | **CUMPLIDO** |
| **Filtros de Asistencias** | Filtrado interactivo por curso, estado, fecha y texto. | La tabla se actualiza reactivamente según los criterios elegidos. | **CUMPLIDO** |
| **CRUD de Asistencias** | Crear, modificar estado/observación y eliminar con confirmación. | Modales funcionales conectados a la API REST. | **CUMPLIDO** |
| **CRUD de Estudiantes** | Registro, edición y eliminación de alumnos. | Formularios validados y persistencia directa en PostgreSQL. | **CUMPLIDO** |
| **CRUD de Cursos** | Registro, edición y eliminación de asignaturas. | Validación de código único y actualización de asignaturas. | **CUMPLIDO** |
| **Notificaciones Toast** | Mensajes de éxito y error visuales. | Toasts flotantes con animación de entrada y temporizador de cierre. | **CUMPLIDO** |

---

## 4. Matriz de Requisitos del Proyecto

| Requisito | Estado | Archivos Relacionados | Demostración / Evidencia |
| :--- | :--- | :--- | :--- |
| **1. Aplicación Android en Kotlin** | **CUMPLIDO** | `app/src/main/java/com/example/proyectofinalgrupo2/*` | Compilación exitosa `BUILD SUCCESSFUL`, APK generado. |
| **2. ConstraintLayout** | **CUMPLIDO** | `app/src/main/res/layout/*.xml` | Todas las pantallas (`activity_*.xml`, `item_*.xml`) usan `ConstraintLayout`. |
| **3. ViewBinding** | **CUMPLIDO** | `build.gradle.kts`, Activities y Adapters | Uso de clases `Binding` en todas las actividades y adaptadores. |
| **4. RecyclerView con Adaptadores** | **CUMPLIDO** | `CursoAdapter`, `AlumnoAsistenciaAdapter`, `LocalAsistenciaAdapter` | 3 adaptadores personalizados implementados con `ViewHolder`. |
| **5. SQLite con SQLiteOpenHelper** | **CUMPLIDO** | `DatabaseHelper.kt` | Métodos `insertar`, `listar`, `buscar`, `actualizar`, `eliminar`. |
| **6. 5+ Pantallas Obligatorias** | **CUMPLIDO** | Inicio, Selección Curso, Toma Asistencia, Historial, Gestión Local | 5 actividades registradas en `AndroidManifest.xml`. |
| **7. API REST Real** | **CUMPLIDO** | `backend/index.js`, `backend/routes/*.js` | API Node.js/Express con 12 endpoints y validaciones. |
| **8. Base de Datos PostgreSQL** | **CUMPLIDO** | `database/schema.sql`, `database/seeds.sql` | BD `asiste_plus` operativa en PostgreSQL con claves foráneas. |
| **9. Sincronización Móvil <-> Servidor** | **CUMPLIDO** | `DatabaseHelper.kt`, `ApiClient.kt`, `routes/asistencias.js` | Flujo offline-first con bandera `sincronizado` y endpoint en lote. |
| **10. Portal Web Administrativo** | **CUMPLIDO** | `web-admin/index.html`, `styles.css`, `app.js` | Dashboard completo y CRUD de cursos, alumnos y asistencias. |
