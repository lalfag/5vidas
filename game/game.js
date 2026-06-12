const { crearBaraja, barajar, repartir } = require('./deck');

const CARTAS_POR_SUBRONDA = [5, 4, 3, 2, 1];

// Configuración de cada modalidad
const CONFIG_MODALIDAD = {
  clasico: {
    cartasBocaAbajo:      false,  // cartas visibles al jugar
    barajarTrasApuestas:  false,  // mano se baraja tras apostar
    rondaFinalVerPropia:  false,  // en ronda final NO ves tu carta
    rondaFinalEspiar:     false   // en ronda final NO puedes espiar
  },
  twisted: {
    cartasBocaAbajo:      true,   // cartas boca abajo hasta que todos juegan
    barajarTrasApuestas:  false,
    rondaFinalVerPropia:  true,   // en ronda final SÍ ves tu carta
    rondaFinalEspiar:     false
  },
  chaos: {
    cartasBocaAbajo:      false,
    barajarTrasApuestas:  true,   // mano se baraja tras apostar
    rondaFinalVerPropia:  true,   // en ronda final SÍ ves tu carta
    rondaFinalEspiar:     true    // en ronda final puedes espiar una carta rival
  }
};

function crearPartida(jugadores, modalidad = 'clasico') {
  return {
    jugadores: jugadores.map(j => ({
      id:          j.id,
      nickname:    j.nickname,
      vidas:       5,
      mano:        [],
      apuesta:     null,
      bazasGanadas: 0
    })),
    subrondaActual:    0,
    minirondaActual:   0,
    fase:              'apuestas',
    turnoIdx:          0,
    iniciadorIdx:      0,
    mesa:              [],
    apuestasRealizadas: 0,
    historial:         [],
    modalidad,
    config:            CONFIG_MODALIDAD[modalidad] || CONFIG_MODALIDAD.clasico
  };
}

function iniciarSubronda(partida) {
  const numCartas = CARTAS_POR_SUBRONDA[partida.subrondaActual];
  const baraja    = barajar(crearBaraja());
  const manos     = repartir(baraja, partida.jugadores.length, numCartas);

  partida.jugadores.forEach((j, i) => {
    j.mano         = manos[i];
    j.apuesta      = null;
    j.bazasGanadas = 0;
    j.manoBarajada = false; // flag para chaos
    j.espiadoPor   = [];    // quién ha espiado esta carta (chaos ronda final)
  });

  partida.minirondaActual    = 0;
  partida.fase               = 'apuestas';
  partida.mesa               = [];
  partida.apuestasRealizadas = 0;
  partida.turnoIdx           = partida.iniciadorIdx;

  log(partida, `Subronda ${partida.subrondaActual + 1} iniciada — ${numCartas} cartas [${partida.modalidad}]`);
  return partida;
}

function cartasEnSubronda(partida) {
  return CARTAS_POR_SUBRONDA[partida.subrondaActual];
}

function apuestaValida(partida, jugadorId, cantidad) {
  const numCartas    = cartasEnSubronda(partida);
  const esRondaFinal = partida.subrondaActual === 4;

  if (cantidad < 0 || cantidad > numCartas) {
    return { valida: false, motivo: `Debe ser entre 0 y ${numCartas}` };
  }

  if (!esRondaFinal) {
    const esUltimo   = partida.apuestasRealizadas === partida.jugadores.length - 1;
    if (esUltimo) {
      const sumaActual = partida.jugadores.reduce((acc, j) => acc + (j.apuesta ?? 0), 0);
      if (sumaActual + cantidad === numCartas) {
        return { valida: false, motivo: `No puedes apostar ${cantidad} (haría la suma igual a ${numCartas})` };
      }
    }
  }

  return { valida: true };
}

function registrarApuesta(partida, jugadorId, cantidad) {
  const jugador = partida.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { error: 'Jugador no encontrado' };
  if (partida.fase !== 'apuestas') return { error: 'No es fase de apuestas' };

  const esRondaFinal     = partida.subrondaActual === 4;
  // En clásico la ronda final es simultánea (todos apuestan a la vez)
  // En twisted/chaos la ronda final es secuencial (ves tu carta, turno normal)
  const apuestaSimultanea = esRondaFinal && partida.modalidad === 'clasico';

  if (!apuestaSimultanea && partida.jugadores[partida.turnoIdx].id !== jugadorId) {
    return { error: 'No es tu turno' };
  }
  if (jugador.apuesta !== null) return { error: 'Ya has apostado' };

  const validacion = apuestaValida(partida, jugadorId, cantidad);
  if (!validacion.valida) return { error: validacion.motivo };

  jugador.apuesta = cantidad;
  partida.apuestasRealizadas++;
  log(partida, `${jugador.nickname} apuesta ${cantidad}`);

  // Avanzar turno en todos los modos excepto ronda final clásica (simultánea)
  if (!apuestaSimultanea) {
    partida.turnoIdx = siguienteTurno(partida.turnoIdx, partida.jugadores.length);
  }

  // Cuando todos han apostado
  if (partida.apuestasRealizadas === partida.jugadores.length) {
    // CHAOS: barajar manos tras las apuestas
    if (partida.config.barajarTrasApuestas) {
      partida.jugadores.forEach(j => {
        j.mano        = barajar(j.mano);
        j.manoBarajada = true;
      });
      log(partida, '[CHAOS] Manos barajadas');
    }
    partida.fase     = 'juego';
    partida.turnoIdx = partida.iniciadorIdx;
    log(partida, 'Apuestas completadas — comienza el juego');
  }

  return { ok: true, partida };
}

