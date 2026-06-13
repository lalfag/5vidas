const salas  = {};
const tokens = {}; // token → codigoSala

function crearSala(socketId, nickname, token, avatar = null) {
  const codigo = generarCodigo();
  salas[codigo] = {
    codigo,
    jugadores: [
      { id: socketId, nickname, vidas: 5, listo: false, token, avatar }
    ],
    creador:      socketId,
    estado:       'esperando',
    partida:      null,
    espectadores: []
  };
  if (token) tokens[token] = codigo;
  return salas[codigo];
}

function unirseASala(codigo, socketId, nickname, token, avatar = null) {
  const sala = salas[codigo];
  if (!sala) return { error: 'Sala no encontrada' };
  if (sala.estado !== 'esperando') return { error: 'La partida ya ha comenzado' };
  if (sala.jugadores.length >= 6) return { error: 'Sala llena (máx. 6 jugadores)' };
  if (sala.jugadores.find(j => j.nickname === nickname)) {
    return { error: 'Ese nickname ya está en uso en esta sala' };
  }
  sala.jugadores.push({ id: socketId, nickname, vidas: 5, listo: false, token, avatar });
  if (token) tokens[token] = codigo;
  return sala;
}

function obtenerSala(codigo) {
  return salas[codigo] || null;
}

function obtenerSalaPorSocket(socketId) {
  return Object.values(salas).find(s =>
    s.jugadores.some(j => j.id === socketId) ||
    (s.espectadores && s.espectadores.some(j => j.id === socketId)) ||
    (s.partida && s.partida.jugadores.some(j => j.id === socketId)) ||
    (s.partida && s.partida.espectadores && s.partida.espectadores.some(j => j.id === socketId))
  ) || null;
}

function obtenerSalaPorToken(token) {
  const codigo = tokens[token];
  if (!codigo) return null;
  return salas[codigo] || null;
}

function eliminarJugador(socketId) {
  const sala = obtenerSalaPorSocket(socketId);
  if (!sala) return null;

  sala.jugadores = sala.jugadores.filter(j => j.id !== socketId);

  if (sala.jugadores.length === 0 && (!sala.espectadores || sala.espectadores.length === 0)) {
    delete salas[sala.codigo];
    return null;
  }

  if (sala.creador === socketId && sala.jugadores.length > 0) {
    sala.creador = sala.jugadores[0].id;
  }

  return sala;
}

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let codigo;
  do {
    codigo = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (salas[codigo]);
  return codigo;
}

module.exports = {
  crearSala,
  unirseASala,
  obtenerSala,
  obtenerSalaPorSocket,
  obtenerSalaPorToken,
  eliminarJugador
};
