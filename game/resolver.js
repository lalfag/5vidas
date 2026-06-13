// resolver.js — Resuelve una minironda completa
// Recibe: array de jugadas [{jugadorId, carta}], opciones { inversionEscala }
// Devuelve: { mesa, ases, efectosAs, ganadorProvisional, log, contextoLogros }

function resolverMinironda(jugadas, opciones = {}) {
  const log = [];
  const inversionEscala = opciones.inversionEscala || false;
  const jugadasOriginales = [...jugadas];

  // 1. Separar jokers antes de las anulaciones normales
  //    Dos jokers → se anulan entre sí (logro CaosControlado)
  //    Un joker   → ya está activo en mesa (efecto gestionado en game.js)
  let jokerAnulado = false;
  let mesaSinJokers = [...jugadas];

  if (opciones.esHardcore) {
    const jokers = jugadas.filter(j => j.carta.palo === 'joker');
    if (jokers.length >= 2) {
      // Dos jokers: se anulan entre sí
      mesaSinJokers = jugadas.filter(j => j.carta.palo !== 'joker');
      jokerAnulado = true;
      log.push('[HARDCORE] Dos jokers se anulan entre sí — escala normal');
    } else if (jokers.length === 1) {
      // Un joker activo: se elimina de la mesa (no participa en resolución normal)
      // pero ya habrá activado la inversión de escala en game.js
      mesaSinJokers = jugadas.filter(j => j.carta.palo !== 'joker');
      log.push('[HARDCORE] Joker activo — carta eliminada de mesa, escala invertida');
    }
  }

  // 2. Aplicar anulaciones por pares sobre las cartas restantes
  let mesa = aplicarAnulaciones([...mesaSinJokers], mesaSinJokers, log);

  // 3. Detectar contexto para logros
  const fueUltimoEnPie = mesaSinJokers.length > 1 && mesa.length === 1 && !mesa[0].forzada;

  // 4. Separar ases supervivientes del resto
  const ases     = mesa.filter(j => j.carta.valor === 1);
  const normales = mesa.filter(j => j.carta.valor !== 1);

  // 5. En modo hardcore: detectar rey inmune al As de Espadas
  //    Se marca en la carta para que server.js lo respete
  if (opciones.esHardcore) {
    mesa.forEach(j => {
      if (j.carta.valor === 12) j.reyInmune = true; // Rey no puede ser eliminado por As Espadas
    });
  }

  // 6. Efectos de ases
  const efectosAs = ases.map(j => ({
    jugadorId: j.jugadorId,
    palo:      j.carta.palo,
    poder:     poderDel(j.carta.palo)
  }));

  log.push(`Ases activos: ${ases.length > 0 ? ases.map(a => a.carta.palo).join(', ') : 'ninguno'}`);

  // 7. Ganador provisional con inversión de escala si procede
  //    NORMAL: solo compiten las cartas "normales" (valor !== 1); los ases
  //    se resuelven aparte por sus poderes (Oros gana auto, Copas no compite, etc.)
  //    INVERTIDA: el valor 1 pasa a ser el más alto, así que los ases NO-Oros
  //    también compiten por valor (su poder se sigue aplicando si ganan).
  //    El As de Oros siempre se gestiona por su canal especial (aplicarAsOros).
  let candidatos = normales;
  if (inversionEscala) {
    const asesNoOros = ases.filter(j => j.carta.palo !== 'oros');
    candidatos = [...normales, ...asesNoOros];
  }
  const ganadorProvisional = calcularGanador(candidatos, log, inversionEscala);

  // 8. Contexto para el sistema de logros (se envía a comprobarLogrosMinironda)
  const contextoLogros = {
    ganadorId:       ganadorProvisional,
    mesaFinal:       mesa,
    mesaOriginal:    jugadasOriginales,
    fueUltimoEnPie,
    inversionEscala,
    jokerAnulado     // para logro CaosControlado
  };

  return {
    mesa,
    ases,
    efectosAs,
    ganadorProvisional,
    log,
    contextoLogros
  };
}

