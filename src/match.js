// Ciclo de vida de la partida: FSM dueña del estado y del enrutado de teclado.
// Proyección mínima de la máquina del spec (§6): TITLE ≈ IDLE, sin LOADING,
// READY ni COUNTDOWN todavía. No dibuja ni suena.

import * as music from './music.js'
import * as logic from './logic.js'

// Umbrales de fin de partida (tuning provisional sobre la canción infinita)
export const WIN_SCORE = 20
export const LOSE_SCORE = -5

// Estados
export const TITLE = 'title'
export const PLAYING = 'playing'
export const PAUSED = 'paused'
export const FINISHED = 'finished'

// Opciones de menú por estado; el cursor navega con las arrows
export const MENUS = { [TITLE]: ['Play'], [PAUSED]: ['Resume', 'Exit'] }

let state = TITLE
let outcome = null   // 'won' | 'lost' cuando state === FINISHED
let cursor = 0       // opción seleccionada del menú activo
let last = null      // último frame jugable, para congelarlo bajo el modal de pausa

export function getState() {
  return state
}

// Transiciones. Cada una valida el estado de origen: fuera de él es un no-op.

export function start() {
  logic.reset()
  music.start()
  outcome = null
  last = null
  state = PLAYING
}

export function pause() {
  if (state !== PLAYING) return
  music.pause()
  cursor = 0
  state = PAUSED
}

export function resume() {
  if (state !== PAUSED) return
  music.resume()
  state = PLAYING
}

export function finish(result) {
  if (state !== PLAYING) return
  outcome = result
  state = FINISHED
}

export function exit() {
  cursor = 0
  state = TITLE
}

// Navegación de menú compartida por TITLE y PAUSED
function menuKey(key) {
  const menu = MENUS[state]
  if (key === 'arrowup') cursor = (cursor + menu.length - 1) % menu.length
  else if (key === 'arrowdown') cursor = (cursor + 1) % menu.length
  else if (key === 'enter') {
    const option = menu[cursor]
    if (option === 'Play') start()
    else if (option === 'Resume') resume()
    else if (option === 'Exit') exit()
  }
}

// Único punto de entrada del teclado; enruta según estado (solo PLAYING
// consume input jugable). Recibe e.key tal cual.
export function key(raw) {
  const k = raw.toLowerCase()
  if (state === PLAYING) {
    if (k === 'escape') return pause()
    const lane = logic.KEYS.indexOf(k)
    if (lane >= 0) logic.push({ lane, at: music.now() })
  } else if (state === FINISHED) {
    if (k === 'enter') exit()
  } else {
    if (k === 'escape' && state === PAUSED) return resume()
    menuKey(k)
  }
}

// Avanza la partida (solo en PLAYING) y devuelve qué debe dibujarse
export function frame() {
  if (state === PLAYING) {
    last = logic.advance(music.frame())
    if (last.score >= WIN_SCORE) finish('won')
    else if (last.score <= LOSE_SCORE) finish('lost')
  }
  return { state, outcome, cursor, menu: MENUS[state], game: last }
}
