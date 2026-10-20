// Carga funciones reales de index.html en un contexto aislado de Node para
// probarlas sin navegador ni Supabase. Se extraen por nombre, de modo que las
// pruebas siempre ejecutan el mismo código que se publica.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const RAIZ = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

function extraer(nombre) {
  const re = new RegExp('(async\\s+)?function\\s+' + nombre + '\\s*\\(|const\\s+' + nombre + '\\s*=\\s*[\\[{]');
  const m = re.exec(HTML);
  if (!m) throw new Error('No se encontró ' + nombre + ' en index.html');
  const esConst = m[0].startsWith('const');
  const abre = esConst ? m[0].slice(-1) : '{';
  const cierra = abre === '{' ? '}' : ']';
  const inicio = esConst ? m.index + m[0].length - 1 : HTML.indexOf('{', m.index);
  let prof = 0;
  for (let i = inicio; i < HTML.length; i++) {
    if (HTML[i] === abre) prof++;
    else if (HTML[i] === cierra) { prof--; if (prof === 0) return HTML.slice(m.index, i + 1) + ';'; }
  }
  throw new Error('Llaves sin cerrar en ' + nombre);
}

const FUNCIONES = [
  'cleanAndParseFloat', 'isValidCuenta', 'registrarAvisosImportacion',
  'CUENTAS_BIESO_ASTURIAS', 'construirConfigBieso', 'processAsturiasNusefaFile',
  'processFile', 'processGasFile', 'extractTablesFromGas', 'calcularValoresPorMesYUnidad'
];

function nuevaApp(mesesCongelados = {}) {
  const unidades = () => ({ mebuc: {}, desan: {}, demam: {}, setra: {}, asturias: {}, nusefa: {} });
  const ctx = {
    XLSX,
    appData: { energia: unidades(), acueducto: unidades(), gas: { mebuc: [], desan: [], demam: [], asturias: [] }, saldos: {} },
    console: { log() {}, warn() {}, error() {} },
    showNotification() {},
    getMesesCongeladosAlumbrado: (u) => mesesCongelados[u] || [],
    avisosImportacion: []
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'importador.js'), 'utf8'), ctx);
  vm.runInContext(FUNCIONES.map(extraer).join('\n') +
    '\nthis.__api={processAsturiasNusefaFile,processFile,processGasFile,calcularValoresPorMesYUnidad};', ctx);
  return { ctx, ...ctx.__api };
}

module.exports = { nuevaApp, XLSX, RAIZ };
