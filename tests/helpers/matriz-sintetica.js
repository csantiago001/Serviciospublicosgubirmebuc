// Construye una matriz con la misma estructura que "8- BIESO Y ASTURIAS.xlsm"
// (bloques mensuales: rótulo → encabezado → filas) con valores ficticios
// conocidos. Incluye a propósito los casos que provocaron el error.
const XLSX = require('xlsx');

const ENC_ENERGIA = ['FACTURA', 'MEDIDOR ', 'CUENTA', 'ESTACIÓN ', 'KW/H', 'TARIFA KW/H', 'ENERGIA', 'A. PUBLICO', 'ASEO', 'SIN ASEO', 'TOTAL A TRAMITAR', 'INTERESES', 'TOTAL FACTURA', 'COMUNICACIÓN OFICIAL'];
const ENC_ACUEDUCTO = ['FACTURA', 'MEDIDOR', 'CUENTA', 'ESTACIÓN ', 'M3', 'TARIFA M3 ', ' ACUEDUCTO ', 'ALCANTARILLADO', ' ASEO ', 'ALCA + ASEO', 'TOTAL A TRAMITAR', 'INTERESES ', 'TOTAL FACTURA', 'COMUNICACIÓN OFICIAL'];

function filaEnergia(cuenta, estacion, energia, aPublico = null) {
  const total = energia + (aPublico || 0);
  return [1000, 2000, cuenta, estacion, 100, energia / 100, energia, aPublico, null, total, total, null, total, 'GS-TEST'];
}
function filaAcueducto(cuenta, estacion, acueducto, alcantarillado, aseo) {
  const total = acueducto + alcantarillado + aseo;
  return [3000, 4000, cuenta, estacion, 10, acueducto / 10, acueducto, alcantarillado, aseo, alcantarillado + aseo, total, null, total, null];
}
function resumen(texto, valor) { return [null, null, null, null, texto, null, valor, null, null, null, null, null, null, null]; }

function bloqueEnergia(rotulo, base) {
  return [
    [rotulo],
    ENC_ENERGIA,
    filaEnergia(214262, 'COLEGIO NUSEFA', 1000 * base, 100 * base),
    filaEnergia(1085817, 'POLINAL CABAÑAS', 300 * base),
    filaEnergia(1085818, 'POLINAL CASAS FISCALES', 20 * base),
    filaEnergia(1136898, 'POLINAL FRONTERA CARABINEROS', 1 * base),
    resumen('NUSEFA ENERGIA', 1000 * base),
    [],
  ];
}

/**
 * @param {Object} op
 *   rotuloSeptiembre: texto del rótulo de septiembre (por defecto con el error real "SEPTEIMBRE")
 *   octubreConError:  incluye una celda #DIV/0! en ENERGIA y un 0 real
 */
function crearMatrizBieso(op = {}) {
  const rotuloSep = op.rotuloSeptiembre ?? 'SEPTEIMBRE';
  const energia = [
    ...bloqueEnergia('JULIO', 7),
    ...bloqueEnergia('AGOSTO', 8),
    ...bloqueEnergia(rotuloSep, 9),
    ['OCTUBRE'], ENC_ENERGIA,
    filaEnergia(214262, 'COLEGIO NUSEFA', 10000, 1000),
    [null, 2000, 1085817, 'POLINAL CABAÑAS', null, null, null, null, null, 0, 0, null, 0, 'SIN PRESUPUESTO'],
    [null, 2000, 1085818, 'POLINAL CASAS FISCALES', null, '__DIV0__', '__DIV0__', null, null, 0, 0, null, 0, 'SIN PRESUPUESTO'],
    filaEnergia(1136898, 'POLINAL FRONTERA CARABINEROS', 5000),
  ];
  const acueducto = [
    ['AGOSTO'], ENC_ACUEDUCTO,
    filaAcueducto('039806', 'COLEGIO NUSEFA', 100, 50, 5),
    filaAcueducto(122860, 'CENTRO VACACIONAL ASTURIAS', 800, 400, 40),
    [],
    ['SEPTIEMBRE'], ENC_ACUEDUCTO,
    filaAcueducto('039806', 'COLEGIO NUSEFA', 110, 55, 6),
    filaAcueducto(122860, 'CENTRO VACACIONAL ASTURIAS', 900, 450, 45),
    [],
    ['OCTUBRE'], ENC_ACUEDUCTO,
    filaAcueducto(null, 'COLEGIO NUSEFA', 120, 60, 7),
    filaAcueducto(122860, 'CENTRO VACACIONAL ASTURIAS', 1000, 500, 50),
  ];

  const wb = XLSX.utils.book_new();
  for (const [nombre, aoa] of [['ENERGIA', energia], ['ACUEDUCTO', acueducto]]) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Convertir marcadores en celdas de error reales de Excel
    Object.keys(ws).forEach(k => {
      if (k[0] !== '!' && ws[k].v === '__DIV0__') ws[k] = { t: 'e', v: 0x07, w: '#DIV/0!' };
    });
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  // Ida y vuelta por el formato binario para leerla como un archivo real
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return XLSX.read(buf, { type: 'buffer' });
}

module.exports = { crearMatrizBieso };
