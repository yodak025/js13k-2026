# PRISM7 — Especificación de arquitectura del runtime

> Documento de construcción inicial. Deliberadamente pequeño: fija fronteras, flujo y contratos; no pretende diseñar el juego entero.

**Objetivo:** construir el núcleo de una partida de PRISM7 separando lógica musical, lógica jugable, representación gráfica y síntesis sonora.

**Arquitectura:** durante una partida, `Match` coordina dos motores lógicos. `MusicEngine` interpreta la partitura y el tiempo; `GameEngine` juzga el input en ese contexto. Su resultado combinado produce dos salidas tontas: órdenes visuales para `CanvasRenderer` y órdenes acústicas para `AudioSynth`.

**Tecnología prevista:** JavaScript, Canvas 2D, Web Audio y una partitura ASCII compilada a datos compactos.

---

## 1. Principios

1. **Dos lógicas, dos representaciones.** Música y gameplay toman decisiones; Canvas y Web Audio materializan decisiones ya tomadas.
2. **Un único reloj musical.** Toda posición temporal se expresa respecto al transporte del `MusicEngine`.
3. **Flujo unidireccional.** Ningún motor llama de vuelta al anterior.
4. **Estado determinista.** Misma partitura e inputs temporizados producen el mismo juicio jugable.
5. **Sin infraestructura abstracta prematura.** No ECS, registros, contenedor de dependencias ni bus global de eventos.
6. **Tamaño como restricción arquitectónica.** Los nombres pueden minificarse y los contratos deben ser datos planos y pequeños.

## 2. Componentes

```text
                         Match
          start · pause · resume · restart · finish
                           │
                           ▼
    partitura ─────▶ MusicEngine ─────▶ MusicFrame
                           │                  │
                           │ reloj            ▼
    input ───────────────────────────▶ GameEngine
                                              │
                                              ▼
                                      PerformanceFrame
                                       ├────────────┐
                                       ▼            ▼
                                CanvasRenderer   AudioSynth
```

### `Match`

Gestor del ciclo de vida de una partida.

Responsabilidades:

- crear y conectar los cuatro componentes;
- controlar la máquina de estados;
- ejecutar la cadencia de cada frame;
- detener y reanudar transporte y entradas;
- destruir limpiamente una partida antes de iniciar otra.

No contiene reglas musicales, puntuación, dibujo ni síntesis.

### `MusicEngine`

Lógica musical y autoridad temporal.

Responsabilidades:

- mantener el transporte respecto a `AudioContext.currentTime`;
- interpretar el chart compilado;
- conocer tempo, pulso, compás, frase y armonía;
- determinar notas activas y próximas;
- producir el contexto musical actual;
- exponer un horizonte futuro para programar audio predecible.

No juzga al jugador y no usa Canvas.

### `GameEngine`

Lógica de interpretación del jugador.

Responsabilidades:

- recibir inputs con timestamp musical;
- emparejar una pulsación con una nota y un carril;
- aplicar ventanas tempranas, perfectas, tardías y de fallo;
- mantener reservas de inputs anticipados;
- calcular `timingError`, calificación, combo, puntuación y estado;
- convertir la interpretación en resultados semánticos.

No accede a Web Audio, Canvas, DOM ni tiempo del sistema.

### `CanvasRenderer`

Proyección visual sin reglas.

Responsabilidades:

- dibujar raíles, notas, unicornio, HUD y efectos;
- calcular posiciones visuales a partir del tiempo musical;
- representar el resultado de la interpretación;
- interpolar animaciones entre frames.

Nunca decide si una nota es correcta ni modifica el estado lógico.

### `AudioSynth`

Renderizador acústico sin reglas.

Responsabilidades:

- recibir órdenes con instante, tono, duración, voz y envolvente;
- crear y reutilizar nodos Web Audio;
- programar acompañamiento futuro;
- ejecutar inmediatamente notas tardías y efectos;
- controlar ganancia, mute y liberación de voces.

No conoce puntuación, ventanas de acierto, carriles ni combos.

## 3. Datos compartidos

Los nombres son conceptuales; la representación final puede compactarse.

### Nota compilada

```js
{
  id: 42,
  at: 12.5,
  lane: 3,
  pitch: 67,
  duration: .25,
  voice: 1
}
```

### Input temporizado

```js
{
  lane: 3,
  down: true,
  at: 12.573
}
```

`at` debe estar expresado en el mismo dominio temporal que las notas.

### `MusicFrame`

```js
{
  time: 12.573,
  beat: 24.146,
  phase: .146,
  active: [note42],
  upcoming: [note43, note44]
}
```

### Resultado de interpretación

```js
{
  note: note42,
  inputAt: 12.573,
  timingError: .073,
  grade: GOOD,
  state: HIT,
  playedAt: 12.573,
  detune: -18
}
```

### `PerformanceFrame`

Producto combinado de ambas lógicas:

```js
{
  music,
  game,
  results,
  visualCommands,
  audioCommands
}
```

No es obligatorio materializar todas estas propiedades en producción. Es el contrato conceptual que debe poder observarse en tests.

## 4. Cadencia de una partida

```js
function frame() {
  const time = music.now()
  const musicFrame = music.advance(time)
  const inputs = input.drain(time)
  const gameFrame = game.advance(musicFrame, inputs)
  const output = resolvePerformance(musicFrame, gameFrame)

  synth.apply(output.audioCommands)
  renderer.draw(output.visualCommands, time)

  requestAnimationFrame(frame)
}
```

Orden obligatorio:

