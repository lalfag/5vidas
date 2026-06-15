const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  crearSala, unirseASala,
  obtenerSalaPorSocket, obtenerSalaPorToken, eliminarJugador
} = require('./game/roomManager');
const {
  crearPartida, iniciarSubronda, registrarApuesta,
  registrarEleccionDuelo, resolverDuelo,
  jugarCarta, aplicar7Oros, espiarCarta, vistaPublica,
  aplicarMana, comprobarLogrosMinironda, comprobarLogrosSubronda,
  CARTAS_POR_SUBRONDA, CONFIG_MODALIDAD, LOGROS,
  encontrarSiguienteSinApostar, encontrarSiguienteSinJugar
} = require('./game/game');
const {
  resolverMinironda, aplicarAsOros, aplicarAsEspadas,
  aplicarAsBastos, calcularVidasARestar
} = require('./game/resolver');

const DUELO_TIMEOUT_MS = 20000; // 20s para el duelo del prisionero
const dueloTimers = {};         // codigoSala → timeout

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// ── HELPERS ───────────────────────────────────────────────────────────────────

const TURN_TIMEOUT_MS = 60000; // 60s sin jugar → skip automático
const turnoTimers = {}; // codigoSala → timeout

function limpiarTurnoTimer(codigoSala) {
  if (turnoTimers[codigoSala]) {
    clearTimeout(turnoTimers[codigoSala]);
    delete turnoTimers[codigoSala];
  }
}

function iniciarTurnoTimer(sala) {
  limpiarTurnoTimer(sala.codigo);
  if (!sala.partida || sala.partida.fase !== 'juego') return;

  turnoTimers[sala.codigo] = setTimeout(() => {
    if (!sala.partida || sala.partida.fase !== 'juego') return;
    const jugadorActual = sala.partida.jugadores[sala.partida.turnoIdx];
    if (!jugadorActual) return;
    console.log(`[TIMEOUT] Skip automático de ${jugadorActual.nickname}`);
    // Jugar primera carta automáticamente
    const resultado = jugarCarta(sala.partida, jugadorActual.id, 0);
    if (resultado.error) return;
    io.to(sala.codigo).emit('turnoSkipeado', { nickname: jugadorActual.nickname });
    emitirEstado(sala);
    if (resultado.todosJugaron) {
      resolverYContinuar(sala);
    } else {
      iniciarTurnoTimer(sala);
    }
  }, TURN_TIMEOUT_MS);
}

function emitirEstado(sala) {
  sala.partida.jugadores.forEach(j => {
    io.to(j.id).emit('estadoActualizado', vistaPublica(sala.partida, j.id));
  });
  if (sala.espectadores) {
    sala.espectadores.forEach(j => {
      io.to(j.id).emit('estadoActualizado', vistaPublica(sala.partida, j.id));
    });
  }
}

const ANULACION_ANIM_MS = 900; // pausa para que se vea la animación de anulación

// Calcula la resolución de la minironda actual y continúa el flujo
// (gestionarAses / finalizarMinironda), insertando antes una pausa visual
// si hubo cartas anuladas por pares para que el cliente pueda animarlas.
function resolverYContinuar(sala) {
  const partida = sala.partida;
  const resolucion = resolverMinironda(partida.mesa, {
    inversionEscala: partida.inversionEscala || false,
    esHardcore:      partida.config.hardcore  || false
  });

  const gruposAnulados = resolucion.gruposAnulados || [];
  const hayAnulaciones = gruposAnulados.some(g => g.jugadas.length > 0);

  const continuar = () => {
    const hayAses = gestionarAses(sala, resolucion);
    if (!hayAses) finalizarMinironda(sala, resolucion.ganadorProvisional, resolucion.contextoLogros);
  };

  if (hayAnulaciones) {
    io.to(sala.codigo).emit('cartasAnuladas', {
      gruposAnulados: gruposAnulados.map(g => ({
        valor:   g.valor,
        jugadas: g.jugadas.map(j => ({ jugadorId: j.jugadorId, carta: j.carta }))
      }))
    });
    setTimeout(continuar, ANULACION_ANIM_MS);
  } else {
    continuar();
  }
}

