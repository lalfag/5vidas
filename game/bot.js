// bot.js — Inteligencia de bots nivel 2 para "5 Vidas"
// El bot no usa socket: sus decisiones se inyectan directamente en el estado
// de la partida a través de las mismas funciones que usaría un jugador humano.

const BOT_PREFIX   = 'bot_';
const BOT_DELAY_MS = 1400; // ms de "pensar" antes de actuar (evita parecer instantáneo)
const BOT_NICKNAMES = ['Roboto', 'ARIA', 'NEXUS', 'HAL', 'CHIP', 'VERA', 'OTTO', 'NORA'];

// ── IDENTIFICACIÓN ────────────────────────────────────────────────────────────

function esBot(jugadorId) {
  return String(jugadorId).startsWith(BOT_PREFIX);
}

function crearJugadorBot(idx) {
  const id       = `${BOT_PREFIX}${idx}_${Date.now()}`;
  const nickname = BOT_NICKNAMES[idx % BOT_NICKNAMES.length] + (idx >= BOT_NICKNAMES.length ? idx : '');
  return { id, nickname, vidas: 5, listo: true, token: null, avatar: null, esBot: true };
}

// ── UTILIDADES DE MANO ────────────────────────────────────────────────────────

// Peso de una carta para estimar si puede ganar bazas
// Devuelve un valor entre 0 y 1
function pesoCartaGanar(carta) {
  if (carta.palo === 'joker') return 0.5;
  if (carta.valor === 1) {
    // Ases: poder especial, no compiten por valor directamente
    if (carta.palo === 'oros')   return 0.95; // casi siempre gana
    if (carta.palo === 'copas')  return 0.10; // no gana por sí solo
    if (carta.palo === 'espadas') return 0.60; // puede eliminar rival
    if (carta.palo === 'bastos') return 0.55; // puede intercambiar
    return 0.5;
  }
  // Cartas normales: escala 1-12 → 0-1 (el 12 es el más alto)
  return (carta.valor - 2) / 10; // 2→0, 12→1
}

// Estima cuántas bazas puede ganar el bot con su mano actual
// Tiene en cuenta el nº de jugadores (más rivales = más difícil ganar)
function estimarBazas(mano, numJugadores, inversionEscala = false) {
  if (!mano || mano.length === 0) return 0;

  let estimacion = 0;
  mano.forEach(carta => {
    let peso = pesoCartaGanar(carta);
    if (inversionEscala) peso = 1 - peso; // escala invertida: ganan las bajas

    // Umbral: con más jugadores, necesitas ser más dominante
    // 2 jugadores → umbral 0.5, 6 jugadores → umbral 0.80
    const umbral = 0.45 + (numJugadores - 2) * 0.07;
    if (peso >= umbral) estimacion += 1;
    else if (peso >= umbral - 0.15) estimacion += 0.5; // contribución parcial
  });

  return Math.round(estimacion);
}

// ── CÁLCULO DE APUESTA ────────────────────────────────────────────────────────

function calcularApuesta(partida, botId) {
  const bot      = partida.jugadores.find(j => j.id === botId);
  if (!bot) return 0;

  const numCartas    = partida.jugadores[0]?.mano?.length ?? 1;
  const numJugadores = partida.jugadores.length;
  const esRondaFinal = partida.subrondaActual === 4;

  let apuesta;

  if (esRondaFinal) {
    // Ronda final: el bot NO ve su propia carta (igual que un humano)
    // Estima si puede ganar: con 1 carta y sin verla, probabilidad ~50%
    // Si hay pocas cartas altas en el mazo que quedan → apuesta 0 (conservador)
    // Estrategia simple: apostar 1 el 45% del tiempo, 0 el 55%
    apuesta = Math.random() < 0.45 ? 1 : 0;
  } else {
    apuesta = estimarBazas(bot.mano, numJugadores, partida.inversionEscala);
    apuesta = Math.max(0, Math.min(apuesta, numCartas));

    // Pequeña variabilidad para no ser predecible (±1 ocasionalmente)
    if (Math.random() < 0.25) {
      apuesta += Math.random() < 0.5 ? 1 : -1;
      apuesta = Math.max(0, Math.min(apuesta, numCartas));
    }
  }

  // ── Restricción del último apostador ─────────────────────────────────────
  const esUltimo = partida.apuestasRealizadas === partida.jugadores.length - 1;
  if (esUltimo && !esRondaFinal) {
    const sumaActual = partida.jugadores.reduce((acc, j) => acc + (j.apuesta ?? 0), 0);
    const prohibido  = numCartas - sumaActual;

    if (apuesta === prohibido) {
      // Intentar ±1, si no, buscar cualquier valor válido
      const alternativas = [apuesta + 1, apuesta - 1, apuesta + 2, apuesta - 2];
      const valida = alternativas.find(a => a >= 0 && a <= numCartas && a !== prohibido);
      apuesta = valida !== undefined ? valida : (prohibido === 0 ? 1 : 0);
    }
  }

  return Math.max(0, Math.min(apuesta, numCartas));
}

