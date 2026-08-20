import { LOOK_AHEAD } from './music.js'
import { KEYS } from './logic.js'

export const canvas = document.getElementById('c')
export const ctx = canvas.getContext('2d')

// Relaciones de aspecto tomadas del viewBox de cada SVG
// (naturalWidth de un SVG sin atributos width/height no es fiable entre navegadores)
const PERSONAJE_ASPECT = 1965.93 / 4527
const CARRILES_W = 2461.9
const CARRILES_H = 6000
const CARRILES_ASPECT = CARRILES_W / CARRILES_H

// Centros de los 7 carriles en coordenadas del SVG (x del rect + mitad de su ancho)
const LANE_W = 198.9
const LANE_X = [0, 376, 767, 1121, 1497, 1888, 2263].map(x => x + LANE_W / 2)

const HIT_Y = 0.8   // línea de impacto, fracción de la altura de pantalla

const personaje = loadImage('assets/Personaje.svg')
const carriles = loadImage('assets/Carriles.svg')

function loadImage(src) {
  const img = new Image()
  img.src = src
  return img
}

export function render(frame) {
  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, w, h)

  if (personaje.complete) {
    const ph = h * 0.85
    const pw = ph * PERSONAJE_ASPECT
    ctx.drawImage(personaje, w * 0.05, (h - ph) / 2, pw, ph)
  }

  // Geometría de los carriles en pantalla, compartida por imagen y notas
  const ch = h * 2
  const cw = ch * CARRILES_ASPECT
  const cx = (w - cw) / 2
  const cy = (h - ch) / 2

  if (carriles.complete) {
    ctx.drawImage(carriles, cx, cy, cw, ch)
  }

  const r = (LANE_W / CARRILES_W) * cw * 0.4

  // Línea de impacto: donde la nota está justo cuando "suena"
  const hitY = h * HIT_Y
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(Math.max(cx, 0), hitY)
  ctx.lineTo(Math.min(cx + cw, w), hitY)
  ctx.stroke()

  // Letra de cada carril, bajo la línea de impacto
  ctx.fillStyle = '#000'
  ctx.font = `bold ${r * 1.6}px monospace`
  ctx.textAlign = 'center'
  for (let i = 0; i < 7; i++) {
    const x = cx + (LANE_X[i] / CARRILES_W) * cw
    ctx.fillText(KEYS[i], x, hitY + r * 2.5)
  }

  // Notas: círculos que caen hacia la línea de impacto.
  // progress 1 = acaba de aparecer arriba; 0 = está sobre la línea.
  // Color según estado: pendiente, acierto, fallo.
  const { time, notes } = frame
  const NOTE_COLORS = ['#fff', '#2e5', '#e33']
  for (const note of notes) {
    const progress = (note.at - time) / LOOK_AHEAD
    const x = cx + (LANE_X[note.lane] / CARRILES_W) * cw
    const y = hitY * (1 - progress)
    ctx.fillStyle = NOTE_COLORS[note.state]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 7)
    ctx.fill()
  }
}