1. Obtener tiempo musical.
2. Interpretar la partitura en ese tiempo.
3. Recoger inputs ya convertidos al dominio musical.
4. Juzgar la interpretación.
5. Resolver órdenes visuales y acústicas.
6. Programar/reproducir audio.
7. Dibujar el frame.

No debe existir una dependencia circular entre motores.

## 5. Modelo temporal y latencia

### Autoridad temporal

El transporte se deriva de Web Audio:

```js
songTime = audioContext.currentTime - startedAt - pausedDuration
```

`performance.now()` y `requestAnimationFrame` no determinan la posición de la canción.

### Dos horizontes

- **Ahora:** lógica y dibujo del estado actual.
- **Futuro próximo:** programación de audio determinista, inicialmente unos 100 ms.

```js
music.advance(now)
music.schedule(now, now + lookAhead)
```

El acompañamiento conocido se programa por adelantado. La interpretación del jugador se programa cuando existe input.

### Ventanas iniciales de juicio

Valores de partida, pendientes de calibración:

```text
< -100 ms       TOO_EARLY: ignorar
-100 a -35 ms   EARLY: reservar y tocar en el instante correcto
 -35 a +25 ms   PERFECT: afinado y en tiempo
 +25 a +80 ms   LATE_GOOD: inmediato, casi afinado
 +80 a +140 ms  LATE_BAD: inmediato y desafinado
> +140 ms        MISS
```

Reglas:

- Un input temprano dentro del margen reserva la nota.
- La nota reservada se reproduce afinada en `note.at`.
- Una pulsación tardía se reproduce en el presente; no se falsea el pasado.
- La desafinación comienza tras una tolerancia mínima y crece de forma acotada.
- Los valores deben ser configuración de tuning, no constantes dispersas.

## 6. Máquina de estados de `Match`

```text
IDLE → LOADING → READY → COUNTDOWN → PLAYING
                                  PLAYING ⇄ PAUSED
                                  PLAYING → FINISHED
                       FINISHED → READY | IDLE
```

Transiciones mínimas:

- `load(chart)`
- `start()`
- `pause()`
- `resume()`
- `restart()`
- `finish()`
- `destroy()`

Invariantes:

- solo `PLAYING` consume input jugable;
- pausar congela transporte, lógica y síntesis programable;
- reanudar no altera la posición relativa de las notas;
- reiniciar elimina voces, inputs, reservas y estado anterior;
- una sola instancia de partida posee el bucle activo.

## 7. Estructura inicial sugerida

```text
src/
├── match.js              ciclo de vida y cadencia
├── chart.js              parser/compilador de partitura
├── music.js              transporte y lógica musical
├── game.js               juicio y estado jugable
├── performance.js        unión de ambas lógicas
├── input.js              teclado → inputs temporizados
├── render.js             CanvasRenderer
├── synth.js              AudioSynth
└── tuning.js             ventanas y parámetros configurables

test/
├── chart.test.js
├── music.test.js
├── game.test.js
├── performance.test.js
└── match.test.js
```

Puede reducirse después de medir. Primero interesa que las fronteras sean visibles.

## 8. Orden de construcción

### Fase 1 — Reloj y partitura

- Crear un chart mínimo con una nota por carril.
- Implementar transporte con `start`, `pause`, `resume` y `now`.
- Hacer que `MusicEngine` identifique notas activas y próximas.
- Probar el motor con un reloj falso, sin Web Audio real.

### Fase 2 — Juicio jugable

- Introducir inputs temporizados sintéticos.
- Emparejar input y nota por carril.
- Implementar reserva temprana, `PERFECT`, tardía y `MISS`.
- Probar límites exactos de cada ventana.

### Fase 3 — Síntesis mínima

- Crear una voz sinusoidal simple.
- Reproducir una nota programada y una tardía inmediata.
- Aplicar desafinación según `timingError`.
- Verificar que `AudioSynth` no contiene reglas de puntuación.

### Fase 4 — Render mínimo

- Dibujar siete raíles y una línea de impacto.
- Proyectar notas según `note.at - music.time`.
- Mostrar visualmente los grados de interpretación.
- Verificar que una caída de frames no desplaza el tiempo musical.

### Fase 5 — Integración

- Crear `Match` y conectar la cadencia completa.
- Añadir la máquina de estados.
- Probar reinicio, pausa y reanudación.
- Construir una frase jugable de 20–30 segundos.

## 9. Pruebas de aceptación

1. Con reloj e inputs falsos, dos ejecuciones producen resultados idénticos.
2. Un input temprano dentro del margen queda reservado y suena en `note.at`.
3. Un input tardío conserva su retraso y genera desafinación calculada.
4. Un `MISS` no puede convertirse posteriormente en acierto.
5. Render y síntesis reciben el mismo resultado semántico.
6. El render no juzga inputs y el sintetizador no conoce puntuación.
7. Pausar y reanudar mantiene sincronizadas notas, input y audio.
8. Reiniciar no conserva voces, eventos ni reservas anteriores.
9. El acompañamiento programado no depende de la frecuencia de `requestAnimationFrame`.
10. Una frase mínima puede tocarse completa en Chromium y Firefox sin errores de consola.

## 10. Decisiones aplazadas

No bloquear la primera vertical slice por:

- formato ASCII definitivo;
- número y personalidad de voces;
- algoritmo final de desafinación;
- nombres definitivos de grados;
- sistema de menús completo;
- optimización extrema para 13 KB;
- animaciones o dirección artística final.

Primero debe demostrarse este recorrido:

```text
partitura → tiempo musical → input → juicio → resultado → dibujo + sonido
```
