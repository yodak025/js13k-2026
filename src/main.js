import { canvas, render } from './render.js'
import * as match from './match.js'

function resize() {
  canvas.width = innerWidth
  canvas.height = innerHeight
}

addEventListener('resize', resize)
resize()

// El teclado se registra aquí (entrada de navegador); match decide qué hacer
addEventListener('keydown', e => {
  if (!e.repeat) match.key(e.key)
})

// Cadencia del frame: match avanza tiempo → música → lógica; render dibuja.
// El rAF solo marca cuándo dibujar; el tiempo musical viene del reloj de music.
function loop() {
  const frame = match.frame()
  window.__frame = frame.game     // gancho de observación para tests
  window.__state = frame.state    // estado de la FSM, observable en tests
  render(frame)
  requestAnimationFrame(loop)
}

loop()
