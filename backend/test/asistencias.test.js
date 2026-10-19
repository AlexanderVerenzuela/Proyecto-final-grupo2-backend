const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const http = require('node:http');
const express = require('express');

const now = new Date('2026-10-14T10:00:00.000Z');
const sessionFixture = () => ({
  id: 10,
  curso_id: 1,
  fecha: '2026-10-14',
  nombre: 'Clase',
  inicio_at: new Date('2026-10-14T09:00:00.000Z'),
  fin_at: new Date('2026-10-14T11:00:00.000Z'),
  abierta: true,
});

const state = {
  currentDate: '2026-10-14',
  alumnos: new Set([1]),
  cursos: new Set([1]),
  sesiones: new Map(),
  asistencias: [],
  nextId: 1,
  failNextQuery: null,
  lastQuery: null,
};

const dbMock = {
  async query(text, params = []) {
    state.lastQuery = { text, params };
    if (state.failNextQuery && text.includes(state.failNextQuery.match)) {
      const error = state.failNextQuery.error;
      state.failNextQuery = null;
      throw error;
    }

    if (text.includes('FROM alumnos WHERE id = $1')) {
      const exists = state.alumnos.has(params[0]);
      return { rows: exists ? [{ id: params[0] }] : [], rowCount: exists ? 1 : 0 };
    }
    if (text.includes('FROM cursos WHERE id = $1')) {
      const exists = state.cursos.has(params[0]);
      return { rows: exists ? [{ id: params[0] }] : [], rowCount: exists ? 1 : 0 };
    }
    if (text.includes('SELECT') && text.includes('AS fecha_historica')) {
      const [cursoId, fecha] = params;
      const existeSesion = [...state.sesiones.values()].some(
        (session) => session.curso_id === cursoId && session.fecha === fecha
      );
      return {
        rows: [{
          fecha_historica: fecha < state.currentDate,
          existe_sesion: existeSesion,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('FROM sesiones_asistencia')) {
      const [sesionId, cursoId, fecha, registro] = params;
      const session = state.sesiones.get(sesionId);
      const matches = session &&
        session.curso_id === cursoId &&
        session.fecha === fecha &&
        (params.length === 4
          ? new Date(registro) >= session.inicio_at && new Date(registro) <= session.fin_at
          : session.abierta && session.inicio_at <= now && session.fin_at > now);
      return {
        rows: matches ? [{ id: session.id, inicio_at: session.inicio_at, fin_at: session.fin_at }] : [],
        rowCount: matches ? 1 : 0,
      };
    }
    if (text.includes('FROM asistencias a') && text.includes('WHERE a.id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM asistencias a')) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('SELECT * FROM asistencias WHERE id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('SELECT id, curso_id, sesion_id, fecha FROM asistencias WHERE id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('SELECT id, curso_id, sesion_id,') && text.includes('FROM asistencias')) {
      const row = state.asistencias.find(
        (item) => item.alumno_id === params[0] && item.sesion_id === params[1]
      );
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM asistencias') && text.includes('sesion_id IS NULL')) {
      const row = state.asistencias.find(
        (item) => item.alumno_id === params[0] &&
          item.curso_id === params[1] &&
          item.fecha === params[2] &&
          item.sesion_id === null
      );
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('INSERT INTO asistencias')) {
      const historical = text.includes('sesion_id IS NULL');
      const [alumno_id, curso_id, sesion_id, fecha, estadoValue, observacion] = historical
        ? [params[0], params[1], null, params[2], params[3], params[4]]
        : params;
      const existing = state.asistencias.find((row) => historical
        ? row.alumno_id === alumno_id && row.curso_id === curso_id &&
          row.fecha === fecha && row.sesion_id === null
        : row.alumno_id === alumno_id && row.sesion_id === sesion_id);
      if (existing) return { rows: [], rowCount: 0 };
      if (!state.alumnos.has(alumno_id) || !state.cursos.has(curso_id) ||
          (!historical && !state.sesiones.has(sesion_id))) {
        const error = new Error('foreign key detail must not reach API');
        error.code = '23503';
        throw error;
      }

      const row = {
        id: state.nextId++,
        alumno_id,
        curso_id,
        sesion_id,
        fecha,
        estado: estadoValue,
        observacion,
        sincronizado: true,
      };
      state.asistencias.push(row);
      return { rows: [{ ...row, created_at: 'now' }], rowCount: 1 };
    }
    if (text.includes('UPDATE asistencias')) {
      if (params.length === 7) {
        const [estadoValue, observacion, id, alumno_id, curso_id, sesion_id, fecha] = params;
        const row = state.asistencias.find(
          (item) => item.id === id && item.alumno_id === alumno_id &&
            item.curso_id === curso_id && item.sesion_id === sesion_id && item.fecha === fecha
        );
        if (!row) return { rows: [], rowCount: 0 };
        Object.assign(row, { estado: estadoValue, observacion, sincronizado: true });
        return { rows: [{ id: row.id, sesion_id: row.sesion_id, fecha: row.fecha }], rowCount: 1 };
      }

      const [estadoValue, observacion, id] = params;
      const row = state.asistencias.find((item) => item.id === id);
      if (!row) return { rows: [], rowCount: 0 };
      Object.assign(row, { estado: estadoValue, observacion });
      return { rows: [{ ...row }], rowCount: 1 };
    }
    if (text.includes('DELETE FROM asistencias')) {
      const previousLength = state.asistencias.length;
      state.asistencias = state.asistencias.filter((row) => row.id !== params[0]);
      return { rows: [], rowCount: previousLength - state.asistencias.length };
    }

    throw new Error(`Unexpected mock query: ${text}`);
  },
};

const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock };
const asistenciasRouter = require('../routes/asistencias');
const app = express();
app.use(express.json());
app.use('/api/asistencias', asistenciasRouter);
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud contiene JSON inválido',
    });
  }
  return res.status(500).json({ success: false, message: 'Error interno en el servidor' });
});

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/asistencias`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[dbPath];
});

beforeEach(() => {
  state.sesiones = new Map([[10, sessionFixture()]]);
  state.asistencias = [];
  state.nextId = 1;
  state.failNextQuery = null;
  state.lastQuery = null;
});

const request = async (path, { method = 'GET', body, rawBody } = {}) => {
  const hasBody = body !== undefined || rawBody !== undefined;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
};

const withoutConsoleError = async (callback) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = original;
  }
};

const validAttendance = (overrides = {}) => ({
  alumno_id: 1,
  curso_id: 1,
  sesion_id: 10,
  fecha: '2026-10-14',
  estado: 'PRESENTE',
  observacion: 'Registro de prueba',
  ...overrides,
});

const validSyncItem = (overrides = {}) => ({
  local_id: 10,
  ...validAttendance(),
  fecha_registro: '2026-10-14T10:00:00.000Z',
  ...overrides,
});

test('registra una asistencia en una sesión abierta vinculada a curso y fecha', async () => {
  const response = await request('', { method: 'POST', body: validAttendance() });
  assert.equal(response.status, 201);
  assert.equal(response.json.success, true);
  assert.equal(response.json.data.estado, 'PRESENTE');
  assert.equal(response.json.data.sesion_id, 10);
});

test('rechaza estados, tipos de campos e identificadores inválidos', async () => {
  for (const estado of ['JUSTIFICADO', 1, null]) {
    assert.equal((await request('', { method: 'POST', body: validAttendance({ estado }) })).status, 400);
  }
  assert.equal((await request('', { method: 'POST', body: validAttendance({ observacion: 12 }) })).status, 400);

  for (const key of ['alumno_id', 'curso_id', 'sesion_id']) {
    for (const value of [0, -1, 1.5, 'abc', '1.2']) {
      const response = await request('', { method: 'POST', body: validAttendance({ [key]: value }) });
      assert.equal(response.status, 400, `${key}=${value}`);
    }
  }
});

test('rechaza fechas imposibles o malformadas', async () => {
  for (const fecha of ['14-10-2026', '2026-02-30', '2026-2-03', 20261014]) {
    const response = await request('', { method: 'POST', body: validAttendance({ fecha }) });
    assert.equal(response.status, 400, String(fecha));
  }
});

test('devuelve 404 para alumno o curso inexistente y 403 para sesión inválida', async () => {
  assert.equal((await request('', { method: 'POST', body: validAttendance({ alumno_id: 2 }) })).status, 404);
  assert.equal((await request('', { method: 'POST', body: validAttendance({ curso_id: 2 }) })).status, 404);
  assert.equal((await request('', { method: 'POST', body: validAttendance({ sesion_id: 11 }) })).status, 403);

  state.sesiones.get(10).abierta = false;
  assert.equal((await request('', { method: 'POST', body: validAttendance() })).status, 403);
});

test('no sobrescribe duplicados registrados para la misma sesión', async () => {
  const initial = await request('', { method: 'POST', body: validAttendance() });
  const duplicate = await request('', {
    method: 'POST',
    body: validAttendance({ estado: 'AUSENTE', observacion: 'No sobrescribir' }),
  });
  assert.equal(initial.status, 201);
  assert.equal(duplicate.status, 409);
  assert.equal(state.asistencias[0].estado, 'PRESENTE');
  assert.equal(state.asistencias[0].observacion, 'Registro de prueba');
});

test('consulta asistencias por filtros válidos y rechaza filtros inválidos', async () => {
  for (const query of [
    '?curso_id=0', '?curso_id=-1', '?curso_id=1.5', '?curso_id=no',
    '?alumno_id=0', '?alumno_id=-2', '?alumno_id=2.5', '?alumno_id=x',
    '?sesion_id=0', '?sesion_id=2.5', '?fecha=2026-02-30',
    '?fecha=14-10-2026', '?estado=JUSTIFICADO',
  ]) {
    assert.equal((await request(query)).status, 400, query);
  }

  const valid = await request('?curso_id=1&alumno_id=1&sesion_id=10&fecha=2026-10-14&estado=presente');
  assert.equal(valid.status, 200);
  assert.match(state.lastQuery.text, /a\.curso_id = \$1/);
  assert.match(state.lastQuery.text, /a\.alumno_id = \$2/);
  assert.match(state.lastQuery.text, /a\.fecha = \$3::DATE/);
  assert.match(state.lastQuery.text, /a\.estado = \$4/);
  assert.match(state.lastQuery.text, /a\.sesion_id = \$5/);
});

test('consulta por ID y valida identificadores y registros inexistentes', async () => {
  assert.equal((await request('/0')).status, 400);
  assert.equal((await request('/1')).status, 404);
  await request('', { method: 'POST', body: validAttendance() });
  const found = await request('/1');
  assert.equal(found.status, 200);
  assert.equal(found.json.data.sesion_id, 10);
});

test('modifica y elimina solo asistencias de sesiones activas y conserva la fecha', async () => {
  await request('', { method: 'POST', body: validAttendance() });

  const updated = await request('/1', {
    method: 'PUT',
    body: { estado: 'TARDANZA', fecha: '2026-10-14', observacion: 'Llegó tarde' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.estado, 'TARDANZA');

  const changedDate = await request('/1', { method: 'PUT', body: { fecha: '2026-10-15' } });
  assert.equal(changedDate.status, 400);

  state.sesiones.get(10).abierta = false;
  assert.equal((await request('/1', { method: 'PUT', body: { estado: 'AUSENTE' } })).status, 403);
  assert.equal((await request('/1', { method: 'DELETE' })).status, 403);

  state.sesiones.get(10).abierta = true;
  assert.equal((await request('/1', { method: 'DELETE' })).status, 200);
  assert.equal((await request('/1')).status, 404);
});

test('rechaza la modificación o eliminación de asistencias históricas sin sesión', async () => {
  state.asistencias.push({
    id: 1, alumno_id: 1, curso_id: 1, sesion_id: null,
    fecha: '2026-10-14', estado: 'PRESENTE', observacion: null,
  });
  state.nextId = 2;
  assert.equal((await request('/1', { method: 'PUT', body: { estado: 'AUSENTE' } })).status, 403);
  assert.equal((await request('/1', { method: 'DELETE' })).status, 403);
});

test('rechaza cuerpo de sincronización malformado, JSON inválido e items vacíos', async () => {
  for (const body of [null, [], {}, { items: {} }, { items: [] }]) {
    const response = await request('/sincronizar', { method: 'POST', body });
    assert.equal(response.status, 400);
    assert.equal(response.json.success, false);
  }
  assert.equal((await request('/sincronizar', {
    method: 'POST',
    rawBody: '{"items":',
  })).status, 400);
});

test('valida individualmente la sincronización y procesa parcialmente el lote', async () => {
  const response = await withoutConsoleError(() => request('/sincronizar', {
    method: 'POST',
    body: {
      items: [
        validSyncItem(),
        null,
        validSyncItem({ local_id: 12, estado: 'INVALIDO' }),
        validSyncItem({ local_id: 13, alumno_id: 99 }),
      ],
    },
  }));

  assert.equal(response.status, 200);
  assert.equal(response.json.success, false);
  assert.equal(response.json.total_procesados, 4);
  assert.equal(response.json.total_sincronizados, 1);
  assert.deepEqual(response.json.items.map((item) => item.success), [true, false, false, false]);
  assert.equal(response.json.items[0].local_id, 10);
  assert.equal(response.json.items[0].remoto_id, 1);
});

test('requiere fecha_registro válida y dentro del horario de la sesión', async () => {
  const responses = await Promise.all([
    request('/sincronizar', { method: 'POST', body: { items: [validSyncItem({ fecha_registro: undefined })] } }),
    request('/sincronizar', { method: 'POST', body: { items: [validSyncItem({ fecha_registro: 'not-a-date' })] } }),
    request('/sincronizar', {
      method: 'POST',
      body: { items: [validSyncItem({ fecha_registro: '2026-10-14T12:00:00.000Z' })] },
    }),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.json.success, false);
    assert.equal(response.json.items[0].success, false);
  }

  const malformedDate = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ fecha: '2026-02-30' })] },
  });
  assert.equal(malformedDate.json.items[0].success, false);
});

test('sincroniza asistencias históricas sin inventar una sesión', async () => {
  const historicalValues = {
    fecha: '2026-10-13',
    fecha_registro: '2026-10-13T10:00:00.000Z',
  };
  const historical = validSyncItem({ ...historicalValues, sesion_id: null });
  const { sesion_id, ...legacyPayloadWithoutSession } = validSyncItem({
    ...historicalValues,
    local_id: 11,
    fecha_registro: '2026-10-13 10:00:00',
  });
  const response = await request('/sincronizar', {
    method: 'POST',
    body: { items: [historical, legacyPayloadWithoutSession] },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.success, true);
  assert.equal(response.json.items[0].success, true);
  assert.equal(response.json.items[0].sesion_id, null);
  assert.equal(state.asistencias[0].sesion_id, null);
  assert.equal(response.json.items[1].success, true);
});

test('rechaza la ausencia de sesión para asistencias actuales o con sesión registrada', async () => {
  const currentDay = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ sesion_id: null })] },
  });
  assert.equal(currentDay.json.items[0].success, false);

  state.sesiones.set(11, {
    ...sessionFixture(),
    id: 11,
    fecha: '2026-10-13',
  });
  const historicalDateWithSession = await request('/sincronizar', {
    method: 'POST',
    body: {
      items: [validSyncItem({
        fecha: '2026-10-13',
        fecha_registro: '2026-10-13T10:00:00.000Z',
        sesion_id: null,
      })],
    },
  });
  assert.equal(historicalDateWithSession.json.items[0].success, false);
  assert.equal(state.asistencias.length, 0);
});

test('confirma duplicados históricos coincidentes y rechaza datos distintos sin sobrescribir', async () => {
  const historical = {
    fecha: '2026-10-13',
    fecha_registro: '2026-10-13T10:00:00.000Z',
  };
  const initial = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ ...historical, sesion_id: null })] },
  });
  const duplicate = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ ...historical, local_id: 11, sesion_id: null })] },
  });
  const conflict = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ ...historical, local_id: 12, sesion_id: null, estado: 'AUSENTE' })] },
  });

  assert.equal(initial.json.items[0].success, true);
  assert.equal(duplicate.json.items[0].success, true);
  assert.equal(duplicate.json.items[0].remoto_id, initial.json.items[0].remoto_id);
  assert.equal(conflict.json.success, false);
  assert.equal(conflict.json.items[0].success, false);
  assert.equal(state.asistencias.length, 1);
  assert.equal(state.asistencias[0].estado, 'PRESENTE');
});

test('no modifica una asistencia histórica ya asociada a ID remoto', async () => {
  const response = await request('/sincronizar', {
    method: 'POST',
    body: {
      items: [validSyncItem({
        fecha: '2026-10-13',
        fecha_registro: '2026-10-13T10:00:00.000Z',
        sesion_id: null,
        remoto_id: 5,
      })],
    },
  });
  assert.equal(response.json.success, false);
  assert.equal(response.json.items[0].success, false);
  assert.equal(state.asistencias.length, 0);
});

test('la sincronización idempotente no sobrescribe duplicados distintos', async () => {
  const first = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem()] },
  });
  const same = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ local_id: 11 })] },
  });
  const different = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ local_id: 12, estado: 'AUSENTE' })] },
  });

  assert.equal(first.json.items[0].success, true);
  assert.equal(same.json.items[0].success, true);
  assert.equal(different.json.success, false);
  assert.equal(different.json.items[0].success, false);
  assert.equal(state.asistencias[0].estado, 'PRESENTE');
});

test('actualiza registros remotos solo si coinciden y la sesión sigue abierta', async () => {
  await request('/sincronizar', { method: 'POST', body: { items: [validSyncItem()] } });
  const edited = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ remoto_id: 1, estado: 'TARDANZA' })] },
  });
  assert.equal(edited.json.items[0].success, true);
  assert.equal(state.asistencias[0].estado, 'TARDANZA');

  const mismatch = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ remoto_id: 99, estado: 'AUSENTE' })] },
  });
  assert.equal(mismatch.json.items[0].success, false);

  state.sesiones.get(10).abierta = false;
  const closed = await request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem({ remoto_id: 1, estado: 'AUSENTE' })] },
  });
  assert.equal(closed.json.items[0].success, false);
  assert.equal(state.asistencias[0].estado, 'TARDANZA');
});

test('oculta detalles de errores de base de datos en respuestas HTTP', async () => {
  state.failNextQuery = {
    match: 'FROM alumnos WHERE id',
    error: new Error('secret SQL query and database password'),
  };
  const response = await withoutConsoleError(() =>
    request('', { method: 'POST', body: validAttendance() })
  );
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(response.json), /secret|password|SQL/);

  state.failNextQuery = {
    match: 'FROM sesiones_asistencia',
    error: new Error('internal query details'),
  };
  const syncResponse = await withoutConsoleError(() => request('/sincronizar', {
    method: 'POST',
    body: { items: [validSyncItem()] },
  }));
  assert.equal(syncResponse.status, 200);
  assert.equal(syncResponse.json.success, false);
  assert.doesNotMatch(JSON.stringify(syncResponse.json), /internal query details/);
});
