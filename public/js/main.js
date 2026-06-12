import { sonidoCarta, sonidoBazaGanada, sonidoBazaPerdida, sonidoPierdesVidas, sonidoAs, sonidoInicio, sonidoEliminado, sonidoVictoria, sonidoCartaEspecial } from '/js/sounds.js';

const socket = io();

let miId        = null;
let miSala      = null;
let miEstado    = null;
let miModalidad = "clasico";

const pantallas = {
  entrada:  document.getElementById('pantalla-entrada'),
  sala:     document.getElementById('pantalla-sala'),
  juego:    document.getElementById('pantalla-juego'),
  resumen:  document.getElementById('pantalla-resumen'),
  fin:      document.getElementById('pantalla-fin')
};

const $ = id => document.getElementById(id);

function irA(nombre) {
  Object.keys(pantallas).forEach(k => {
    pantallas[k].style.display = 'none';
    pantallas[k].classList.remove('activa');
  });
  pantallas[nombre].style.display = 'flex';
  pantallas[nombre].classList.remove('oculto');
}

function obtenerToken() {
  let token = sessionStorage.getItem('cincoVidasToken');
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('cincoVidasToken', token);
  }
  return token;
}

// ── ICONOS SVG DE PALOS (por Gemini) ───────────────────────
const PALOS_SVG = {
  oros: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <circle cx="18" cy="18" r="14" stroke="currentColor" stroke-width="1.6" fill="none" />
  <circle cx="18" cy="18" r="8" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2" fill="none" />
  <circle cx="18" cy="18" r="3" fill="currentColor" opacity="0.2" />
  <circle cx="18" cy="18" r="1.5" fill="currentColor" />
</svg>`,

  copas: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 9 7 L 27 7 C 27 18, 9 18, 9 7 Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 11 11 Q 18 13, 25 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" />
  <path d="M 18 16 L 18 28" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" />
  <path d="M 12 29 L 24 29" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
</svg>`,

  espadas: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 18 4 L 22 10 L 22 25 L 14 25 L 14 10 Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <line x1="18" y1="7" x2="18" y2="25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M 10 25 L 26 25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" />
  <line x1="18" y1="25" x2="18" y2="31" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  <circle cx="18" cy="32" r="1.2" fill="currentColor" />
</svg>`,

  bastos: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 16 31 L 15 25 Q 14 18, 13 13 Q 12 6, 18 5 Q 24 6, 23 13 Q 22 18, 21 25 L 20 31 Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 13 16 L 10 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M 23 11 L 26 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M 22 21 L 25 22" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <circle cx="17" cy="11" r="1.5" fill="currentColor" opacity="0.3" />
  <circle cx="19" cy="20" r="1.5" fill="currentColor" opacity="0.3" />
</svg>`
};


const PALO_COLOR = {
  oros:    '#8a6000',
  copas:   '#a0001e',
  espadas: '#0f3a7a',
  bastos:  '#1a5c22'
};

const PALO_BORDER = {
  oros:    'rgba(176,134,0,0.35)',
  copas:   'rgba(180,0,40,0.3)',
  espadas: 'rgba(30,80,150,0.3)',
  bastos:  'rgba(30,110,40,0.3)'
};

const REVERSO_SVG = `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <rect x="1" y="1" width="88" height="128" rx="8" fill="#0f3460" stroke="#1a4a7a" stroke-width="1.5"/>
  <rect x="5" y="5" width="80" height="120" rx="6" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>
  <rect x="9" y="9" width="72" height="112" rx="4" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <path d="M12,12 L20,12 L20,14 L14,14 L14,20 L12,20 Z" fill="rgba(240,192,64,0.45)"/>
  <path d="M78,12 L70,12 L70,14 L76,14 L76,20 L78,20 Z" fill="rgba(240,192,64,0.45)"/>
  <path d="M12,118 L20,118 L20,116 L14,116 L14,110 L12,110 Z" fill="rgba(240,192,64,0.45)"/>
  <path d="M78,118 L70,118 L70,116 L76,116 L76,110 L78,110 Z" fill="rgba(240,192,64,0.45)"/>
  <polygon points="45,28 62,65 45,102 28,65" fill="none" stroke="rgba(240,192,64,0.22)" stroke-width="1"/>
  <polygon points="45,36 56,65 45,94 34,65" fill="none" stroke="rgba(240,192,64,0.14)" stroke-width="1"/>
  <line x1="45" y1="44" x2="45" y2="86" stroke="rgba(240,192,64,0.18)" stroke-width="1"/>
  <line x1="27" y1="65" x2="63" y2="65" stroke="rgba(240,192,64,0.18)" stroke-width="1"/>
  <circle cx="45" cy="65" r="7" fill="none" stroke="rgba(240,192,64,0.35)" stroke-width="1.5"/>
  <circle cx="45" cy="65" r="2.5" fill="rgba(240,192,64,0.3)"/>
  <circle cx="45" cy="17" r="2" fill="rgba(240,192,64,0.28)"/>
  <circle cx="45" cy="113" r="2" fill="rgba(240,192,64,0.28)"/>
  <circle cx="16" cy="65" r="2" fill="rgba(240,192,64,0.28)"/>
  <circle cx="74" cy="65" r="2" fill="rgba(240,192,64,0.28)"/>
</svg>`;

