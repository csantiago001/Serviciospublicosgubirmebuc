// Pruebas unitarias de js/importador.js
const test = require('node:test');
const assert = require('node:assert/strict');
const GI = require('../js/importador.js');

test('detectarMes: nombres exactos, con tildes, espacios o año', () => {
  assert.equal(GI.detectarMes('SEPTIEMBRE').mes, 'SEPTIEMBRE');
  assert.equal(GI.detectarMes('SEPTIEMBRE').exacto, true);
  assert.equal(GI.detectarMes(' septiembre ').mes, 'SEPTIEMBRE');
  assert.equal(GI.detectarMes('Septiembre 2026').mes, 'SEPTIEMBRE');
  assert.equal(GI.detectarMes('ENERO').mes, 'ENERO');
  assert.equal(GI.detectarMes(' ENERO ').mes, 'ENERO');
});

test('detectarMes: corrige el error de digitación real "SEPTEIMBRE" y variantes', () => {
  const r = GI.detectarMes('SEPTEIMBRE');
  assert.equal(r.mes, 'SEPTIEMBRE');
  assert.equal(r.exacto, false, 'debe marcarse como corregido para avisar al usuario');
  assert.equal(GI.detectarMes('SETIEMBRE').mes, 'SEPTIEMBRE');
  assert.equal(GI.detectarMes('SEPT').mes, 'SEPTIEMBRE');
  assert.equal(GI.detectarMes('OCUTBRE').mes, 'OCTUBRE');
  assert.equal(GI.detectarMes('NOVIEMBR').mes, 'NOVIEMBRE');
  assert.equal(GI.detectarMes('FEBRREO').mes, 'FEBRERO');
  assert.equal(GI.detectarMes('AGOSOT'), null, 'rótulos cortos con error se informan, no se adivinan');
});

test('detectarMes: no confunde municipios, estaciones ni códigos con meses', () => {
  for (const t of ['ENCINO', 'CABRERA', 'MALAGA', 'CURITI', 'GALAN', 'HATO', 'FACTURA', 'No FACTURA',
    'FACT3489807', 'FS5460089', 'TOTAL', 'CUENTA', 'NUSEFA ENERGIA', 'JUNIN', 'MAYOR', 'MARZOS', 'JULIAN', 'ABRIGO', 'ENEROS', '', null, undefined, 12345]) {
    assert.equal(GI.detectarMes(t), null, `"${t}" no debe reconocerse como mes`);
  }
});

test('parsearMonto: distingue número, cero real, vacío, error de Excel e inválido', () => {
  assert.deepEqual(GI.parsearMonto(7207015), { valor: 7207015, estado: 'numero' });
  assert.deepEqual(GI.parsearMonto(0), { valor: 0, estado: 'numero' });
  assert.deepEqual(GI.parsearMonto(null), { valor: 0, estado: 'vacio' });
  assert.deepEqual(GI.parsearMonto(''), { valor: 0, estado: 'vacio' });
  assert.equal(GI.parsearMonto({ error: '#DIV/0!' }).estado, 'error_excel');
  assert.equal(GI.parsearMonto('#DIV/0!').estado, 'error_excel');
  assert.equal(GI.parsearMonto('SIN PRESUPUESTO').estado, 'invalido');
});

test('parsearMonto: formatos de texto colombianos y estadounidenses', () => {
  assert.equal(GI.parsearMonto('$ 7.207.015').valor, 7207015);
  assert.equal(GI.parsearMonto('$7.207.015,50').valor, 7207015.5);
  assert.equal(GI.parsearMonto(' $460,593.05 ').valor, 460593.05);
  assert.equal(GI.parsearMonto('$1,234,567').valor, 1234567);
  assert.equal(GI.parsearMonto('120.19').valor, 120.19);
  assert.equal(GI.parsearMonto('(1.500,25)').valor, -1500.25);
});
