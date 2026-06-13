const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  crearSala, unirseASala,
  obtenerSalaPorSocket, obtenerSalaPorToken, eliminarJugador
} = require('./game/roomManager');
const {
  crearPartida, iniciarSubronda, registrarApuesta,
  jugarCarta, espiarCarta, vistaPublica, CARTAS_POR_SUBRONDA, CONFIG_MODALIDAD
} = require('./game/game');
const {
  resolverMinironda, aplicarAsOros, aplicarAsEspadas,
  aplicarAsBastos, calcularVidasARestar
} = require('./game/resolver');

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
      const resolucion = resolverMinironda(sala.partida.mesa);
      const hayAses = gestionarAses(sala, resolucion);
      if (!hayAses) finalizarMinironda(sala, resolucion.ganadorProvisional);
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

function gestionarAses(sala, resultado) {
  const ases = resultado.ases;
  if (ases.length === 0) return false;

  sala.partida.resolucion = {
    mesa:               resultado.mesa,
    ases:               ases,
    efectosAs:          resultado.efectosAs,
    ganadorProvisional: resultado.ganadorProvisional,
    asesPendientes:     ases.map(a => a.carta.palo).filter(p => p === 'espadas' || p === 'bastos'),
    multiplicadorCopas: ases.some(a => a.carta.palo === 'copas')
  };

  io.to(sala.codigo).emit('asesPendientes', {
    ases, efectosAs: resultado.efectosAs, mesa: resultado.mesa
  });

  ases.forEach(as => {
    if (as.carta.palo === 'espadas' || as.carta.palo === 'bastos') {
      io.to(as.jugadorId).emit('accionAs', { palo: as.carta.palo, mesa: resultado.mesa });
    }
  });

  if (sala.partida.resolucion.asesPendientes.length === 0) {
    comprobarAsesResueltos(sala);
  }

  return true;
}

function finalizarMinironda(sala, ganadorId) {
  const partida       = sala.partida;
  const resolucion    = partida.resolucion || {};
  const multiplicador = resolucion.multiplicadorCopas ? 2 : 1;
  const jugador       = partida.jugadores.find(j => j.id === ganadorId);
  if (jugador) jugador.bazasGanadas += multiplicador;

  const numCartas    = CARTAS_POR_SUBRONDA[partida.subrondaActual];
  partida.resolucion = null;

  io.to(sala.codigo).emit('minirondaResuelta', {
    ganadorId,
    multiplicador,
    bazasGanadas: jugador ? jugador.bazasGanadas : 0
  });

  setTimeout(() => {
    partida.minirondaActual++;
    if (partida.minirondaActual < numCartas) {
      partida.iniciadorIdx = partida.jugadores.findIndex(j => j.id === ganadorId);
      partida.turnoIdx     = partida.iniciadorIdx;
      partida.fase         = 'juego';
      partida.mesa         = [];
      emitirEstado(sala);
    } else {
      finalizarSubronda(sala);
    }
  }, 2000);
}