// ── REACCIONES ────────────────────────────────
const REACCIONES = {
  smilyface: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="14" r="2.5" fill="currentColor"/><circle cx="24" cy="14" r="2.5" fill="currentColor"/><path d="M10 22 C13 28, 23 28, 26 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  lolface:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 13 L14 17 L10 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M26 13 L22 17 L26 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 24 Q18 30, 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M6 16 A3.5 3.5 0 0 0 8 22 A3.5 3.5 0 0 0 6 16 Z" fill="currentColor"/><path d="M30 16 A3.5 3.5 0 0 1 28 22 A3.5 3.5 0 0 1 30 16 Z" fill="currentColor"/></svg>`,
  angryface: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M11 11 L15 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M25 11 L21 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="13" cy="17" r="2.5" fill="currentColor"/><circle cx="23" cy="17" r="2.5" fill="currentColor"/><path d="M12 26 Q18 21, 24 26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`,
  surprise:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="14" r="3" fill="currentColor"/><circle cx="24" cy="14" r="3" fill="currentColor"/><ellipse cx="18" cy="25" rx="5" ry="6" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  thinking:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="14" r="2.5" fill="currentColor"/><circle cx="24" cy="14" r="2.5" fill="currentColor"/><path d="M22 10 Q24 7, 26 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M14 24 Q18 24, 22 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M16 28 C16 32, 20 32, 20 28" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  thumbup:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M10 16 V30 H6 V16 Z M14 16 C14 10, 18 6, 22 6 V12 H30 A4 4 0 0 1 30 20 H28 V24 A4 4 0 0 1 24 28 H14 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`,
  thumbdown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M10 20 V6 H6 V20 Z M14 20 C14 26, 18 30, 22 30 V24 H30 A4 4 0 0 0 30 16 H28 V12 A4 4 0 0 0 24 8 H14 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`,
  fire:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 4 C18 4, 10 12, 10 20 A8 8 0 0 0 26 20 C26 12, 18 4, 18 4 Z M18 12 C18 12, 14 16, 14 20 A4 4 0 0 0 22 20 C22 16, 18 12, 18 12 Z" fill="currentColor"/></svg>`,
  skull:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 4 A12 12 0 0 0 6 16 V22 C6 26, 10 30, 14 30 V32 H22 V30 C26 30, 30 26, 30 22 V16 A12 12 0 0 0 18 4 Z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="13" cy="18" r="3" fill="currentColor"/><circle cx="23" cy="18" r="3" fill="currentColor"/><path d="M16 26 L20 26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  heart:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 10 C14 4, 6 6, 6 14 C6 22, 18 30, 18 30 C18 30, 30 22, 30 14 C30 6, 22 4, 18 10 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`,
  target:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="18" cy="18" r="11" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="18" cy="18" r="6" fill="currentColor"/></svg>`,
  zzz:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M22 6 L30 6 L22 14 L30 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 16 L18 16 L12 22 L18 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6 24 L10 24 L6 28 L10 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
};

let reaccionCooldown = false;

function enviarReaccion(tipo) {
  if (reaccionCooldown) return;
  reaccionCooldown = true;
  setTimeout(() => { reaccionCooldown = false; }, 2000);
  socket.emit('reaccion', { tipo });
}

function mostrarReaccionFlotante(nickname, tipo) {
  const svg = REACCIONES[tipo];
  if (!svg) return;
  const el = document.createElement('div');
  el.className = 'reaccion-flotante';
  el.innerHTML = `<span class="reaccion-nombre">${nickname}</span>${svg}`;
  // Posición horizontal aleatoria
  el.style.left = (10 + Math.random() * 70) + '%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function crearPanelReacciones() {
  const panel = document.createElement('div');
  panel.id = 'panel-reacciones';
  panel.innerHTML = Object.entries(REACCIONES).map(([tipo, svg]) =>
    `<button class="btn-reaccion" data-tipo="${tipo}" title="${tipo}">${svg}</button>`
  ).join('');
  panel.querySelectorAll('.btn-reaccion').forEach(btn => {
    btn.addEventListener('click', () => enviarReaccion(btn.dataset.tipo));
  });
  document.body.appendChild(panel);
}

function crearChat() {
  if (document.getElementById('chat-container')) return;

  const chat = document.createElement('div');
  chat.id = 'chat-container';
  chat.innerHTML = `
    <button id="chat-toggle" title="Chat">💬 <span id="chat-badge" class="oculto">0</span></button>
    <div id="chat-panel" class="oculto">
      <div id="chat-mensajes"></div>
      <div id="chat-input-row">
        <input id="chat-input" type="text" placeholder="Mensaje..." maxlength="120" autocomplete="off"/>
        <button id="chat-enviar">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(chat);

  let chatAbierto = false;
  let mensajesNuevos = 0;

  const toggle    = document.getElementById('chat-toggle');
  const panel     = document.getElementById('chat-panel');
  const input     = document.getElementById('chat-input');
  const badge     = document.getElementById('chat-badge');

  toggle.addEventListener('click', () => {
    chatAbierto = !chatAbierto;
    panel.classList.toggle('oculto', !chatAbierto);
    if (chatAbierto) {
      mensajesNuevos = 0;
      badge.classList.add('oculto');
      badge.textContent = '0';
      input.focus();
      const msgs = document.getElementById('chat-mensajes');
      msgs.scrollTop = msgs.scrollHeight;
    }
  });

  document.getElementById('chat-enviar').addEventListener('click', enviarMensaje);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') enviarMensaje(); });

  function enviarMensaje() {
    const texto = input.value.trim();
    if (!texto) return;
    socket.emit('chatMensaje', { texto });
    input.value = '';
  }

  window._chatAbierto    = () => chatAbierto;
  window._chatNuevoMsg   = () => {
    mensajesNuevos++;
    if (!chatAbierto) {
      badge.textContent = mensajesNuevos > 9 ? '9+' : mensajesNuevos;
      badge.classList.remove('oculto');
    }
  };
}