// ── ELECCIÓN DE CARTA ─────────────────────────────────────────────────────────

// Devuelve el índice en bot.mano de la carta a jugar
function elegirCarta(partida, botId) {
  const bot  = partida.jugadores.find(j => j.id === botId);
  if (!bot || bot.mano.length === 0) return 0;

  const esRondaFinal = partida.subrondaActual === 4;

  // En la ronda final solo hay 1 carta: forzado
  if (esRondaFinal || bot.mano.length === 1) return 0;

  const bazasGanadas = bot.bazasGanadas;
  const apuesta      = bot.apuesta ?? 0;
  const cartasRestantes = bot.mano.length; // cuántas minirondas quedan (incluida esta)
  const bazasQueNecesita = apuesta - bazasGanadas; // cuántas más necesita ganar

  // ¿Quiere ganar esta baza?
  // Heurística: si le quedan exactamente las bazas que necesita ganar → intenta ganar
  //             si ya tiene más de las que apostó → intenta perder
  //             si tiene margen → evalúa según le convenga
  const quiereGanar = bazasQueNecesita > 0 &&
    (bazasQueNecesita >= cartasRestantes || Math.random() < 0.65);

  const mesa = partida.mesa;
  const inversionEscala = partida.inversionEscala || false;

  if (quiereGanar) {
    return elegirCartaParaGanar(bot.mano, mesa, inversionEscala);
  } else {
    return elegirCartaParaPerder(bot.mano, mesa, inversionEscala);
  }
}

// Elige la carta mínima que supere a la ganadora actual en mesa
// Si no puede ganar, juega la más alta disponible (al menos intenta)
function elegirCartaParaGanar(mano, mesa, inversionEscala) {
  const ganadoraValor = valorGanadorMesa(mesa, inversionEscala);

  // Cartas normales que superarían la ganadora
  const candidatas = mano
    .map((carta, idx) => ({ carta, idx }))
    .filter(({ carta }) => {
      if (carta.valor === 1) return carta.palo === 'oros'; // As de Oros siempre gana
      if (inversionEscala) return carta.valor < ganadoraValor;
      return carta.valor > ganadoraValor;
    });

  if (candidatas.length > 0) {
    // Juega la mínima ganadora (para no desperdiciar cartas altas)
    candidatas.sort((a, b) => inversionEscala
      ? b.carta.valor - a.carta.valor   // invertida: queremos el mayor (que en invBaja es el "peor ganador")
      : a.carta.valor - b.carta.valor   // normal: el menor que gane
    );
    return candidatas[0].idx;
  }

  // No puede ganar — juega la más alta de todas (daño mínimo a la apuesta)
  return indiceCartaMaxima(mano, inversionEscala);
}

// Elige la carta más baja para intentar perder la baza (o que se anule)
function elegirCartaParaPerder(mano, mesa, inversionEscala) {
  // Prefiere cartas que puedan anularse con algo ya en mesa
  const valoresEnMesa = new Set(mesa.map(j => j.carta.valor));
  const anuladora = mano.findIndex(c => valoresEnMesa.has(c.valor));
  if (anuladora !== -1) return anuladora; // anular es el mejor modo de "no ganar"

  // Si no, juega la carta mínima
  return indiceCartaMinima(mano, inversionEscala);
}

// Valor de la carta que va ganando en mesa (0 si mesa vacía = cualquiera gana)
function valorGanadorMesa(mesa, inversionEscala) {
  if (mesa.length === 0) return inversionEscala ? 13 : 0;

  const cartasValidas = mesa
    .filter(j => !j.oculta && j.carta.valor !== 1) // los ases se resuelven aparte
    .map(j => j.carta.valor);

  if (cartasValidas.length === 0) return inversionEscala ? 13 : 0;

  return inversionEscala
    ? Math.min(...cartasValidas)
    : Math.max(...cartasValidas);
}