// ── ANULACIONES POR PARES ─────────────────────────────────────────────────────
function aplicarAnulaciones(jugadas, jugadasOriginales, log) {
  let cambio = true;

  while (cambio) {
    cambio = false;
    const grupos = {};
    jugadas.forEach(j => {
      if (!grupos[j.carta.valor]) grupos[j.carta.valor] = [];
      grupos[j.carta.valor].push(j);
    });

    for (const valor in grupos) {
      const grupo = grupos[valor];
      if (grupo.length >= 2) {
        const anuladasCount = grupo.length % 2 === 0 ? grupo.length : grupo.length - 1;
        if (anuladasCount > 0) {
          log.push(`Anulación: ${anuladasCount} cartas de valor ${valor} eliminadas`);
          let eliminadas = 0;
          jugadas = jugadas.filter(j => {
            if (j.carta.valor === parseInt(valor) && eliminadas < anuladasCount) {
              eliminadas++;
              return false;
            }
            return true;
          });
          cambio = true;
          break;
        }
      }
    }
  }

  // Desempate total
  if (jugadas.length === 0) {
    log.push('Desempate total: todas las cartas anuladas — gana la última jugada');
    jugadas = [{ ...jugadasOriginales[jugadasOriginales.length - 1], forzada: true }];
  }

  return jugadas;
}

// ── GANADOR POR VALOR NUMÉRICO ────────────────────────────────────────────────
function calcularGanador(cartas, log, inversionEscala = false) {
  if (cartas.length === 0) return null;

  let mejor = cartas[0];
  for (let i = 1; i < cartas.length; i++) {
    const esMejor = inversionEscala
      ? cartas[i].carta.valor < mejor.carta.valor   // escala invertida: gana el menor
      : cartas[i].carta.valor > mejor.carta.valor;  // escala normal: gana el mayor
    if (esMejor) mejor = cartas[i];
  }

  log.push(`Ganador provisional: ${mejor.jugadorId} con ${mejor.carta.valor} de ${mejor.carta.palo}${inversionEscala ? ' (escala invertida)' : ''}`);
  return mejor.jugadorId;
}

// ── PODERES DE LOS ASES ───────────────────────────────────────────────────────
function poderDel(palo) {
  const poderes = {
    oros:    'mayor_absoluto',
    bastos:  'intercambio',
    espadas: 'eliminar',
    copas:   'multiplicador'
  };
  return poderes[palo] || null;
}

// ── AS DE OROS ────────────────────────────────────────────────────────────────
function aplicarAsOros(ganadorProvisional, ases) {
  const asOros = ases.find(a => a.carta.palo === 'oros');
  if (asOros) return asOros.jugadorId;
  return ganadorProvisional;
}

// ── AS DE ESPADAS ─────────────────────────────────────────────────────────────
// HARDCORE: el rey (valor 12) no puede ser eliminado
function aplicarAsEspadas(mesa, cartaAEliminarIdx, esHardcore = false) {
  const objetivo = mesa[cartaAEliminarIdx];
  if (esHardcore && objetivo && objetivo.reyInmune) {
    return { error: 'El Rey es inmune al As de Espadas', mesa };
  }
  const nuevaMesa = [...mesa];
  nuevaMesa.splice(cartaAEliminarIdx, 1);
  return { ok: true, mesa: nuevaMesa };
}

// ── AS DE BASTOS ──────────────────────────────────────────────────────────────
function aplicarAsBastos(mesa, idxObjetivo) {
  const nuevaMesa = [...mesa];
  const idxAs     = nuevaMesa.findIndex(j => j.carta.valor === 1 && j.carta.palo === 'bastos');
  if (idxAs === -1 || idxObjetivo === idxAs) return nuevaMesa;

  const valorTemp                    = nuevaMesa[idxAs].carta.valor;
  nuevaMesa[idxAs].carta.valor       = nuevaMesa[idxObjetivo].carta.valor;
  nuevaMesa[idxObjetivo].carta.valor = valorTemp;

  return nuevaMesa;
}

// ── CALCULAR VIDAS A RESTAR ───────────────────────────────────────────────────
function calcularVidasARestar(apuesta, bazasGanadas) {
  return Math.abs(bazasGanadas - apuesta);
}

module.exports = {
  resolverMinironda,
  aplicarAnulaciones,
  aplicarAsOros,
  aplicarAsEspadas,
  aplicarAsBastos,
  calcularVidasARestar,
  poderDel
};
