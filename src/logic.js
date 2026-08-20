// Lógica jugable: recibe el MusicFrame, juzga los inputs del jugador
// y anota el estado de cada nota. No dibuja ni suena.

import * as music from './music.js'

export const WINDOW = 0.12           // margen de acierto en segundos (±120 ms)
export const KEYS = 'sdfjklñ'        // tecla por carril, i..vii

// Estados por id de nota: undefined/0 = pendiente, 1 = acierto, 2 = fallo
const states = []

// Pulsaciones con timestamp musical, pendientes de juzgar en el próximo frame
const inputs = []

addEventListener('keydown', e => {
  if (e.repeat) return
  const lane = KEYS.indexOf(e.key.toLowerCase())
  if (lane >= 0) inputs.push({ lane, at: music.now() })
})

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
    if (best) states[best.id] = Math.abs(best.at - input.at) <= WINDOW ? 1 : 2
  }

  // Nota cuya ventana pasó sin pulsación: fallo
  for (const n of notes) {
    if (!states[n.id] && n.at + WINDOW < time) states[n.id] = 2
  }

  return { time, notes: notes.map(n => ({ ...n, state: states[n.id] || 0 })) }
}
