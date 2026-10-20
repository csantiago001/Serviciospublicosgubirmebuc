/*
 * GUBIR MEBUC · Utilidades de importación de matrices Excel
 * ---------------------------------------------------------
 * Funciones puras (sin DOM ni Supabase) usadas por index.html y por las
 * pruebas automatizadas (tests/). Se cargan como script clásico y exponen
 * window.GubirImport; en Node se exportan con module.exports.
 *
 * Objetivo: que ningún dato se pierda ni se convierta silenciosamente en 0.
 *  - detectarMes(): reconoce rótulos de mes aunque tengan tildes, espacios,
 *    año o errores de digitación leves ("SEPTEIMBRE", "SETIEMBRE").
 *  - parsearMonto(): distingue número, celda vacía, error de Excel y texto
 *    no numérico.
 *  - parsearMatrizPorBloques(): lee hojas organizadas en bloques mensuales
 *    (rótulo de mes + encabezado + filas) y devuelve registros + avisos.
 */
(function (global) {
  'use strict';

  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
    'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // Variantes válidas en español y abreviaturas habituales
  var ALIAS_MES = {
    SETIEMBRE: 'SEPTIEMBRE',
    ENE: 'ENERO', FEB: 'FEBRERO', MAR: 'MARZO', ABR: 'ABRIL', MAY: 'MAYO',
    JUN: 'JUNIO', JUL: 'JULIO', AGO: 'AGOSTO', SEP: 'SEPTIEMBRE', SEPT: 'SEPTIEMBRE',
    SET: 'SEPTIEMBRE', OCT: 'OCTUBRE', NOV: 'NOVIEMBRE', DIC: 'DICIEMBRE'
  };

  function normalizarTexto(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ /g, ' ')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Distancia de Damerau-Levenshtein (transposiciones cuentan como 1)
  function distanciaEdicion(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var costo = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[m][n];
  }

  /**
   * Interpreta un texto como nombre de mes.
   * @returns {null | {mes: string, exacto: boolean, original: string}}
   *   exacto=false indica que se corrigió una variante o error de digitación
   *   (el llamador debe informarlo como aviso).
   */
  function detectarMes(valor) {
    var original = valor === null || valor === undefined ? '' : String(valor);
    var t = normalizarTexto(original)
      .replace(/[^A-Z ]/g, ' ')   // quita año, puntos, guiones
      .replace(/\s+/g, ' ').trim();
    if (!t || t.indexOf(' ') !== -1) {
      // Solo se acepta una palabra (p. ej. "SEPTIEMBRE 2026" → "SEPTIEMBRE")
      var palabras = t.split(' ').filter(Boolean);
      if (palabras.length !== 1) return null;
      t = palabras[0];
    }
    if (MESES.indexOf(t) !== -1) {
      return { mes: t, exacto: normalizarTexto(original) === t, original: original };
    }
    if (ALIAS_MES[t]) return { mes: ALIAS_MES[t], exacto: false, original: original };
    // Palabras cortas (JUNIN, MAYOR, MALAGA…) nunca se corrigen: un rótulo corto
    // mal escrito queda "no reconocido" y se informa, en vez de adivinar.
    if (t.length < 7) return null;

    // Error de digitación: se acepta solo si hay un único mes a distancia ≤ 2
    var mejor = null, mejorDist = Infinity, empate = false;
    for (var k = 0; k < MESES.length; k++) {
      var dist = distanciaEdicion(t, MESES[k]);
      if (dist < mejorDist) { mejorDist = dist; mejor = MESES[k]; empate = false; }
      else if (dist === mejorDist) { empate = true; }
    }
    var tolerancia = t.length >= 9 ? 2 : 1;
    if (mejor && !empate && mejorDist <= tolerancia) {
      return { mes: mejor, exacto: false, original: original };
    }
    return null;
  }

  /**
   * Convierte una celda a monto sin ocultar errores.
   * @returns {{valor: number, estado: 'numero'|'vacio'|'error_excel'|'invalido', texto?: string}}
   *   - 'numero': valor numérico real (incluye el 0 real).
   *   - 'vacio' : celda vacía → valor 0, no es un error.
   *   - 'error_excel': #DIV/0!, #REF!, #VALUE!… → valor 0, debe informarse.
   *   - 'invalido': texto que no es un número → valor 0, debe informarse.
   */
  function parsearMonto(celda) {
    if (celda === null || celda === undefined) return { valor: 0, estado: 'vacio' };
    if (typeof celda === 'object' && celda.error) {
      return { valor: 0, estado: 'error_excel', texto: String(celda.error) };
    }
    if (typeof celda === 'number') {
      return isFinite(celda) ? { valor: celda, estado: 'numero' } : { valor: 0, estado: 'invalido', texto: String(celda) };
    }
    if (typeof celda === 'boolean') return { valor: 0, estado: 'invalido', texto: String(celda) };
    var texto = String(celda).replace(/ /g, ' ').trim();
    if (texto === '' || texto === '-' || texto === '$' || texto === '$ -') return { valor: 0, estado: 'vacio' };
    if (/^#(DIV\/0!|N\/A|REF!|VALUE!|VALOR!|NAME\?|NOMBRE\?|NUM!|NULL!|NULO!)/i.test(texto)) {
      return { valor: 0, estado: 'error_excel', texto: texto };
    }
    var negativo = /^\(.*\)$/.test(texto) || /^-/.test(texto.replace(/[$\s]/g, ''));
    var limpio = texto.replace(/[$\s()]/g, '').replace(/^-/, '');
    if (!/^[\d.,]+$/.test(limpio) || !/\d/.test(limpio)) {
      return { valor: 0, estado: 'invalido', texto: texto };
    }
    var ultimoPunto = limpio.lastIndexOf('.');
    var ultimaComa = limpio.lastIndexOf(',');
    var normal;
    if (ultimoPunto !== -1 && ultimaComa !== -1) {
      // El separador que aparece de último es el decimal
      normal = ultimaComa > ultimoPunto
        ? limpio.replace(/\./g, '').replace(',', '.')
        : limpio.replace(/,/g, '');
    } else if (ultimaComa !== -1) {
      normal = /^\d{1,3}(,\d{3})+$/.test(limpio) ? limpio.replace(/,/g, '') : limpio.replace(',', '.');
    } else if (ultimoPunto !== -1) {
      normal = /^\d{1,3}(\.\d{3}){2,}$/.test(limpio) ? limpio.replace(/\./g, '') : limpio;
    } else {
      normal = limpio;
    }
    var n = Number(normal);
    if (!isFinite(n)) return { valor: 0, estado: 'invalido', texto: texto };
    return { valor: negativo ? -n : n, estado: 'numero' };
  }

  /** Lee una hoja de SheetJS como matriz de valores crudos (conserva tipos y errores). */
  function leerFilasHoja(XLSX, worksheet, maxFilas) {
    var ref = worksheet && worksheet['!ref'];
    if (!ref) return [];
    var rango = XLSX.utils.decode_range(ref);
    var ultima = Math.min(rango.e.r, (maxFilas || 5000) - 1);
    var filas = [];
    for (var r = 0; r <= ultima; r++) {
      var fila = [];
      for (var c = 0; c <= rango.e.c; c++) {
        var celda = worksheet[XLSX.utils.encode_cell({ r: r, c: c })];
        if (!celda) { fila.push(null); continue; }
        if (celda.t === 'e') { fila.push({ error: celda.w || '#ERROR' }); continue; }
        fila.push(celda.v === undefined ? null : celda.v);
      }
      filas.push(fila);
    }
    return filas;
  }

  function textoCelda(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.error) return String(v.error);
    return String(v).replace(/ /g, ' ').trim();
  }

  function esFilaVacia(fila) {
    return fila.every(function (v) { return textoCelda(v) === ''; });
  }

  /** Una fila "rótulo" tiene texto solo en la primera celda no vacía y nada más. */
  function textoRotulo(fila) {
    var noVacias = [];
    for (var i = 0; i < fila.length; i++) {
      if (textoCelda(fila[i]) !== '') noVacias.push(i);
    }
    if (noVacias.length !== 1 || noVacias[0] > 1) return null;
    var v = fila[noVacias[0]];
    return typeof v === 'string' ? v : null;
  }

  function construirMapaColumnas(encabezados, mapeo) {
    var norm = encabezados.map(function (h) { return normalizarTexto(textoCelda(h)).toLowerCase(); });
    var mapa = {};
    Object.keys(mapeo).forEach(function (clave) {
      mapa[clave] = -1;
      var patrones = mapeo[clave].map(function (p) { return normalizarTexto(p).toLowerCase(); });
      // 1º coincidencia exacta, 2º coincidencia parcial (mismo criterio que el importador original)
      for (var i = 0; i < norm.length && mapa[clave] === -1; i++) {
        if (patrones.indexOf(norm[i]) !== -1) mapa[clave] = i;
      }
      for (var j = 0; j < norm.length && mapa[clave] === -1; j++) {
        if (norm[j] && patrones.some(function (p) { return norm[j].indexOf(p) !== -1; })) mapa[clave] = j;
      }
    });
    return mapa;
  }

  function esEncabezado(fila) {
    return fila.some(function (v) {
      var t = normalizarTexto(textoCelda(v));
      return t === 'CUENTA' || t === 'FACTURA' || t.indexOf('ESTACION') === 0;
    });
  }

  /**
   * Parser genérico de hojas por bloques mensuales.
   * @param {Array<Array>} filas        Matriz de valores (leerFilasHoja).
   * @param {Object} cfg
   *   hoja: nombre de la hoja (para mensajes)
   *   mapeoColumnas: { clave: [patrones...] } — debe incluir 'cuenta'
   *   camposMonetarios: claves del mapeo que son montos
   *   resolverUnidad(cuenta): devuelve la unidad o null
   *   construirRegistro(valores, ctx): arma el objeto final
   * @returns {{ bloques: Object<mes, Array>, avisos: Array }}
   */
  function parsearMatrizPorBloques(filas, cfg) {
    var avisos = [];
    var porMes = {};          // { unidad: { MES: [registros] } }
    var mesActual = null;
    var mapa = null;
    var filaRotulo = 0;
    var vistosEnMes = {};     // detectar cuentas repetidas en un mismo mes

    function aviso(tipo, fila, mensaje, extra) {
      var a = { tipo: tipo, hoja: cfg.hoja, fila: fila + 1, mes: mesActual, mensaje: mensaje };
      if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
      avisos.push(a);
    }

    for (var r = 0; r < filas.length; r++) {
      var fila = filas[r] || [];
      if (esFilaVacia(fila)) continue;

      var rotulo = textoRotulo(fila);
      if (rotulo !== null && !esEncabezado(fila)) {
        var det = detectarMes(rotulo);
        if (det) {
          if (!det.exacto && normalizarTexto(det.original) !== det.mes) {
            aviso('mes_corregido', r, 'El rótulo "' + rotulo.trim() + '" se interpretó como ' + det.mes + '. Corrija la matriz para evitar ambigüedades.', { mesDetectado: det.mes });
          }
          if (porMes.__mesesVistos && porMes.__mesesVistos[det.mes]) {
            aviso('mes_repetido', r, 'El mes ' + det.mes + ' aparece más de una vez en la hoja; los registros se combinan por cuenta.', { mesDetectado: det.mes });
          }
          porMes.__mesesVistos = porMes.__mesesVistos || {};
          porMes.__mesesVistos[det.mes] = true;
          mesActual = det.mes;
          mapa = null;
          filaRotulo = r;
          vistosEnMes = {};
          continue;
        }
        // Rótulo que no es un mes: se detiene la asignación para no mezclar
        // las filas siguientes con el mes anterior (causa del error de ASTURIAS).
        if (mesActual !== null || mapa !== null) {
          aviso('rotulo_no_reconocido', r, 'No se reconoce "' + rotulo.trim() + '" como un mes. Las filas de ese bloque no se importaron.');
        }
        mesActual = null;
        mapa = null;
        continue;
      }

      if (esEncabezado(fila)) {
        if (!mesActual) {
          aviso('bloque_sin_mes', r, 'Se encontró un encabezado de tabla sin un rótulo de mes válido encima. El bloque se omitió.');
          mapa = null;
          continue;
        }
        if (mapa) {
          // Un segundo encabezado en el mismo mes indica un bloque nuevo sin rótulo
          aviso('bloque_sin_mes', r, 'Se encontró un nuevo encabezado sin rótulo de mes después de ' + mesActual + '. El bloque se omitió para no sobrescribir ese mes.');
          mesActual = null;
          mapa = null;
          continue;
        }
        mapa = construirMapaColumnas(fila, cfg.mapeoColumnas);
        if (mapa.cuenta === -1) {
          aviso('columna_faltante', r, 'El encabezado de ' + mesActual + ' no tiene la columna CUENTA.');
          mapa = null;
        }
        continue;
      }

      if (!mesActual || !mapa) continue;

      var cuentaTexto = textoCelda(fila[mapa.cuenta]);
      var estacion = mapa.estacion >= 0 ? textoCelda(fila[mapa.estacion]) : '';
      var estU = normalizarTexto(estacion);
      if (/TOTAL|SUBTOTAL|PROMEDIO|SUMATORIA/.test(estU)) continue;

      // Montos de la fila (con su estado)
      var montos = {};
      var tieneMonto = false;
      (cfg.camposMonetarios || []).forEach(function (campo) {
        var idx = mapa[campo];
        montos[campo] = idx >= 0 ? parsearMonto(fila[idx]) : { valor: 0, estado: 'vacio' };
        if (montos[campo].estado === 'numero' && montos[campo].valor !== 0) tieneMonto = true;
      });

      if (cuentaTexto === '') {
        if (estacion !== '' && tieneMonto) {
          aviso('fila_sin_cuenta', r, 'La fila de "' + estacion + '" en ' + mesActual + ' no tiene número de CUENTA y no se pudo asignar a una unidad. Complete la cuenta en la matriz.', { estacion: estacion });
        }
        continue; // filas de resumen (sin cuenta ni estación) se ignoran
      }

      var unidad = cfg.resolverUnidad(cuentaTexto);
      if (!unidad) {
        if (/^\d{3,}$/.test(cuentaTexto) || estacion !== '') {
          aviso('cuenta_no_mapeada', r, 'La cuenta ' + cuentaTexto + (estacion ? ' (' + estacion + ')' : '') + ' de ' + mesActual + ' no pertenece a ninguna unidad configurada.', { cuenta: cuentaTexto });
        }
        continue;
      }

      var problemas = [];
      Object.keys(montos).forEach(function (campo) {
        var m = montos[campo];
        if (m.estado === 'error_excel' || m.estado === 'invalido') {
          problemas.push({ campo: campo, estado: m.estado, texto: m.texto });
          aviso('valor_invalido', r, 'Valor no numérico en ' + campo.toUpperCase() + ' ("' + m.texto + '") para la cuenta ' + cuentaTexto + ' en ' + mesActual + '. Se tomó como 0 hasta que se corrija la matriz.', { cuenta: cuentaTexto, campo: campo, unidad: unidad });
        }
      });

      var registro = cfg.construirRegistro({
        fila: fila, mapa: mapa, cuenta: cuentaTexto, estacion: estacion,
        montos: montos, texto: textoCelda
      });
      if (problemas.length) registro._problemas = problemas;

      var claveVisto = unidad + '|' + cuentaTexto;
      if (vistosEnMes[claveVisto] !== undefined) {
        aviso('cuenta_duplicada', r, 'La cuenta ' + cuentaTexto + ' aparece dos veces en ' + mesActual + ' (filas ' + (vistosEnMes[claveVisto] + 1) + ' y ' + (r + 1) + '). Se conserva la última.', { cuenta: cuentaTexto });
      }
      vistosEnMes[claveVisto] = r;

      porMes[unidad] = porMes[unidad] || {};
      var lista = porMes[unidad][mesActual] = porMes[unidad][mesActual] || [];
      var idx = -1;
      for (var k = 0; k < lista.length; k++) {
        if (String(lista[k].CUENTA).trim() === cuentaTexto) { idx = k; break; }
      }
      if (idx >= 0) lista[idx] = registro; else lista.push(registro);
    }

    delete porMes.__mesesVistos;
    return { datos: porMes, avisos: avisos };
  }

  var api = {
    MESES: MESES,
    normalizarTexto: normalizarTexto,
    distanciaEdicion: distanciaEdicion,
    detectarMes: detectarMes,
    parsearMonto: parsearMonto,
    leerFilasHoja: leerFilasHoja,
    construirMapaColumnas: construirMapaColumnas,
    parsearMatrizPorBloques: parsearMatrizPorBloques
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.GubirImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
