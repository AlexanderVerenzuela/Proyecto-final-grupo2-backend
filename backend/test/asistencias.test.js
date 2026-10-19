const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const http = require('node:http');
const express = require('express');

const state = {
  alumnos: new Set([1]),
  cursos: new Set([1]),
  asistencias: [],
  nextId: 1,
  failNextInsertWithUniqueViolation: false,
  lastQuery: null,
};

const dbMock = {
  async query(text, params = []) {
    state.lastQuery = { text, params };

    if (text.includes('FROM alumnos WHERE id = $1')) {
      return { rows: state.alumnos.has(params[0]) ? [{ id: params[0] }] : [], rowCount: state.alumnos.has(params[0]) ? 1 : 0 };
    }
    if (text.includes('FROM cursos WHERE id = $1')) {
      return { rows: state.cursos.has(params[0]) ? [{ id: params[0] }] : [], rowCount: state.cursos.has(params[0]) ? 1 : 0 };
    }
    if (text.includes('SELECT id FROM asistencias WHERE alumno_id = $1')) {
      const match = state.asistencias.find(
        (row) => row.alumno_id === params[0] && row.curso_id === params[1] &&
          row.fecha === params[2] && (params.length < 4 || row.id !== params[3])
      );
      return { rows: match ? [{ id: match.id }] : [], rowCount: match ? 1 : 0 };
    }
    if (text.includes('INSERT INTO asistencias')) {
      if (state.failNextInsertWithUniqueViolation) {
        state.failNextInsertWithUniqueViolation = false;
        const error = new Error('database unique violation');
        error.code = '23505';
        throw error;
      }

      const [alumno_id, curso_id, fecha, estado, observacion] = params;
      const existing = state.asistencias.find(
        (row) => row.alumno_id === alumno_id && row.curso_id === curso_id && row.fecha === fecha
      );
      if (existing && !text.includes('ON CONFLICT')) {
        const error = new Error('database unique violation');
        error.code = '23505';
        throw error;
      }
      if (existing) {
        existing.estado = estado;
        existing.observacion = observacion;
        return { rows: [{ id: existing.id, fecha }], rowCount: 1 };
      }
      if (!state.alumnos.has(alumno_id) || !state.cursos.has(curso_id)) {
        const error = new Error('database foreign key violation');
        error.code = '23503';
        throw error;
      }

      const row = {
        id: state.nextId++,
        alumno_id,
        curso_id,
        fecha,
        estado,
        observacion,
        sincronizado: true,
      };
      state.asistencias.push(row);
      return { rows: [{ ...row, created_at: 'now' }], rowCount: 1 };
    }
    if (text.includes('SELECT * FROM asistencias WHERE id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('SELECT id FROM asistencias WHERE id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('FROM asistencias a') && text.includes('WHERE a.id = $1')) {
      const row = state.asistencias.find((item) => item.id === params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('UPDATE asistencias')) {
      const [estado, observacion, fecha, id] = params;
      const row = state.asistencias.find((item) => item.id === id);
      if (row) Object.assign(row, { estado, observacion, fecha });
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes('DELETE FROM asistencias')) {
      state.asistencias = state.asistencias.filter((row) => row.id !== params[0]);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
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
    return res.status(400).json({ success: false, message: 'El cuerpo de la solicitud contiene JSON inválido' });
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
  state.asistencias = [];
  state.nextId = 1;
  state.failNextInsertWithUniqueViolation = false;
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

const validAttendance = (overrides = {}) => ({
  alumno_id: 1,
  curso_id: 1,
  fecha: '2026-10-14',
  estado: 'PRESENTE',
  ...overrides,
});

test('registra una asistencia válida', async () => {
  const response = await request('', { method: 'POST', body: validAttendance() });
  assert.equal(response.status, 201);
  assert.equal(response.json.success, true);
  assert.equal(response.json.data.estado, 'PRESENTE');
});

test('rechaza estados no admitidos y tipos incorrectos', async () => {
  for (const estado of ['JUSTIFICADO', 1, null]) {
    const response = await request('', { method: 'POST', body: validAttendance({ estado }) });
    assert.equal(response.status, 400);
  }
  const notString = await request('', { method: 'POST', body: validAttendance({ observacion: 12 }) });
  assert.equal(notString.status, 400);
});

test('rechaza fechas malformadas e inexistentes', async () => {
  for (const fecha of ['14-10-2026', '2026-02-30', '2026-2-03', 20261014]) {
    const response = await request('', { method: 'POST', body: validAttendance({ fecha }) });
    assert.equal(response.status, 400);
  }
});

test('rechaza identificadores cero, negativos, decimales y no numéricos', async () => {
  for (const key of ['alumno_id', 'curso_id']) {
    for (const value of [0, -1, 1.5, 'abc', '1.2']) {
      const response = await request('', { method: 'POST', body: validAttendance({ [key]: value }) });
      assert.equal(response.status, 400, `${key}=${value}`);
    }
  }
});

test('responde 404 si el alumno o curso no existe', async () => {
  const alumno = await request('', { method: 'POST', body: validAttendance({ alumno_id: 2 }) });
  const curso = await request('', { method: 'POST', body: validAttendance({ curso_id: 2 }) });
  assert.equal(alumno.status, 404);
  assert.equal(curso.status, 404);
});

test('responde 409 ante duplicados, incluso si la restricción detecta una carrera', async () => {
  await request('', { method: 'POST', body: validAttendance() });
  const duplicate = await request('', { method: 'POST', body: validAttendance() });
  assert.equal(duplicate.status, 409);

  state.asistencias = [];
  state.failNextInsertWithUniqueViolation = true;
  const originalConsoleError = console.error;
  console.error = () => {};
  const race = await request('', { method: 'POST', body: validAttendance() });
  console.error = originalConsoleError;
  assert.equal(race.status, 409);
});

test('consulta, actualiza y elimina una asistencia con respuestas compatibles', async () => {
  await request('', { method: 'POST', body: validAttendance() });

  const found = await request('/1');
  assert.equal(found.status, 200);
  assert.equal(found.json.data.id, 1);

  const updated = await request('/1', {
    method: 'PUT',
    body: { estado: 'TARDANZA', fecha: '2026-10-15', observacion: 'Llegó tarde' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.estado, 'TARDANZA');

  const deleted = await request('/1', { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  const missing = await request('/1');
  assert.equal(missing.status, 404);
});

test('rechaza cuerpo de sincronización malformado, JSON inválido e items vacíos', async () => {
  for (const body of [null, [], {}, { items: {} }, { items: [] }]) {
    const response = await request('/sincronizar', { method: 'POST', body });
    assert.equal(response.status, 400);
    assert.equal(response.json.success, false);
  }
  const malformedJson = await request('/sincronizar', { method: 'POST', rawBody: '{"items":' });
  assert.equal(malformedJson.status, 400);
});

test('procesa parcialmente una sincronización y conserva el resultado de cada item', async () => {
  const response = await request('/sincronizar', {
    method: 'POST',
    body: {
      items: [
        { local_id: 10, ...validAttendance() },
        null,
        { local_id: 12, ...validAttendance({ estado: 'INVALIDO' }) },
        { local_id: 13, ...validAttendance({ alumno_id: 99 }) },
      ],
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.success, false);
  assert.equal(response.json.total_procesados, 4);
  assert.equal(response.json.total_sincronizados, 1);
  assert.deepEqual(response.json.items.map((item) => item.success), [true, false, false, false]);
  assert.equal(response.json.items[0].local_id, 10);
  assert.equal(response.json.items[0].remoto_id, 1);
});

test('rechaza elementos de sincronización inválidos sin abortar las entradas restantes', async () => {
  const response = await request('/sincronizar', {
    method: 'POST',
    body: { items: [{ local_id: 1, ...validAttendance({ fecha: '2026-02-30' }) }] },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.success, false);
  assert.equal(response.json.items[0].success, false);
});

test('rechaza parámetros de consulta inválidos y mantiene los filtros admitidos', async () => {
  for (const query of [
    '?curso_id=0', '?curso_id=-1', '?curso_id=1.5', '?curso_id=no',
    '?alumno_id=0', '?alumno_id=-2', '?alumno_id=2.5', '?alumno_id=x',
    '?fecha=2026-02-30', '?fecha=14-10-2026', '?estado=JUSTIFICADO',
  ]) {
    const response = await request(query);
    assert.equal(response.status, 400, query);
  }

  const valid = await request('?curso_id=1&alumno_id=1&fecha=2026-10-14&estado=presente');
  assert.equal(valid.status, 200);
  assert.match(state.lastQuery.text, /a\.curso_id = \$1/);
  assert.match(state.lastQuery.text, /a\.alumno_id = \$2/);
  assert.match(state.lastQuery.text, /a\.fecha = \$3::DATE/);
  assert.match(state.lastQuery.text, /a\.estado = \$4/);
});
