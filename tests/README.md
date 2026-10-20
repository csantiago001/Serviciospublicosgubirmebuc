# Pruebas automatizadas

Cubren la lectura de las matrices Excel (`js/importador.js`) y el cálculo de
Saldos Presupuestales de `index.html` (las funciones se extraen del mismo
archivo que se publica).

```bash
cd tests
npm install
npm test                                   # matrices sintéticas
GUBIR_MATRICES_DIR=/ruta/matrices npm test # + verificación con las matrices reales
```

Las matrices reales no se versionan (contienen datos institucionales).
