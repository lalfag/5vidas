// sounds.js — Efectos de sonido con Web Audio API (sin archivos externos)

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  // Reanudar si el navegador lo suspendió (política de autoplay)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tono(frecuencia, duracion, tipo = 'sine', volumen = 0.3, inicio = 0) {
  const c   = getCtx();
  const osc = c.createOscillator();
  const gan = c.createGain();

  osc.connect(gan);
  gan.connect(c.destination);

  osc.type      = tipo;
  osc.frequency.setValueAtTime(frecuencia, c.currentTime + inicio);

  gan.gain.setValueAtTime(0, c.currentTime + inicio);
  gan.gain.linearRampToValueAtTime(volumen, c.currentTime + inicio + 0.01);
  gan.gain.exponentialRampToValueAtTime(0.001, c.currentTime + inicio + duracion);

  osc.start(c.currentTime + inicio);
  osc.stop(c.currentTime + inicio + duracion);
}

// ── EFECTOS ──────────────────────────────────

// Carta jugada: clic seco
export function sonidoCarta() {
  tono(800, 0.06, 'square', 0.15);
  tono(400, 0.08, 'square', 0.08, 0.04);
}

// Baza ganada: acorde ascendente
export function sonidoBazaGanada() {
  tono(440, 0.15, 'sine', 0.25);
  tono(554, 0.15, 'sine', 0.2,  0.1);
  tono(659, 0.25, 'sine', 0.25, 0.2);
}

// Baza perdida: dos tonos descendentes
export function sonidoBazaPerdida() {
  tono(440, 0.15, 'sine', 0.2);
  tono(330, 0.25, 'sine', 0.2, 0.15);
}

// Pierdes vidas: tono grave
export function sonidoPierdesVidas() {
  tono(220, 0.1,  'sawtooth', 0.2);
  tono(165, 0.3,  'sawtooth', 0.25, 0.08);
  tono(110, 0.4,  'sine',     0.2,  0.2);
}

// As activado: tono misterioso
export function sonidoAs() {
  tono(300, 0.1,  'sine', 0.15);
  tono(600, 0.2,  'sine', 0.2,  0.08);
  tono(450, 0.3,  'sine', 0.15, 0.2);
}

// Inicio de partida: fanfarria
export function sonidoInicio() {
  tono(330, 0.12, 'sine', 0.2);
  tono(392, 0.12, 'sine', 0.2,  0.12);
  tono(494, 0.12, 'sine', 0.2,  0.24);
  tono(659, 0.3,  'sine', 0.25, 0.36);
}

// Eliminado: nota lúgubre
export function sonidoEliminado() {
  tono(220, 0.2,  'sawtooth', 0.25);
  tono(196, 0.2,  'sawtooth', 0.2,  0.18);
  tono(165, 0.5,  'sine',     0.2,  0.35);
}

// Fin de partida / victoria
export function sonidoVictoria() {
  [330,392,494,659,784].forEach((f, i) => {
    tono(f, 0.15, 'sine', 0.22, i * 0.1);
  });
  tono(988, 0.5, 'sine', 0.3, 0.5);
}

// ── FIGURAS ──────────────────────────────────

// Sota (10): toque ligero, pícaro — dos notas ascendentes rápidas
export function sonidoSota() {
  tono(520, 0.07, 'triangle', 0.18);
  tono(660, 0.14, 'triangle', 0.22, 0.07);
}

// Caballo (11): relinchos estilizados — portamento rápido + eco
export function sonidoCaballo() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gan = c.createGain();
  osc.connect(gan); gan.connect(c.destination);

  osc.type = 'sawtooth';
  // Portamento: sube rápido (relincho)
  osc.frequency.setValueAtTime(320, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(680, c.currentTime + 0.18);
  osc.frequency.exponentialRampToValueAtTime(480, c.currentTime + 0.32);

  gan.gain.setValueAtTime(0, c.currentTime);
  gan.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.02);
  gan.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.38);

  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.4);

  // Eco de pezuñas
  tono(280, 0.06, 'square', 0.08, 0.22);
  tono(280, 0.06, 'square', 0.05, 0.30);
}

// Rey (12): acorde solemne — fanfarria de tres notas + campana
export function sonidoRey() {
  // Acorde de do mayor: C-E-G
  tono(261, 0.35, 'sine',     0.18);        // Do
  tono(330, 0.35, 'sine',     0.16, 0.06);  // Mi
  tono(392, 0.45, 'sine',     0.2,  0.12);  // Sol
  // Toque metálico de corona
  tono(1100, 0.08, 'triangle', 0.14, 0.18);
  tono(880,  0.25, 'triangle', 0.12, 0.24);
}

// ── ASES (con su personalidad) ────────────────

// As de Oros: brillante, dorado — campana cristalina
export function sonidoAsOros() {
  const notas = [880, 1108, 1318, 1760];
  notas.forEach((f, i) => tono(f, 0.3 - i * 0.04, 'sine', 0.2 - i * 0.02, i * 0.07));
  // Shimmer final
  tono(2200, 0.15, 'triangle', 0.08, 0.3);
}

// As de Copas: cálido, salvavidas — cuerno melódico
export function sonidoAsCopas() {
  tono(440, 0.15, 'sine', 0.2);
  tono(494, 0.15, 'sine', 0.22, 0.12);
  tono(440, 0.3,  'sine', 0.18, 0.27);
  // Eco suave
  tono(330, 0.2, 'triangle', 0.1, 0.5);
}

// As de Espadas: oscuro, letal — nota grave + disonancia
export function sonidoAsEspadas() {
  // Nota grave amenazante
  tono(110, 0.15, 'sawtooth', 0.22);
  tono(146, 0.25, 'sawtooth', 0.18, 0.1);
  // Cuchillo al aire: pitido agudo cortante
  tono(1400, 0.04, 'square', 0.12, 0.22);
  tono(1200, 0.08, 'square', 0.1,  0.25);
  // Resonancia final
  tono(98, 0.45, 'sine', 0.14, 0.3);
}

// As de Bastos: rústico, brutal — golpe sordo + retumbo
export function sonidoAsBastos() {
  const c = getCtx();
  // Golpe de porra: noise-like via muchos tonos rápidos
  [200, 150, 180, 120].forEach((f, i) => {
    tono(f, 0.06, 'sawtooth', 0.2 - i * 0.03, i * 0.02);
  });
  // Retumbo grave
  tono(80,  0.5, 'sine', 0.25, 0.08);
  tono(60,  0.4, 'sine', 0.15, 0.22);
}

// ── DISPATCHER: llama el sonido correcto según valor y palo ─────────────
// valor: número (1=as, 10=sota, 11=caballo, 12=rey), palo: 'oros'|'copas'|'espadas'|'bastos'
export function sonidoCartaEspecial(valor, palo) {
  if (valor === 1) {
    if      (palo === 'oros')    sonidoAsOros();
    else if (palo === 'copas')   sonidoAsCopas();
    else if (palo === 'espadas') sonidoAsEspadas();
    else if (palo === 'bastos')  sonidoAsBastos();
  } else if (valor === 12) {
    sonidoRey();
  } else if (valor === 11) {
    sonidoCaballo();
  } else if (valor === 10) {
    sonidoSota();
  }
  // Para cualquier otra carta se usa sonidoCarta() desde el frontend
}
