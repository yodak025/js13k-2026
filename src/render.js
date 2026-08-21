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

const personaje = document.getElementById('personaje')
const carriles = document.getElementById('carriles')

// Texto centrado con la fuente cutre provisional
function text(str, x, y, size, color = '#fff') {
  ctx.fillStyle = color
  ctx.font = `bold ${size}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText(str, x, y)
}

// Lista de opciones de menú con cursor resaltado
function menu(options, cursor, x, y, size) {
  options.forEach((option, i) => {
    const selected = i === cursor
    text(`${selected ? '▶ ' : ''}${option}`, x, y + i * size * 1.6, size, selected ? '#fff' : '#888')
  })
}

// Escena jugable: unicornio, carriles, línea de impacto, notas y HUD de score
function drawGame(frame, w, h) {
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
  for (let i = 0; i < 7; i++) {
    const x = cx + (LANE_X[i] / CARRILES_W) * cw
    text(KEYS[i], x, hitY + r * 2.5, r * 1.6, '#000')
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

  // HUD provisional de puntuación
  text(`Score: ${frame.score}`, w / 2, h * 0.06, h * 0.035)
}

// Velo semitransparente para modales sobre la escena congelada
function overlay(w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'
  ctx.fillRect(0, 0, w, h)
}

export function render(frame) {
  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, w, h)

  // Título cutre provisional: nombre y menú
  if (frame.state === 'title') {
    text('PRISM7', w / 2, h * 0.4, h * 0.1)
    menu(frame.menu, frame.cursor, w / 2, h * 0.6, h * 0.04)
    return
  }

  // El reloj está congelado en pausa, así que la escena se dibuja quieta sola
  if (frame.game) drawGame(frame.game, w, h)

  // Modal de pausa cutre provisional
  if (frame.state === 'paused') {
    overlay(w, h)
    text('PAUSE', w / 2, h * 0.35, h * 0.07)
    menu(frame.menu, frame.cursor, w / 2, h * 0.5, h * 0.04)
  }

  // Pantallas cutres de victoria/derrota
  if (frame.state === 'finished') {
    overlay(w, h)
    const won = frame.outcome === 'won'
    text(won ? 'YOU WIN' : 'GAME OVER', w / 2, h * 0.4, h * 0.09, won ? '#2e5' : '#e33')
    text(`Score: ${frame.game.score}`, w / 2, h * 0.5, h * 0.04)
    text('Press Enter', w / 2, h * 0.62, h * 0.03, '#888')
  }
}