// ── CREAR CARTA ELEMENT ───────────────────────
const NOMBRES_VALOR = { 1:'A', 10:'J', 11:'C', 12:'R' };

// Icono central para figuras (Rey, Caballo, Sota) — por Gemini
const FIGURA_ICONO = {
  12: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 8 26 L 28 26 L 27 22 L 9 22 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15" />
  <path d="M 8 22 L 7 12 L 13 17 L 18 10 L 23 17 L 29 12 L 28 22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <circle cx="7" cy="11" r="1.2" fill="currentColor" />
  <circle cx="18" cy="9" r="1.5" fill="currentColor" />
  <circle cx="29" cy="11" r="1.2" fill="currentColor" />
  <circle cx="13" cy="24" r="1" fill="currentColor" opacity="0.7" />
  <circle cx="18" cy="24" r="1" fill="currentColor" opacity="0.7" />
  <circle cx="23" cy="24" r="1" fill="currentColor" opacity="0.7" />
</svg>`,
  11: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 12 15 L 8 13 L 9 10 L 14 11 L 16 8 L 19 11 L 18 15" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none" />
  <path d="M 18 11 C 20 13, 20 16, 21 19" stroke="currentColor" stroke-width="1.6" fill="none" />
  <path d="M 18 15 L 27 15 C 29 15, 30 18, 29 22 L 19 22 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1" />
  <path d="M 15 22 L 14 30" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  <path d="M 18 22 L 17 29" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M 26 22 L 27 30" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  <path d="M 29 22 L 30 29" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  <path d="M 29 18 Q 33 19, 32 26" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
</svg>`,
  10: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 13 12 Q 18 7, 24 10 Q 23 13, 13 13 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15" />
  <circle cx="18" cy="16" r="3.5" stroke="currentColor" stroke-width="1.6" fill="none" />
  <path d="M 11 26 C 11 21, 14 21, 18 21 C 22 21, 25 21, 25 26" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
  <path d="M 14 26 L 14 32 L 22 32 L 22 26" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <line x1="24" y1="18" x2="26" y2="30" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
</svg>`
};

function labelValor(v) { return NOMBRES_VALOR[v] || String(v); }

function crearCartaEl(carta, opts = {}) {
  const el = document.createElement('div');

  const esAs     = carta.valor === 1;
  const esFigura = carta.valor >= 10;
  const nombreFigura = { 12: 'rey', 11: 'caballo', 10: 'sota' }[carta.valor] || '';
  const clasesEspeciales = esAs ? ' as' : (esFigura ? ` figura ${nombreFigura}` : '');
  el.className = `carta ${carta.palo}${clasesEspeciales} ${opts.seleccionable ? 'seleccionable' : 'no-seleccionable'} carta-nueva`;

  const color = PALO_COLOR[carta.palo];
  const val   = labelValor(carta.valor);
  const icono = esFigura
    ? FIGURA_ICONO[carta.valor] || ''
    : PALOS_SVG[carta.palo]?.() || '';

  el.style.setProperty('color', color);
  el.innerHTML = `
    <div class="carta-esquina carta-tl">
      <span class="carta-val">${val}</span>
    </div>
    <div class="carta-centro">${icono}</div>
    <div class="carta-esquina carta-br">
      <span class="carta-val">${val}</span>
    </div>
    ${opts.label ? `<span class="jugador-carta">${opts.label}</span>` : ''}
  `;

  if (opts.onClick) el.addEventListener('click', opts.onClick);
  return el;
}

function crearCartaReverso() {
  const el = document.createElement('div');
  el.className = 'carta carta-reverso no-seleccionable';
  el.innerHTML = REVERSO_SVG;
  return el;
}

// ── RENDERIZAR JUEGO ──────────────────────────
function renderizarJuego(estado) {
  miEstado = estado;
  const yo = estado.jugadores.find(j => j.id === miId);
  const soyEspectador = estado.soyEspectador;
  const miJugador = yo || { nickname: 'Espectador', vidas: 0, apuesta: null, bazasGanadas: 0, mano: null };

  const esMiTurno    = !soyEspectador && estado.jugadores[estado.turnoIdx]?.id === miId;
  const esRondaFinal = estado.esRondaFinal;
  const numCartas    = [5,4,3,2,1][estado.subrondaActual];

  const bannerEl = $('banner-espectador');
  soyEspectador ? bannerEl.classList.remove('oculto') : bannerEl.classList.add('oculto');

  $('info-subronda').textContent = `Subronda ${estado.subrondaActual + 1}/5${esRondaFinal ? ' · Final' : ''}`;
  const infoModo = $('info-modalidad');
  if (infoModo) {
    const badges = { clasico: '', twisted: '🃏 Twisted', chaos: '🌀 Chaos' };
    infoModo.textContent = badges[estado.modalidad] || '';
  }
  $('info-fase').textContent     = tradFase(estado.fase);

  $('mi-nickname').textContent     = miJugador.nickname;
  const vidasEl = $('mis-vidas');
  const vidasAntes = vidasEl.textContent;
  const vidasNuevas = soyEspectador ? '💀 Eliminado' : `❤️ ${miJugador.vidas}`;
  if (vidasAntes !== vidasNuevas) {
    vidasEl.classList.remove('shake','latido');
    void vidasEl.offsetWidth; // reflow
    vidasEl.classList.add(miJugador.vidas < parseInt(vidasAntes.replace(/[^0-9]/g,'')) ? 'shake' : 'latido');
    setTimeout(() => vidasEl.classList.remove('shake','latido'), 400);
  }
  vidasEl.textContent = vidasNuevas;
  $('mi-apuesta-info').textContent = miJugador.apuesta !== null
    ? `Aposté: ${miJugador.apuesta} · Bazas: ${miJugador.bazasGanadas}`
    : '';

  // Rivales
  const rivalesEl = $('rivales');
  rivalesEl.innerHTML = '';
  estado.jugadores.filter(j => j.id !== miId).forEach(j => {
    const esSuTurno = estado.jugadores[estado.turnoIdx]?.id === j.id;
    const div = document.createElement('div');
    div.className = `rival${esSuTurno ? ' turno-activo' : ''}`;

    let cartaHtml = '';
    if ((soyEspectador || esRondaFinal) && j.mano && j.mano.length > 0) {
      const c = j.mano[0];
      const col = PALO_COLOR[c.palo];
      const brd = PALO_BORDER[c.palo];
      const ico = PALOS_SVG[c.palo]?.() || '';
      cartaHtml = `<div class="carta-mini" style="border-color:${brd};color:${col}">
        <span class="carta-mini-val" style="color:${col}">${labelValor(c.valor)}</span>
        <div class="carta-mini-ico">${ico}</div>
      </div>`;
    }

    div.innerHTML = `
      <span class="nombre">${j.nickname}</span>
      <span class="vidas">❤️ ${j.vidas}</span>
      <span class="apuesta-rival">${j.apuesta !== null ? `Apostó: ${j.apuesta}` : '—'}</span>
      <span style="font-size:0.72rem;color:#4caf50">Bazas: ${j.bazasGanadas}/${j.apuesta !== null ? j.apuesta : '?'}</span>
      <span style="font-size:0.72rem;color:#aaa">${j.cartasEnMano} carta${j.cartasEnMano !== 1 ? 's' : ''}</span>
      ${cartaHtml}
    `;
    rivalesEl.appendChild(div);
  });

  // Mesa
  const mesaEl = $('cartas-mesa');
  mesaEl.innerHTML = '';
  estado.mesa.forEach(jugada => {
    let cartaMesaEl;
    if (jugada.oculta) {
      cartaMesaEl = crearCartaReverso();
      cartaMesaEl.classList.add('carta-jugada');
    } else {
      const autor = estado.jugadores.find(j => j.id === jugada.jugadorId);
      cartaMesaEl = crearCartaEl(jugada.carta, { label: autor?.nickname || '' });
      cartaMesaEl.classList.add('carta-jugada');
    }
    mesaEl.appendChild(cartaMesaEl);
  });

  // Mi mano
  const manoEl = $('mi-mano');
  manoEl.innerHTML = '';

  if (soyEspectador) {
    // sin mano
  } else if (esRondaFinal) {
    const aviso = document.createElement('p');
    aviso.style.cssText = 'color:#e94560;font-size:0.85rem;text-align:center;margin-bottom:0.5rem';
    aviso.textContent = '🃏 No puedes ver tu propia carta';
    manoEl.appendChild(aviso);
    manoEl.appendChild(crearCartaReverso());
    if (estado.fase === 'juego' && esMiTurno) {
      const btn = document.createElement('button');
      btn.textContent = '🂠 Jugar mi carta';
      btn.style.cssText = 'max-width:200px;margin-top:0.5rem';
      btn.addEventListener('click', () => jugarCarta(0));
      manoEl.appendChild(btn);
    }
  } else if (estado.modalidad === 'chaos' && miJugador.manoBarajada && estado.fase === 'juego') {
    // Chaos fase juego: reversos seleccionables
    manoEl.classList.add('mano-chaos');
    const numCartas = miJugador.cartasEnMano;
    for (let i = 0; i < numCartas; i++) {
      const reverso = crearCartaReverso();
      if (esMiTurno) {
        reverso.style.cursor = 'pointer';
        reverso.classList.add('seleccionable');
        const idx = i;
        reverso.addEventListener('click', () => jugarCarta(idx));
      }
      manoEl.appendChild(reverso);
    }
  } else if (miJugador.mano) {
    manoEl.classList.remove('mano-chaos');
    miJugador.mano.forEach((carta, idx) => {
      const puedoJugar = estado.fase === 'juego' && esMiTurno;
      manoEl.appendChild(crearCartaEl(carta, {
        seleccionable: puedoJugar,
        onClick: puedoJugar ? () => jugarCarta(idx) : null
      }));
    });
  }

  // Panel apuestas
  const panelApuestas = $('panel-apuestas');
  const apuestaSimultanea = esRondaFinal && estado.modalidad === 'clasico';
  if (!soyEspectador && estado.fase === 'apuestas' && miJugador.apuesta === null && (apuestaSimultanea || esMiTurno)) {
    panelApuestas.classList.remove('oculto');
    renderizarBotonesApuesta(estado);
  } else {
    panelApuestas.classList.add('oculto');
  }

  // Mensaje
  const msgJuego = $('msg-juego');
  if (soyEspectador) {
    msgJuego.textContent = '👁️ Modo espectador';
  } else if (estado.fase === 'apuestas') {
    if (apuestaSimultanea) {
      msgJuego.textContent = miJugador.apuesta !== null
        ? '✓ Apuesta registrada — esperando al resto...'
        : '🃏 Apuesta en secreto: ¿ganas esta baza?';
    } else {
      const apostador = estado.jugadores[estado.turnoIdx];
      msgJuego.textContent = esMiTurno
        ? `Tu turno de apostar (${numCartas} bazas en juego)`
        : `Esperando apuesta de ${apostador?.nickname}...`;
    }
  } else if (estado.fase === 'juego') {
    const activo = estado.jugadores[estado.turnoIdx];
    msgJuego.textContent = esMiTurno
      ? '👆 Tu turno — elige una carta'
      : `⏳ Turno de ${activo?.nickname}`;
  } else if (estado.fase === 'resolucion') {
    msgJuego.textContent = '⚔️ Resolviendo la baza...';
  } else {
    msgJuego.textContent = '';
  }
}

function tradFase(fase) {
  const t = { apuestas: 'Apuestas', juego: 'Juego', resolucion: 'Resolución', esperandoSiguiente: 'Entre subrondas' };
  return t[fase] || fase;
}

function renderizarBotonesApuesta(estado) {
  const numCartas    = [5,4,3,2,1][estado.subrondaActual];
  const esRondaFinal = estado.subrondaActual === 4;
  const container    = $('botones-apuesta');
  container.innerHTML = '';

  const sumaActual = estado.jugadores.reduce((s, j) => s + (j.apuesta ?? 0), 0);
  const esUltimo   = estado.jugadores.filter(j => j.apuesta === null).length === 1;

  $('msg-apuesta').textContent = esRondaFinal
    ? '¿Ganas esta baza?'
    : `¿Cuántas bazas ganarás? (0–${numCartas})`;

  for (let i = 0; i <= numCartas; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (!esRondaFinal && esUltimo && sumaActual + i === numCartas) {
      btn.disabled = true;
      btn.title    = `Prohibido — haría la suma igual a ${numCartas}`;
    }
    btn.addEventListener('click', () => apostar(i));
    container.appendChild(btn);
  }
}

// ── ACCIONES ─────────────────────────────────
function apostar(cantidad) {
  sonidoCarta();
  socket.emit('apostar', { cantidad }, res => {
    if (res.error) mostrarError(res.error);
  });
}

function jugarCarta(idx) {
  // Determinar sonido: si conocemos la carta (mano visible), usar sonido específico
  const yo = miEstado?.jugadores.find(j => j.id === miId);
  const carta = yo?.mano?.[idx];
  if (carta && [1, 10, 11, 12].includes(carta.valor)) {
    sonidoCartaEspecial(carta.valor, carta.palo);
  } else {
    sonidoCarta();
  }
  socket.emit('jugarCarta', { cartaIdx: idx }, res => {
    if (res.error) mostrarError(res.error);
  });
}

function mostrarError(msg) {
  const el = $('msg-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('oculto');
  setTimeout(() => el.classList.add('oculto'), 3000);
}

// ── LOBBY ─────────────────────────────────────
function renderizarSala(sala) {
  miSala = sala;
  $('codigo-sala').textContent = sala.codigo;
  const lista = $('lista-jugadores');
  lista.innerHTML = '';
  sala.jugadores.forEach(j => {
    const li = document.createElement('li');
    li.textContent = j.nickname;
    if (j.id === sala.creador) {
      const corona = document.createElement('span');
      corona.className = 'corona';
      corona.textContent = '👑 creador';
      li.appendChild(corona);
    }
    lista.appendChild(li);
  });
  const btnIniciar = $('btn-iniciar');
  const selectorModo = $('selector-modalidad');
  if (sala.creador === socket.id) {
    btnIniciar.classList.remove('oculto');
    if (selectorModo) selectorModo.classList.remove('oculto');
    $('msg-sala').textContent = sala.jugadores.length < 2 ? 'Esperando más jugadores...' : '¡Listos para jugar!';
  } else {
    btnIniciar.classList.add('oculto');
    if (selectorModo) selectorModo.classList.add('oculto');
    $('msg-sala').textContent = 'Esperando al creador...';
  }
}

// ── BOTONES LOBBY ─────────────────────────────
$('btn-crear').addEventListener('click', () => {
  const nickname = $('input-nickname').value.trim();
  if (nickname.length < 2) return mostrarError('Nickname demasiado corto');
  socket.emit('crearSala', { nickname, token: obtenerToken() }, res => {
    if (res.error) return mostrarError(res.error);
    renderizarSala(res.sala);
    irA('sala');
  });
});

$('btn-unirse-form').addEventListener('click', () => {
  $('form-unirse').classList.toggle('oculto');
});

$('btn-unirse').addEventListener('click', () => {
  const nickname = $('input-nickname').value.trim();
  const codigo   = $('input-codigo').value.trim().toUpperCase();
  if (nickname.length < 2) return mostrarError('Nickname demasiado corto');
  if (codigo.length !== 4) return mostrarError('El código tiene 4 letras');
  socket.emit('unirseASala', { nickname, codigo, token: obtenerToken() }, res => {
    if (res.error) return mostrarError(res.error);
    renderizarSala(res.sala);
    irA('sala');
  });
});

// Selector de modalidad
const DESCS_MODALIDAD = {
  clasico: 'Modo estándar — apuestas y bazas clásicas',
  twisted: 'Las cartas se juegan boca abajo y se revelan a la vez',
  chaos:   'Tus cartas se barajan tras apostar — no sabes qué juegas'
};

document.querySelectorAll('.btn-modo').forEach(btn => {
  btn.addEventListener('click', () => {
    miModalidad = btn.dataset.modo;
    document.querySelectorAll('.btn-modo').forEach(b => {
      b.classList.toggle('activo', b.dataset.modo === miModalidad);
      b.classList.toggle('secundario', b.dataset.modo !== miModalidad);
    });
    $('desc-modalidad').textContent = DESCS_MODALIDAD[miModalidad] || '';
  });
});

$('btn-iniciar').addEventListener('click', () => {
  socket.emit('iniciarPartida', { modalidad: miModalidad }, res => {
    if (res.error) mostrarError(res.error);
  });
});

$('btn-siguiente').addEventListener('click', () => {
  socket.emit('siguienteSubronda', res => {
    if (res.error) mostrarError(res.error);
    else irA('juego');
  });
});

const btnNueva = $('btn-nueva-partida');
if (btnNueva) {
  btnNueva.addEventListener('click', () => {
    sessionStorage.removeItem('cincoVidasToken');
    irA('entrada');
  });
}

// ── EVENTOS SERVIDOR ──────────────────────────
socket.on('connect', () => {
  miId = socket.id;
  const token = sessionStorage.getItem('cincoVidasToken');
  if (token) socket.emit('registrarToken', { token });
});

socket.on('tokenInvalido', () => {
  sessionStorage.removeItem('cincoVidasToken');
});

socket.on('salaActualizada', sala => {
  miSala = sala;
  renderizarSala(sala);
  if (pantallas.entrada.style.display === 'flex') irA('sala');
});

socket.on('partidaIniciada', () => {
  sonidoInicio();
  irA('juego');
  if (!document.getElementById('panel-reacciones')) crearPanelReacciones();
  crearChat();
});

socket.on('reaccion', ({ nickname, tipo }) => {
  mostrarReaccionFlotante(nickname, tipo);
});

socket.on('chatMensaje', ({ nickname, texto, id }) => {
  const msgs = document.getElementById('chat-mensajes');
  if (!msgs) return;
  const esMio = id === miId;
  const div = document.createElement('div');
  div.className = `chat-msg ${esMio ? 'chat-msg-mio' : ''}`;
  div.innerHTML = `<span class="chat-nick">${esMio ? 'Tú' : nickname}</span><span class="chat-texto">${texto}</span>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  if (window._chatNuevoMsg && !esMio) window._chatNuevoMsg();
});