function gestionarAses(sala, resultado) {
  const ases = resultado.ases;

  const siete7OrosActivo = sala.partida.config.hardcore &&
    resultado.mesa.some(j => j.carta.valor === 7 && j.carta.palo === 'oros');

  // Si no hay ases ni 7 de oros activo, no hay resolución asíncrona pendiente
  if (ases.length === 0 && !siete7OrosActivo) return false;

  sala.partida.resolucion = {
    mesa:               resultado.mesa,
    ases:               ases,
    efectosAs:          resultado.efectosAs,
    ganadorProvisional: resultado.ganadorProvisional,
    asesPendientes:     ases.map(a => a.carta.palo).filter(p => p === 'espadas' || p === 'bastos'),
    multiplicadorCopas: ases.some(a => a.carta.palo === 'copas'),
    contextoLogros:     resultado.contextoLogros || null,
    gruposAnulados:     resultado.gruposAnulados || [],
    // HARDCORE: 7 de oros activo en mesa
    siete7OrosActivo
  };

  if (ases.length > 0) {
    io.to(sala.codigo).emit('asesPendientes', {
      ases, efectosAs: resultado.efectosAs, mesa: resultado.mesa
    });

    ases.forEach(as => {
      if (as.carta.palo === 'espadas' || as.carta.palo === 'bastos') {
        io.to(as.jugadorId).emit('accionAs', {
          palo: as.carta.palo,
          mesa: resultado.mesa,
          gruposAnulados: resultado.gruposAnulados || []
        });
      }
    });
  }

  // HARDCORE: avisar al dueño del 7 de oros para que pueda usar su poder
  if (siete7OrosActivo) {
    const jugador7 = resultado.mesa.find(j => j.carta.valor === 7 && j.carta.palo === 'oros');
    if (jugador7) {
      io.to(jugador7.jugadorId).emit('siete7OrosPendiente', { mesa: resultado.mesa });
    }
  }

  if (sala.partida.resolucion.asesPendientes.length === 0 && !siete7OrosActivo) {
    comprobarAsesResueltos(sala);
  }

  return true;
}

function finalizarMinironda(sala, ganadorId, contextoLogros = null) {
  const partida       = sala.partida;
  const resolucion    = partida.resolucion || {};
  const multiplicador = resolucion.multiplicadorCopas ? 2 : 1;
  const jugador       = partida.jugadores.find(j => j.id === ganadorId);
  if (jugador) jugador.bazasGanadas += multiplicador;

  const numCartas = CARTAS_POR_SUBRONDA[partida.subrondaActual];

  // HARDCORE: comprobar logros de maná de esta minironda
  // contextoLogros puede venir del parámetro (caso sin ases) o de partida.resolucion (caso con ases/7oros)
  let eventosLogro = [];
  const ctxBase = contextoLogros || resolucion.contextoLogros || null;
  if (partida.config.hardcore && ctxBase) {
    const ctx = { ...ctxBase, ganadorId };
    eventosLogro = comprobarLogrosMinironda(partida, ctx);

    // Logro CaosControlado: joker anulado por otro joker
    if (ctx.jokerAnulado) {
      const mesaOrig = ctx.mesaOriginal || [];
      const jokers   = mesaOrig.filter(j => j.carta.palo === 'joker');
      jokers.forEach(j => {
        const jug = partida.jugadores.find(p => p.id === j.jugadorId);
        if (jug) {
          const ev = aplicarMana(partida, jug, 1, 'caos_controlado');
          if (ev) eventosLogro.push(ev);
        }
      });
    }
  }

  partida.resolucion = null;

  io.to(sala.codigo).emit('minirondaResuelta', {
    ganadorId,
    multiplicador,
    bazasGanadas:  jugador ? jugador.bazasGanadas : 0,
    eventosLogro,  // array de logros conseguidos esta minironda
    estadoMana:    partida.config.hardcore
      ? partida.jugadores.map(j => ({ id: j.id, mana: j.mana?.mana ?? 0, vidas: j.vidas }))
      : null
  });

  setTimeout(() => {
    partida.minirondaActual++;
    if (partida.minirondaActual < numCartas) {
      partida.iniciadorIdx    = partida.jugadores.findIndex(j => j.id === ganadorId);
      partida.turnoIdx        = partida.iniciadorIdx;
      partida.fase            = 'juego';
      partida.mesa            = [];
      partida.inversionEscala = false; // HARDCORE: el joker solo afecta a SU minironda
      emitirEstado(sala);
    } else {
      finalizarSubronda(sala);
    }
  }, 2000);
}

