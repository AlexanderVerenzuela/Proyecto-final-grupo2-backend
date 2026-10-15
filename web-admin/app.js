/**
 * ASISTE+ | Portal Administrativo Cibertec
 * Lógica de conexión a API REST y gestión de interfaz
 */

const API_BASE = '/api';

// Estado global de la aplicación web
const state = {
  currentView: 'dashboard',
  cursos: [],
  alumnos: [],
  asistencias: [],
  filtros: {
    curso_id: '',
    estado: '',
    fecha: '',
    q: '',
  },
};

// =====================================================================
// INICIALIZACIÓN
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModals();
  initFilters();
  initForms();

  // Establecer fecha de hoy por defecto en el filtro de asistencia
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('asistencia-fecha').value = today;

  // Cargar datos iniciales
  checkServerHealth();
  cargarDatosGenerales().then(() => {
    cargarDashboard();
  });

  // Botón refrescar
  document.getElementById('btn-refresh').addEventListener('click', () => {
    refreshCurrentView();
  });

  // Ver todas desde dashboard
  document.getElementById('btn-ver-todas-asistencias').addEventListener('click', () => {
    switchView('asistencias');
  });
});

// =====================================================================
// NAVEGACIÓN ENTRE VISTAS
// =====================================================================
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;

  // Actualizar botones de navegación
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });

  // Actualizar secciones de vista
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('active', v.id === `view-${viewName}`);
  });

  // Actualizar títulos
  const titles = {
    dashboard: { title: 'Panel de Control', sub: 'Resumen general y métricas en tiempo real' },
    asistencias: { title: 'Control de Asistencias', sub: 'Registro y seguimiento de asistencia por sesión' },
    alumnos: { title: 'Mantenimiento de Estudiantes', sub: 'Gestión académica de alumnos matriculados' },
    cursos: { title: 'Mantenimiento de Cursos', sub: 'Gestión de asignaturas y docentes de Cibertec' },
  };

  if (titles[viewName]) {
    document.getElementById('page-title').textContent = titles[viewName].title;
    document.getElementById('page-subtitle').textContent = titles[viewName].sub;
  }

  // Cargar datos correspondientes
  refreshCurrentView();
}

function refreshCurrentView() {
  switch (state.currentView) {
    case 'dashboard':
      cargarDashboard();
      break;
    case 'asistencias':
      cargarAsistencias();
      break;
    case 'alumnos':
      cargarAlumnos();
      break;
    case 'cursos':
      cargarCursos();
      break;
  }
}

// =====================================================================
// COMPROBACIÓN DE SALUD DEL SERVIDOR
// =====================================================================
async function checkServerHealth() {
  const badge = document.getElementById('server-status-badge');
  const text = document.getElementById('server-status-text');
  const dot = badge.querySelector('.status-dot');

  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (res.ok && data.status === 'OK') {
      text.textContent = 'API en Línea (PG)';
      dot.classList.remove('error');
    } else {
      throw new Error(data.mensaje || 'Error en BD');
    }
  } catch (err) {
    text.textContent = 'Servidor sin conexión';
    dot.classList.add('error');
  }
}

// =====================================================================
// CARGA DE DATOS GENERALES (CURSOS Y ALUMNOS PARA COMBOS)
// =====================================================================
async function cargarDatosGenerales() {
  try {
    const [resCursos, resAlumnos] = await Promise.all([
      fetch(`${API_BASE}/cursos`),
      fetch(`${API_BASE}/alumnos`),
    ]);

    const dataCursos = await resCursos.json();
    const dataAlumnos = await resAlumnos.json();

    if (dataCursos.success) state.cursos = dataCursos.data;
    if (dataAlumnos.success) state.alumnos = dataAlumnos.data;

    poblarCombos();
  } catch (err) {
    console.error('Error cargando datos generales:', err);
    showToast('Error de comunicación con el servidor', 'error');
  }
}

