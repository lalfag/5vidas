import { sonidoCarta, sonidoBazaGanada, sonidoBazaPerdida, sonidoPierdesVidas, sonidoAs, sonidoInicio, sonidoEliminado, sonidoVictoria, sonidoCartaEspecial } from '/js/sounds.js';

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 10000
});

let miId        = null;
let miSala      = null;
let miEstado    = null;
let miModalidad = "clasico";

// Identificador de la última subronda para la que ya se animó el reparto de
// "mi mano". Se usa para que la animación de cartas-nueva (popIn/reparto)
// solo se dispare al iniciarse una subronda nueva, no en cada
// estadoActualizado (que llega con cada acción de cualquier jugador).
let subrondaAnimadaKey = null;

const pantallas = {
  entrada:  document.getElementById('pantalla-entrada'),
  avatar:   document.getElementById('pantalla-avatar'),
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

// ── AVATARES ─────────────────────────────────
const AVATARES = {
    Caballero: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="16" y="0" width="4" height="4" fill="#ef4444"/><rect x="18" y="2" width="4" height="2" fill="#ef4444"/><rect x="8" y="4" width="20" height="12" fill="#b0b8c8"/><rect x="6" y="8" width="2" height="6" fill="#7a8494"/><rect x="28" y="8" width="2" height="6" fill="#7a8494"/><rect x="10" y="8" width="16" height="4" fill="#475569"/><rect x="12" y="10" width="2" height="1" fill="#1e293b"/><rect x="22" y="10" width="2" height="1" fill="#1e293b"/><rect x="8" y="16" width="20" height="16" fill="#b0b8c8"/><rect x="6" y="18" width="2" height="12" fill="#7a8494"/><rect x="28" y="18" width="2" height="12" fill="#7a8494"/><rect x="6" y="16" width="6" height="4" fill="#7a8494"/><rect x="24" y="16" width="6" height="4" fill="#7a8494"/><rect x="16" y="20" width="4" height="6" fill="#7a8494"/></svg>`,
    Mago: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="16" y="0" width="4" height="4" fill="#7c3aed"/><rect x="14" y="4" width="8" height="4" fill="#7c3aed"/><rect x="12" y="8" width="12" height="4" fill="#7c3aed"/><rect x="16" y="8" width="4" height="2" fill="#fbbf24"/><rect x="10" y="12" width="16" height="4" fill="#7c3aed"/><rect x="6" y="16" width="24" height="2" fill="#fbbf24"/><rect x="10" y="18" width="16" height="6" fill="#f5c99a"/><rect x="12" y="19" width="2" height="2" fill="#1a1a2e"/><rect x="22" y="19" width="2" height="2" fill="#1a1a2e"/><rect x="12" y="22" width="12" height="6" fill="#e2e8f0"/><rect x="8" y="24" width="4" height="12" fill="#3b82f6"/><rect x="24" y="24" width="4" height="12" fill="#3b82f6"/><rect x="12" y="26" width="12" height="10" fill="#7c3aed"/></svg>`,
    Pirata: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="8" y="2" width="20" height="4" fill="#1a1a2e"/><rect x="6" y="6" width="24" height="4" fill="#1a1a2e"/><rect x="10" y="10" width="16" height="2" fill="#e94560"/><rect x="10" y="12" width="16" height="10" fill="#f5c99a"/><rect x="10" y="14" width="16" height="1" fill="#1a1a2e"/><rect x="13" y="13" width="4" height="4" fill="#1a1a2e"/><rect x="21" y="14" width="2" height="2" fill="#1a1a2e"/><rect x="10" y="20" width="16" height="4" fill="#4a3728"/><rect x="10" y="24" width="16" height="12" fill="#e94560"/><rect x="14" y="24" width="8" height="12" fill="#1a1a2e"/></svg>`,
    Ninja: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="10" y="4" width="16" height="16" fill="#1a1a2e"/><rect x="8" y="8" width="2" height="10" fill="#1a1a2e"/><rect x="26" y="8" width="2" height="10" fill="#1a1a2e"/><rect x="6" y="12" width="2" height="6" fill="#e94560"/><rect x="12" y="10" width="12" height="4" fill="#f5c99a"/><rect x="14" y="11" width="2" height="2" fill="#1a1a2e"/><rect x="20" y="11" width="2" height="2" fill="#1a1a2e"/><rect x="10" y="20" width="16" height="16" fill="#1a1a2e"/><rect x="8" y="24" width="2" height="10" fill="#1a1a2e"/><rect x="26" y="24" width="2" height="10" fill="#1a1a2e"/><rect x="10" y="28" width="16" height="3" fill="#e94560"/></svg>`,
    Rey: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="10" y="2" width="16" height="6" fill="#f0c040"/><rect x="10" y="0" width="2" height="2" fill="#f0c040"/><rect x="15" y="0" width="2" height="2" fill="#f0c040"/><rect x="20" y="0" width="2" height="2" fill="#f0c040"/><rect x="25" y="0" width="2" height="2" fill="#f0c040"/><rect x="12" y="4" width="2" height="2" fill="#c0002a"/><rect x="22" y="4" width="2" height="2" fill="#3b82f6"/><rect x="10" y="8" width="16" height="12" fill="#f5c99a"/><rect x="12" y="11" width="2" height="2" fill="#1a1a2e"/><rect x="22" y="11" width="2" height="2" fill="#1a1a2e"/><rect x="8" y="14" width="2" height="8" fill="#e2e8f0"/><rect x="26" y="14" width="2" height="8" fill="#e2e8f0"/><rect x="10" y="16" width="16" height="6" fill="#e2e8f0"/><rect x="8" y="22" width="20" height="14" fill="#c0002a"/><rect x="12" y="22" width="12" height="14" fill="#f0c040"/><rect x="12" y="22" width="3" height="14" fill="#e2e8f0"/><rect x="21" y="22" width="3" height="14" fill="#e2e8f0"/></svg>`,
    Bruja: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="16" y="0" width="4" height="4" fill="#1a1a2e"/><rect x="14" y="4" width="8" height="4" fill="#1a1a2e"/><rect x="12" y="8" width="12" height="4" fill="#1a1a2e"/><rect x="10" y="12" width="16" height="4" fill="#1a1a2e"/><rect x="10" y="14" width="16" height="2" fill="#7c3aed"/><rect x="6" y="16" width="24" height="2" fill="#1a1a2e"/><rect x="8" y="18" width="20" height="10" fill="#7c3aed"/><rect x="10" y="18" width="16" height="10" fill="#22c55e"/><rect x="12" y="20" width="2" height="2" fill="#fbbf24"/><rect x="22" y="20" width="2" height="2" fill="#fbbf24"/><rect x="10" y="28" width="16" height="8" fill="#1a1a2e"/><rect x="2" y="32" width="32" height="2" fill="#b45309"/><rect x="30" y="30" width="4" height="6" fill="#fbbf24"/></svg>`,
    Robot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="17" y="0" width="2" height="6" fill="#94a3b8"/><rect x="16" y="0" width="4" height="2" fill="#fbbf24"/><rect x="8" y="6" width="20" height="18" fill="#60a5fa"/><rect x="6" y="10" width="2" height="10" fill="#94a3b8"/><rect x="28" y="10" width="2" height="10" fill="#94a3b8"/><rect x="11" y="11" width="4" height="4" fill="#fbbf24"/><rect x="21" y="11" width="4" height="4" fill="#fbbf24"/><rect x="12" y="18" width="12" height="3" fill="#94a3b8"/><rect x="14" y="19" width="8" height="1" fill="#1a1a2e"/><rect x="15" y="24" width="6" height="2" fill="#94a3b8"/><rect x="8" y="26" width="20" height="10" fill="#60a5fa"/><rect x="12" y="29" width="12" height="4" fill="#94a3b8"/></svg>`,
    Fantasma: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="12" y="4" width="12" height="4" fill="#e2e8f0"/><rect x="10" y="8" width="16" height="4" fill="#e2e8f0"/><rect x="8" y="12" width="20" height="16" fill="#e2e8f0"/><rect x="8" y="20" width="2" height="12" fill="#93c5fd"/><rect x="13" y="12" width="3" height="5" fill="#1a1a2e"/><rect x="20" y="13" width="3" height="5" fill="#1a1a2e"/><rect x="13" y="13" width="1" height="1" fill="#ffffff"/><rect x="20" y="14" width="1" height="1" fill="#ffffff"/><rect x="8" y="28" width="4" height="4" fill="#e2e8f0"/><rect x="16" y="28" width="4" height="4" fill="#e2e8f0"/><rect x="24" y="28" width="4" height="4" fill="#e2e8f0"/><rect x="12" y="28" width="4" height="2" fill="#93c5fd"/><rect x="20" y="28" width="4" height="2" fill="#93c5fd"/></svg>`,
    Dragon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="8" y="2" width="4" height="6" fill="#f97316"/><rect x="24" y="2" width="4" height="6" fill="#f97316"/><rect x="16" y="4" width="4" height="4" fill="#fbbf24"/><rect x="10" y="8" width="16" height="14" fill="#16a34a"/><rect x="12" y="11" width="3" height="3" fill="#fbbf24"/><rect x="13" y="12" width="1" height="1" fill="#000000"/><rect x="21" y="11" width="3" height="3" fill="#fbbf24"/><rect x="22" y="12" width="1" height="1" fill="#000000"/><rect x="8" y="16" width="20" height="12" fill="#16a34a"/><rect x="10" y="22" width="16" height="2" fill="#fbbf24"/><rect x="11" y="18" width="2" height="2" fill="#0b5325"/><rect x="23" y="18" width="2" height="2" fill="#0b5325"/></svg>`,
    Vampiro: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="10" y="4" width="16" height="6" fill="#1a1a2e"/><rect x="16" y="10" width="4" height="2" fill="#1a1a2e"/><rect x="8" y="6" width="2" height="6" fill="#1a1a2e"/><rect x="26" y="6" width="2" height="6" fill="#1a1a2e"/><rect x="10" y="10" width="16" height="12" fill="#f5c99a"/><rect x="12" y="12" width="2" height="2" fill="#e94560"/><rect x="22" y="12" width="2" height="2" fill="#e94560"/><rect x="14" y="17" width="8" height="2" fill="#1a1a2e"/><rect x="15" y="18" width="1" height="2" fill="#ffffff"/><rect x="20" y="18" width="1" height="2" fill="#ffffff"/><rect x="6" y="20" width="4" height="8" fill="#e94560"/><rect x="26" y="20" width="4" height="8" fill="#e94560"/><rect x="10" y="22" width="16" height="14" fill="#1a1a2e"/><rect x="14" y="22" width="8" height="14" fill="#e94560"/></svg>`,
    Arquero: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="10" y="2" width="16" height="8" fill="#15803d"/><rect x="8" y="6" width="20" height="6" fill="#15803d"/><rect x="22" y="0" width="2" height="4" fill="#e94560"/><rect x="10" y="10" width="16" height="10" fill="#f5c99a"/><rect x="12" y="12" width="2" height="2" fill="#92400e"/><rect x="22" y="12" width="2" height="2" fill="#92400e"/><rect x="10" y="20" width="16" height="16" fill="#15803d"/><rect x="30" y="4" width="2" height="28" fill="#92400e"/><rect x="28" y="4" width="2" height="2" fill="#92400e"/><rect x="28" y="30" width="2" height="2" fill="#92400e"/><rect x="10" y="24" width="16" height="2" fill="#92400e"/></svg>`,
    Esqueleto: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" style="shape-rendering:crispEdges"><rect x="10" y="4" width="16" height="14" fill="#e7e5e4"/><rect x="8" y="6" width="2" height="10" fill="#a8a29e"/><rect x="26" y="6" width="2" height="10" fill="#a8a29e"/><rect x="12" y="9" width="4" height="4" fill="#1a1a2e"/><rect x="20" y="9" width="4" height="4" fill="#1a1a2e"/><rect x="17" y="13" width="2" height="2" fill="#1a1a2e"/><rect x="12" y="18" width="12" height="4" fill="#e7e5e4"/><rect x="14" y="19" width="1" height="2" fill="#1a1a2e"/><rect x="18" y="19" width="1" height="2" fill="#1a1a2e"/><rect x="21" y="19" width="1" height="2" fill="#1a1a2e"/><rect x="17" y="22" width="2" height="14" fill="#e7e5e4"/><rect x="10" y="25" width="16" height="2" fill="#e7e5e4"/><rect x="12" y="29" width="12" height="2" fill="#e7e5e4"/><rect x="14" y="33" width="8" height="2" fill="#e7e5e4"/></svg>`
,
    Oscar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="10" y="3" width="16" height="11" fill="#1a1a2e"/><rect x="8" y="5" width="20" height="7" fill="#1a1a2e"/><rect x="7" y="7" width="22" height="4" fill="#1a1a2e"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="9" y="14" width="18" height="3" fill="#f5c99a"/><rect x="11" y="10" width="14" height="15" fill="#f5c99a"/><rect x="10" y="12" width="16" height="11" fill="#f5c99a"/><rect x="13" y="13" width="3" height="1" fill="#1a1a2e"/><rect x="20" y="13" width="3" height="1" fill="#1a1a2e"/><rect x="14" y="12" width="1" height="1" fill="#1a1a2e"/><rect x="21" y="12" width="1" height="1" fill="#1a1a2e"/><rect x="13" y="18" width="10" height="4" fill="#1a1a2e"/><rect x="14" y="19" width="8" height="2" fill="#ffffff"/><rect x="12" y="18" width="1" height="2" fill="#1a1a2e"/><rect x="23" y="18" width="1" height="2" fill="#1a1a2e"/><rect x="7" y="29" width="22" height="7" fill="#3b82f6"/><rect x="10" y="28" width="16" height="1" fill="#3b82f6"/></svg>`,
    Carlos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="11" y="5" width="14" height="6" fill="#6B3F1A"/><rect x="10" y="7" width="16" height="8" fill="#6B3F1A"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="11" y="10" width="14" height="15" fill="#f5c99a"/><rect x="12" y="13" width="5" height="4" fill="#1a1a2e"/><rect x="19" y="13" width="5" height="4" fill="#1a1a2e"/><rect x="17" y="14" width="2" height="1" fill="#1a1a2e"/><rect x="13" y="14" width="3" height="2" fill="#93c5fd" fill-opacity="0.3"/><rect x="20" y="14" width="3" height="2" fill="#93c5fd" fill-opacity="0.3"/><rect x="14" y="14" width="1" height="1" fill="#1a1a2e"/><rect x="21" y="14" width="1" height="1" fill="#1a1a2e"/><rect x="16" y="20" width="4" height="1" fill="#1a1a2e"/><rect x="15" y="19" width="6" height="1" fill="#6B3F1A"/><rect x="15" y="21" width="6" height="4" fill="#6B3F1A"/><rect x="17" y="21" width="2" height="2" fill="#f5c99a"/><rect x="7" y="29" width="22" height="7" fill="#3b82f6"/><rect x="10" y="28" width="16" height="1" fill="#3b82f6"/></svg>`,
    Marcos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="11" y="4" width="14" height="5" fill="#6B3F1A"/><rect x="9" y="7" width="18" height="24" fill="#6B3F1A"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="11" y="9" width="14" height="16" fill="#f5c99a"/><rect x="13" y="12" width="2" height="1" fill="#1a1a2e"/><rect x="21" y="12" width="2" height="1" fill="#1a1a2e"/><rect x="13" y="14" width="2" height="2" fill="#1a1a2e"/><rect x="21" y="14" width="2" height="2" fill="#1a1a2e"/><rect x="14" y="14" width="1" height="1" fill="#ffffff"/><rect x="22" y="14" width="1" height="1" fill="#ffffff"/><rect x="16" y="21" width="4" height="1" fill="#1a1a2e"/><rect x="7" y="29" width="22" height="7" fill="#6b7280"/><rect x="10" y="28" width="16" height="1" fill="#6b7280"/></svg>`,
    Mateo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="11" y="7" width="14" height="3" fill="#1a1a2e"/><rect x="10" y="8" width="16" height="3" fill="#1a1a2e"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="11" y="10" width="14" height="15" fill="#f5c99a"/><rect x="10" y="13" width="16" height="9" fill="#f5c99a"/><rect x="13" y="13" width="2" height="1" fill="#1a1a2e"/><rect x="21" y="13" width="2" height="1" fill="#1a1a2e"/><rect x="13" y="15" width="2" height="2" fill="#1a1a2e"/><rect x="21" y="15" width="2" height="2" fill="#1a1a2e"/><rect x="15" y="21" width="6" height="1" fill="#1a1a2e"/><rect x="7" y="29" width="22" height="7" fill="#991b1b"/><rect x="10" y="28" width="16" height="1" fill="#991b1b"/></svg>`,
    Gus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="10" y="3" width="16" height="11" fill="#f97316"/><rect x="8" y="5" width="20" height="8" fill="#f97316"/><rect x="7" y="7" width="22" height="5" fill="#f97316"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="11" y="11" width="14" height="14" fill="#f5c99a"/><rect x="12" y="13" width="5" height="4" fill="#1a1a2e"/><rect x="19" y="13" width="5" height="4" fill="#1a1a2e"/><rect x="17" y="14" width="2" height="1" fill="#1a1a2e"/><rect x="13" y="14" width="3" height="2" fill="#93c5fd" fill-opacity="0.3"/><rect x="20" y="14" width="3" height="2" fill="#93c5fd" fill-opacity="0.3"/><rect x="14" y="14" width="1" height="1" fill="#1a1a2e"/><rect x="21" y="14" width="1" height="1" fill="#1a1a2e"/><rect x="15" y="19" width="6" height="1" fill="#f97316"/><rect x="16" y="20" width="4" height="1" fill="#1a1a2e"/><rect x="15" y="21" width="6" height="4" fill="#f97316"/><rect x="17" y="21" width="2" height="2" fill="#f5c99a"/><rect x="7" y="29" width="22" height="7" fill="#ea580c"/><rect x="10" y="28" width="16" height="1" fill="#ea580c"/></svg>`,
    Adri: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%"><rect x="11" y="6" width="14" height="5" fill="#1a1a2e"/><rect x="10" y="8" width="16" height="4" fill="#1a1a2e"/><rect x="15" y="25" width="6" height="4" fill="#f5c99a"/><rect x="11" y="10" width="14" height="15" fill="#f5c99a"/><rect x="10" y="13" width="16" height="9" fill="#f5c99a"/><rect x="13" y="13" width="2" height="1" fill="#1a1a2e"/><rect x="21" y="13" width="2" height="1" fill="#1a1a2e"/><rect x="13" y="15" width="2" height="2" fill="#1a1a2e"/><rect x="21" y="15" width="2" height="2" fill="#1a1a2e"/><rect x="15" y="20" width="6" height="1" fill="#1a1a2e"/><rect x="16" y="21" width="4" height="1" fill="#f5c99a"/><rect x="16" y="22" width="4" height="3" fill="#1a1a2e"/><rect x="17" y="22" width="2" height="1" fill="#f5c99a"/><rect x="7" y="29" width="22" height="7" fill="#4b5563"/><rect x="10" y="28" width="16" height="1" fill="#4b5563"/></svg>`,
    Maria: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%" shape-rendering="crispEdges"><rect x="8" y="4" width="20" height="4" fill="#F4D03F"/><rect x="6" y="8" width="24" height="6" fill="#F4D03F"/><rect x="6" y="14" width="4" height="12" fill="#F4D03F"/><rect x="26" y="14" width="4" height="12" fill="#F4D03F"/><rect x="16" y="6" width="4" height="2" fill="#F7DC6F"/><rect x="10" y="8" width="16" height="16" fill="#FEDCBA"/><rect x="15" y="24" width="6" height="3" fill="#FEDCBA"/><rect x="13" y="14" width="3" height="3" fill="#ffffff"/><rect x="13" y="14" width="2" height="2" fill="#2ECC71"/><rect x="20" y="14" width="3" height="3" fill="#ffffff"/><rect x="20" y="14" width="2" height="2" fill="#2ECC71"/><rect x="13" y="13" width="3" height="1" fill="#424949"/><rect x="20" y="13" width="3" height="1" fill="#424949"/><rect x="17" y="18" width="2" height="2" fill="#E0C0A0"/><rect x="16" y="21" width="4" height="1" fill="#E74C3C"/><rect x="9" y="27" width="18" height="6" fill="#F1948A"/><rect x="11" y="26" width="14" height="1" fill="#F1948A"/></svg>`,
    Bombera: `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="bombera"><rect x="14" y="2" width="8" height="2" fill="#e94560"/><rect x="12" y="4" width="12" height="4" fill="#e94560"/><rect x="10" y="8" width="16" height="2" fill="#e94560"/><rect x="8" y="10" width="20" height="2" fill="#1a1a2e"/><rect x="10" y="12" width="16" height="8" fill="#f5c99a"/><rect x="12" y="14" width="2" height="2" fill="#1a1a2e"/><rect x="22" y="14" width="2" height="2" fill="#1a1a2e"/><rect x="16" y="18" width="4" height="2" fill="#1a1a2e"/><rect x="8" y="12" width="2" height="6" fill="#1a1a2e"/><rect x="26" y="12" width="2" height="6" fill="#1a1a2e"/><rect x="10" y="20" width="16" height="10" fill="#1a1a2e"/><rect x="12" y="20" width="2" height="10" fill="#e94560"/><rect x="22" y="20" width="2" height="10" fill="#e94560"/><rect x="14" y="24" width="8" height="2" fill="#e94560"/></g></svg>`,
    Superwoman: `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="superheroina"><rect x="8" y="4" width="20" height="2" fill="#1a1a2e"/><rect x="6" y="6" width="24" height="2" fill="#1a1a2e"/><rect x="6" y="8" width="6" height="16" fill="#1a1a2e"/><rect x="24" y="8" width="6" height="16" fill="#1a1a2e"/><rect x="8" y="24" width="4" height="4" fill="#1a1a2e"/><rect x="24" y="24" width="4" height="4" fill="#1a1a2e"/><rect x="12" y="8" width="12" height="12" fill="#f5c99a"/><rect x="10" y="10" width="16" height="4" fill="#e94560"/><rect x="14" y="14" width="8" height="2" fill="#e94560"/><rect x="14" y="11" width="2" height="2" fill="#f0c040"/><rect x="20" y="11" width="2" height="2" fill="#f0c040"/><rect x="16" y="17" width="4" height="2" fill="#f0c040"/><rect x="10" y="20" width="16" height="10" fill="#e94560"/><rect x="14" y="22" width="8" height="6" fill="#f0c040"/><rect x="16" y="24" width="4" height="2" fill="#1a1a2e"/></g></svg>`,
    Alien: `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="alien"><rect x="10" y="4" width="16" height="2" fill="#22c55e"/><rect x="8" y="6" width="20" height="4" fill="#22c55e"/><rect x="6" y="10" width="24" height="8" fill="#22c55e"/><rect x="8" y="18" width="20" height="2" fill="#22c55e"/><rect x="12" y="20" width="12" height="2" fill="#22c55e"/><rect x="10" y="10" width="6" height="6" fill="#7c3aed"/><rect x="20" y="10" width="6" height="6" fill="#7c3aed"/><rect x="12" y="12" width="2" height="2" fill="#1a1a2e"/><rect x="22" y="12" width="2" height="2" fill="#1a1a2e"/><rect x="12" y="1" width="2" height="3" fill="#22c55e"/><rect x="22" y="1" width="2" height="3" fill="#22c55e"/><rect x="11" y="0" width="4" height="1" fill="#7c3aed"/><rect x="21" y="0" width="4" height="1" fill="#7c3aed"/><rect x="16" y="17" width="4" height="1" fill="#1a1a2e"/><rect x="10" y="22" width="16" height="10" fill="#1a1a2e"/><rect x="12" y="24" width="12" height="2" fill="#7c3aed"/><rect x="12" y="28" width="12" height="2" fill="#7c3aed"/></g></svg>`
};

let miAvatar = null;

// ── SKINS DE CARTAS ────────────────────────────────────────────────────────
// Cada skin define su propia paleta de color/borde por palo (el resto del
// aspecto de la carta —fondos, texturas— se controla vía variables CSS en
// body.skin-XXX, ver style.css). Aquí solo viven los colores que se aplican
// inline desde JS (icono central, valores en las esquinas).
const PALOS_COLOR_POR_SKIN = {
  clasica: {
    oros: '#8a6000', copas: '#a0001e', espadas: '#0f3a7a', bastos: '#1a5c22', joker: '#7c3aed'
  },
  nocturna: {
    oros: '#f0c95a', copas: '#f08aa0', espadas: '#8fb4f5', bastos: '#8fe0a8', joker: '#c9a8ff'
  },
  pergamino: {
    oros: '#8a6000', copas: '#9a2a1e', espadas: '#2a4a7a', bastos: '#3a6020', joker: '#6c3aad'
  }
};

const BORDES_POR_SKIN = {
  clasica: {
    oros: 'rgba(176,134,0,0.35)', copas: 'rgba(180,0,40,0.3)', espadas: 'rgba(30,80,150,0.3)', bastos: 'rgba(30,110,40,0.3)', joker: 'rgba(124,58,237,0.4)'
  },
  nocturna: {
    oros: 'rgba(240,201,90,0.4)', copas: 'rgba(240,138,160,0.35)', espadas: 'rgba(143,180,245,0.35)', bastos: 'rgba(143,224,168,0.35)', joker: 'rgba(201,168,255,0.45)'
  },
  pergamino: {
    oros: 'rgba(176,134,0,0.4)', copas: 'rgba(154,42,30,0.35)', espadas: 'rgba(42,74,122,0.35)', bastos: 'rgba(58,96,32,0.35)', joker: 'rgba(108,58,173,0.45)'
  }
};

const SKINS_VALIDAS = ['clasica', 'nocturna', 'pergamino'];

function obtenerSkinActual() {
  const guardada = sessionStorage.getItem('cincoVidasSkin');
  return SKINS_VALIDAS.includes(guardada) ? guardada : 'clasica';
}

function aplicarSkinCartas(skin) {
  if (!SKINS_VALIDAS.includes(skin)) skin = 'clasica';
  sessionStorage.setItem('cincoVidasSkin', skin);
  document.body.classList.remove(...SKINS_VALIDAS.map(s => `skin-${s}`));
  document.body.classList.add(`skin-${skin}`);
}

// Getters que reemplazan los antiguos objetos fijos PALO_COLOR / PALO_BORDER:
// devuelven la paleta de la skin actualmente activa
function obtenerPaloColor() {
  return PALOS_COLOR_POR_SKIN[obtenerSkinActual()] || PALOS_COLOR_POR_SKIN.clasica;
}
function obtenerPaloBorder() {
  return BORDES_POR_SKIN[obtenerSkinActual()] || BORDES_POR_SKIN.clasica;
}

function inicializarPantallaAvatar() {
  const grid = document.getElementById('avatar-grid-todos');

  function crearItem(nombre, svg) {
    const div = document.createElement('div');
    div.className = 'avatar-item';
    div.dataset.nombre = nombre;
    div.innerHTML = `${svg}<span>${nombre}</span>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('seleccionado'));
      div.classList.add('seleccionado');
      miAvatar = { nombre, svg };
      document.getElementById('btn-confirmar-avatar').disabled = false;
    });
    return div;
  }

  Object.entries(AVATARES).forEach(([nombre, svg]) => {
    grid.appendChild(crearItem(nombre, svg));
  });
}

// Helper: obtener el SVG de un avatar por nombre (estructura plana única)
function obtenerAvatarSvg(nombre) {
  return nombre ? (AVATARES[nombre] || '') : '';
}

document.getElementById('btn-confirmar-avatar').addEventListener('click', () => {
  if (!miAvatar) return;
  // Guardar avatar y pasar al flujo normal (crear o unirse)
  sessionStorage.setItem('cincoVidasAvatar', JSON.stringify(miAvatar));
  const accion = sessionStorage.getItem('cincoVidasAccion');
  if (accion === 'crear') {
    ejecutarCrearSala();
  } else {
    ejecutarUnirse();
  }
});

// Llamar al inicializar
inicializarPantallaAvatar();
inicializarSelectorSkin();

function inicializarSelectorSkin() {
  const skinActual = obtenerSkinActual();
  document.querySelectorAll('.skin-item').forEach(item => {
    item.classList.toggle('seleccionado', item.dataset.skin === skinActual);
    item.addEventListener('click', () => {
      document.querySelectorAll('.skin-item').forEach(el => el.classList.remove('seleccionado'));
      item.classList.add('seleccionado');
      aplicarSkinCartas(item.dataset.skin);
    });
  });
}
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

function labelValor(v, palo) {
  if (palo === 'joker') return '🃏';
  return NOMBRES_VALOR[v] || String(v);
}

// Icono central para el Joker (Hardcore) — máscara estilizada
const JOKER_ICONO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="100%" height="100%">
  <path d="M 18 4 C 10 4, 6 10, 6 16 C 6 24, 12 30, 12 30 L 12 24 L 16 28 L 18 24 L 20 28 L 24 24 L 24 30 C 24 30, 30 24, 30 16 C 30 10, 26 4, 18 4 Z"
    stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12" />
  <circle cx="13" cy="15" r="2" fill="currentColor" />
  <circle cx="23" cy="15" r="2" fill="currentColor" />
  <path d="M 13 21 Q 18 25, 23 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
  <circle cx="18" cy="3" r="1.5" fill="currentColor" opacity="0.7" />
</svg>`;

function crearCartaEl(carta, opts = {}) {
  const el = document.createElement('div');

  const esJoker  = carta.palo === 'joker';
  const esAs     = !esJoker && carta.valor === 1;
  const esFigura = !esJoker && carta.valor >= 10;
  const nombreFigura = { 12: 'rey', 11: 'caballo', 10: 'sota' }[carta.valor] || '';
  const clasesEspeciales = esJoker ? ' joker' : (esAs ? ' as' : (esFigura ? ` figura ${nombreFigura}` : ''));
  const claseNueva = opts.nueva ? ' carta-nueva' : '';
  el.className = `carta ${carta.palo}${clasesEspeciales} ${opts.seleccionable ? 'seleccionable' : 'no-seleccionable'}${claseNueva}`;

  const color = obtenerPaloColor()[carta.palo];
  const val   = labelValor(carta.valor, carta.palo);
  const icono = esJoker
    ? JOKER_ICONO
    : (esFigura ? FIGURA_ICONO[carta.valor] || '' : PALOS_SVG[carta.palo]?.() || '');

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

  // ── RESALTE DE "TU TURNO" ──────────────────────────────────────────────
  // Tu turno de jugar carta (fase juego) o de apostar por turnos (fase apuestas,
  // sin apuesta simultánea de ronda final)
  const apuestaSimultaneaTurno = esRondaFinal && estado.modalidad === 'clasico';
  const esMiTurnoActivo = esMiTurno && (
    estado.fase === 'juego' ||
    (estado.fase === 'apuestas' && !apuestaSimultaneaTurno && miJugador.apuesta === null)
  );
  const miZonaEl = $('mi-zona');
  if (miZonaEl) miZonaEl.classList.toggle('turno-activo', esMiTurnoActivo);
  document.body.classList.toggle('mi-turno', esMiTurnoActivo);

  const bannerEl = $('banner-espectador');
  soyEspectador ? bannerEl.classList.remove('oculto') : bannerEl.classList.add('oculto');

  $('info-subronda').textContent = `Subronda ${estado.subrondaActual + 1}/5${esRondaFinal ? ' · Final' : ''}`;
  aplicarFondoModalidad(estado.modalidad);
  const infoModo = $('info-modalidad');
  if (infoModo) {
    const badges = { clasico: '', twisted: '🃏 Twisted', chaos: '🌀 Chaos' };
    infoModo.textContent = badges[estado.modalidad] || '';
  }
  $('info-fase').textContent     = tradFase(estado.fase);

  const miAvatarNombre = miJugador.avatar;
  const miAvatarSvg = obtenerAvatarSvg(miAvatarNombre);
  const miNicknameEl = $('mi-nickname');
  miNicknameEl.innerHTML = miAvatarSvg
    ? `<span class="mi-avatar-inline">${miAvatarSvg}</span>${miJugador.nickname}`
    : miJugador.nickname;
  const vidasEl = $('mis-vidas');
  const vidasAntes = vidasEl.textContent;
  const esVegas = estado.modalidad === 'vegas';
  const vidasNuevas = soyEspectador ? '💀 Eliminado'
    : esVegas ? `🪙 ${estado.vegas?.monedas?.[miId] ?? 0}`
    : `❤️ ${miJugador.vidas}`;
  if (vidasAntes !== vidasNuevas) {
    vidasEl.classList.remove('shake','latido');
    void vidasEl.offsetWidth;
    vidasEl.classList.add(miJugador.vidas < parseInt(vidasAntes.replace(/[^0-9]/g,'')) ? 'shake' : 'latido');
    setTimeout(() => vidasEl.classList.remove('shake','latido'), 400);
  }
  vidasEl.textContent = vidasNuevas;
  $('mi-apuesta-info').textContent = miJugador.apuesta !== null
    ? `Aposté: ${miJugador.apuesta} · Bazas: ${miJugador.bazasGanadas}`
    : '';

  // Rivales — ordenados en el sentido real de juego (el que va justo
  // después de mí queda a mi izquierda, y se recorre hacia la derecha
  // hasta el jugador anterior a mí), tal como en una mesa real
  const rivalesEl = $('rivales');
  rivalesEl.innerHTML = '';

  // Posiciones disponibles según número de rivales (de izquierda a derecha
  // en el sentido de giro de la mesa)
  const LAYOUTS_RIVALES = {
    1: ['arriba-centro'],
    2: ['arriba-izq', 'arriba-der'],
    3: ['izq', 'arriba-centro', 'der'],
    4: ['izq', 'arriba-izq', 'arriba-der', 'der'],
    5: ['izq', 'arriba-izq', 'arriba-centro', 'arriba-der', 'der']
  };

  const idsRivales = (estado.rivalesOrden && estado.rivalesOrden.length > 0)
    ? estado.rivalesOrden.filter(id => id !== miId)
    : estado.jugadores.filter(j => j.id !== miId).map(j => j.id);

  const layout = LAYOUTS_RIVALES[idsRivales.length] || [];

  idsRivales.forEach((rivalId, i) => {
    const j = estado.jugadores.find(p => p.id === rivalId);
    if (!j) return;

    const esSuTurno = estado.jugadores[estado.turnoIdx]?.id === j.id;
    const div = document.createElement('div');
    div.className = `rival${esSuTurno ? ' turno-activo' : ''}`;
    div.dataset.pos = layout[i] || 'arriba-centro';

    const avatarSvg = obtenerAvatarSvg(j.avatar);

    let cartaHtml = '';
    if ((soyEspectador || esRondaFinal) && j.mano && j.mano.length > 0) {
      const c = j.mano[0];
      const col = obtenerPaloColor()[c.palo];
      const brd = obtenerPaloBorder()[c.palo];
      const ico = PALOS_SVG[c.palo]?.() || '';
      cartaHtml = `<div class="carta-mini" style="border-color:${brd};color:${col}">
        <span class="carta-mini-val" style="color:${col}">${labelValor(c.valor, c.palo)}</span>
        <div class="carta-mini-ico">${ico}</div>
      </div>`;
    }

    div.innerHTML = `
      ${avatarSvg ? `<div class="rival-avatar">${avatarSvg}</div>` : ''}
      <span class="nombre">${j.nickname}</span>
      <span class="vidas">${esVegas ? `🪙 ${estado.vegas?.monedas?.[j.id] ?? 0}` : `❤️ ${j.vidas}`}</span>
      <span class="apuesta-rival">${j.apuesta !== null ? `Apostó: ${j.apuesta}` : '—'}</span>
      <span style="font-size:0.72rem;color:#4caf50">Bazas: ${j.bazasGanadas}/${j.apuesta !== null ? j.apuesta : '?'}</span>
      <span style="font-size:0.72rem;color:#aaa">${j.cartasEnMano} carta${j.cartasEnMano !== 1 ? 's' : ''}</span>
      ${manaRivalHtml(j)}
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
    cartaMesaEl.dataset.jugadorId = jugada.jugadorId;
    if (!jugada.oculta) cartaMesaEl.dataset.valor = jugada.carta.valor;
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

    // Animación de reparto: solo la primera vez que se renderiza la mano de
    // esta subronda (evita que el popIn/vuelo se repita en cada
    // estadoActualizado que llega por cualquier acción de cualquier jugador)
    const claveSubronda = `${estado.subrondaActual}`;
    const esRepartoNuevo = subrondaAnimadaKey !== claveSubronda;
    if (esRepartoNuevo) subrondaAnimadaKey = claveSubronda;

    miJugador.mano.forEach((carta, idx) => {
      const puedoJugar = estado.fase === 'juego' && esMiTurno;
      manoEl.appendChild(crearCartaEl(carta, {
        seleccionable: puedoJugar,
        nueva: esRepartoNuevo,
        onClick: puedoJugar ? () => jugarCarta(idx) : null
      }));
    });
  }

  // Panel apuestas
  const panelApuestas = $('panel-apuestas');
  const apuestaSimultanea = esRondaFinal && ['clasico', 'vegas'].includes(estado.modalidad);

  // VEGAS: segundo paso del turno — ya aposté bazas pero me falta apostar
  // monedas. Tiene prioridad sobre el panel de apuestas normal.
  const esperandoMisMonedas = esVegas && !soyEspectador &&
    miJugador.apuesta !== null && miJugador.apuestaMonedas === null &&
    (apuestaSimultanea || esMiTurno);

  if (esperandoMisMonedas) {
    panelApuestas.classList.add('oculto');
    renderizarPanelMonedas(estado, miJugador);
  } else {
    $('panel-monedas')?.classList.add('oculto');

    if (!soyEspectador && estado.fase === 'apuestas' && miJugador.apuesta === null && (apuestaSimultanea || esMiTurno)) {
      panelApuestas.classList.remove('oculto');
      renderizarBotonesApuesta(estado);
      requestAnimationFrame(() => panelApuestas.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } else {
      panelApuestas.classList.add('oculto');
    }
  }

  // VEGAS: mostrar monedas/bancas siempre visibles durante la partida
  if (esVegas) actualizarPanelEconomiaVegas(estado);

  // Mensaje
  const msgJuego = $('msg-juego');
  if (soyEspectador) {
    msgJuego.textContent = '👁️ Modo espectador';
  } else if (esperandoMisMonedas) {
    msgJuego.textContent = '🎰 Apostaste tus bazas — ¿cuántas monedas arriesgas?';
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
  } else if (estado.fase === 'duelo') {
    msgJuego.textContent = '⚔️ Duelo del Prisionero en curso...';
  } else {
    msgJuego.textContent = '';
  }

  // HARDCORE: barra de maná y escala invertida
  actualizarBarraMana(estado);
  actualizarEscalaInvertida(estado);
}

// VEGAS: panel del segundo paso del turno de apuesta — arriesgar monedas
// sobre la apuesta de bazas que el jugador acaba de hacer.
function renderizarPanelMonedas(estado, miJugador) {
  const panel = $('panel-monedas');
  if (!panel) return;
  panel.classList.remove('oculto');

  const saldo  = estado.vegas?.monedas?.[miId] ?? 0;
  const maximo = Math.floor(saldo * 0.20);

  if (saldo <= 0 || maximo === 0) {
    panel.innerHTML = `<p>🎰 Apostaste <strong>${miJugador.apuesta}</strong> bazas. Con menos de 5 monedas no puedes apostar seguridad esta subronda.</p>`;
    // Auto-confirmar con 0 para no bloquear el flujo
    setTimeout(() => apostarMonedas(0), 800);
    return;
  }

  if (panel.dataset.saldo !== String(saldo)) {
    panel.dataset.saldo = String(saldo);
    panel.innerHTML = `
      <p>🎰 Apostaste <strong>${miJugador.apuesta}</strong> bazas. ¿Cuántas monedas arriesgas? (máx. 20% = ${maximo}🪙)</p>
      <p style="font-size:0.8rem;color:var(--gris)">Si aciertas exacto, las doblas. Si fallas, las pierdes.</p>
      <div style="display:flex;align-items:center;gap:0.6rem;justify-content:center;flex-wrap:wrap">
        <input type="range" id="slider-monedas" min="1" max="${maximo}" value="1" style="flex:1;min-width:140px">
        <span id="valor-monedas" style="font-weight:700;color:var(--dorado);min-width:3ch;text-align:right">1</span>
        <span>🪙</span>
      </div>
      <div style="display:flex;gap:0.4rem;justify-content:center;flex-wrap:wrap;margin-top:0.4rem">
        <button class="btn-monedas-rapido" data-val="1">Mín. (1)</button>
        <button class="btn-monedas-rapido" data-val="${Math.max(1,Math.floor(maximo*0.5))}">50%</button>
        <button class="btn-monedas-rapido" data-val="${maximo}">Máx. (${maximo})</button>
        <button class="btn-monedas-rapido" data-val="0">Pasar</button>
      </div>
      <button id="btn-confirmar-monedas" style="margin-top:0.6rem">Confirmar 🎰</button>
    `;

    const slider  = $('slider-monedas');
    const valorEl = $('valor-monedas');
    slider.addEventListener('input', () => { valorEl.textContent = slider.value; });

    panel.querySelectorAll('.btn-monedas-rapido').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        if (val === 0) {
          // Pasar: no apostar nada
          apostarMonedas(0);
        } else {
          slider.value = val;
          valorEl.textContent = val;
        }
      });
    });

    $('btn-confirmar-monedas').addEventListener('click', () => {
      const cantidad = parseInt(slider.value, 10) || 1;
      apostarMonedas(cantidad);
    });
  }
}

// VEGAS: actualiza el panel siempre visible con el saldo propio, el de los
// rivales y las dos bancas (vidas / apuestas)
function actualizarPanelEconomiaVegas(estado) {
  const cont = $('economia-vegas');
  if (!cont || !estado.vegas) return;
  cont.classList.remove('oculto');

  const miSaldo = estado.vegas.monedas?.[miId] ?? 0;

  const filasRivales = estado.jugadores
    .filter(j => j.id !== miId)
    .map(j => {
      const arriesgado = j.apuestaMonedas;
      const tag = arriesgado !== null ? ` <span class="moneda-rival-apuesta">(🎲 ${arriesgado})</span>` : '';
      return `<span class="moneda-rival">${j.nickname}: ${estado.vegas.monedas?.[j.id] ?? 0} 🪙${tag}</span>`;
    })
    .join('');

  const miApuesta = estado.jugadores.find(j => j.id === miId)?.apuestaMonedas;
  const miTag = miApuesta !== null && miApuesta !== undefined ? ` <span class="moneda-rival-apuesta">(🎲 ${miApuesta})</span>` : '';

  cont.innerHTML = `
    <div class="economia-vegas-fila economia-vegas-mias">🪙 Tus monedas: <strong>${miSaldo}</strong>${miTag}</div>
    <div class="economia-vegas-fila economia-vegas-rivales">${filasRivales}</div>
    <div class="economia-vegas-fila economia-vegas-bancas">
      <span title="Resto del bote de vidas, se reparte cuando alcance para un número exacto">🏦 Banco vidas: ${estado.vegas.bancaVidas}</span>
      <span title="Resto del bote de apuestas, se reparte cuando alcance para un número exacto">🎲 Banco apuestas: ${estado.vegas.bancaApuestas}</span>
    </div>
  `;
}

// VEGAS: muestra los movimientos económicos de la subronda (bote de vidas
// repartido + resultado de la apuesta de monedas) en la pantalla de resumen
function mostrarResultadosVegas(vegas) {
  let cont = $('resultados-vegas');
  if (!vegas) {
    cont?.classList.add('oculto');
    return;
  }
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'resultados-vegas';
    const tabla = $('tabla-resumen');
    tabla?.insertAdjacentElement('afterend', cont);
  }
  cont.classList.remove('oculto');

  // Agrupar movimientos por jugador (puede tener varios: bote de vidas +
  // resultado de apuesta de monedas)
  const totales = {};
  (vegas.movimientos || []).forEach(m => {
    totales[m.jugadorId] = (totales[m.jugadorId] || 0) + m.delta;
  });

  const ETIQUETAS_MOTIVO = {
    vidas_perdidas:          '📉 Bazas falladas',
    bote_vidas:              '🏦 Bote de vidas',
    apuesta_perdida:         '🎲 Apuesta perdida',
    apuesta_ganada:          '🎲 Apuesta acertada',
    apuesta_ganada_prorrata: '🎲 Apuesta acertada (parcial)'
  };

  const filas = (vegas.movimientos || []).map(m => {
    const jugador = miEstado?.jugadores.find(j => j.id === m.jugadorId);
    const esYo    = m.jugadorId === miId;
    const nombre  = esYo ? 'Tú' : (jugador?.nickname || '???');
    const signo   = m.delta > 0 ? '+' : '';
    const clase   = m.delta > 0 ? 'positivo' : 'negativo';
    return `<div class="vegas-movimiento ${clase}">
      <span>${nombre} — ${ETIQUETAS_MOTIVO[m.motivo] || m.motivo}</span>
      <span>${signo}${m.delta} 🪙</span>
    </div>`;
  }).join('');

  cont.innerHTML = `
    <p class="vegas-resultados-titulo">🎰 Resultado económico</p>
    ${filas || '<p style="font-size:0.8rem;color:var(--gris)">Sin movimientos esta subronda</p>'}
    <div class="economia-vegas-fila economia-vegas-bancas" style="margin-top:0.4rem">
      <span>🏦 Banco vidas: ${vegas.bancaVidas}</span>
      <span>🎲 Banco apuestas: ${vegas.bancaApuestas}</span>
    </div>
  `;

  // Sonido de monedas para resultados propios positivos
  const miDelta = totales[miId] || 0;
  if (miDelta > 0) {
    try { sonidoCartaEspecial(1, 'oros'); } catch (e) {}
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

// ════════════════════════════════════════════════════════════════════════════
// ── MODO HARDCORE ────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

const MANA_PARA_VIDA = 5;

const LOGRO_ICONOS = {
  ultimo_en_pie:      '🏔️',
  pureza:             '🎨',
  regicida:           '👑',
  intocable:          '🛡️',
  tercer_acto:        '🔁',
  fantasma:           '👻',
  filo_navaja:        '🔪',
  cazador_ases:       '🎯',
  caos_controlado:    '🃏',
  vidente:            '🔮',
  harmonia:           '🌈',
  rey_detras_del_rey: '🏅',
  reanimador:         '❤️‍🔥',
  agonia:             '💔',
  racha_perfecta:     '🔥',
  lo_mas_bajo:        '🔃',
  mentor:             '🎓',
  indestructible:     '💎',
  mana_colchon:       '✨'
};

// ── BARRA DE MANÁ ──────────────────────────────────────────────────────────
function actualizarBarraMana(estado) {
  const esHardcore = estado.config?.hardcore;
  const barraMia = $('mi-barra-mana');
  if (!barraMia) return;

  if (!esHardcore) {
    barraMia.classList.add('oculto');
    return;
  }

  const yo = estado.jugadores.find(j => j.id === miId);
  const manaInfo = yo?.mana;
  if (!manaInfo) {
    barraMia.classList.add('oculto');
    return;
  }

  barraMia.classList.remove('oculto');
  const pct = Math.min(100, (manaInfo.mana / MANA_PARA_VIDA) * 100);
  const fill = $('mi-mana-fill');
  const valorEl = $('mi-mana-valor');

  if (fill) {
    const pctAnterior = parseFloat(fill.dataset.pct || '0');
    fill.style.width = pct + '%';
    fill.dataset.pct = pct;
    // Pulso si sube
    if (pct > pctAnterior) {
      fill.classList.remove('mana-pulso');
      void fill.offsetWidth;
      fill.classList.add('mana-pulso');
    }
  }
  if (valorEl) valorEl.textContent = `${manaInfo.mana}/${MANA_PARA_VIDA}`;
}

// Mostrar barra de maná pequeña en rivales (solo número total visible)
function manaRivalHtml(j) {
  if (!j.mana) return '';
  const pct = Math.min(100, (j.mana.mana / MANA_PARA_VIDA) * 100);
  return `
    <div class="barra-mana barra-mana-rival">
      <span class="mana-label">✨</span>
      <div class="mana-track"><div class="mana-fill" style="width:${pct}%"></div></div>
      <span class="mana-valor">${j.mana.mana}/${MANA_PARA_VIDA}</span>
    </div>
  `;
}

// ── NOTIFICACIONES DE LOGRO ───────────────────────────────────────────────────
// Cola global: los logros pueden llegar en lotes (fin de minironda, fin de
// subronda, eventos puntuales como el 7 de Oros) muy seguidos entre sí,
// incluso justo cuando la pantalla cambia (resumen de subronda). Para que
// ninguna notificación se pierda o se solape con el cambio de pantalla,
// se encolan todas y se muestran de una en una con un ritmo fijo,
// independientemente de qué pantalla esté activa en ese momento
// (#contenedor-logros es position:fixed y está presente en todo momento).
const COLA_LOGROS = [];
let colaLogrosActiva = false;

function procesarColaLogros() {
  if (colaLogrosActiva) return;
  const siguiente = COLA_LOGROS.shift();
  if (!siguiente) return;

  colaLogrosActiva = true;
  mostrarNotificacionLogro(siguiente);

  setTimeout(() => {
    colaLogrosActiva = false;
    procesarColaLogros();
  }, 450);
}

function encolarLogro(evento) {
  if (!evento || !evento.logro) return;
  COLA_LOGROS.push(evento);
  procesarColaLogros();
}

function mostrarNotificacionLogro(evento) {
  if (!evento || !evento.logro) return;
  const cont = $('contenedor-logros');
  if (!cont) return;

  const icono = LOGRO_ICONOS[evento.logroId] || '✨';
  const esMio = evento.jugadorId === miId;
  // Rareza visual: logros de 3+ maná tienen animación más grande
  const rareza = evento.logro.mana >= 3 ? 'logro-epico' : (evento.logro.mana >= 2 ? 'logro-raro' : 'logro-comun');

  const card = document.createElement('div');
  card.className = `notificacion-logro ${rareza}`;
  card.innerHTML = `
    <div class="logro-icono">${icono}</div>
    <div class="logro-texto">
      <span class="logro-jugador">${esMio ? 'Tú' : evento.nickname}</span>
      <span class="logro-nombre">${evento.logro.nombre}</span>
      ${evento.logro.mana > 0 ? `<span class="logro-mana">+${evento.logro.mana} ✨</span>` : ''}
    </div>
    ${evento.vidaGanada ? '<div class="logro-vida-extra">❤️ +1 vida</div>' : ''}
  `;
  cont.appendChild(card);

  // Sonido sutil para logros (reutilizamos sonido de carta especial si existe)
  try { sonidoCartaEspecial(1, 'copas'); } catch (e) {}

  setTimeout(() => card.classList.add('logro-saliendo'), 3200);
  setTimeout(() => card.remove(), 3700);
}

function mostrarEventosLogro(eventos) {
  if (!eventos || eventos.length === 0) return;
  eventos.forEach(ev => encolarLogro(ev));
}

// ── ESCALA INVERTIDA (JOKERS) ──────────────────────────────────────────────
function actualizarEscalaInvertida(estado) {
  const badge = $('info-escala-invertida');
  if (!badge) return;
  if (estado.inversionEscala) {
    badge.classList.remove('oculto');
  } else {
    badge.classList.add('oculto');
  }
}

// ── 7 DE OROS — PANEL DE INTERCAMBIO ──────────────────────────────────────────
let seleccion7Oros = [];

function mostrarPanel7Oros(mesa, jugadorId7) {
  if (jugadorId7 !== miId) return; // solo el dueño del 7 de oros ve el panel

  seleccion7Oros = [];
  const panel = $('panel-7oros');
  const botonesEl = $('botones-7oros');
  if (!panel || !botonesEl) return;

  panel.classList.remove('oculto');
  botonesEl.innerHTML = '';

  mesa.forEach((jugada, idx) => {
    // El dueño del 7 de Oros no puede elegir su propia carta
    if (jugada.jugadorId === jugadorId7) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer';
    wrapper.dataset.idx = idx;
    const cartaEl = crearCartaEl(jugada.carta, { seleccionable: true });
    wrapper.appendChild(cartaEl);

    wrapper.addEventListener('click', () => {
      if (seleccion7Oros.includes(idx)) {
        seleccion7Oros = seleccion7Oros.filter(i => i !== idx);
        wrapper.classList.remove('carta-7oros-elegida');
      } else if (seleccion7Oros.length < 2) {
        seleccion7Oros.push(idx);
        wrapper.classList.add('carta-7oros-elegida');
      }

      if (seleccion7Oros.length === 2) {
        const [idxA, idxB] = seleccion7Oros;
        socket.emit('usar7Oros', { idxA, idxB }, res => {
          if (res.error) {
            mostrarError(res.error);
            seleccion7Oros = [];
            botonesEl.querySelectorAll('.carta-7oros-elegida').forEach(el => el.classList.remove('carta-7oros-elegida'));
          } else {
            panel.classList.add('oculto');
          }
        });
      }
    });

    botonesEl.appendChild(wrapper);
  });
}

const btnPasar7Oros = $('btn-pasar-7oros');
if (btnPasar7Oros) {
  btnPasar7Oros.addEventListener('click', () => {
    socket.emit('pasar7Oros', res => {
      if (res.error) mostrarError(res.error);
      else $('panel-7oros').classList.add('oculto');
    });
  });
}

// ── DUELO DEL PRISIONERO ───────────────────────────────────────────────────────
let dueloTimerInterval = null;
let yaElegiDuelo = false;

function avatarDueloHtml(jugador) {
  const svg = obtenerAvatarSvg(jugador?.avatar);
  return svg ? `<div class="rival-avatar duelo-avatar-svg">${svg}</div>` : '<div class="duelo-avatar-placeholder">❓</div>';
}

function abrirOverlayDuelo({ jugadorAId, jugadorBId, nickA, nickB, timeout }) {
  const overlay = $('overlay-duelo');
  if (!overlay) return;

  yaElegiDuelo = false;

  const estado = miEstado;
  const jugA = estado?.jugadores.find(j => j.id === jugadorAId);
  const jugB = estado?.jugadores.find(j => j.id === jugadorBId);

  $('duelo-avatar-a').innerHTML = avatarDueloHtml(jugA);
  $('duelo-avatar-b').innerHTML = avatarDueloHtml(jugB);
  $('duelo-nombre-a').textContent = nickA || jugA?.nickname || '???';
  $('duelo-nombre-b').textContent = nickB || jugB?.nickname || '???';

  $('duelo-eleccion-a').classList.add('oculto');
  $('duelo-eleccion-b').classList.add('oculto');
  $('duelo-resultado').classList.add('oculto');
  $('duelo-espera').classList.add('oculto');
  $('duelo-tabla').classList.remove('oculto');

  const soyParticipante = miId === jugadorAId || miId === jugadorBId;
  const acciones = $('duelo-acciones');
  const observador = $('duelo-observador');

  if (soyParticipante) {
    acciones.classList.remove('oculto');
    observador.classList.add('oculto');
  } else {
    acciones.classList.add('oculto');
    observador.classList.remove('oculto');
  }

  overlay.classList.remove('oculto');

  // Countdown visual
  let segs = Math.floor((timeout || 20000) / 1000);
  const timerEl = $('duelo-timer');
  timerEl.textContent = segs;
  timerEl.classList.remove('duelo-timer-urgente');
  if (dueloTimerInterval) clearInterval(dueloTimerInterval);
  dueloTimerInterval = setInterval(() => {
    segs--;
    if (segs <= 5 && segs >= 0) timerEl.classList.add('duelo-timer-urgente');
    timerEl.textContent = Math.max(0, segs);
    if (segs <= 0) clearInterval(dueloTimerInterval);
  }, 1000);
}

function elegirDuelo(eleccion) {
  if (yaElegiDuelo) return;
  yaElegiDuelo = true;
  $('duelo-acciones').classList.add('oculto');
  $('duelo-espera').classList.remove('oculto');

  socket.emit('elegirDuelo', { eleccion }, res => {
    if (res.error) {
      mostrarError(res.error);
      yaElegiDuelo = false;
      $('duelo-acciones').classList.remove('oculto');
      $('duelo-espera').classList.add('oculto');
    }
  });
}

const btnDueloColaborar = $('btn-duelo-colaborar');
const btnDueloTraicionar = $('btn-duelo-traicionar');
if (btnDueloColaborar)  btnDueloColaborar.addEventListener('click', () => elegirDuelo('colaborar'));
if (btnDueloTraicionar) btnDueloTraicionar.addEventListener('click', () => elegirDuelo('traicionar'));

function mostrarResultadoDuelo(resultado) {
  if (dueloTimerInterval) clearInterval(dueloTimerInterval);

  // Si el duelo se canceló porque un participante se desconectó,
  // cerrar el overlay sin mostrar resultados detallados
  if (resultado && resultado.cancelado) {
    $('overlay-duelo').classList.add('oculto');
    mostrarMsgJuego('⚔️ El duelo se canceló — un jugador se desconectó');
    return;
  }

  const estado = miEstado;
  const jugA = estado?.jugadores.find(j => j.id === resultado.jugadorAId);
  const jugB = estado?.jugadores.find(j => j.id === resultado.jugadorBId);

  const ICONOS_ELECCION = { colaborar: '🤝', traicionar: '🗡️' };

  $('duelo-eleccion-a').textContent = ICONOS_ELECCION[resultado.eleccionA] || '';
  $('duelo-eleccion-b').textContent = ICONOS_ELECCION[resultado.eleccionB] || '';
  $('duelo-eleccion-a').classList.remove('oculto');
  $('duelo-eleccion-b').classList.remove('oculto');
  $('duelo-tabla').classList.add('oculto');
  $('duelo-acciones').classList.add('oculto');
  $('duelo-espera').classList.add('oculto');
  $('duelo-observador').classList.add('oculto');

  // Construir texto de resultado desde el punto de vista de quien mira
  let texto = '';
  const efA = resultado.efectos.find(e => e.jugadorId === resultado.jugadorAId);
  const efB = resultado.efectos.find(e => e.jugadorId === resultado.jugadorBId);

  function describirEfecto(jug, ef) {
    if (!jug || !ef) return '';
    const partes = [];
    if (ef.mana) partes.push(`${ef.mana > 0 ? '+' : ''}${ef.mana} maná`);
    if (ef.vidasPerdidas) partes.push(`−${ef.vidasPerdidas} vida`);
    if (ef.info)       partes.push(`sabe que su carta es <strong>${ef.info === 'mayor' ? 'MAYOR' : 'menor'}</strong>`);
    if (ef.infoCuanto !== undefined) partes.push(`sabe que su carta es <strong>${Math.abs(ef.infoCuanto)} puntos mayor</strong>`);
    return `<strong>${jug.nickname}</strong>: ${partes.join(', ') || 'sin cambios'}`;
  }

  if (resultado.eleccionA === 'colaborar' && resultado.eleccionB === 'colaborar') {
    texto = `🤝 Ambos colaboraron.<br>${describirEfecto(jugA, efA)}<br>${describirEfecto(jugB, efB)}`;
  } else if (resultado.eleccionA === 'traicionar' && resultado.eleccionB === 'traicionar') {
    texto = `🗡️ Ambos traicionaron.<br>${describirEfecto(jugA, efA)}<br>${describirEfecto(jugB, efB)}`;
  } else {
    const traidor   = resultado.eleccionA === 'traicionar' ? jugA : jugB;
    const efTraidor = resultado.eleccionA === 'traicionar' ? efA : efB;
    const victima   = resultado.eleccionA === 'traicionar' ? jugB : jugA;
    const efVictima = resultado.eleccionA === 'traicionar' ? efB : efA;
    texto = `🗡️ ${traidor?.nickname} traicionó a ${victima?.nickname}.<br>${describirEfecto(traidor, efTraidor)}<br>${describirEfecto(victima, efVictima)}`;
  }

  $('duelo-resultado-texto').innerHTML = texto;
  $('duelo-resultado').classList.remove('oculto');

  // Cerrar overlay tras unos segundos
  setTimeout(() => {
    $('overlay-duelo').classList.add('oculto');
  }, 5000);
}

// ── ACCIONES ─────────────────────────────────
function apostar(cantidad) {
  sonidoCarta();
  socket.emit('apostar', { cantidad }, res => {
    if (res.error) mostrarError(res.error);
  });
}

// VEGAS: segundo paso del turno — arriesgar monedas sobre la apuesta de bazas
function apostarMonedas(cantidad) {
  sonidoCarta();
  const panel = $('panel-monedas');
  if (panel) delete panel.dataset.saldo; // forzar reconstrucción del panel la próxima vez
  socket.emit('apostarMonedas', { cantidad }, res => {
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

function mostrarMsgJuego(texto, duracion = 4000) {
  const el = $('msg-juego');
  if (!el) return;
  el.textContent = texto;
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.textContent = ''; }, duracion);
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
  crearChat();
  $('codigo-sala').textContent = sala.codigo;
  const lista = $('lista-jugadores');
  lista.innerHTML = '';
  sala.jugadores.forEach(j => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;';
    const avatarSvg = obtenerAvatarSvg(j.avatar);
    li.innerHTML = `
      ${avatarSvg ? `<span class="avatar-mini">${avatarSvg}</span>` : ''}
      <span class="nombre">${j.nickname}</span>
      ${j.id === sala.creador ? `<span class="corona">👑</span>` : ''}
    `;
    lista.appendChild(li);
  });
  const btnIniciar = $('btn-iniciar');
  const selectorModo = $('selector-modalidad');
  const etiquetaModo = $('etiqueta-modo-sala');

  // Fondo y etiqueta de modo — visibles para todos los jugadores de la sala
  const modalidadSala = sala.modalidad || 'clasico';
  miModalidad = modalidadSala;
  aplicarFondoModalidad(modalidadSala);

  if (sala.creador === socket.id) {
    btnIniciar.classList.remove('oculto');
    if (selectorModo) selectorModo.classList.remove('oculto');
    if (etiquetaModo) etiquetaModo.classList.add('oculto');
    sincronizarBotonesModo(modalidadSala);
    $('msg-sala').textContent = sala.jugadores.length < 2 ? 'Esperando más jugadores...' : '¡Listos para jugar!';
  } else {
    btnIniciar.classList.add('oculto');
    if (selectorModo) selectorModo.classList.add('oculto');
    if (etiquetaModo) etiquetaModo.classList.remove('oculto');
    $('msg-sala').textContent = 'Esperando al creador...';
  }
}

// ── BOTONES LOBBY ─────────────────────────────
function ejecutarCrearSala() {
  const nickname = $('input-nickname').value.trim();
  const avatarData = sessionStorage.getItem('cincoVidasAvatar');
  socket.emit('crearSala', { nickname, token: obtenerToken(), avatar: avatarData ? JSON.parse(avatarData).nombre : null }, res => {
    if (res.error) { irA('entrada'); return mostrarError(res.error); }
    miSala = res.sala;
    renderizarSala(res.sala);
    irA('sala');
  });
}

function ejecutarUnirse() {
  const nickname = $('input-nickname').value.trim();
  const codigo   = $('input-codigo').value.trim().toUpperCase();
  const avatarData = sessionStorage.getItem('cincoVidasAvatar');
  socket.emit('unirseASala', { nickname, codigo, token: obtenerToken(), avatar: avatarData ? JSON.parse(avatarData).nombre : null }, res => {
    if (res.error) { irA('entrada'); return mostrarError(res.error); }
    miSala = res.sala;
    renderizarSala(res.sala);
    irA('sala');
  });
}

$('btn-crear').addEventListener('click', () => {
  const nickname = $('input-nickname').value.trim();
  if (nickname.length < 2) return mostrarError('Nickname demasiado corto');
  sessionStorage.setItem('cincoVidasAccion', 'crear');
  irA('avatar');
});

$('btn-unirse-form').addEventListener('click', () => {
  $('form-unirse').classList.toggle('oculto');
});

$('btn-unirse').addEventListener('click', () => {
  const nickname = $('input-nickname').value.trim();
  const codigo   = $('input-codigo').value.trim().toUpperCase();
  if (nickname.length < 2) return mostrarError('Nickname demasiado corto');
  if (codigo.length !== 4) return mostrarError('El código tiene 4 letras');
  sessionStorage.setItem('cincoVidasAccion', 'unirse');
  irA('avatar');
});

// Selector de modalidad
const DESCS_MODALIDAD = {
  clasico:  'Modo estándar — apuestas y bazas clásicas',
  twisted:  'Las cartas se juegan boca abajo y se revelan a la vez',
  chaos:    'Tus cartas se barajan tras apostar — no sabes qué juegas',
  leap:     '🙈 Apuestas a ciegas — ves tus cartas solo después de apostar',
  hardcore: '💀 Jokers, 7 de Oros árbitro, Rey inmune, maná/logros y Duelo del Prisionero en la ronda final',
  vegas:    '🎰 Empiezas con 50 monedas. Por cada vida perdida, 10 monedas van al bote y se reparten entre quien no perdió ninguna. Además, arriesga monedas a que aciertas tu apuesta de bazas: si aciertas, las doblas.'
};

const NOMBRES_MODALIDAD = {
  clasico:  '⚔️ Clásico',
  twisted:  '🃏 Twisted',
  chaos:    '🌀 Chaos',
  leap:     '🙈 Leap of Faith',
  hardcore: '💀 Hardcore',
  vegas:    '🎰 Vegas'
};

const MODOS_VALIDOS = ['clasico', 'twisted', 'chaos', 'leap', 'hardcore', 'vegas'];

// Aplica el fondo correspondiente al modo de juego (clase en <body>) y
// actualiza la etiqueta visible para que todos sepan a qué se está jugando
function aplicarFondoModalidad(modalidad) {
  if (!MODOS_VALIDOS.includes(modalidad)) modalidad = 'clasico';
  document.body.classList.remove(...MODOS_VALIDOS.map(m => `fondo-${m}`));
  document.body.classList.add(`fondo-${modalidad}`);

  const etiqueta = $('etiqueta-modo-sala');
  if (etiqueta) etiqueta.textContent = NOMBRES_MODALIDAD[modalidad] || '';
}

// Sincroniza los botones .btn-modo y la descripción con la modalidad dada
function sincronizarBotonesModo(modalidad) {
  document.querySelectorAll('.btn-modo').forEach(b => {
    b.classList.toggle('activo', b.dataset.modo === modalidad);
    b.classList.toggle('secundario', b.dataset.modo !== modalidad);
  });
  const desc = $('desc-modalidad');
  if (desc) desc.textContent = DESCS_MODALIDAD[modalidad] || '';
}

document.querySelectorAll('.btn-modo').forEach(btn => {
  btn.addEventListener('click', () => {
    // Solo el creador puede cambiar el modo desde la sala de espera
    if (miSala && miSala.creador !== socket.id) return;

    miModalidad = btn.dataset.modo;
    sincronizarBotonesModo(miModalidad);
    aplicarFondoModalidad(miModalidad);

    // Si ya estamos en una sala, avisar al servidor para que todos lo vean
    if (miSala) {
      socket.emit('seleccionarModalidad', { modalidad: miModalidad }, res => {
        if (res?.error) mostrarError(res.error);
      });
    }
  });
});

// Otro jugador (o el propio) ha (pre)seleccionado el modo — actualizar para todos
socket.on('modalidadSeleccionada', ({ modalidad }) => {
  miModalidad = modalidad;
  if (miSala) miSala.modalidad = modalidad;
  sincronizarBotonesModo(modalidad);
  aplicarFondoModalidad(modalidad);
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
    if (miSala) {
      renderizarSala(miSala);
      irA('sala');
    } else {
      sessionStorage.removeItem('cincoVidasToken');
      irA('entrada');
    }
  });
}

// ── EVENTOS SERVIDOR ──────────────────────────
socket.on('connect', () => {
  miId = socket.id;
  const token = sessionStorage.getItem('cincoVidasToken');
  if (token) socket.emit('registrarToken', { token });
});

// Móvil: cuando la pestaña/app vuelve al foco, verificar conexión y reconectar
// si es necesario. Cubre: bloqueo de pantalla, cambio de app, modo avión corto.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!socket.connected) {
      socket.connect();
    } else {
      // Incluso conectado, re-enviar el token para reasociarse a la sala
      // en caso de que el servidor haya limpiado el estado del socket
      const token = sessionStorage.getItem('cincoVidasToken');
      if (token) socket.emit('registrarToken', { token });
    }
  }
});

// Desconexión: intentar reconectar automáticamente siempre
socket.on('disconnect', (reason) => {
  console.log('[socket] desconectado:', reason);
  if (reason === 'io server disconnect') {
    // El servidor forzó la desconexión — esperar un poco y reconectar
    setTimeout(() => socket.connect(), 1000);
  }
  // Para 'transport close', 'ping timeout', etc. socket.io ya reintenta solo
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
  subrondaAnimadaKey = null; // forzar animación de reparto en la primera subronda
  irA('juego');
  if (!document.getElementById('panel-reacciones')) crearPanelReacciones();
  crearChat();
});

socket.on('reaccion', ({ nickname, tipo }) => {
  mostrarReaccionFlotante(nickname, tipo);
});

socket.on('turnoSkipeado', ({ nickname }) => {
  mostrarMsgJuego(`⏭ ${nickname} tardó demasiado — turno saltado automáticamente`);
});

socket.on('jugadorDesconectado', ({ nickname }) => {
  mostrarMsgJuego(`🔌 ${nickname} se ha desconectado y ha sido eliminado de la partida`);
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

  // HARDCORE: si estamos en fase de duelo y el overlay no está abierto
  // (p.ej. tras reconexión), reabrirlo con los datos del duelo
  if (estado.fase === 'duelo' && estado.duelo && !estado.duelo.resuelto) {
    const overlay = $('overlay-duelo');
    if (overlay && overlay.classList.contains('oculto')) {
      const jugA = estado.jugadores.find(j => j.id === estado.duelo.jugadorAId);
      const jugB = estado.jugadores.find(j => j.id === estado.duelo.jugadorBId);
      abrirOverlayDuelo({
        jugadorAId: estado.duelo.jugadorAId,
        jugadorBId: estado.duelo.jugadorBId,
        nickA: jugA?.nickname,
        nickB: jugB?.nickname,
        timeout: 20000
      });
    }
  }
});

socket.on('minirondaResuelta', ({ ganadorId, multiplicador, eventosLogro }) => {
  if (ganadorId === miId) sonidoBazaGanada();
  else sonidoBazaPerdida();
  // Flash en la mesa
  const mesaFlash = document.getElementById('mesa');
  mesaFlash.classList.add(ganadorId === miId ? 'flash-verde' : 'flash-rojo');
  setTimeout(() => { mesaFlash.classList.remove('flash-verde','flash-rojo'); }, 800);

  // Resaltar la carta ganadora en la mesa (brillo dorado + elevación breve)
  const cartaGanadora = document.querySelector(`#cartas-mesa [data-jugador-id="${ganadorId}"]`);
  if (cartaGanadora) {
    cartaGanadora.classList.add('carta-ganadora');
    setTimeout(() => cartaGanadora.classList.remove('carta-ganadora'), 1200);
  }

  $('panel-ases').classList.add('oculto');
  $('panel-7oros').classList.add('oculto');
  const estado  = miEstado;
  if (!estado) return;
  const ganador = estado.jugadores.find(j => j.id === ganadorId);
  const nombre  = ganador?.nickname || 'Alguien';
  const mult    = multiplicador > 1 ? ` (×${multiplicador} As de Copas 🍷)` : '';
  $('msg-juego').textContent = `✅ Baza para ${nombre}${mult}`;

  // HARDCORE: mostrar logros conseguidos en esta minironda
  mostrarEventosLogro(eventosLogro);
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

socket.on('accionAs', ({ palo, mesa, gruposAnulados }) => {
  const panel = $('panel-ases');
  panel.classList.remove('oculto');
  const instrucciones = {
    espadas: '⚔️ As de Espadas: elige una carta para ELIMINAR (o pasa)',
    bastos:  '🪵 As de Bastos: elige una carta para INTERCAMBIAR su valor con el As'
  };
  $('msg-as').textContent = instrucciones[palo] || '';

  const botonesEl = $('botones-as');
  botonesEl.innerHTML = '';

  function crearWrapper(jugada, esAnulada) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer';
    const cartaEl = crearCartaEl(jugada.carta, { seleccionable: true });
    if (esAnulada) cartaEl.classList.add('carta-anulada-objetivo');
    wrapper.appendChild(cartaEl);
    if (esAnulada) {
      const tag = document.createElement('span');
      tag.textContent = '🚫 Anulada';
      tag.style.cssText = 'font-size:0.65rem;color:var(--gris)';
      wrapper.appendChild(tag);
    }
    return wrapper;
  }

  mesa.forEach((jugada, idx) => {
    const wrapper = crearWrapper(jugada, false);
    wrapper.addEventListener('click', () => {
      const evento = palo === 'espadas' ? 'asEspadas' : 'asBastos';
      const payload = palo === 'espadas'
        ? { objetivo: { origen: 'mesa', idx } }
        : { cartaIdx: idx };
      socket.emit(evento, payload, res => {
        if (res.error) mostrarError(res.error);
        else panel.classList.add('oculto');
      });
    });
    botonesEl.appendChild(wrapper);
  });

  // As de Espadas: también se pueden seleccionar cartas de parejas ya anuladas
  // (p. ej. dos Reyes anulados) — al "matar" una, la otra resucita y vuelve a mesa
  if (palo === 'espadas' && gruposAnulados && gruposAnulados.length > 0) {
    gruposAnulados.forEach((grupo, grupoIdx) => {
      grupo.jugadas.forEach((jugada, idx) => {
        const wrapper = crearWrapper(jugada, true);
        wrapper.addEventListener('click', () => {
          socket.emit('asEspadas', { objetivo: { origen: 'anulada', grupoIdx, idx } }, res => {
            if (res.error) mostrarError(res.error);
            else panel.classList.add('oculto');
          });
        });
        botonesEl.appendChild(wrapper);
      });
    });
  }

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

// HARDCORE: 7 de Oros activo — el dueño elige dos cartas para intercambiar
socket.on('siete7OrosPendiente', ({ mesa }) => {
  sonidoAs();
  mostrarPanel7Oros(mesa, miId);
});

// HARDCORE: logro conseguido fuera del flujo de minironda (p.ej. 7 de Oros)
socket.on('logroConseguido', evento => {
  encolarLogro(evento);
});

// Animación sutil: cuando dos (o más) cartas se anulan por pares,
// se "levantan" ligeramente y se desvanecen antes de desaparecer de la mesa
socket.on('cartasAnuladas', ({ gruposAnulados }) => {
  const mesaEl = $('cartas-mesa');
  if (!mesaEl) return;

  gruposAnulados.forEach(grupo => {
    grupo.jugadas.forEach(jugada => {
      const candidatos = mesaEl.querySelectorAll(`[data-jugador-id="${jugada.jugadorId}"]`);
      candidatos.forEach(el => {
        if (parseInt(el.dataset.valor) === jugada.carta.valor) {
          el.classList.add('carta-anulando');
        }
      });
    });
  });
});

socket.on('mesaActualizada', ({ mesa }) => {
  if (!miEstado) return;
  miEstado.mesa = mesa;
  const mesaEl = $('cartas-mesa');
  mesaEl.innerHTML = '';
  mesa.forEach(jugada => {
    const autor = miEstado.jugadores.find(j => j.id === jugada.jugadorId);
    const el = crearCartaEl(jugada.carta, { label: autor?.nickname || '' });
    el.dataset.jugadorId = jugada.jugadorId;
    el.dataset.valor = jugada.carta.valor;
    mesaEl.appendChild(el);
  });
});

let ultimoResumen = [];

socket.on('subrondaTerminada', ({ resumen, jugadoresVivos, eventosLogroSubronda, vegas }) => {
  ultimoResumen = resumen;
  const miResumen = resumen.find(r => r.id === miId);
  if (miResumen && miResumen.vidasRestadas > 0) sonidoPierdesVidas();
  irA('resumen');

  // HARDCORE: mostrar logros conseguidos al cierre de la subronda
  mostrarEventosLogro(eventosLogroSubronda);
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

  // VEGAS: resultados económicos de la subronda (bote de vidas + apuestas)
  mostrarResultadosVegas(vegas);

  // Zona de donación de vidas
  let zonaDonacion = $('zona-donacion');
  if (!zonaDonacion) {
    zonaDonacion = document.createElement('div');
    zonaDonacion.id = 'zona-donacion';
    $('pantalla-resumen').insertBefore(zonaDonacion, $('btn-siguiente'));
  }
  zonaDonacion.innerHTML = '';

  // IMPORTANTE: no usar miEstado (puede estar desactualizado en el instante
  // en que el jugador acaba de morir). jugadoresVivos viene recién calculado
  // en este mismo evento, así que es la fuente fiable.
  const soyEspectador = Array.isArray(jugadoresVivos)
    ? !jugadoresVivos.some(j => j.id === miId)
    : (miEstado && !miEstado.jugadores.find(j => j.id === miId));

  if (soyEspectador) {
    const esVegasResumen = miEstado?.modalidad === 'vegas';
    const bocadillo = document.createElement('div');
    bocadillo.className = 'bocadillo-pedir';
    bocadillo.innerHTML = `
      <p>💀 Estás eliminado</p>
      <button id="btn-pedir-vida">${esVegasResumen ? '🙏 Pedir 10 monedas' : '🙏 Pedir una vida'}</button>
      <p id="msg-pedir-vida" class="info"></p>
    `;
    zonaDonacion.appendChild(bocadillo);
    $('btn-pedir-vida').addEventListener('click', () => {
      $('btn-pedir-vida').disabled = true;
      socket.emit('pedirVida', res => {
        if (res.error) {
          $('msg-pedir-vida').textContent = res.error;
          $('btn-pedir-vida').disabled = false;
        } else {
          $('msg-pedir-vida').textContent = '✉️ Petición enviada — esperando que alguien done...';
        }
      });
    });
  }

  const esCreador = miSala && miSala.creador === miId;
  if (esCreador) {
    $('btn-siguiente').classList.remove('oculto');
    $('msg-resumen').textContent = '';
  } else {
    $('btn-siguiente').classList.add('oculto');
    $('msg-resumen').textContent = 'Esperando al creador...';
  }
});

// Llega una petición de vida — mostrar a los jugadores vivos
socket.on('peticionVida', ({ solicitanteId, nickname }) => {
  let zonaDonacion = $('zona-donacion');
  if (!zonaDonacion) return;
  if (document.getElementById(`peticion-${solicitanteId}`)) return;

  const esVegasPeticion = miEstado?.modalidad === 'vegas';
  const miVidasActuales = miEstado?.jugadores.find(j => j.id === miId)?.vidas ?? 0;
  const misMonedasActuales = miEstado?.modalidad === 'vegas'
    ? (miEstado?.vegas?.monedas?.[miId] ?? 0) : null;
  const soyVivo = miEstado?.jugadores.some(j => j.id === miId);
  if (!soyVivo) return;

  const puedeDonar = esVegasPeticion ? (misMonedasActuales >= 20) : (miVidasActuales > 1);

  const peticion = document.createElement('div');
  peticion.id = `peticion-${solicitanteId}`;
  peticion.className = 'bocadillo-peticion';
  peticion.innerHTML = `
    <span>🙏 <strong>${nickname}</strong> pide ${esVegasPeticion ? '10 monedas' : 'una vida'}</span>
    ${puedeDonar
      ? `<button class="btn-donar" data-id="${solicitanteId}" data-nick="${nickname}">${esVegasPeticion ? '🪙 Donar 10' : '❤️ Donar'}</button>`
      : `<span class="donar-imposible">${esVegasPeticion ? 'Menos de 20 monedas' : 'Sin vidas para donar'}</span>`
    }
  `;
  zonaDonacion.appendChild(peticion);
});

// Confirmación de donación
socket.on('vidaDonada', ({ donanteId, donanteNick, donantesVidas, receptorId, receptorNick }) => {
  const peticion = document.getElementById(`peticion-${receptorId}`);
  if (peticion) peticion.remove();

  const esVegasDonacion = miEstado?.modalidad === 'vegas';
  const zonaDonacion = $('zona-donacion');
  if (zonaDonacion) {
    const aviso = document.createElement('div');
    aviso.className = 'bocadillo-donado';
    aviso.textContent = esVegasDonacion
      ? `🪙 ${donanteNick} le dio 10 monedas a ${receptorNick}`
      : `❤️ ${donanteNick} le dio una vida a ${receptorNick}`;
    zonaDonacion.appendChild(aviso);
  }

  mostrarMsgJuego(esVegasDonacion
    ? `🪙 ${donanteNick} → ${receptorNick}: 10 monedas donadas`
    : `❤️ ${donanteNick} → ${receptorNick}: vida donada`);
});

// Delegación para botones donar (creados dinámicamente)
document.addEventListener('click', e => {
  if (!e.target.matches('.btn-donar')) return;
  const solicitanteId = e.target.dataset.id;
  e.target.disabled = true;
  e.target.textContent = '...';
  socket.emit('donarVida', { solicitanteId }, res => {
    if (res.error) {
      e.target.disabled = false;
      e.target.textContent = miEstado?.modalidad === 'vegas' ? '🪙 Donar 10' : '❤️ Donar';
      mostrarMsgJuego(`⚠️ ${res.error}`);
    }
  });
});

socket.on('subrondaIniciada', () => irA('juego'));

// HARDCORE: Duelo del Prisionero
socket.on('dueloIniciado', (data) => {
  irA('juego'); // asegurar que estamos en pantalla de juego de fondo
  abrirOverlayDuelo(data);
});

socket.on('dueloResuelto', (resultado) => {
  mostrarResultadoDuelo(resultado);
});

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
  // Countdown visual de 5s hasta que el servidor resetee la sala
  let segs = 5;
  const countdownEl = document.getElementById('countdown-reset');
  if (countdownEl) countdownEl.textContent = segs;
  const intervalo = setInterval(() => {
    segs--;
    if (countdownEl) countdownEl.textContent = segs;
    if (segs <= 0) clearInterval(intervalo);
  }, 1000);
  // Token se conserva — la sala se reseteará automáticamente en 5s
});

// Sala reseteada tras fin de partida — todos vuelven a la antesala
socket.on('salaReseteada', ({ sala }) => {
  miSala = sala;
  miEstado = null;
  ultimoResumen = [];
  subrondaAnimadaKey = null;
  renderizarSala(sala);
  irA('sala');

  // Ocultar paneles específicos de Vegas por si la próxima partida es de
  // otro modo (se reconstruyen al renderizar el siguiente estado si procede)
  $('economia-vegas')?.classList.add('oculto');
  $('panel-monedas')?.classList.add('oculto');
  if ($('panel-monedas')) delete $('panel-monedas').dataset.saldo;
  $('resultados-vegas')?.classList.add('oculto');
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

aplicarFondoModalidad('clasico');
aplicarSkinCartas(obtenerSkinActual());
irA('entrada');