function finalizarSubronda(sala) {
  const partida = sala.partida;
  const resumen = [];

  // Precalcular quién es el único con 1 vida (para logro Agonía)
  const jugadoresConUnaVida = partida.jugadores.filter(j => j.vidas === 1);
  const unicoConUnaVida     = jugadoresConUnaVida.length === 1 ? jugadoresConUnaVida[0].id : null;

  // HARDCORE: eventos de logro de subronda (incluye el colchón de maná,
  // calculado dentro del forEach siguiente)
  const eventosLogroSubronda = [];

  partida.jugadores.forEach(j => {
    const restar = calcularVidasARestar(j.apuesta, j.bazasGanadas);

    // HARDCORE: detectar flags para logros antes de restar
    const teniaSotaOSuperior = partida.config.hardcore &&
      j._manoPrevia && j._manoPrevia.some(c => c.valor >= 10);
    const eraUnicoConUnaVida = unicoConUnaVida === j.id;

    j.vidas -= restar;
    if (j.vidas < 0) j.vidas = 0;

    // HARDCORE: colchón de maná lleno al perder vida con cap máximo
    if (partida.config.hardcore && j.mana && restar > 0) {
      const maxVidas = partida.maxVidas || 7;
      if (j.vidas < maxVidas && j.mana.mana >= 5) {
        j.vidas++;
        j.mana.mana -= 5;
        j.mana.vidasGanadasMana++;
        console.log(`[MANÁ-COLCHÓN] ${j.nickname} recupera 1 vida por maná lleno`);

        // Aviso visual: sin esto, el jugador no sabe por qué no perdió la
        // vida que le tocaba — se muestra como una notificación más
        eventosLogroSubronda.push({
          jugadorId:  j.id,
          nickname:   j.nickname,
          logroId:    'mana_colchon',
          logro:      LOGROS.mana_colchon,
          manaGanado: 0,
          vidaGanada: true
        });
      }
    }

    resumen.push({
      id:                j.id,
      nickname:          j.nickname,
      apuesta:           j.apuesta,
      bazasGanadas:      j.bazasGanadas,
      vidasRestadas:     restar,
      vidasRestantes:    j.vidas,
      teniaSotaOSuperior,
      eraUnicoConUnaVida
    });
  });

  // HARDCORE: logros de subronda
  if (partida.config.hardcore) {
    eventosLogroSubronda.push(...comprobarLogrosSubronda(partida, resumen));
  }

  const nuevosEspectadores = partida.jugadores.filter(j => j.vidas <= 0);
  nuevosEspectadores.forEach(j => { j.espectador = true; });
  if (!sala.espectadores) sala.espectadores = [];
  sala.espectadores.push(...nuevosEspectadores);
  partida.jugadores = partida.jugadores.filter(j => !j.espectador);

  io.to(sala.codigo).emit('subrondaTerminada', {
    resumen,
    jugadoresVivos:      partida.jugadores,
    eventosLogroSubronda: eventosLogroSubronda || []
  });

  if (partida.jugadores.length <= 1) {
    const ganador = partida.jugadores[0] || null;
    io.to(sala.codigo).emit('partidaTerminada', { ganador });

    // Resetear sala para que todos vuelvan a la antesala sin reconectarse
    setTimeout(() => {
      // Reunir todos los jugadores (activos + espectadores) con sus vidas reseteadas
      const todosLosJugadores = [
        ...(partida.jugadores || []),
        ...(sala.espectadores || [])
      ].map(j => ({
        id:       j.id,
        nickname: j.nickname,
        token:    j.token,
        avatar:   j.avatar || null,
        vidas:    5,
        listo:    false
      }));

      sala.jugadores   = todosLosJugadores;
      sala.espectadores = [];
      sala.partida     = null;
      sala.estado      = 'esperando';

      io.to(sala.codigo).emit('salaReseteada', { sala });
    }, 5000); // 5s para que se vea la pantalla de fin

    return;
  }

  // Rotar el iniciador de la PRÓXIMA subronda (independiente de quién ganó
  // la última baza de esta subronda, que es lo que queda en iniciadorIdx)
  const idxAnterior = partida.iniciadorSubrondaIdx ?? 0;
  partida.iniciadorSubrondaIdx = (idxAnterior + 1) % partida.jugadores.length;

  if (partida.subrondaActual >= 4) {
    partida.subrondaActual = 0;
  } else {
    partida.subrondaActual++;
  }

  partida.fase = 'esperandoSiguiente';
}