function jugarCarta(partida, jugadorId, cartaIdx) {
  const jugador = partida.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { error: 'Jugador no encontrado' };
  if (partida.fase !== 'juego') return { error: 'No es fase de juego' };
  if (partida.jugadores[partida.turnoIdx].id !== jugadorId) return { error: 'No es tu turno' };
  if (cartaIdx < 0 || cartaIdx >= jugador.mano.length) return { error: 'Carta inválida' };

  const carta = jugador.mano.splice(cartaIdx, 1)[0];

  // TWISTED: carta boca abajo hasta que todos jueguen
  const bocaAbajo = partida.config.cartasBocaAbajo;
  partida.mesa.push({ jugadorId, carta, oculta: bocaAbajo });

  log(partida, `${jugador.nickname} juega ${bocaAbajo ? '?' : carta.valor + ' de ' + carta.palo}`);

  partida.turnoIdx = siguienteTurno(partida.turnoIdx, partida.jugadores.length);

  const todosJugaron = partida.mesa.length === partida.jugadores.length;
  if (todosJugaron) {
    // TWISTED: revelar todas las cartas
    if (bocaAbajo) {
      partida.mesa.forEach(j => { j.oculta = false; });
      log(partida, '[TWISTED] Cartas reveladas');
    }
    partida.fase = 'resolucion';
  }

  return { ok: true, partida, todosJugaron };
}

// CHAOS ronda final: espiar una carta rival
function espiarCarta(partida, espiadorId, objetivoId) {
  if (!partida.config.rondaFinalEspiar) return { error: 'No disponible en este modo' };
  if (partida.subrondaActual !== 4) return { error: 'Solo en la ronda final' };
  if (partida.jugadores.length < 3) return { error: 'Necesitas al menos 3 jugadores' };

  const objetivo = partida.jugadores.find(j => j.id === objetivoId);
  if (!objetivo) return { error: 'Jugador no encontrado' };
  if (objetivoId === espiadorId) return { error: 'No puedes espiarte a ti mismo' };
  if (!objetivo.mano || objetivo.mano.length === 0) return { error: 'Sin cartas que espiar' };

  // Guardar quién ha espiado a quién
  if (!objetivo.espiadoPor) objetivo.espiadoPor = [];
  if (objetivo.espiadoPor.includes(espiadorId)) return { error: 'Ya has espiado a este jugador' };
  objetivo.espiadoPor.push(espiadorId);

  return { ok: true, carta: objetivo.mano[0] };
}

function siguienteTurno(idx, total) {
  return (idx + 1) % total;
}

function log(partida, msg) {
  partida.historial.push(msg);
  console.log(`[PARTIDA] ${msg}`);
}

function vistaPublica(partida, miId) {
  const esRondaFinal   = partida.subrondaActual === 4;
  const todosApostaron = partida.jugadores.every(j => j.apuesta !== null);
  const soyEspectador  = !partida.jugadores.find(j => j.id === miId);
  const config         = partida.config;

  // En ronda final, ¿veo mi propia carta?
  const verPropia = config.rondaFinalVerPropia;

  // Cartas en mesa: en TWISTED mientras no todos han jugado, ocultar
  const mesaVisible = partida.mesa.map(j => ({
    jugadorId: j.jugadorId,
    carta:     j.oculta ? null : j.carta,
    oculta:    j.oculta || false
  }));

  return {
    subrondaActual:   partida.subrondaActual,
    minirondaActual:  partida.minirondaActual,
    fase:             partida.fase,
    turnoIdx:         partida.turnoIdx,
    iniciadorIdx:     partida.iniciadorIdx,
    mesa:             mesaVisible,
    esRondaFinal,
    soyEspectador,
    modalidad:        partida.modalidad,
    config:           { rondaFinalEspiar: config.rondaFinalEspiar, rondaFinalVerPropia: verPropia },
    jugadores: partida.jugadores.map(j => ({
      id:           j.id,
      nickname:     j.nickname,
      vidas:        j.vidas,
      apuesta:      esRondaFinal
        ? (todosApostaron || j.id === miId ? j.apuesta : null)
        : j.apuesta,
      bazasGanadas: j.bazasGanadas,
      cartasEnMano: j.mano.length,
      manoBarajada: j.manoBarajada || false,
      mano: (() => {
        if (soyEspectador) return j.mano;
        if (esRondaFinal) {
          if (j.id === miId) return verPropia ? j.mano : null;
          return j.mano;
        }
        // CHAOS: si la mano está barajada, no revelar las cartas propias
        if (j.id === miId) {
          if (partida.config.barajarTrasApuestas && j.manoBarajada) return null;
          return j.mano;
        }
        return null;
      })()
    }))
  };
}

module.exports = {
  crearPartida,
  iniciarSubronda,
  registrarApuesta,
  jugarCarta,
  espiarCarta,
  apuestaValida,
  cartasEnSubronda,
  vistaPublica,
  CARTAS_POR_SUBRONDA,
  CONFIG_MODALIDAD
};
