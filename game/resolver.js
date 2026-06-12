// resolver.js — Resuelve una minironda completa
// Recibe: array de jugadas [{jugadorId, carta}]
// Devuelve: { ganadorId, cartasFinales, efectosAs, log }

function resolverMinironda(jugadas) {
  const log = [];
  const jugadasOriginales = [...jugadas]; // guardamos antes de mutar

  // 1. Aplicar anulaciones por pares
  let mesa = aplicarAnulaciones([...jugadas], jugadasOriginales, log);

  // 2. Separar ases supervivientes del resto
  const ases      = mesa.filter(j => j.carta.valor === 1);
  const normales  = mesa.filter(j => j.carta.valor !== 1);

  // 3. Resolver efectos de ases (asíncronos en el flujo real,
  //    aquí calculamos qué ases están activos y sus poderes)
  const efectosAs = ases.map(j => ({
    jugadorId: j.jugadorId,
    palo:      j.carta.palo,
    poder:     poderDel(j.carta.palo)
  }));

  log.push(`Ases activos: ${ases.length > 0 ? ases.map(a => a.carta.palo).join(', ') : 'ninguno'}`);

  // 4. Determinar ganador provisional (sin aplicar ases todavía)
  //    Los ases se resuelven en fases separadas desde server.js
  const ganadorProvisional = calcularGanador(normales, log);

  return {
    mesa,           // cartas que quedaron tras anulaciones
    ases,           // ases supervivientes
    efectosAs,      // poderes activos
    ganadorProvisional,
    log
  };
}

// --- ANULACIONES POR PARES ---
function aplicarAnulaciones(jugadas, jugadasOriginales, log) {
  let cambio = true;

  while (cambio) {
    cambio = false;
    // Agrupar por valor
    const grupos = {};
    jugadas.forEach(j => {
      if (!grupos[j.carta.valor]) grupos[j.carta.valor] = [];
      grupos[j.carta.valor].push(j);
    });

    for (const valor in grupos) {
      const grupo = grupos[valor];
      if (grupo.length >= 2) {
        // Número par de cartas iguales → se anulan todas
        // Número impar → queda una
        const anuladasCount = grupo.length % 2 === 0 ? grupo.length : grupo.length - 1;
        if (anuladasCount > 0) {
          log.push(`Anulación: ${anuladasCount} cartas de valor ${valor} eliminadas`);
          // Eliminar de jugadas las primeras 'anuladasCount'
          let eliminadas = 0;
          jugadas = jugadas.filter(j => {
            if (j.carta.valor === parseInt(valor) && eliminadas < anuladasCount) {
              eliminadas++;
              return false;
            }
            return true;
          });
          cambio = true;
          break; // Reiniciar el bucle tras cada anulación
        }
      }
    }
  }

  // Caso especial: desempate total (todas las cartas se anularon)
  if (jugadas.length === 0) {
    log.push('Desempate total: todas las cartas anuladas — gana la última jugada');
    // Devolvemos la última jugada original como ganadora forzosa
    // Nota: el llamador debe pasar jugadas originales para este caso
    // Lo marcamos con una flag especial
    jugadas = [{ ...jugadasOriginales[jugadasOriginales.length - 1], forzada: true }];
  }

  return jugadas;
}

// --- GANADOR POR VALOR NUMÉRICO ---
function calcularGanador(cartas, log) {
  if (cartas.length === 0) return null;

  let mejor = cartas[0];
  for (let i = 1; i < cartas.length; i++) {
    if (cartas[i].carta.valor > mejor.carta.valor) {
      mejor = cartas[i];
    }
  }

  log.push(`Ganador provisional: ${mejor.jugadorId} con ${mejor.carta.valor} de ${mejor.carta.palo}`);
  return mejor.jugadorId;
}

// --- PODERES DE LOS ASES ---
function poderDel(palo) {
  const poderes = {
    oros:    'mayor_absoluto',   // gana automáticamente
    bastos:  'intercambio',      // intercambia su valor por otra carta
    espadas: 'eliminar',         // elimina una carta de la mesa
    copas:   'multiplicador'     // x2 bazas al ganador final
  };
  return poderes[palo];
}

// --- APLICAR AS DE OROS ---
// Siempre gana si sobrevive
function aplicarAsOros(ganadorProvisional, ases) {
  const asOros = ases.find(a => a.carta.palo === 'oros');
  if (asOros) return asOros.jugadorId;
  return ganadorProvisional;
}

// --- APLICAR AS DE ESPADAS ---
// Elimina una carta de la mesa (el jugador elige cuál)
function aplicarAsEspadas(mesa, cartaAEliminarIdx) {
  const nuevaMesa = [...mesa];
  nuevaMesa.splice(cartaAEliminarIdx, 1);
  return nuevaMesa;
}

// --- APLICAR AS DE BASTOS ---
// Intercambia el as por otra carta de la mesa (el jugador elige cuál)
function aplicarAsBastos(mesa, idxObjetivo) {
  const nuevaMesa = [...mesa];
  const idxAs     = nuevaMesa.findIndex(j => j.carta.valor === 1 && j.carta.palo === 'bastos');
  if (idxAs === -1 || idxObjetivo === idxAs) return nuevaMesa;

  // Intercambia los valores (no los palos ni jugadores)
  const valorTemp                    = nuevaMesa[idxAs].carta.valor;
  nuevaMesa[idxAs].carta.valor       = nuevaMesa[idxObjetivo].carta.valor;
  nuevaMesa[idxObjetivo].carta.valor = valorTemp;

  return nuevaMesa;
}

// --- CALCULAR VIDAS A RESTAR AL FINAL DE SUBRONDA ---
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
