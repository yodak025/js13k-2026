// Tests de la FSM de partida y de la puntuación, sin navegador:
// match, logic y music no tocan el DOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as match from '../src/match.js';
import * as logic from '../src/logic.js';

// Frame musical sintético para juzgar sin reloj real
const musicFrame = (time, notes) => ({ time, notes });

test('FSM: ciclo título → jugando → pausa → salir', () => {
  assert.equal(match.getState(), match.TITLE);

  // Enter en "Play" arranca la partida
  match.key('Enter');
  assert.equal(match.getState(), match.PLAYING);

  // Escape pausa; Escape de nuevo reanuda
  match.key('Escape');
  assert.equal(match.getState(), match.PAUSED);
  match.key('Escape');
  assert.equal(match.getState(), match.PLAYING);

  // En pausa: ArrowDown selecciona "Exit", Enter vuelve al título
  match.key('Escape');
  match.key('ArrowDown');
  match.key('Enter');
  assert.equal(match.getState(), match.TITLE);
});

test('FSM: transiciones inválidas son no-ops', () => {
  assert.equal(match.getState(), match.TITLE);
  match.pause();
  assert.equal(match.getState(), match.TITLE);
  match.resume();
  assert.equal(match.getState(), match.TITLE);
  match.finish('won');
  assert.equal(match.getState(), match.TITLE);
  // Escape en el título no hace nada
  match.key('Escape');
  assert.equal(match.getState(), match.TITLE);
});

test('score: acierto suma, fallo por tiempo y por timing restan', () => {
  logic.reset();

  // Acierto: input dentro de la ventana de la nota 0
  logic.push({ lane: 3, at: 1.05 });
  let frame = logic.advance(musicFrame(1.05, [{ id: 0, at: 1, lane: 3 }]));
  assert.equal(frame.score, 1);
  assert.equal(frame.notes[0].state, 1);

  // Fallo por timing: input fuera de la ventana de la nota 1
  logic.push({ lane: 2, at: 2.5 });
  frame = logic.advance(musicFrame(2.5, [{ id: 1, at: 2, lane: 2 }]));
  assert.equal(frame.score, 0);
  assert.equal(frame.notes[0].state, 2);

  // Fallo por expiración: la ventana de la nota 2 pasó sin pulsación
  frame = logic.advance(musicFrame(4, [{ id: 2, at: 3, lane: 0 }]));
  assert.equal(frame.score, -1);
  assert.equal(frame.notes[0].state, 2);

  // El juicio no se repite: avanzar de nuevo no vuelve a restar
  frame = logic.advance(musicFrame(4.1, [{ id: 2, at: 3, lane: 0 }]));
  assert.equal(frame.score, -1);
});

test('FSM: victoria y derrota por umbral, Enter vuelve al título', () => {
  // Simula alcanzar el umbral de victoria
  match.start();
  logic.reset();
  for (let i = 0; i < match.WIN_SCORE; i++) {
    logic.push({ lane: 0, at: i });
    logic.advance(musicFrame(i, [{ id: i, at: i, lane: 0 }]));
  }
  match.frame();   // el frame observa el score y dispara finish('won')
  assert.equal(match.getState(), match.FINISHED);
  match.key('Enter');
  assert.equal(match.getState(), match.TITLE);

  // Simula caer al umbral de derrota (expiran notas sin pulsar)
  match.start();
  logic.reset();
  for (let i = 0; i > match.LOSE_SCORE; i--) {
    logic.advance(musicFrame(10, [{ id: -i, at: 1, lane: 0 }]));
  }
  match.frame();
  assert.equal(match.getState(), match.FINISHED);
  match.key('Enter');
  assert.equal(match.getState(), match.TITLE);
});

test('restart: una partida nueva no conserva estado anterior', () => {
  // Deja score residual en una partida
  match.start();
  logic.push({ lane: 1, at: 5 });
  logic.advance(musicFrame(5, [{ id: 9, at: 5, lane: 1 }]));

  // Play de nuevo desde el título: todo a cero
  match.pause();
  match.key('ArrowDown');
  match.key('Enter');   // Exit
  match.key('Enter');   // Play
  assert.equal(match.getState(), match.PLAYING);
  const frame = logic.advance(musicFrame(0, []));
  assert.equal(frame.score, 0);
  match.pause();
  match.key('ArrowDown');
  match.key('Enter');   // Exit, deja la FSM en título para otros tests
});
