// Notas i..vii representadas como enteros 0..6 (índice de carril).
// Una nota por pulso, ritmo fijo: la nota i suena en el instante i * SPB.

export const BPM = 90
export const SPB = 60 / BPM   // segundos por pulso
export const LOOK_AHEAD = 2   // horizonte visible hacia el futuro, en segundos

const lanes = []              // lanes[i] = carril de la nota del pulso i

// Generación perezosa: la nota i se decide la primera vez que alguien la pide
function lane(i) {
  while (lanes.length <= i) lanes.push((Math.random() * 7) | 0)
  return lanes[i]
}

// Reloj provisional basado en performance.now(); cuando exista AudioSynth
// pasará a derivarse de AudioContext.currentTime
let startedAt = 0

export function start() {
  startedAt = performance.now() / 1000
}

export function now() {
  return performance.now() / 1000 - startedAt
}

// MusicFrame mínimo: tiempo actual y notas entre ahora y el horizonte
export function frame() {
  const t = now()
  const notes = []
  const first = Math.max(0, Math.ceil((t - 0.2) / SPB))
  for (let i = first; i * SPB <= t + LOOK_AHEAD; i++) {
    notes.push({ id: i, at: i * SPB, lane: lane(i) })
  }
  return { time: t, notes }
}