function finalizarSubronda(sala) {
  const partida = sala.partida;
  const resumen = [];

  partida.jugadores.forEach(j => {
    const restar = calcularVidasARestar(j.apuesta, j.bazasGanadas);
    j.vidas -= restar;
    if (j.vidas < 0) j.vidas = 0;
    resumen.push({
      id:             j.id,
      nickname:       j.nickname,
      apuesta:        j.apuesta,
      bazasGanadas:   j.bazasGanadas,
      vidasRestadas:  restar,
      vidasRestantes: j.vidas
    });
  });

  const nuevosEspectadores = partida.jugadores.filter(j => j.vidas <= 0);
  nuevosEspectadores.forEach(j => { j.espectador = true; });
  if (!sala.espectadores) sala.espectadores = [];
  sala.espectadores.push(...nuevosEspectadores);
  partida.jugadores = partida.jugadores.filter(j => !j.espectador);

  io.to(sala.codigo).emit('subrondaTerminada', {
    resumen,
    jugadoresVivos: partida.jugadores
  });

  if (partida.jugadores.length <= 1) {
    const ganador = partida.jugadores[0] || null;
    io.to(sala.codigo).emit('partidaTerminada', { ganador });
    sala.estado = 'terminada';
    return;
  }

  partida.iniciadorIdx = (partida.iniciadorIdx + 1) % partida.jugadores.length;

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

  let ganador = res.ganadorProvisional;

  if (res.ases.some(a => a.carta.palo === 'oros')) {
    ganador = aplicarAsOros(ganador, res.ases);
  } else {
    const normales = res.mesa.filter(j => j.carta.valor !== 1);
    if (normales.length > 0) {
      ganador = normales.reduce((a, b) => a.carta.valor > b.carta.valor ? a : b).jugadorId;
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
    sala.partida.iniciadorIdx = Math.floor(Math.random() * sala.jugadores.length);
    sala.partida.turnoIdx     = sala.partida.iniciadorIdx;
    iniciarSubronda(sala.partida);

    io.to(sala.codigo).emit('partidaIniciada');
    emitirEstado(sala);
    callback({ ok: true });
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
      setTimeout(() => {
        const resolucion = resolverMinironda(sala.partida.mesa);
        const hayAses = gestionarAses(sala, resolucion);
        if (!hayAses) finalizarMinironda(sala, resolucion.ganadorProvisional);
      }, delayReveal);
    } else {
      iniciarTurnoTimer(sala);
    }
    callback({ ok: true });
  });

  socket.on('asEspadas', ({ cartaIdx }, callback) => {
    const sala = obtenerSalaPorSocket(socket.id);
    if (!sala?.partida?.resolucion) return callback({ error: 'No hay resolución activa' });
    const res = sala.partida.resolucion;

    if (cartaIdx !== -1) {
      const objetivo = res.mesa[cartaIdx];
      if (objetivo && objetivo.jugadorId === socket.id) {
        return callback({ error: 'No puedes eliminar tu propia carta' });
      }
      res.mesa = aplicarAsEspadas(res.mesa, cartaIdx);
    }

    res.asesPendientes = res.asesPendientes.filter(p => p !== 'espadas');
    io.to(sala.codigo).emit('mesaActualizada', { mesa: res.mesa });
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

    console.log(`[TURNO] Subronda ${sala.partida.subrondaActual + 1} — iniciadorIdx: ${sala.partida.iniciadorIdx} — jugadores: ${sala.partida.jugadores.map(j => j.nickname).join(',')}`);

    iniciarSubronda(sala.partida);
    io.to(sala.codigo).emit('subrondaIniciada', { subronda: sala.partida.subrondaActual + 1 });
    emitirEstado(sala);
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

        // Ajustar turnoIdx si hacía falta
        if (partida.turnoIdx >= partida.jugadores.length) {
          partida.turnoIdx = 0;
        }
        if (partida.iniciadorIdx >= partida.jugadores.length) {
          partida.iniciadorIdx = 0;
        }

        // Si era su turno y estamos en fase juego, continuar
        if (partida.fase === 'juego') {
          // Si todos los demás ya jugaron (mesa completa ahora)
          if (partida.mesa.length === partida.jugadores.length) {
            const resolucion = resolverMinironda(partida.mesa);
            const hayAses = gestionarAses(sala, resolucion);
            if (!hayAses) finalizarMinironda(sala, resolucion.ganadorProvisional);
          } else {
            emitirEstado(sala);
            iniciarTurnoTimer(sala);
          }
        } else if (partida.fase === 'apuestas') {
          // Si todos los demás ya apostaron
          if (partida.apuestasRealizadas >= partida.jugadores.length) {
            partida.fase = 'juego';
            partida.turnoIdx = partida.iniciadorIdx;
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
