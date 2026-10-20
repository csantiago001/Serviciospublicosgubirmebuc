// Pruebas de integración: ejecutan el importador y el cálculo de Saldos
// tal como están en index.html, sobre una matriz con la estructura real.
const test = require('node:test');
const assert = require('node:assert/strict');
const { nuevaApp } = require('./helpers/cargar-app');
const { crearMatrizBieso } = require('./helpers/matriz-sintetica');

const ARCHIVO = '8- BIESO Y ASTURIAS.xlsm';

async function importar(app, wb = crearMatrizBieso(), veces = 1) {
  for (let i = 0; i < veces; i++) await app.processAsturiasNusefaFile(ARCHIVO, wb, 'T');
  return app.calcularValoresPorMesYUnidad(true);
}

test('ASTURIAS septiembre se importa aunque el rótulo diga "SEPTEIMBRE"', async () => {
  const app = nuevaApp();
  const r = await importar(app);
  // 2700 + 180 + 9 de las tres cuentas de ASTURIAS en el bloque de septiembre
  assert.equal(r.asturias['Energía'].SEPTIEMBRE, 2889);
  assert.equal(r.nusefa['Energía'].SEPTIEMBRE, 9000);
  assert.equal(r.nusefa['Alumbrado Público'].SEPTIEMBRE, 900);
});

test('Los valores de septiembre ya no sobrescriben agosto', async () => {
  const app = nuevaApp();
  const r = await importar(app);
  assert.equal(r.asturias['Energía'].AGOSTO, 2568);
  assert.equal(r.nusefa['Energía'].AGOSTO, 8000);
  assert.equal(r.asturias['Energía'].JULIO, 2247);
});

test('Los demás meses y servicios de ASTURIAS conservan sus valores', async () => {
  const app = nuevaApp();
  const r = await importar(app);
  assert.equal(r.asturias['Acueducto'].AGOSTO, 800);
  assert.equal(r.asturias['Acueducto'].SEPTIEMBRE, 900);
  assert.equal(r.asturias['Acueducto'].OCTUBRE, 1000);
  assert.equal(r.asturias['Alcantarillado'].SEPTIEMBRE, 450 + 45);
  assert.equal(r.asturias['Energía'].OCTUBRE, 5000);
});

test('Con el rótulo bien escrito el resultado es idéntico (la corrección no es un caso especial)', async () => {
  const a = await importar(nuevaApp(), crearMatrizBieso({ rotuloSeptiembre: 'SEPTEIMBRE' }));
  const b = await importar(nuevaApp(), crearMatrizBieso({ rotuloSeptiembre: 'SEPTIEMBRE' }));
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('Importar dos veces no duplica registros ni altera los valores', async () => {
  const app = nuevaApp();
  const una = JSON.stringify(await importar(app, crearMatrizBieso(), 1));
  const dos = JSON.stringify(await importar(app, crearMatrizBieso(), 1));
  assert.equal(una, dos);
  assert.equal(app.ctx.appData.energia.asturias.SEPTIEMBRE.length, 3);
});

test('Los ceros reales siguen siendo cero y los errores de Excel se informan', async () => {
  const app = nuevaApp();
  await importar(app);
  const oct = app.ctx.appData.energia.asturias.OCTUBRE;
  const cabanas = oct.find(x => x.CUENTA === '1085817');
  assert.equal(cabanas.ENERGIA, 0);
  assert.equal(cabanas._problemas, undefined, 'un 0 real no es un problema');
  const casas = oct.find(x => x.CUENTA === '1085818');
  assert.equal(casas._problemas[0].estado, 'error_excel');
  const avisos = app.ctx.avisosImportacion;
  assert.ok(avisos.some(a => a.tipo === 'valor_invalido' && a.cuenta === '1085818'));
});

test('Se informan el rótulo corregido y la fila sin cuenta', async () => {
  const app = nuevaApp();
  await importar(app);
  const tipos = app.ctx.avisosImportacion.map(a => a.tipo);
  assert.ok(tipos.includes('mes_corregido'));
  const sinCuenta = app.ctx.avisosImportacion.find(a => a.tipo === 'fila_sin_cuenta');
  assert.ok(sinCuenta && sinCuenta.mes === 'OCTUBRE' && /NUSEFA/.test(sinCuenta.mensaje));
});

test('Un rótulo que no es un mes detiene el bloque en vez de mezclarlo con el mes anterior', async () => {
  const app = nuevaApp();
  const r = await importar(app, crearMatrizBieso({ rotuloSeptiembre: 'XXXXXXXX' }));
  assert.equal(r.asturias['Energía'].AGOSTO, 2568, 'agosto no debe recibir filas del bloque desconocido');
  assert.equal(r.asturias['Energía'].SEPTIEMBRE, undefined);
  assert.ok(app.ctx.avisosImportacion.some(a => a.tipo === 'rotulo_no_reconocido'));
});
