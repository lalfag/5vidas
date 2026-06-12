const { resolverMinironda, calcularVidasARestar } = require('./game/resolver');

// TEST 1: Ganador normal
console.log('\n--- TEST 1: Ganador normal ---');
const t1 = resolverMinironda([
  { jugadorId: 'Ana',  carta: { valor: 7,  palo: 'oros' } },
  { jugadorId: 'Bob',  carta: { valor: 10, palo: 'copas' } },
  { jugadorId: 'Carl', carta: { valor: 5,  palo: 'bastos' } }
]);
console.log('Ganador:', t1.ganadorProvisional); // Bob (10)
console.log('Log:', t1.log);

// TEST 2: Anulación por par
console.log('\n--- TEST 2: Anulación de par ---');
const t2 = resolverMinironda([
  { jugadorId: 'Ana',  carta: { valor: 7, palo: 'oros' } },
  { jugadorId: 'Bob',  carta: { valor: 7, palo: 'copas' } },
  { jugadorId: 'Carl', carta: { valor: 5, palo: 'bastos' } }
]);
console.log('Ganador:', t2.ganadorProvisional); // Carl (los 7 se anulan)
console.log('Log:', t2.log);

// TEST 3: As de Oros gana
console.log('\n--- TEST 3: As de Oros ---');
const t3 = resolverMinironda([
  { jugadorId: 'Ana',  carta: { valor: 12, palo: 'oros' } },
  { jugadorId: 'Bob',  carta: { valor: 1,  palo: 'oros' } }
]);
console.log('Ases activos:', t3.efectosAs);
console.log('Ganador provisional (sin aplicar as):', t3.ganadorProvisional); // Ana (12)
const { aplicarAsOros } = require('./game/resolver');
const ganadorFinal = aplicarAsOros(t3.ganadorProvisional, t3.ases);
console.log('Ganador final (con as oros):', ganadorFinal); // Bob

// TEST 4: Cálculo de vidas
console.log('\n--- TEST 4: Vidas a restar ---');
console.log('Apostó 3, ganó 3:', calcularVidasARestar(3, 3)); // 0
console.log('Apostó 2, ganó 4:', calcularVidasARestar(2, 4)); // 2
console.log('Apostó 5, ganó 1:', calcularVidasARestar(5, 1)); // 4