function poblarCombos() {
  // Combo Filtro Curso
  const filterCurso = document.getElementById('filter-curso');
  filterCurso.innerHTML = '<option value="">Todos los cursos</option>';
  state.cursos.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.codigo} - ${c.nombre}`;
    filterCurso.appendChild(opt);
  });

  // Combo Modal Asistencia - Cursos
  const selectCursoModal = document.getElementById('asistencia-curso');
  selectCursoModal.innerHTML = '<option value="">Seleccione un curso...</option>';
  state.cursos.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.codigo} - ${c.nombre}`;
    selectCursoModal.appendChild(opt);
  });

  // Combo Modal Asistencia - Alumnos
  const selectAlumnoModal = document.getElementById('asistencia-alumno');
  selectAlumnoModal.innerHTML = '<option value="">Seleccione un estudiante...</option>';
  state.alumnos.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `[${a.codigo}] ${a.apellidos}, ${a.nombres}`;
    selectAlumnoModal.appendChild(opt);
  });
}

// =====================================================================
// DASHBOARD
// =====================================================================
async function cargarDashboard() {
  try {
    const res = await fetch(`${API_BASE}/estadisticas`);
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;

    // Métricas
    document.getElementById('stat-alumnos').textContent = data.alumnos.total;
    document.getElementById('stat-alumnos-activos').textContent = `${data.alumnos.activos} estudiantes activos`;
    document.getElementById('stat-cursos').textContent = data.cursos.total;
    document.getElementById('stat-asistencias').textContent = data.asistencias.total;
    document.getElementById('stat-tasa').textContent = `${data.asistencias.porcentaje_asistencia}% puntualidad/asistencia`;

    document.getElementById('stat-presentes').textContent = `${data.asistencias.presentes} Presentes`;
    document.getElementById('stat-tardanzas').textContent = `${data.asistencias.tardanzas} Tardanzas`;
    document.getElementById('stat-ausentes').textContent = `${data.asistencias.ausentes} Ausentes`;

    // Tabla de desglose por curso
    const tbodyStats = document.querySelector('#table-stats-cursos tbody');
    if (data.por_curso && data.por_curso.length > 0) {
      tbodyStats.innerHTML = data.por_curso
        .map(
          (c) => `
        <tr>
          <td><strong>${escapeHtml(c.curso_codigo)}</strong></td>
          <td>${escapeHtml(c.curso_nombre)}</td>
          <td><span class="badge badge-presente">${c.presentes}</span></td>
          <td><span class="badge badge-tardanza">${c.tardanzas}</span></td>
          <td><span class="badge badge-ausente">${c.ausentes}</span></td>
          <td><strong>${c.total_asistencias}</strong></td>
        </tr>
      `
        )
        .join('');
    } else {
      tbodyStats.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay registros de asistencias</td></tr>`;
    }

    // Últimas asistencias
    const resRecent = await fetch(`${API_BASE}/asistencias`);
    const jsonRecent = await resRecent.json();
    const tbodyRecent = document.querySelector('#table-ultimas-asistencias tbody');

    if (jsonRecent.success && jsonRecent.data.length > 0) {
      const top5 = jsonRecent.data.slice(0, 5);
      tbodyRecent.innerHTML = top5
        .map(
          (a) => `
        <tr>
          <td><small class="text-muted">${a.fecha}</small></td>
          <td>${escapeHtml(a.alumno_nombre_completo)}</td>
          <td>${escapeHtml(a.curso_codigo)}</td>
          <td><span class="badge badge-${a.estado.toLowerCase()}">${a.estado}</span></td>
        </tr>
      `
        )
        .join('');
    } else {
      tbodyRecent.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin registros recientes</td></tr>`;
    }
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

// =====================================================================
// GESTIÓN DE ASISTENCIAS
// =====================================================================
async function cargarAsistencias() {
  const tbody = document.getElementById('tbody-asistencias');
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Cargando registros...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (state.filtros.curso_id) params.append('curso_id', state.filtros.curso_id);
    if (state.filtros.estado) params.append('estado', state.filtros.estado);
    if (state.filtros.fecha) params.append('fecha', state.filtros.fecha);
    if (state.filtros.q) params.append('q', state.filtros.q);

    const res = await fetch(`${API_BASE}/asistencias?${params.toString()}`);
    const json = await res.json();

    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No se encontraron registros que coincidan con los filtros</td></tr>`;
      document.getElementById('asistencias-count').textContent = 'Mostrando 0 registros';
      return;
    }

    state.asistencias = json.data;
    document.getElementById('asistencias-count').textContent = `Mostrando ${json.total} registro(s)`;

    tbody.innerHTML = json.data
      .map(
        (a) => `
      <tr>
        <td><strong>#${a.id}</strong></td>
        <td>${a.fecha}</td>
        <td><code>${escapeHtml(a.alumno_codigo)}</code></td>
        <td>${escapeHtml(a.alumno_nombre_completo)}</td>
        <td>${escapeHtml(a.curso_nombre)} <small class="text-muted">(${escapeHtml(a.curso_codigo)})</small></td>
        <td><span class="badge badge-${a.estado.toLowerCase()}">${a.estado}</span></td>
        <td><small class="text-muted">${escapeHtml(a.observacion || '-')}</small></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" title="Modificar" onclick="abrirEditarAsistencia(${a.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon btn-delete" title="Eliminar" onclick="eliminarAsistencia(${a.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Error cargando asistencias:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Error al obtener las asistencias</td></tr>`;
  }
}

function initFilters() {
  const filterCurso = document.getElementById('filter-curso');
  const filterEstado = document.getElementById('filter-estado');
  const filterFecha = document.getElementById('filter-fecha');
  const filterBuscar = document.getElementById('filter-buscar');
  const btnLimpiar = document.getElementById('btn-limpiar-filtros');

  const aplicarFiltros = () => {
    state.filtros.curso_id = filterCurso.value;
    state.filtros.estado = filterEstado.value;
    state.filtros.fecha = filterFecha.value;
    state.filtros.q = filterBuscar.value.trim();
    cargarAsistencias();
  };

  filterCurso.addEventListener('change', aplicarFiltros);
  filterEstado.addEventListener('change', aplicarFiltros);
  filterFecha.addEventListener('change', aplicarFiltros);

  let searchTimeout;
  filterBuscar.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(aplicarFiltros, 300);
  });

  btnLimpiar.addEventListener('click', () => {
    filterCurso.value = '';
    filterEstado.value = '';
    filterFecha.value = '';
    filterBuscar.value = '';
    aplicarFiltros();
  });
}

// =====================================================================
// MODALES Y FORMULARIOS
// =====================================================================
function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach((m) => m.classList.remove('active'));
    });
  });

  // Abrir modal nueva asistencia
  document.getElementById('btn-nueva-asistencia').addEventListener('click', () => {
    document.getElementById('modal-asistencia-title').textContent = 'Registrar Asistencia';
    document.getElementById('form-asistencia').reset();
    document.getElementById('asistencia-id').value = '';
    document.getElementById('group-curso').style.display = 'flex';
    document.getElementById('group-alumno').style.display = 'flex';
    document.getElementById('asistencia-curso').disabled = false;
    document.getElementById('asistencia-alumno').disabled = false;
    document.getElementById('asistencia-fecha').value = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="asistencia-estado"][value="PRESENTE"]').checked = true;
    document.getElementById('modal-asistencia').classList.add('active');
  });

  // Abrir modal nuevo alumno
  document.getElementById('btn-nuevo-alumno').addEventListener('click', () => {
    document.getElementById('modal-alumno-title').textContent = 'Nuevo Estudiante';
    document.getElementById('form-alumno').reset();
    document.getElementById('alumno-id').value = '';
    document.getElementById('group-alumno-activo').style.display = 'none';
    document.getElementById('modal-alumno').classList.add('active');
  });

  // Abrir modal nuevo curso
  document.getElementById('btn-nuevo-curso').addEventListener('click', () => {
    document.getElementById('modal-curso-title').textContent = 'Nuevo Curso';
    document.getElementById('form-curso').reset();
    document.getElementById('curso-id').value = '';
    document.getElementById('modal-curso').classList.add('active');
  });
}

function initForms() {
  // Form Asistencia
  document.getElementById('form-asistencia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('asistencia-id').value;
    const alumno_id = document.getElementById('asistencia-alumno').value;
    const curso_id = document.getElementById('asistencia-curso').value;
    const fecha = document.getElementById('asistencia-fecha').value;
    const estado = document.querySelector('input[name="asistencia-estado"]:checked').value;
    const observacion = document.getElementById('asistencia-observacion').value;

    const payload = { alumno_id, curso_id, fecha, estado, observacion };

    try {
      let res;
      if (id) {
        // Modificación
        res = await fetch(`${API_BASE}/asistencias/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha, estado, observacion }),
        });
      } else {
        // Creación
        res = await fetch(`${API_BASE}/asistencias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Error al guardar asistencia');
      }

      showToast(json.message || 'Operación exitosa', 'success');
      document.getElementById('modal-asistencia').classList.remove('active');
      cargarAsistencias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Alumno
  document.getElementById('form-alumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('alumno-id').value;
    const codigo = document.getElementById('alumno-codigo').value.trim();
    const nombres = document.getElementById('alumno-nombres').value.trim();
    const apellidos = document.getElementById('alumno-apellidos').value.trim();
    const correo = document.getElementById('alumno-correo').value.trim();
    const telefono = document.getElementById('alumno-telefono').value.trim();
    const activo = document.getElementById('alumno-activo').checked;

    const payload = { codigo, nombres, apellidos, correo, telefono, activo };

    try {
      const url = id ? `${API_BASE}/alumnos/${id}` : `${API_BASE}/alumnos`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Error al guardar alumno');

      showToast(json.message || 'Estudiante guardado', 'success');
      document.getElementById('modal-alumno').classList.remove('active');
      await cargarDatosGenerales();
      cargarAlumnos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Form Curso
  document.getElementById('form-curso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('curso-id').value;
    const codigo = document.getElementById('curso-codigo').value.trim();
    const nombre = document.getElementById('curso-nombre').value.trim();
    const docente = document.getElementById('curso-docente').value.trim();
    const seccion = document.getElementById('curso-seccion').value.trim();
    const ciclo = document.getElementById('curso-ciclo').value.trim();
    const creditos = document.getElementById('curso-creditos').value;

    const payload = { codigo, nombre, docente, seccion, ciclo, creditos };

    try {
      const url = id ? `${API_BASE}/cursos/${id}` : `${API_BASE}/cursos`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Error al guardar curso');

      showToast(json.message || 'Curso guardado', 'success');
      document.getElementById('modal-curso').classList.remove('active');
      await cargarDatosGenerales();
      cargarCursos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// =====================================================================
// OPERACIONES CRUD: ASISTENCIAS
// =====================================================================
window.abrirEditarAsistencia = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/asistencias/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const a = json.data;
    document.getElementById('modal-asistencia-title').textContent = `Modificar Asistencia #${a.id}`;
    document.getElementById('asistencia-id').value = a.id;
    document.getElementById('asistencia-curso').value = a.curso_id;
    document.getElementById('asistencia-alumno').value = a.alumno_id;
    document.getElementById('asistencia-curso').disabled = true;
    document.getElementById('asistencia-alumno').disabled = true;
    document.getElementById('asistencia-fecha').value = a.fecha;
    document.getElementById('asistencia-observacion').value = a.observacion || '';

    const radio = document.querySelector(`input[name="asistencia-estado"][value="${a.estado}"]`);
    if (radio) radio.checked = true;

    document.getElementById('modal-asistencia').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.eliminarAsistencia = async function (id) {
  if (!confirm(`¿Está seguro de eliminar el registro de asistencia #${id}? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/asistencias/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);

    showToast('Asistencia eliminada exitosamente', 'success');
    cargarAsistencias();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// =====================================================================
// OPERACIONES CRUD: ALUMNOS
// =====================================================================
async function cargarAlumnos() {
  const tbody = document.getElementById('tbody-alumnos');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Cargando alumnos...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/alumnos`);
    const json = await res.json();

    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay estudiantes registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data
      .map(
        (al) => `
      <tr>
        <td>#${al.id}</td>
        <td><code>${escapeHtml(al.codigo)}</code></td>
        <td><strong>${escapeHtml(al.apellidos)}, ${escapeHtml(al.nombres)}</strong></td>
        <td>${escapeHtml(al.correo)}</td>
        <td>${escapeHtml(al.telefono || '-')}</td>
        <td><span class="badge ${al.activo ? 'badge-active' : 'badge-inactive'}">${al.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" title="Editar" onclick="abrirEditarAlumno(${al.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon btn-delete" title="Eliminar" onclick="eliminarAlumno(${al.id}, '${escapeHtml(al.nombres)}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Error cargando alumnos:', err);
  }
}

window.abrirEditarAlumno = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/alumnos/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const al = json.data;
    document.getElementById('modal-alumno-title').textContent = `Editar Estudiante [${al.codigo}]`;
    document.getElementById('alumno-id').value = al.id;
    document.getElementById('alumno-codigo').value = al.codigo;
    document.getElementById('alumno-nombres').value = al.nombres;
    document.getElementById('alumno-apellidos').value = al.apellidos;
    document.getElementById('alumno-correo').value = al.correo;
    document.getElementById('alumno-telefono').value = al.telefono || '';
    document.getElementById('group-alumno-activo').style.display = 'block';
    document.getElementById('alumno-activo').checked = al.activo;

    document.getElementById('modal-alumno').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.eliminarAlumno = async function (id, nombre) {
  if (!confirm(`¿Desea eliminar al alumno "${nombre}"? Se borrarán también todas sus asistencias registradas.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/alumnos/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);

    showToast('Alumno eliminado correctamente', 'success');
    await cargarDatosGenerales();
    cargarAlumnos();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// =====================================================================
// OPERACIONES CRUD: CURSOS
// =====================================================================
async function cargarCursos() {
  const tbody = document.getElementById('tbody-cursos');
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Cargando cursos...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/cursos`);
    const json = await res.json();

    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay cursos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data
      .map(
        (c) => `
      <tr>
        <td>#${c.id}</td>
        <td><code>${escapeHtml(c.codigo)}</code></td>
        <td><strong>${escapeHtml(c.nombre)}</strong></td>
        <td>${escapeHtml(c.docente)}</td>
        <td><span class="badge badge-active">${escapeHtml(c.seccion || 'T5BN')}</span></td>
        <td>Ciclo ${escapeHtml(c.ciclo || 'V')}</td>
        <td>${c.creditos || 4} cred.</td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" title="Editar" onclick="abrirEditarCurso(${c.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon btn-delete" title="Eliminar" onclick="eliminarCurso(${c.id}, '${escapeHtml(c.nombre)}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Error cargando cursos:', err);
  }
}

window.abrirEditarCurso = async function (id) {
  try {
    const res = await fetch(`${API_BASE}/cursos/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const c = json.data;
    document.getElementById('modal-curso-title').textContent = `Editar Curso [${c.codigo}]`;
    document.getElementById('curso-id').value = c.id;
    document.getElementById('curso-codigo').value = c.codigo;
    document.getElementById('curso-nombre').value = c.nombre;
    document.getElementById('curso-docente').value = c.docente;
    document.getElementById('curso-seccion').value = c.seccion || 'T5BN';
    document.getElementById('curso-ciclo').value = c.ciclo || 'V';
    document.getElementById('curso-creditos').value = c.creditos || 4;

    document.getElementById('modal-curso').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.eliminarCurso = async function (id, nombre) {
  if (!confirm(`¿Desea eliminar el curso "${nombre}"? Se borrarán también las asistencias asociadas.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/cursos/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);

    showToast('Curso eliminado correctamente', 'success');
    await cargarDatosGenerales();
    cargarCursos();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// =====================================================================
// UTILIDADES: TOAST Y ESCAPE HTML
// =====================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
