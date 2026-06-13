// deck.js — Baraja española de 40 cartas
// Valores: 1 (As) a 7, luego Sota=10, Caballo=11, Rey=12
// Palos: oros, copas, espadas, bastos

const PALOS = ['oros', 'copas', 'espadas', 'bastos'];
const VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

function crearBaraja() {
  const baraja = [];
  PALOS.forEach(palo => {
    VALORES.forEach(valor => {
      baraja.push({ valor, palo });
    });
  });
  return baraja;
}

function barajar(mazo) {
  const copia = [...mazo];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Reparte numCartas a cada uno de numJugadores jugadores
function repartir(baraja, numJugadores, numCartas) {
  const manos = Array.from({ length: numJugadores }, () => []);
  let idx = 0;
  for (let c = 0; c < numCartas; c++) {
    for (let j = 0; j < numJugadores; j++) {
      manos[j].push(baraja[idx]);
      idx++;
    }
  }
  return manos;
}

module.exports = { crearBaraja, barajar, repartir, PALOS, VALORES };