socket.on('estadoActualizado', estado => {
  if (pantallas.juego.style.display === 'flex') {
    renderizarJuego(estado);
  } else if (estado.soyEspectador) {
    irA('juego');
    renderizarJuego(estado);
  }
});

socket.on('minirondaResuelta', ({ ganadorId, multiplicador }) => {
  if (ganadorId === miId) sonidoBazaGanada();
  else sonidoBazaPerdida();
  // Flash en la mesa
  const mesaFlash = document.getElementById('mesa');
  mesaFlash.classList.add(ganadorId === miId ? 'flash-verde' : 'flash-rojo');
  setTimeout(() => { mesaFlash.classList.remove('flash-verde','flash-rojo'); }, 800);
  $('panel-ases').classList.add('oculto');
  const estado  = miEstado;
  if (!estado) return;
  const ganador = estado.jugadores.find(j => j.id === ganadorId);
  const nombre  = ganador?.nickname || 'Alguien';
  const mult    = multiplicador > 1 ? ` (×${multiplicador} As de Copas 🍷)` : '';
  $('msg-juego').textContent = `✅ Baza para ${nombre}${mult}`;
});

socket.on('asesPendientes', ({ ases }) => {
  sonidoAs();
  const panel = $('panel-ases');
  panel.classList.remove('oculto');
  const desc = ases.map(a => {
    const poderes = {
      oros:    '🥇 As de Oros — gana automáticamente',
      copas:   '🍷 As de Copas — ×2 bazas al ganador',
      espadas: '⚔️ As de Espadas — elimina una carta',
      bastos:  '🪵 As de Bastos — intercambia un valor'
    };
    return poderes[a.carta.palo] || `As de ${a.carta.palo}`;
  }).join(' | ');
  $('msg-as').textContent = desc;
  $('botones-as').innerHTML = '';
});

