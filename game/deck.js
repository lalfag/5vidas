const PALOS = ['oros', 'copas', 'espadas', 'bastos'];
const VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

function crearBaraja() {
  const baraja = [];
  for (const palo of PALOS) {
    for (const valor of VALORES) {
      baraja.push({ palo, valor });
    }
  }
  return baraja;
}

function barajar(baraja) {
  const b = [...baraja];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function repartir(baraja, numJugadores, cartasPorJugador) {
  const manos = Array.from({ length: numJugadores }, () => []);
  for (let c = 0; c < cartasPorJugador; c++) {
    for (let j = 0; j < numJugadores; j++) {
      manos[j].push(baraja.pop());
    }
  }
  return manos;
}

function esAs(carta) {
  return carta.valor === 1;
}

module.exports = { crearBaraja, barajar, repartir, esAs, PALOS, VALORES };