function comprobarAsesResueltos(sala) {
  const res = sala.partida.resolucion;
  if (!res) return;

  const pendientesAccion = res.asesPendientes.filter(p => p === 'espadas' || p === 'bastos');
  if (pendientesAccion.length > 0) return;

  // HARDCORE: si el 7 de oros sigue pendiente de usarse, esperar
  if (res.siete7OrosActivo) return;

  let ganador = res.ganadorProvisional;
  const inversionEscala = sala.partida.inversionEscala || false;

  // Si el As de Espadas eliminó otra carta que era un As, ese As ya no debe
  // aplicar su poder (ya no está en mesa)
  res.ases = res.ases.filter(a => res.mesa.some(m => m.jugadorId === a.jugadorId && m.carta.palo === a.carta.palo && m.carta.valor === a.carta.valor));

  if (res.ases.some(a => a.carta.palo === 'oros')) {
    ganador = aplicarAsOros(ganador, res.ases);
  } else {
    // Mismo criterio que resolver.js: en escala normal solo compiten las
    // cartas "normales" (valor !== 1). En escala invertida, el valor 1 es
    // el más alto, así que los ases supervivientes (no-oros) también compiten.
    const normales = res.mesa.filter(j => j.carta.valor !== 1);
    let candidatos = normales;
    if (inversionEscala) {
      const asesNoOros = res.mesa.filter(j => j.carta.valor === 1 && j.carta.palo !== 'oros');
      candidatos = [...normales, ...asesNoOros];
    }
    if (candidatos.length > 0) {
      ganador = candidatos.reduce((a, b) => {
        const aGana = inversionEscala ? a.carta.valor < b.carta.valor : a.carta.valor > b.carta.valor;
        return aGana ? a : b;
      }).jugadorId;
    } else if (res.mesa.length > 0) {
      ganador = res.mesa[res.mesa.length - 1].jugadorId;
    }
  }

  finalizarMinironda(sala, ganador);
}