socket.on('accionAs', ({ palo, mesa }) => {
  const panel = $('panel-ases');
  panel.classList.remove('oculto');
  const instrucciones = {
    espadas: '⚔️ As de Espadas: elige una carta para ELIMINAR (o pasa)',
    bastos:  '🪵 As de Bastos: elige una carta para INTERCAMBIAR su valor con el As'
  };
  $('msg-as').textContent = instrucciones[palo] || '';

  const botonesEl = $('botones-as');
  botonesEl.innerHTML = '';

  mesa.forEach((jugada, idx) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer';
    const cartaEl = crearCartaEl(jugada.carta, { seleccionable: true });
    wrapper.appendChild(cartaEl);
    wrapper.addEventListener('click', () => {
      const evento = palo === 'espadas' ? 'asEspadas' : 'asBastos';
      socket.emit(evento, { cartaIdx: idx }, res => {
        if (res.error) mostrarError(res.error);
        else panel.classList.add('oculto');
      });
    });
    botonesEl.appendChild(wrapper);
  });

  if (palo === 'espadas') {
    const btnPasar = document.createElement('button');
    btnPasar.textContent = 'No usar';
    btnPasar.style.cssText = 'background:rgba(255,255,255,0.1);margin-top:0.5rem';
    btnPasar.addEventListener('click', () => {
      socket.emit('asEspadas', { cartaIdx: -1 }, res => {
        if (res.error) mostrarError(res.error);
        else panel.classList.add('oculto');
      });
    });
    botonesEl.appendChild(btnPasar);
  }
});

