import { canvas, render } from './render.js'
import * as music from './music.js'
import * as logic from './logic.js'

function resize() {
  canvas.width = innerWidth
  canvas.height = innerHeight
}

addEventListener('resize', resize)
resize()

// Cadencia del frame: tiempo → música → lógica → render.
// El rAF solo marca cuándo dibujar; el tiempo musical viene del reloj de music.
function loop() {
  const musicFrame = music.frame()
  const gameFrame = logic.advance(musicFrame)
  window.__frame = gameFrame   // gancho de observación para tests
  render(gameFrame)
  requestAnimationFrame(loop)
}

music.start()
loop()