// ── EVENTOS ───────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[+] Conectado:', socket.id);

  // ── RECONEXIÓN POR TOKEN ──
  socket.on('registrarToken', ({ token }) => {
    if (!token) return;

    const sala = obtenerSalaPorToken(token);
    if (!sala) return; // no hay partida activa con este token

    // Buscar jugador por token en partida activa o espectadores
    let jugador = null;
    let esEspectador = false;

    if (sala.partida) {
      jugador = sala.partida.jugadores.find(j => j.token === token);
      if (!jugador && sala.espectadores) {
        jugador = sala.espectadores.find(j => j.token === token);
        if (jugador) esEspectador = true;
      }
    }

    // También buscar en jugadores del lobby
    const jLobby = sala.jugadores.find(j => j.token === token);

    if (!jugador && !jLobby) return;

    const socketAntiguo = jugador?.id || jLobby?.id;

    // Actualizar socketId en todos los sitios
    if (jugador) jugador.id = socket.id;
    if (jLobby)  jLobby.id  = socket.id;
    if (sala.creador === socketAntiguo) sala.creador = socket.id;

    socket.join(sala.codigo);
    console.log(`[RECONEXIÓN] ${jugador?.nickname || jLobby?.nickname} reconectado`);

    if (sala.estado === 'jugando' && sala.partida) {
      socket.emit('partidaIniciada');
      socket.emit('estadoActualizado', vistaPublica(sala.partida, socket.id));
    } else if (sala.estado === 'esperando') {
      socket.emit('salaActualizada', sala);
    }
  });

  // ── LOBBY ──
  socket.on('crearSala', ({ nickname, token, avatar }, callback) => {
    if (!nickname || nickname.trim().length < 2) return callback({ error: 'Nickname demasiado corto' });
    const sala = crearSala(socket.id, nickname.trim(), token, avatar || null);
    socket.join(sala.codigo);
    callback({ ok: true, sala });
  });

  socket.on('unirseASala', ({ nickname, codigo, token, avatar }, callback) => {
    if (!nickname || nickname.trim().length < 2) return callback({ error: 'Nickname demasiado corto' });
    const resultado = unirseASala(codigo.toUpperCase(), socket.id, nickname.trim(), token, avatar || null);
    if (resultado.error) return callback(resultado);
    socket.join(codigo.toUpperCase());
    io.to(codigo.toUpperCase()).emit('salaActualizada', resultado);
    callback({ ok: true, sala: resultado });
  });

  socket.on('iniciarPartida', ({ modalidad = 'clasico' } = {}, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala) return callback({ error: 'No estás en ninguna sala' });
    if (sala.creador !== socket.id) return callback({ error: 'Solo el creador puede iniciar' });
    if (sala.jugadores.length < 2) return callback({ error: 'Mínimo 2 jugadores' });

    sala.estado  = 'jugando';
    sala.partida = crearPartida(sala.jugadores, modalidad);
    sala.modalidad = modalidad;
    const inicioAleatorio = Math.floor(Math.random() * sala.jugadores.length);
    sala.partida.iniciadorIdx         = inicioAleatorio;
    sala.partida.iniciadorSubrondaIdx = inicioAleatorio;
    sala.partida.turnoIdx             = inicioAleatorio;
    iniciarSubronda(sala.partida);

    io.to(sala.codigo).emit('partidaIniciada');
    emitirEstado(sala);
    callback({ ok: true });
  });

  // El creador preselecciona el modo de juego en el lobby — se refleja a
  // todos (fondo + etiqueta) aunque la partida no haya empezado
  socket.on('seleccionarModalidad', ({ modalidad }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala) return callback?.({ error: 'No estás en ninguna sala' });
    if (sala.creador !== socket.id) return callback?.({ error: 'Solo el creador puede cambiar el modo' });
    if (sala.estado !== 'esperando') return callback?.({ error: 'La partida ya ha comenzado' });

    const modosValidos = ['clasico', 'twisted', 'chaos', 'leap', 'hardcore'];
    if (!modosValidos.includes(modalidad)) return callback?.({ error: 'Modo inválido' });

    sala.modalidad = modalidad;
    io.to(sala.codigo).emit('modalidadSeleccionada', { modalidad });
    callback?.({ ok: true });
  });

  socket.on('apostar', ({ cantidad }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala || !sala.partida) return callback({ error: 'Sin partida activa' });
    const resultado = registrarApuesta(sala.partida, socket.id, cantidad);
    if (resultado.error) return callback({ error: resultado.error });
    emitirEstado(sala);
    // Si tras apostar empieza la fase de juego, arrancar el timer
    if (sala.partida.fase === 'juego') iniciarTurnoTimer(sala);
    callback({ ok: true });
  });

  socket.on('jugarCarta', ({ cartaIdx }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala || !sala.partida) return callback({ error: 'Sin partida activa' });

    const partida      = sala.partida;
    const esRondaFinal = partida.subrondaActual === 4;
    const jugador      = partida.jugadores.find(j => j.id === socket.id);

    if (!jugador) return callback({ error: 'Jugador no encontrado' });
    if (partida.fase !== 'juego') return callback({ error: 'No es fase de juego' });
    if (partida.jugadores[partida.turnoIdx].id !== socket.id) return callback({ error: 'No es tu turno' });

    const idxReal  = esRondaFinal ? 0 : cartaIdx;
    const resultado = jugarCarta(partida, socket.id, idxReal);
    if (resultado.error) return callback({ error: resultado.error });
    limpiarTurnoTimer(sala.codigo);
    emitirEstado(sala);

    if (resultado.todosJugaron) {
      // TWISTED: delay de 1.5s para que los jugadores vean las cartas girar
      const delayReveal = partida.config.cartasBocaAbajo ? 1500 : 0;
      setTimeout(() => resolverYContinuar(sala), delayReveal);
    } else {
      iniciarTurnoTimer(sala);
    }
    callback({ ok: true });
  });

  socket.on('asEspadas', ({ cartaIdx, objetivo }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida?.resolucion) return callback({ error: 'No hay resolución activa' });
    const res = sala.partida.resolucion;

    // Compatibilidad: cartaIdx (clásico, apunta a mesa) u objetivo { origen, idx, grupoIdx }
    const target = objetivo || (cartaIdx !== undefined && cartaIdx !== -1 ? { origen: 'mesa', idx: cartaIdx } : null);

    if (target) {
      let jugadorCarta = null;
      if (target.origen === 'anulada') {
        const grupo = res.gruposAnulados?.[target.grupoIdx];
        jugadorCarta = grupo?.jugadas?.[target.idx]?.jugadorId;
      } else {
        jugadorCarta = res.mesa[target.idx]?.jugadorId;
      }
      if (jugadorCarta === socket.id) {
        return callback({ error: 'No puedes eliminar tu propia carta' });
      }

      const resultadoEspadas = aplicarAsEspadas(
        res.mesa, target,
        sala.partida.config.hardcore || false,
        res.gruposAnulados || []
      );
      if (resultadoEspadas.error) return callback({ error: resultadoEspadas.error });
      res.mesa           = resultadoEspadas.mesa;
      res.gruposAnulados = resultadoEspadas.gruposAnulados;

      // Si una carta resucitó y volvió a la mesa, el ganador provisional
      // se recalcula al final en comprobarAsesResueltos (usa res.mesa)
    }

    res.asesPendientes = res.asesPendientes.filter(p => p !== 'espadas');
    io.to(sala.codigo).emit('mesaActualizada', { mesa: res.mesa, gruposAnulados: res.gruposAnulados });
    comprobarAsesResueltos(sala);
    callback({ ok: true });
  });

  socket.on('asBastos', ({ cartaIdx }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida?.resolucion) return callback({ error: 'No hay resolución activa' });
    const res = sala.partida.resolucion;
    res.mesa  = aplicarAsBastos(res.mesa, cartaIdx);
    res.asesPendientes = res.asesPendientes.filter(p => p !== 'bastos');
    io.to(sala.codigo).emit('mesaActualizada', { mesa: res.mesa });
    comprobarAsesResueltos(sala);
    callback({ ok: true });
  });

  socket.on('siguienteSubronda', (callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida) return callback({ error: 'Sin partida activa' });
    if (sala.creador !== socket.id) return callback({ error: 'Solo el creador' });
    if (sala.partida.fase !== 'esperandoSiguiente') return callback({ error: 'No es el momento' });

    // Resetear flag de petición de vida
    if (sala.espectadores) sala.espectadores.forEach(j => { j.pidioVidaEstaRonda = false; });

    console.log(`[TURNO] Subronda ${sala.partida.subrondaActual + 1} — iniciadorSubrondaIdx: ${sala.partida.iniciadorSubrondaIdx} — jugadores: ${sala.partida.jugadores.map(j => j.nickname).join(',')}`);

    iniciarSubronda(sala.partida);
    io.to(sala.codigo).emit('subrondaIniciada', { subronda: sala.partida.subrondaActual + 1 });
    emitirEstado(sala);

    // HARDCORE: si hay duelo pendiente, emitir evento y arrancar timer
    if (sala.partida.duelo && sala.partida.fase === 'duelo') {
      const duelo = sala.partida.duelo;
      io.to(sala.codigo).emit('dueloIniciado', {
        jugadorAId: duelo.jugadorAId,
        jugadorBId: duelo.jugadorBId,
        nickA: sala.partida.jugadores.find(j => j.id === duelo.jugadorAId)?.nickname,
        nickB: sala.partida.jugadores.find(j => j.id === duelo.jugadorBId)?.nickname,
        timeout: DUELO_TIMEOUT_MS
      });

      // Timer: si no eligen en 20s → traición automática
      if (dueloTimers[sala.codigo]) clearTimeout(dueloTimers[sala.codigo]);
      dueloTimers[sala.codigo] = setTimeout(() => {
        if (!sala.partida?.duelo || sala.partida.duelo.resuelto) return;
        console.log('[DUELO TIMEOUT] Traición automática por tiempo');
        // Forzar traición para quien no eligió
        const d = sala.partida.duelo;
        if (!d.eleccionA) d.eleccionA = 'traicionar';
        if (!d.eleccionB) d.eleccionB = 'traicionar';
        const resultadoDuelo = resolverDuelo(sala.partida);
        io.to(sala.codigo).emit('dueloResuelto', resultadoDuelo);
        emitirEstado(sala);
        delete dueloTimers[sala.codigo];
      }, DUELO_TIMEOUT_MS);
    }

    callback({ ok: true });
  });

  socket.on('espiarCarta', ({ objetivoId }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida) return callback({ error: 'Sin partida activa' });
    const resultado = espiarCarta(sala.partida, socket.id, objetivoId);
    if (resultado.error) return callback(resultado);
    callback({ ok: true, carta: resultado.carta });
  });

  socket.on('pedirVida', (callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida) return callback({ error: 'Sin partida activa' });
    if (sala.partida.fase !== 'esperandoSiguiente') return callback({ error: 'Solo entre subrondas' });

    // Buscar al espectador
    const espectador = sala.espectadores?.find(j => j.id === socket.id);
    if (!espectador) return callback({ error: 'Solo los espectadores pueden pedir vida' });
    if (espectador.pidioVidaEstaRonda) return callback({ error: 'Ya pediste vida esta subronda' });

    espectador.pidioVidaEstaRonda = true;
    io.to(sala.codigo).emit('peticionVida', { solicitanteId: socket.id, nickname: espectador.nickname });
    callback({ ok: true });
  });

  socket.on('donarVida', ({ solicitanteId }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida) return callback({ error: 'Sin partida activa' });
    if (sala.partida.fase !== 'esperandoSiguiente') return callback({ error: 'Solo entre subrondas' });

    const donante = sala.partida.jugadores.find(j => j.id === socket.id);
    if (!donante) return callback({ error: 'No eres un jugador activo' });
    if (donante.vidas <= 1) return callback({ error: 'No puedes donar, te quedarías sin vidas' });

    const receptor = sala.espectadores?.find(j => j.id === solicitanteId);
    if (!receptor) return callback({ error: 'El receptor no existe o ya fue resucitado' });

    // Transferir vida
    donante.vidas -= 1;
    receptor.vidas = 1;
    receptor.pidioVidaEstaRonda = true;

    // Sacar al receptor de espectadores y meterlo de vuelta en jugadores
    sala.espectadores = sala.espectadores.filter(j => j.id !== solicitanteId);
    receptor.espectador = false;
    sala.partida.jugadores.push(receptor);

    console.log(`[VIDA] ${donante.nickname} donó una vida a ${receptor.nickname}`);

    io.to(sala.codigo).emit('vidaDonada', {
      donanteId:       donante.id,
      donanteNick:     donante.nickname,
      donantesVidas:   donante.vidas,
      receptorId:      receptor.id,
      receptorNick:    receptor.nickname
    });
    callback({ ok: true });
  });

  // ── HARDCORE: DUELO DEL PRISIONERO ──────────────────────────────────────────

  socket.on('elegirDuelo', ({ eleccion }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida) return callback({ error: 'Sin partida activa' });
    if (sala.partida.fase !== 'duelo') return callback({ error: 'No hay duelo activo' });

    const resultado = registrarEleccionDuelo(sala.partida, socket.id, eleccion);
    if (resultado.error) return callback({ error: resultado.error });

    emitirEstado(sala);

    if (resultado.resuelto) {
      // Limpiar timer del duelo
      if (dueloTimers[sala.codigo]) {
        clearTimeout(dueloTimers[sala.codigo]);
        delete dueloTimers[sala.codigo];
      }
      const resultadoDuelo = resolverDuelo(sala.partida);
      io.to(sala.codigo).emit('dueloResuelto', resultadoDuelo);
      emitirEstado(sala);
    }
    callback({ ok: true });
  });

  // ── HARDCORE: 7 DE OROS ───────────────────────────────────────────────────────

  socket.on('usar7Oros', ({ idxA, idxB }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida?.resolucion) return callback({ error: 'No hay resolución activa' });
    const res = sala.partida.resolucion;

    if (!res.siete7OrosActivo) return callback({ error: 'No hay 7 de oros activo' });

    // Verificar que quien llama es el dueño del 7 de oros
    const jugador7 = res.mesa.find(j => j.carta.valor === 7 && j.carta.palo === 'oros');
    if (!jugador7 || jugador7.jugadorId !== socket.id) {
      return callback({ error: 'No eres el jugador del 7 de Oros' });
    }

    const resultado = aplicar7Oros(res.mesa, idxA, idxB, socket.id);
    if (resultado.error) return callback({ error: resultado.error });

    res.mesa             = resultado.mesa;
    res.siete7OrosActivo = false; // ya se usó

    // Logro "El Rey Detrás del Rey": el 7 hizo ganar a alguien que iba perdiendo
    // Comprobar si la carta beneficiada no era la más alta antes del intercambio
    const jugadorBeneficiado = res.mesa[idxA].jugadorId !== socket.id
      ? res.mesa[idxA].jugadorId
      : res.mesa[idxB].jugadorId;
    const jug7  = sala.partida.jugadores.find(j => j.id === socket.id);
    const jugBen = sala.partida.jugadores.find(j => j.id === jugadorBeneficiado);
    if (jug7 && jug7.mana) {
      const ev = aplicarMana(sala.partida, jug7, 1, 'rey_detras_del_rey');
      if (ev) io.to(sala.codigo).emit('logroConseguido', ev);
    }

    io.to(sala.codigo).emit('mesaActualizada', { mesa: res.mesa });
    // Tras el 7 de oros, continuar con resolución normal de ases
    comprobarAsesResueltos(sala);
    callback({ ok: true });
  });

  socket.on('pasar7Oros', (callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida?.resolucion) return callback({ error: 'No hay resolución activa' });
    sala.partida.resolucion.siete7OrosActivo = false;
    comprobarAsesResueltos(sala);
    callback({ ok: true });
  });

  socket.on('chatMensaje', ({ texto }) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala) return;
    const jugador = sala.partida?.jugadores.find(j => j.id === socket.id)
      || sala.partida?.espectadores?.find(j => j.id === socket.id)
      || sala.jugadores.find(j => j.id === socket.id);
    if (!jugador) return;
    const textoLimpio = String(texto).trim().slice(0, 120);
    if (!textoLimpio) return;
    io.to(sala.codigo).emit('chatMensaje', { nickname: jugador.nickname, texto: textoLimpio, id: socket.id });
  });

  socket.on('reaccion', ({ tipo }) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala) return;
    const jugador = sala.partida?.jugadores.find(j => j.id === socket.id)
      || sala.partida?.espectadores?.find(j => j.id === socket.id)
      || sala.jugadores.find(j => j.id === socket.id);
    if (!jugador) return;
    io.to(sala.codigo).emit('reaccion', { jugadorId: socket.id, nickname: jugador.nickname, tipo });
  });

  socket.on('disconnect', () => {
    console.log('[-] Desconectado:', socket.id);
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala) return;

    // Si hay partida activa, gestionar desconexión en juego
    if (sala.partida && sala.estado === 'jugando') {
      const partida = sala.partida;
      const jugadorIdx = partida.jugadores.findIndex(j => j.id === socket.id);

      if (jugadorIdx !== -1) {
        const jugador = partida.jugadores[jugadorIdx];
        console.log(`[DISCONNECT] ${jugador.nickname} se ha ido durante la partida`);
        io.to(sala.codigo).emit('jugadorDesconectado', { nickname: jugador.nickname });

        const eraSuTurnoJuego    = partida.fase === 'juego'    && partida.jugadores[partida.turnoIdx]?.id === socket.id;
        const habiaApostado      = jugador.apuesta !== null;

        // Quitar también su jugada de la mesa si ya había jugado esta minironda
        const jugadaEnMesaIdx = partida.mesa.findIndex(m => m.jugadorId === socket.id);
        if (jugadaEnMesaIdx !== -1) partida.mesa.splice(jugadaEnMesaIdx, 1);

        // Eliminar de la partida
        partida.jugadores.splice(jugadorIdx, 1);
        limpiarTurnoTimer(sala.codigo);

        // Si solo queda 1 jugador, terminar partida
        if (partida.jugadores.length <= 1) {
          const ganador = partida.jugadores[0] || null;
          io.to(sala.codigo).emit('partidaTerminada', { ganador });
          sala.estado = 'terminada';
          return;
        }

        // Si había apostado, su apuesta ya no cuenta en el recuento
        if (habiaApostado) {
          partida.apuestasRealizadas = Math.max(0, partida.apuestasRealizadas - 1);
        }

        // Recalcular iniciadorIdx / iniciadorSubrondaIdx por si quedaron fuera de rango
        if (partida.iniciadorIdx >= partida.jugadores.length) {
          partida.iniciadorIdx = 0;
        }
        if (partida.iniciadorSubrondaIdx >= partida.jugadores.length) {
          partida.iniciadorSubrondaIdx = 0;
        }

        // ── Recalcular turnoIdx según la fase, basándonos en QUIÉN falta por actuar ──
        if (partida.fase === 'apuestas') {
          // El turno pasa al primer jugador (en orden de mesa) que aún no haya apostado
          partida.turnoIdx = encontrarSiguienteSinApostar(partida);

          // Si con esto ya han apostado todos los que quedan, pasar a juego
          if (partida.apuestasRealizadas >= partida.jugadores.length) {
            partida.fase     = 'juego';
            partida.turnoIdx = partida.iniciadorIdx;
            if (partida.mesa.length === partida.jugadores.length) {
              resolverYContinuar(sala);
              return;
            }
          }
          emitirEstado(sala);
          if (partida.fase === 'juego') iniciarTurnoTimer(sala);

        } else if (partida.fase === 'juego') {
          // Si todos los que quedan ya jugaron su carta esta minironda
          if (partida.mesa.length === partida.jugadores.length && partida.mesa.length > 0) {
            resolverYContinuar(sala);
          } else {
            if (eraSuTurnoJuego) {
              // El turno pasa a quien le sigue en la mesa (el siguiente que no haya jugado)
              partida.turnoIdx = encontrarSiguienteSinJugar(partida, jugadorIdx);
            } else if (partida.turnoIdx > jugadorIdx) {
              // El jugador eliminado estaba antes en el array: el índice se desplaza una posición
              partida.turnoIdx = partida.turnoIdx - 1;
            }
            // Asegurar rango válido
            if (partida.turnoIdx >= partida.jugadores.length || partida.turnoIdx < 0) {
              partida.turnoIdx = encontrarSiguienteSinJugar(partida, null);
            }
            emitirEstado(sala);
            iniciarTurnoTimer(sala);
          }
        } else if (partida.fase === 'duelo' && partida.duelo && !partida.duelo.resuelto) {
          const duelo = partida.duelo;
          if (duelo.jugadorAId === socket.id || duelo.jugadorBId === socket.id) {
            // Uno de los participantes del duelo se desconectó: el jugador ya
            // fue eliminado de partida.jugadores, así que resolverDuelo no
            // puede aplicar efectos. Marcamos el duelo como resuelto sin
            // efectos y avisamos al resto para cerrar el overlay.
            if (dueloTimers[sala.codigo]) {
              clearTimeout(dueloTimers[sala.codigo]);
              delete dueloTimers[sala.codigo];
            }
            duelo.resuelto = true;
            partida.fase    = 'apuestas';
            io.to(sala.codigo).emit('dueloResuelto', {
              jugadorAId: duelo.jugadorAId,
              jugadorBId: duelo.jugadorBId,
              eleccionA:  duelo.eleccionA || 'traicionar',
              eleccionB:  duelo.eleccionB || 'traicionar',
              efectos:    [],
              cancelado:  true
            });
          }
          emitirEstado(sala);
        } else {
          emitirEstado(sala);
        }
        return;
      }
    }

    // Desconexión en lobby
    eliminarJugador(socket.id);
    if (sala) io.to(sala.codigo).emit('salaActualizada', sala);
  });
});

httpServer.listen(PORT, () => {
  console.log('Servidor corriendo en http://localhost:' + PORT);
});