socket.on('mesaActualizada', ({ mesa }) => {
  if (!miEstado) return;
  miEstado.mesa = mesa;
  const mesaEl = $('cartas-mesa');
  mesaEl.innerHTML = '';
  mesa.forEach(jugada => {
    const autor = miEstado.jugadores.find(j => j.id === jugada.jugadorId);
    mesaEl.appendChild(crearCartaEl(jugada.carta, { label: autor?.nickname || '' }));
  });
});

let ultimoResumen = [];

socket.on('subrondaTerminada', ({ resumen }) => {
  ultimoResumen = resumen;
  const miResumen = resumen.find(r => r.id === miId);
  if (miResumen && miResumen.vidasRestadas > 0) sonidoPierdesVidas();
  irA('resumen');
  const tbody = document.querySelector('#tabla-resumen tbody');
  tbody.innerHTML = '';
  resumen.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.nickname}</td>
      <td>${r.apuesta}</td>
      <td>${r.bazasGanadas}</td>
      <td class="${r.vidasRestadas > 0 ? 'negativo' : ''}">−${r.vidasRestadas}</td>
      <td>${r.vidasRestantes > 0 ? r.vidasRestantes : '💀'}</td>
    `;
    tbody.appendChild(tr);
  });

  const esCreador = miSala && miSala.creador === miId;
  if (esCreador) {
    $('btn-siguiente').classList.remove('oculto');
    $('msg-resumen').textContent = '';
  } else {
    $('btn-siguiente').classList.add('oculto');
    $('msg-resumen').textContent = 'Esperando al creador...';
  }
});

socket.on('subrondaIniciada', () => irA('juego'));

socket.on('partidaTerminada', ({ ganador }) => {
  if (ganador && ganador.id === miId) sonidoVictoria();
  else sonidoEliminado();
  irA('fin');
  $('fin-ganador').textContent = ganador
    ? `🏆 ¡${ganador.nickname} gana la partida!`
    : '💀 Nadie sobrevivió';

  const tbodyFin = document.querySelector('#tabla-fin tbody');
  if (tbodyFin) {
    tbodyFin.innerHTML = '';
    // Usar ultimoResumen que tiene las vidas ya restadas correctamente
    const fuente = ultimoResumen.length > 0 ? ultimoResumen : (miEstado?.jugadores || []);
    const jugadores = [...fuente].sort((a, b) => (b.vidasRestantes ?? b.vidas ?? 0) - (a.vidasRestantes ?? a.vidas ?? 0));
    jugadores.forEach((j, i) => {
      const vidas = j.vidasRestantes ?? j.vidas ?? 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}º</td>
        <td>${j.nickname}</td>
        <td>${vidas > 0 ? vidas : '💀'}</td>
      `;
      tbodyFin.appendChild(tr);
    });
  }
  sessionStorage.removeItem('cincoVidasToken');
});

// ── MODAL INSTRUCCIONES ──
const modalOverlay = document.getElementById('modal-instrucciones');

document.getElementById('btn-instrucciones').addEventListener('click', () => {
  modalOverlay.classList.remove('oculto');
});

document.getElementById('btn-cerrar-modal').addEventListener('click', () => {
  modalOverlay.classList.add('oculto');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add('oculto');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.querySelectorAll('.tab-contenido').forEach(t => {
      t.classList.remove('activo');
      t.classList.add('oculto');
    });
    btn.classList.add('activo');
    const tab = document.getElementById('tab-' + btn.dataset.tab);
    if (tab) { tab.classList.add('activo'); tab.classList.remove('oculto'); }
  });
});

irA('entrada');
