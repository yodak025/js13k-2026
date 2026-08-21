// Lógica jugable: recibe el MusicFrame y los inputs encolados, juzga la
// interpretación y acumula la puntuación. No dibuja, no suena, no toca el DOM.

export const WINDOW = 0.12           // margen de acierto en segundos (±120 ms)
export const KEYS = 'sdfjklñ'        // tecla por carril, i..vii

// Estados por id de nota: undefined/0 = pendiente, 1 = acierto, 2 = fallo
const states = []

// Pulsaciones con timestamp musical, pendientes de juzgar en el próximo frame
const inputs = []

// Puntuación acumulada: acierto +1, fallo −1
let score = 0

// Encola una pulsación { lane, at }; quien escucha el teclado vive fuera
export function push(input) {
  inputs.push(input)
}

// Olvida juicios, inputs y puntuación de la partida anterior
export function reset() {
  states.length = 0
  inputs.length = 0
  score = 0
}

// Anota el juicio de una nota y ajusta la puntuación (solo en la transición)
function judge(id, state) {
  states[id] = state
  score += state === 1 ? 1 : -1
}

export function advance(musicFrame) {
  const { time, notes } = musicFrame

  // Cada input se empareja con la nota pendiente más cercana de su carril
  while (inputs.length) {
    const input = inputs.shift()
    let best = null
    for (const n of notes) {
      if (n.lane !== input.lane || states[n.id]) continue
      if (!best || Math.abs(n.at - input.at) < Math.abs(best.at - input.at)) best = n
    }
    if (best) judge(best.id, Math.abs(best.at - input.at) <= WINDOW ? 1 : 2)
  }

  // Nota cuya ventana pasó sin pulsación: fallo
  for (const n of notes) {
    if (!states[n.id] && n.at + WINDOW < time) judge(n.id, 2)
  }

  return { time, score, notes: notes.map(n => ({ ...n, state: states[n.id] || 0 })) }
}