function indiceCartaMaxima(mano, inversionEscala) {
  let mejorIdx = 0;
  mano.forEach((carta, idx) => {
    const mejorActual = mano[mejorIdx];
    const esMejor = inversionEscala
      ? carta.valor < mejorActual.valor
      : carta.valor > mejorActual.valor;
    if (esMejor) mejorIdx = idx;
  });
  return mejorIdx;
}

function indiceCartaMinima(mano, inversionEscala) {
  let peorIdx = 0;
  mano.forEach((carta, idx) => {
    const peorActual = mano[peorIdx];
    const esPeor = inversionEscala
      ? carta.valor > peorActual.valor
      : carta.valor < peorActual.valor;
    if (esPeor) peorIdx = idx;
  });
  return peorIdx;
}

// ── RESOLUCIÓN DE ASES ────────────────────────────────────────────────────────

// As de Espadas: elige qué carta eliminar de la mesa
// Estrategia: eliminar la carta más alta (la que más amenaza al bot ganar)
// Si el bot quiere ganar → elimina la mayor rival
// Si el bot quiere perder → elimina la propia carta del bot si está (raro pero posible)
function elegirObjetivoAsEspadas(partida, botId, mesa, gruposAnulados) {
  const bot          = partida.jugadores.find(j => j.id === botId);
  const apuesta      = bot?.apuesta ?? 0;
  const bazasGanadas = bot?.bazasGanadas ?? 0;
  const quiereGanar  = (apuesta - bazasGanadas) > 0;

  // Buscar en la mesa (origen 'mesa')
  // Filtrar cartas que no son del bot
  const cartasRivales = mesa
    .map((j, idx) => ({ ...j, idx }))
    .filter(j => j.jugadorId !== botId && j.carta.valor !== 1); // no eliminar ases (son especiales)

  if (cartasRivales.length === 0) {
    // No hay rivales: elegir índice 0 por defecto (primer elemento)
    return { origen: 'mesa', idx: 0 };
  }

  if (quiereGanar) {
    // Eliminar la carta más alta rival
    cartasRivales.sort((a, b) => b.carta.valor - a.carta.valor);
  } else {
    // Eliminar la carta más baja rival (interferencia mínima)
    cartasRivales.sort((a, b) => a.carta.valor - b.carta.valor);
  }

  return { origen: 'mesa', idx: cartasRivales[0].idx };
}

// As de Bastos: elige con qué carta intercambiar valor
// Estrategia: intercambiar con la carta más alta si el bot quiere ganar más bazas
//             o con la más baja si quiere perder
function elegirObjetivoAsBastos(partida, botId, mesa) {
  const bot          = partida.jugadores.find(j => j.id === botId);
  const apuesta      = bot?.apuesta ?? 0;
  const bazasGanadas = bot?.bazasGanadas ?? 0;
  const quiereGanar  = (apuesta - bazasGanadas) > 0;

  const idxAsBastos = mesa.findIndex(j => j.carta.valor === 1 && j.carta.palo === 'bastos');
  if (idxAsBastos === -1) return 0;

  const cartasIntercambiables = mesa
    .map((j, idx) => ({ ...j, idx }))
    .filter((j, idx) => idx !== idxAsBastos && j.carta.valor !== 1);

  if (cartasIntercambiables.length === 0) return idxAsBastos;

  if (quiereGanar) {
    cartasIntercambiables.sort((a, b) => b.carta.valor - a.carta.valor);
  } else {
    cartasIntercambiables.sort((a, b) => a.carta.valor - b.carta.valor);
  }

  return cartasIntercambiables[0].idx;
}

// ── DILEMA DEL PRISIONERO (Hardcore) ─────────────────────────────────────────
// El bot elige según su situación: si va ganando → traiciona (no arriesga),
// si va perdiendo → colabora (intenta sacar algo positivo)
function elegirEleccionDuelo(partida, botId) {
  const bot = partida.jugadores.find(j => j.id === botId);
  if (!bot) return 'traicionar';
  // Si el bot tiene pocas vidas → intenta colaborar para el maná
  if (bot.vidas <= 2) return 'colaborar';
  // Si va cómodo → traiciona (estrategia dominante en teoría de juegos)
  return Math.random() < 0.35 ? 'colaborar' : 'traicionar';
}

module.exports = {
  esBot,
  crearJugadorBot,
  calcularApuesta,
  elegirCarta,
  elegirObjetivoAsEspadas,
  elegirObjetivoAsBastos,
  elegirEleccionDuelo,
  BOT_DELAY_MS
};
