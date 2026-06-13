const { crearBaraja, barajar, repartir } = require('./deck');

const CARTAS_POR_SUBRONDA = [5, 4, 3, 2, 1];

// Configuración de cada modalidad
const CONFIG_MODALIDAD = {
  clasico: {
    cartasBocaAbajo:        false,
    barajarTrasApuestas:    false,
    rondaFinalVerPropia:    false,
    rondaFinalEspiar:       false,
    cartasOcultasAlApostar: false,
    hardcore:               false
  },
  twisted: {
    cartasBocaAbajo:        true,
    barajarTrasApuestas:    false,
    rondaFinalVerPropia:    true,
    rondaFinalEspiar:       false,
    cartasOcultasAlApostar: false,
    hardcore:               false
  },
  chaos: {
    cartasBocaAbajo:        false,
    barajarTrasApuestas:    true,
    rondaFinalVerPropia:    true,
    rondaFinalEspiar:       true,
    cartasOcultasAlApostar: false,
    hardcore:               false
  },
  leap: {
    cartasBocaAbajo:        false,
    barajarTrasApuestas:    false,
    rondaFinalVerPropia:    false,
    rondaFinalEspiar:       false,
    cartasOcultasAlApostar: true,
    hardcore:               false
  },
  hardcore: {
    cartasBocaAbajo:        false,
    barajarTrasApuestas:    false,
    rondaFinalVerPropia:    false,  // igual que clásico: NO ves tu carta
    rondaFinalEspiar:       false,
    cartasOcultasAlApostar: false,
    hardcore:               true,   // flag maestra que activa todo lo especial
    jokers:                 true,   // 2 jokers en el mazo
    poderesFiguras:         true,   // 7 de oros árbitro + rey inmune
    sistemaManá:            true,   // logros y barra de maná
    dilemaDelPrisionero:    true,   // duelo en ronda final
    maxVidas:               7       // cap de vidas en hardcore
  }
};

// ── BARAJA HARDCORE ──────────────────────────────────────────────────────────
// Añade 2 jokers a la baraja española estándar
function crearBarajaHardcore() {
  const baraja = crearBaraja(); // baraja española de 40 cartas
  // Joker 1 y Joker 2 — valor especial 0, palo 'joker'
  baraja.push({ valor: 0, palo: 'joker', id: 'joker1' });
  baraja.push({ valor: 0, palo: 'joker', id: 'joker2' });
  return baraja;
}

// ── ESTADO INICIAL DE MANÁ POR JUGADOR ───────────────────────────────────────
function estadoManaInicial() {
  return {
    mana:              0,       // maná actual (0-4, al llegar a 5 → vida)
    vidasGanadasMana:  0,       // total de vidas ganadas por maná en la partida
    logrosConseguidos: [],      // array de { id, nombre, turno }
    subrondasSinPerderVida: 0,  // contador para Indestructible
    racha: 0                    // subrondas acertando apuesta exacta (RachaPerfecta)
  };
}

