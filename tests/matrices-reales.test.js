// Verificación opcional con las matrices reales (no se versionan en el
// repositorio). Ejecutar con:
//   GUBIR_MATRICES_DIR=/ruta/a/las/matrices npm test
// La carpeta debe contener los .xlsm con sus nombres originales o con el
// prefijo numérico ("8- BIESO Y ASTURIAS.xlsm", "1- MEBUC ENERGIA.xlsm", …).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { nuevaApp, XLSX } = require('./helpers/cargar-app');

const DIR = process.env.GUBIR_MATRICES_DIR;
const omitir = !DIR || !fs.existsSync(DIR);

function buscar(fragmento) {
  const f = fs.readdirSync(DIR).find(n => n.toUpperCase().replace(/_/g, ' ').includes(fragmento));
  return f ? path.join(DIR, f) : null;
}

test('Matriz real BIESO Y ASTURIAS: ASTURIAS septiembre = $7.207.015', { skip: omitir && 'GUBIR_MATRICES_DIR no definido' }, async () => {
  const app = nuevaApp();
  const archivo = buscar('BIESO Y ASTURIAS');
  assert.ok(archivo, 'no se encontró la matriz BIESO Y ASTURIAS');
  await app.processAsturiasNusefaFile('8- BIESO Y ASTURIAS.xlsm', XLSX.readFile(archivo), 'T');
  const r = app.calcularValoresPorMesYUnidad(true);
  // Valores tomados directamente de la matriz (hoja ENERGIA, filas 67-69 y 76-78)
  assert.equal(r.asturias['Energía'].SEPTIEMBRE, 5048524 + 1243622 + 914869);
  assert.equal(r.asturias['Energía'].AGOSTO, 4746471 + 1155752 + 897680);
  assert.equal(r.nusefa['Energía'].SEPTIEMBRE, 9838237);
  assert.equal(r.nusefa['Energía'].AGOSTO, 8411899);
  assert.equal(r.asturias['Acueducto'].SEPTIEMBRE, 4641784);
});

test('Matrices reales: cada unidad conserva los meses de su archivo', { skip: omitir && 'GUBIR_MATRICES_DIR no definido' }, async () => {
  const app = nuevaApp();
  const archivos = {
    '1- MEBUC ENERGIA.xlsm': 'MEBUC ENERGIA', '2- MEBUC ACUEDUCTO.xlsm': 'MEBUC ACUEDUCTO',
    '3- DESAN ENERGIA.xlsm': 'DESAN ENERGIA', '4- DESAN ACUEDUCTO.xlsm': 'DESAN ACUEDUCTO',
    '5- DEMAM ENERGIA.xlsm': 'DEMAM ENERGIA', '6- DEMAM ACUEDUCTO.xlsm': 'DEMAM ACUEDUCTO',
    '7- GAS MEBUC-DESAN-DEMAM.xlsm': 'GAS MEBUC'
  };
  for (const [nombre, frag] of Object.entries(archivos)) {
    const f = buscar(frag);
    if (f) await app.processFile(nombre, XLSX.readFile(f), 'T');
  }
  for (const u of ['mebuc', 'desan', 'demam']) {
    for (const s of ['energia', 'acueducto']) {
      const meses = Object.keys(app.ctx.appData[s][u]);
      assert.ok(meses.includes('SEPTIEMBRE'), `${s}/${u} debe tener SEPTIEMBRE (tiene ${meses.join(',')})`);
    }
  }
  // Reimportar el gas no duplica las tablas de ASTURIAS
  const gas = buscar('GAS MEBUC');
  if (gas) {
    const antes = app.ctx.appData.gas.asturias.length;
    await app.processFile('7- GAS MEBUC-DESAN-DEMAM.xlsm', XLSX.readFile(gas), 'T');
    assert.equal(app.ctx.appData.gas.asturias.length, antes);
  }
});
