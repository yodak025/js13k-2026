// Notas i..vii representadas como enteros 0..6 (índice de carril).
// Una nota por pulso, ritmo fijo: la nota i suena en el instante i * SPB.

export const BPM = 90
export const SPB = 60 / BPM   // segundos por pulso
export const LOOK_AHEAD = 6   // horizonte visible hacia el futuro, en segundos
                              // (2 · 3: las notas caen 3 veces más despacio)

const lanes = []              // lanes[i] = carril de la nota del pulso i

// Generación perezosa: la nota i se decide la primera vez que alguien la pide
function lane(i) {
  while (lanes.length <= i) lanes.push((Math.random() * 7) | 0)
  return lanes[i]
}

// Reloj provisional basado en performance.now(); cuando exista AudioSynth
// pasará a derivarse de AudioContext.currentTime (mismo esquema con pausedDuration)
let startedAt = 0
let pausedAt = null   // instante absoluto en que se pausó; null = corriendo

// Arranca una partida nueva: resetea partitura y transporte
export function start() {
  lanes.length = 0
  startedAt = performance.now() / 1000
  pausedAt = null
}

// Pausar congela el transporte: now() deja de avanzar
export function pause() {
  if (pausedAt === null) pausedAt = performance.now() / 1000
}

// Reanudar desplaza el origen para que las notas no cambien de posición relativa
export function resume() {
  if (pausedAt !== null) {
    startedAt += performance.now() / 1000 - pausedAt
    pausedAt = null
  }
}

export function now() {
  return (pausedAt ?? performance.now() / 1000) - startedAt
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