// ── CREAR PARTIDA ─────────────────────────────────────────────────────────────
function crearPartida(jugadores, modalidad = 'clasico') {
  const config    = CONFIG_MODALIDAD[modalidad] || CONFIG_MODALIDAD.clasico;
  const maxVidas  = config.maxVidas || 5;

  return {
    jugadores: jugadores.map(j => ({
      id:           j.id,
      nickname:     j.nickname,
      token:        j.token || null,
      vidas:        5,
      avatar:       j.avatar || null,
      mano:         [],
      apuesta:      null,
      bazasGanadas: 0,
      // Estado Hardcore por jugador
      mana:         config.hardcore ? estadoManaInicial() : null
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
    config,
    maxVidas,
    // Estado Hardcore global
    duelo:             null,  // { jugadorAId, jugadorBId, fase, eleccionA, eleccionB }
    inversionEscala:   false  // true cuando hay joker activo en mesa
  };
}

// ── INICIAR SUBRONDA ──────────────────────────────────────────────────────────
function iniciarSubronda(partida) {
  const numCartas = CARTAS_POR_SUBRONDA[partida.subrondaActual];
  const esHardcore = partida.config.hardcore;

  // Crear baraja según modalidad
  const baraja = barajar(esHardcore ? crearBarajaHardcore() : crearBaraja());
  const manos  = repartir(baraja, partida.jugadores.length, numCartas);

  partida.jugadores.forEach((j, i) => {
    j.mano         = manos[i];
    j.apuesta      = null;
    j.bazasGanadas = 0;
    j.manoBarajada = false;
    j.espiadoPor   = [];
  });

  partida.minirondaActual    = 0;
  partida.fase               = 'apuestas';
  partida.mesa               = [];
  partida.apuestasRealizadas = 0;
  partida.turnoIdx           = partida.iniciadorIdx;
  partida.inversionEscala    = false;
  partida.duelo              = null;

  log(partida, `Subronda ${partida.subrondaActual + 1} iniciada — ${numCartas} cartas [${partida.modalidad}]`);

  // HARDCORE ronda final: preparar duelo del prisionero
  if (esHardcore && partida.subrondaActual === 4) {
    partida.duelo = prepararDuelo(partida);
    partida.fase  = 'duelo'; // fase previa a apuestas
    log(partida, `[HARDCORE] Duelo del prisionero preparado: ${partida.duelo.jugadorAId} vs ${partida.duelo.jugadorBId}`);
  }

  return partida;
}

// ── DUELO DEL PRISIONERO ──────────────────────────────────────────────────────
function prepararDuelo(partida) {
  const vivos = partida.jugadores;
  if (vivos.length < 2) return null;

  // Selección completamente aleatoria de dos jugadores distintos
  const shuffled  = [...vivos].sort(() => Math.random() - 0.5);
  const jugadorA  = shuffled[0];
  const jugadorB  = shuffled[1];

  return {
    jugadorAId:  jugadorA.id,
    jugadorBId:  jugadorB.id,
    eleccionA:   null,   // 'colaborar' | 'traicionar'
    eleccionB:   null,
    resuelto:    false,
    timer:       null    // se gestiona en server.js
  };
}

function registrarEleccionDuelo(partida, jugadorId, eleccion) {
  const duelo = partida.duelo;
  if (!duelo || duelo.resuelto) return { error: 'No hay duelo activo' };
  if (!['colaborar', 'traicionar'].includes(eleccion)) return { error: 'Elección inválida' };

  const esA = duelo.jugadorAId === jugadorId;
  const esB = duelo.jugadorBId === jugadorId;
  if (!esA && !esB) return { error: 'No eres parte del duelo' };

  if (esA) {
    if (duelo.eleccionA !== null) return { error: 'Ya elegiste' };
    duelo.eleccionA = eleccion;
  } else {
    if (duelo.eleccionB !== null) return { error: 'Ya elegiste' };
    duelo.eleccionB = eleccion;
  }

  // Si los dos ya eligieron, resolver
  const ambosEligieron = duelo.eleccionA !== null && duelo.eleccionB !== null;
  if (ambosEligieron) {
    return { ok: true, resuelto: true };
  }

  return { ok: true, resuelto: false };
}

function resolverDuelo(partida) {
  const duelo = partida.duelo;
  if (!duelo) return null;

  const jugA   = partida.jugadores.find(j => j.id === duelo.jugadorAId);
  const jugB   = partida.jugadores.find(j => j.id === duelo.jugadorBId);
  if (!jugA || !jugB) return null;

  const cartaA = jugA.mano[0]; // en ronda final cada uno tiene 1 carta
  const cartaB = jugB.mano[0];

  const elA = duelo.eleccionA || 'traicionar'; // timeout → traición
  const elB = duelo.eleccionB || 'traicionar';

  const resultado = {
    jugadorAId:  duelo.jugadorAId,
    jugadorBId:  duelo.jugadorBId,
    eleccionA:   elA,
    eleccionB:   elB,
    efectos:     []
  };

  if (elA === 'colaborar' && elB === 'colaborar') {
    // Ambos colaboran: +2 maná cada uno + saben si su carta es mayor o menor
    const aEsMayor = cartaA.valor > cartaB.valor;
    resultado.efectos.push(
      { jugadorId: duelo.jugadorAId, mana: +2, info: aEsMayor ? 'mayor' : 'menor' },
      { jugadorId: duelo.jugadorBId, mana: +2, info: aEsMayor ? 'menor' : 'mayor' }
    );

  } else if (elA === 'traicionar' && elB === 'colaborar') {
    // A traiciona, B colabora: A sabe exactamente cuánto mayor es su carta; B pierde 1 vida
    const diferencia = cartaA.valor - cartaB.valor;
    resultado.efectos.push(
      { jugadorId: duelo.jugadorAId, mana: 0, infoCuanto: diferencia },
      { jugadorId: duelo.jugadorBId, mana: 0, vidasPerdidas: 1, info: 'menor' }
    );

  } else if (elA === 'colaborar' && elB === 'traicionar') {
    // B traiciona, A colabora: B sabe exactamente cuánto mayor es su carta; A pierde 1 vida
    const diferencia = cartaB.valor - cartaA.valor;
    resultado.efectos.push(
      { jugadorId: duelo.jugadorAId, mana: 0, vidasPerdidas: 1, info: 'menor' },
      { jugadorId: duelo.jugadorBId, mana: 0, infoCuanto: diferencia }
    );

  } else {
    // Ambos traicionan: -1 maná cada uno, sin información
    resultado.efectos.push(
      { jugadorId: duelo.jugadorAId, mana: -1 },
      { jugadorId: duelo.jugadorBId, mana: -1 }
    );
  }

  // Aplicar efectos sobre el estado del jugador
  resultado.efectos.forEach(efecto => {
    const j = partida.jugadores.find(p => p.id === efecto.jugadorId);
    if (!j) return;
    if (efecto.mana && j.mana) {
      aplicarMana(partida, j, efecto.mana, null);
    }
    if (efecto.vidasPerdidas) {
      j.vidas = Math.max(0, j.vidas - efecto.vidasPerdidas);
    }
  });

  duelo.resuelto = true;
  // Tras el duelo, pasar a fase de apuestas
  partida.fase = 'apuestas';

  log(partida, `[DUELO] ${elA} vs ${elB} — resuelto`);
  return resultado;
}

// ── APUESTAS ──────────────────────────────────────────────────────────────────
function cartasEnSubronda(partida) {
  return CARTAS_POR_SUBRONDA[partida.subrondaActual];
}

function apuestaValida(partida, jugadorId, cantidad) {
  const numCartas    = cartasEnSubronda(partida);
  const esRondaFinal = partida.subrondaActual === 4;

  if (cantidad < 0 || cantidad > numCartas) {
    return { valida: false, motivo: `Debe ser entre 0 y ${numCartas}` };
  }

  // En ronda final de clásico (simultánea) no hay restricción del último
  if (!esRondaFinal || partida.modalidad !== 'clasico') {
    const esUltimo = partida.apuestasRealizadas === partida.jugadores.length - 1;
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

  const esRondaFinal      = partida.subrondaActual === 4;
  const apuestaSimultanea = esRondaFinal && partida.modalidad === 'clasico';

  if (!apuestaSimultanea && partida.jugadores[partida.turnoIdx].id !== jugadorId) {
    return { error: 'No es tu turno' };
  }
  if (jugador.apuesta !== null) return { error: 'Ya has apostado' };

  const validacion = apuestaValida(partida, jugadorId, cantidad);
  if (!validacion.valida) return { error: validacion.motivo };

  // Detectar logro "Filo de la Navaja" antes de registrar
  let logroFiloNavaja = null;
  if (partida.config.hardcore) {
    const esUltimo = partida.apuestasRealizadas === partida.jugadores.length - 1;
    if (esUltimo && !esRondaFinal) {
      const sumaActual = partida.jugadores.reduce((acc, j) => acc + (j.apuesta ?? 0), 0);
      const numCartas  = cartasEnSubronda(partida);
      // El número más restrictivo es el que más se acerca a la prohibición sin tocarla
      const prohibido  = numCartas - sumaActual;
      if (cantidad === prohibido - 1 || cantidad === prohibido + 1) {
        logroFiloNavaja = jugador;
      }
    }
  }

  jugador.apuesta = cantidad;
  partida.apuestasRealizadas++;
  log(partida, `${jugador.nickname} apuesta ${cantidad}`);

  if (!apuestaSimultanea) {
    partida.turnoIdx = siguienteTurno(partida.turnoIdx, partida.jugadores.length);
  }

  const logros = [];

  if (logroFiloNavaja && logroFiloNavaja.mana) {
    const l = aplicarMana(partida, logroFiloNavaja, 1, 'filo_navaja');
    if (l) logros.push(l);
  }

  if (partida.apuestasRealizadas === partida.jugadores.length) {
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

  return { ok: true, partida, logros };
}

// ── JUGAR CARTA ───────────────────────────────────────────────────────────────
function jugarCarta(partida, jugadorId, cartaIdx) {
  const jugador = partida.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { error: 'Jugador no encontrado' };
  if (partida.fase !== 'juego') return { error: 'No es fase de juego' };
  if (partida.jugadores[partida.turnoIdx].id !== jugadorId) return { error: 'No es tu turno' };
  if (cartaIdx < 0 || cartaIdx >= jugador.mano.length) return { error: 'Carta inválida' };

  const carta     = jugador.mano.splice(cartaIdx, 1)[0];
  const bocaAbajo = partida.config.cartasBocaAbajo;
  partida.mesa.push({ jugadorId, carta, oculta: bocaAbajo });

  log(partida, `${jugador.nickname} juega ${bocaAbajo ? '?' : carta.valor + ' de ' + carta.palo}`);

  partida.turnoIdx = siguienteTurno(partida.turnoIdx, partida.jugadores.length);

  const todosJugaron = partida.mesa.length === partida.jugadores.length;
  if (todosJugaron) {
    if (bocaAbajo) {
      partida.mesa.forEach(j => { j.oculta = false; });
      log(partida, '[TWISTED] Cartas reveladas');
    }

    // HARDCORE: comprobar si hay joker en mesa
    if (partida.config.jokers) {
      const jokerEnMesa = partida.mesa.filter(j => j.carta.palo === 'joker');
      if (jokerEnMesa.length === 1) {
        // Un joker activo: invertir escala
        partida.inversionEscala = true;
        log(partida, '[HARDCORE] Joker activo — escala invertida');
      } else if (jokerEnMesa.length >= 2) {
        // Dos jokers: se anulan, escala normal (se gestionan en resolver)
        partida.inversionEscala = false;
        log(partida, '[HARDCORE] Dos jokers — se anulan, escala normal');
      }
    }

    partida.fase = 'resolucion';
  }

  return { ok: true, partida, todosJugaron };
}

// ── ACCIÓN 7 DE OROS (HARDCORE) ───────────────────────────────────────────────
// El jugador que tiró el 7 de oros elige intercambiar el valor de dos cartas en mesa
// Se llama desde server.js durante la fase de resolución
function aplicar7Oros(mesa, idxA, idxB, jugadorId7) {
  if (idxA === idxB) return { error: 'Debes elegir dos cartas distintas' };
  if (idxA < 0 || idxA >= mesa.length || idxB < 0 || idxB >= mesa.length) {
    return { error: 'Índice de carta inválido' };
  }
  // No puede intercambiar su propia carta
  if (mesa[idxA].jugadorId === jugadorId7 || mesa[idxB].jugadorId === jugadorId7) {
    return { error: 'No puedes intercambiar tu propia carta' };
  }

  const nuevaMesa    = mesa.map(j => ({ ...j, carta: { ...j.carta } }));
  const valorTemp    = nuevaMesa[idxA].carta.valor;
  nuevaMesa[idxA].carta.valor = nuevaMesa[idxB].carta.valor;
  nuevaMesa[idxB].carta.valor = valorTemp;

  return { ok: true, mesa: nuevaMesa };
}

// ── SISTEMA DE MANÁ ───────────────────────────────────────────────────────────
const LOGROS = {
  ultimo_en_pie:         { nombre: 'Último en Pie',           mana: 1 },
  pureza:                { nombre: 'Pureza',                  mana: 1 },
  regicida:              { nombre: 'Regicida',                mana: 1 },
  intocable:             { nombre: 'Intocable',               mana: 1 },
  tercer_acto:           { nombre: 'Tercer Acto',             mana: 1 },
  fantasma:              { nombre: 'Fantasma',                mana: 1 },
  filo_navaja:           { nombre: 'Filo de la Navaja',       mana: 1 },
  cazador_ases:          { nombre: 'Cazador de Ases',         mana: 1 },
  caos_controlado:       { nombre: 'Caos Controlado',         mana: 1 },
  vidente:               { nombre: 'Vidente',                 mana: 1 },
  harmonia:              { nombre: 'Harmonía',                mana: 1 },
  rey_detras_del_rey:    { nombre: 'El Rey Detrás del Rey',   mana: 1 },
  reanimador:            { nombre: 'Reanimador',              mana: 2 },
  agonia:                { nombre: 'Agonía',                  mana: 2 },
  racha_perfecta:        { nombre: 'Racha Perfecta',          mana: 2 },
  lo_mas_bajo:           { nombre: 'Lo más bajo es lo más alto', mana: 2 },
  mentor:                { nombre: 'Mentor',                  mana: 3 },
  indestructible:        { nombre: 'Indestructible',          mana: 5 }
};

const MANA_PARA_VIDA = 5;

// Aplica maná a un jugador. Devuelve el evento de logro si se dispara uno.
function aplicarMana(partida, jugador, cantidad, logroId) {
  if (!jugador.mana) return null;

  const maxVidas = partida.maxVidas || 7;
  jugador.mana.mana = Math.max(0, jugador.mana.mana + cantidad);

  const evento = logroId ? {
    jugadorId: jugador.id,
    nickname:  jugador.nickname,
    logroId,
    logro:     LOGROS[logroId],
    manaGanado: cantidad
  } : null;

  if (logroId && LOGROS[logroId]) {
    jugador.mana.logrosConseguidos.push({
      id:     logroId,
      nombre: LOGROS[logroId].nombre,
      turno:  partida.minirondaActual
    });
  }

  // Comprobar si se alcanza el umbral de vida
  let vidaGanada = false;
  while (jugador.mana.mana >= MANA_PARA_VIDA) {
    if (jugador.vidas < maxVidas) {
      jugador.vidas++;
      jugador.mana.mana -= MANA_PARA_VIDA;
      jugador.mana.vidasGanadasMana++;
      vidaGanada = true;
      log(partida, `[MANÁ] ${jugador.nickname} gana 1 vida por maná (${jugador.vidas} vidas)`);
    } else {
      // Ya tiene el máximo: guardar maná lleno como colchón
      // Si pierde una vida y tiene maná lleno, se recuperará automáticamente (en server.js)
      break;
    }
  }

  if (evento) evento.vidaGanada = vidaGanada;
  return evento;
}

// Comprueba los logros de maná al final de una minironda
// Devuelve array de eventos de logro para emitir al frontend
function comprobarLogrosMinironda(partida, contexto) {
  // contexto: { ganadorId, mesaFinal, mesaOriginal, inversionEscala }
  if (!partida.config.hardcore) return [];

  const eventos   = [];
  const mesa      = contexto.mesaFinal      || [];
  const original  = contexto.mesaOriginal   || [];
  const ganadorId = contexto.ganadorId;
  const ganador   = partida.jugadores.find(j => j.id === ganadorId);

  // 1. ÚLTIMO EN PIE — ganador fue la última carta viva tras anulaciones
  if (ganador && contexto.fueUltimoEnPie) {
    const ev = aplicarMana(partida, ganador, 1, 'ultimo_en_pie');
    if (ev) eventos.push(ev);
  }

  // 2. PUREZA — todas las cartas originales son del mismo palo
  if (ganador && original.length > 1) {
    const paloUnico = original[0].carta.palo;
    const todosMismoPalo = original.every(j => j.carta.palo === paloUnico);
    if (todosMismoPalo && paloUnico !== 'joker') {
      // Harmonía: TODOS suman (no solo el ganador)
      partida.jugadores.forEach(j => {
        const ev = aplicarMana(partida, j, 1, 'harmonia');
        if (ev) eventos.push(ev);
      });
      // Pureza: solo el ganador
      const ev = aplicarMana(partida, ganador, 1, 'pureza');
      if (ev) eventos.push(ev);
    }
  }

  // 3. LO MÁS BAJO ES LO MÁS ALTO — ganó con el 1 con escala invertida
  if (ganador && contexto.inversionEscala) {
    const cartaGanador = original.find(j => j.jugadorId === ganadorId);
    if (cartaGanador && cartaGanador.carta.valor === 1) {
      const ev = aplicarMana(partida, ganador, 2, 'lo_mas_bajo');
      if (ev) eventos.push(ev);
    }
  }

  // 4. INTOCABLE — as supervivió en mesa de 4+ jugadores
  if (original.length >= 4) {
    mesa.forEach(j => {
      if (j.carta.valor === 1) {
        const jug = partida.jugadores.find(p => p.id === j.jugadorId);
        if (jug) {
          const ev = aplicarMana(partida, jug, 1, 'intocable');
          if (ev) eventos.push(ev);
        }
      }
    });
  }

  return eventos;
}

// Comprueba logros al final de una subronda
function comprobarLogrosSubronda(partida, resumen) {
  if (!partida.config.hardcore) return [];

  const eventos = [];

  resumen.forEach(r => {
    const jugador = partida.jugadores.find(j => j.id === r.id)
      || partida.jugadores.find(j => j.nickname === r.nickname);
    if (!jugador || !jugador.mana) return;

    // VIDENTE — acertó exacto en ronda final
    if (partida.subrondaActual === 4 && r.vidasRestadas === 0) {
      const ev = aplicarMana(partida, jugador, 1, 'vidente');
      if (ev) eventos.push(ev);
    }

    // FANTASMA — apostó 0, cumplió, y tenía sota o superior
    if (r.apuesta === 0 && r.vidasRestadas === 0) {
      const teniaSotaOSuperior = jugador.mano && jugador.mano.some(c => c.valor >= 10);
      // Nota: la mano ya se usó, así que esto debe registrarse antes de limpiar mano
      // Se pasa por contexto desde server.js con el flag precalculado
      if (r.teniaSotaOSuperior) {
        const ev = aplicarMana(partida, jugador, 1, 'fantasma');
        if (ev) eventos.push(ev);
      }
    }

    // RACHA PERFECTA — acertó exacto tres subrondas consecutivas
    if (r.vidasRestadas === 0) {
      jugador.mana.racha = (jugador.mana.racha || 0) + 1;
      if (jugador.mana.racha >= 3) {
        const ev = aplicarMana(partida, jugador, 2, 'racha_perfecta');
        if (ev) eventos.push(ev);
        jugador.mana.racha = 0; // reset para no disparar repetido
      }
    } else {
      jugador.mana.racha = 0;
    }

    // AGONÍA — único jugador con 1 vida durante una subronda completa
    if (r.eraUnicoConUnaVida) {
      const ev = aplicarMana(partida, jugador, 2, 'agonia');
      if (ev) eventos.push(ev);
    }

    // INDESTRUCTIBLE — 5 subrondas sin perder vida
    if (r.vidasRestadas === 0) {
      jugador.mana.subrondasSinPerderVida = (jugador.mana.subrondasSinPerderVida || 0) + 1;
      if (jugador.mana.subrondasSinPerderVida >= 5) {
        const ev = aplicarMana(partida, jugador, 5, 'indestructible');
        if (ev) eventos.push(ev);
        jugador.mana.subrondasSinPerderVida = 0;
      }
    } else {
      jugador.mana.subrondasSinPerderVida = 0;
    }
  });

  return eventos;
}

// ── ESPIAR CARTA (CHAOS) ──────────────────────────────────────────────────────
function espiarCarta(partida, espiadorId, objetivoId) {
  if (!partida.config.rondaFinalEspiar) return { error: 'No disponible en este modo' };
  if (partida.subrondaActual !== 4) return { error: 'Solo en la ronda final' };
  if (partida.jugadores.length < 3) return { error: 'Necesitas al menos 3 jugadores' };

  const objetivo = partida.jugadores.find(j => j.id === objetivoId);
  if (!objetivo) return { error: 'Jugador no encontrado' };
  if (objetivoId === espiadorId) return { error: 'No puedes espiarte a ti mismo' };
  if (!objetivo.mano || objetivo.mano.length === 0) return { error: 'Sin cartas que espiar' };

  if (!objetivo.espiadoPor) objetivo.espiadoPor = [];
  if (objetivo.espiadoPor.includes(espiadorId)) return { error: 'Ya has espiado a este jugador' };
  objetivo.espiadoPor.push(espiadorId);

  return { ok: true, carta: objetivo.mano[0] };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function siguienteTurno(idx, total) {
  return (idx + 1) % total;
}

function log(partida, msg) {
  partida.historial.push(msg);
  console.log(`[PARTIDA] ${msg}`);
}

// ── VISTA PÚBLICA ─────────────────────────────────────────────────────────────
function vistaPublica(partida, miId) {
  const esRondaFinal   = partida.subrondaActual === 4;
  const todosApostaron = partida.jugadores.every(j => j.apuesta !== null);
  const soyEspectador  = !partida.jugadores.find(j => j.id === miId);
  const config         = partida.config;
  const verPropia      = config.rondaFinalVerPropia;

  const mesaVisible = partida.mesa.map(j => ({
    jugadorId: j.jugadorId,
    carta:     j.oculta ? null : j.carta,
    oculta:    j.oculta || false
  }));

  // Info del duelo — solo los participantes ven su propia elección
  let dueloPublico = null;
  if (partida.duelo) {
    const d = partida.duelo;
    dueloPublico = {
      jugadorAId:   d.jugadorAId,
      jugadorBId:   d.jugadorBId,
      resuelto:     d.resuelto,
      // Cada jugador solo ve si él ya eligió (no la elección del rival)
      yaElegisteA:  d.jugadorAId === miId ? d.eleccionA !== null : undefined,
      yaElegisteB:  d.jugadorBId === miId ? d.eleccionB !== null : undefined,
      eleccionA:    d.resuelto ? d.eleccionA : (d.jugadorAId === miId ? d.eleccionA : null),
      eleccionB:    d.resuelto ? d.eleccionB : (d.jugadorBId === miId ? d.eleccionB : null)
    };
  }

  return {
    subrondaActual:    partida.subrondaActual,
    minirondaActual:   partida.minirondaActual,
    fase:              partida.fase,
    turnoIdx:          partida.turnoIdx,
    iniciadorIdx:      partida.iniciadorIdx,
    mesa:              mesaVisible,
    esRondaFinal,
    soyEspectador,
    modalidad:         partida.modalidad,
    inversionEscala:   partida.inversionEscala || false,
    duelo:             dueloPublico,
    config: {
      rondaFinalEspiar:   config.rondaFinalEspiar,
      rondaFinalVerPropia: verPropia,
      hardcore:           config.hardcore || false,
      jokers:             config.jokers   || false,
      poderesFiguras:     config.poderesFiguras || false
    },
    jugadores: partida.jugadores.map(j => ({
      id:           j.id,
      nickname:     j.nickname,
      vidas:        j.vidas,
      avatar:       j.avatar || null,
      apuesta:      esRondaFinal
        ? (todosApostaron || j.id === miId ? j.apuesta : null)
        : j.apuesta,
      bazasGanadas: j.bazasGanadas,
      cartasEnMano: j.mano.length,
      manoBarajada: j.manoBarajada || false,
      // Maná: cada jugador solo ve su propio maná completo; los demás ven solo el total
      mana: j.mana ? (j.id === miId || soyEspectador
        ? { mana: j.mana.mana, logros: j.mana.logrosConseguidos }
        : { mana: j.mana.mana }
      ) : null,
      mano: (() => {
        if (soyEspectador) return j.mano;
        if (esRondaFinal) {
          if (j.id === miId) return verPropia ? j.mano : null;
          return j.mano;
        }
        if (j.id === miId) {
          if (config.cartasOcultasAlApostar && partida.fase === 'apuestas') return null;
          if (config.barajarTrasApuestas && j.manoBarajada) return null;
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
  registrarEleccionDuelo,
  resolverDuelo,
  jugarCarta,
  aplicar7Oros,
  espiarCarta,
  apuestaValida,
  cartasEnSubronda,
  vistaPublica,
  aplicarMana,
  comprobarLogrosMinironda,
  comprobarLogrosSubronda,
  CARTAS_POR_SUBRONDA,
  CONFIG_MODALIDAD,
  LOGROS,
  MANA_PARA_VIDA
};
