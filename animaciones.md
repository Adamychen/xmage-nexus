# Plan de Animaciones — XMage Nexus Web Client

> **Estado:** ✅ COMPLETO — 5 de 5 partes
> **Rama base:** `master` + compatible con `feat/game-ui-v2` (flag `gameUi: v1|v2`)
> **Última actualización:** 2026-10-16 — ✅ Plan completo (17 animaciones, 3 semanas)

---

## Índice

1. [Contexto y objetivos](#1-contexto-y-objetivos) ✅ Parte 1
2. [Inventario de animaciones existentes](#2-inventario-de-animaciones-existentes) ✅ Parte 1
3. [Principios de diseño y arquitectura](#3-principios-de-diseño-y-arquitectura) ✅ Parte 1
4. [Categoría A — Feedback inmediato de acción](#4-categoría-a--feedback-inmediato-de-acción) ✅ Parte 2
5. [Categoría B — Transiciones de estado](#5-categoría-b--transiciones-de-estado) ✅ Parte 3
6. [Categoría C — Atención dirigida](#6-categoría-c--atención-dirigida) ✅ Parte 3
7. [Categoría D — Delight e inmersión](#7-categoría-d--delight-e-inmersión) ✅ Parte 4
8. [Matriz de priorización y roadmap](#8-matriz-de-priorización-y-roadmap) ✅ Parte 4
9. [Guía de implementación técnica](#9-guía-de-implementación-técnica) ✅ Parte 5 (actual)
10. [Testing y validación](#10-testing-y-validación) ✅ Parte 5 (actual)
5. [Categoría B — Transiciones de estado](#5-categoría-b--transiciones-de-estado) — Parte 3
6. [Categoría C — Atención dirigida](#6-categoría-c--atención-dirigida) — Parte 3
7. [Categoría D — Delight e inmersión](#7-categoría-d--delight-e-inmersión) — Parte 4
8. [Matriz de priorización y roadmap](#8-matriz-de-priorización-y-roadmap) — Parte 4
9. [Guía de implementación técnica](#9-guía-de-implementación-técnica) — Parte 5
10. [Testing y validación](#10-testing-y-validación) — Parte 5

---

## 1. Contexto y objetivos

### 1.1 Problema actual

La UI de juego es funcional pero **estática en momentos críticos**. El jugador no siempre percibe:
- Si su acción se envió (el `is-pending` con `opacity: 0.72` es invisible en partida rápida)
- Qué fase es y cuándo cambia (el `PhaseBar` es pequeño, sin transición)
- Quién tiene prioridad y hacia dónde va (cambio de clase `has-priority` sin movimiento)
- Si debe actuar (el `targetPulse` infinito se vuelve ruido visual)

Esto genera **fricción cognitiva**: el jugador mira el log en vez del tablero.

### 1.2 Objetivos del plan

1. **Claridad:** cada animación debe responder a "¿qué pasó?" o "¿qué debo hacer?"
2. **Feedback <100ms:** toda acción del jugador tiene respuesta visual inmediata (antes del eco del servidor)
3. **Jerarquía:** animar solo lo importante; el resto permanece quieto
4. **Compatibilidad:** funcionar en `v1` (master) y `v2` (Table layout) sin duplicar código
5. **Accesibilidad:** respetar `prefers-reduced-motion`, `settings.animationSpeed` y `html.fx-off`
6. **Performance:** 60fps en tableros con 20+ permanentes, sin layout thrashing

### 1.3 Alcance

- **Dentro:** animaciones CSS/JS para `board/`, `game/`, `CardSlot`, `PlayerInfoBar`, `GameScreen`
- **Fuera:** sonidos (ya existe `soundManager`), música, animaciones de lobby/decks (otro plan)

### 1.4 Compatibilidad con `feat/game-ui-v2`

La rama `feat/game-ui-v2` introduce un flag `gameUi: 'v1'|'v2'` (`DEFAULT='v2'`):

```ts
// web/src/game/gameUi.ts
export type GameUi = 'v1' | 'v2'
export const DEFAULT_GAME_UI: GameUi = 'v2'

// web/src/settings/boardLayoutChoice.ts
export function boardLayoutChoiceOf(settings) {
  return settings.gameUi === 'v2' ? 'table' : settings.boardLayout
}
```

- **v1:** `GameStrip` + `GameDrawer` + `GameDock` + `PhaseBar` + `BoardZone` 3 filas
- **v2:** `GameTopBar` + `SidePanel` + `PhaseDial` + `LogTicker` + `CombatLedger` + `StackDeck` + `PortraitBoard` + `board-wrap[data-ui='v2']`

**Estrategia:** animar la **capa compartida** (`CardSlot`, `BoardZone`, `tokens.css`, `flightManager.ts`, `fx.ts`) — 80% del valor sin duplicar. Solo el chrome específico (`GameStrip` vs `GameTopBar`, `GameDrawer` vs `StackDeck`) necesita branch `if (gameUi === 'v2')`.

---

## 2. Inventario de animaciones existentes

### 2.1 Cartas (`CardSlot.tsx` + `CardSlot.css`)

| Animación | Trigger | Duración | Código | Estado |
|---|---|---|---|---|
| `cardAppear` | Montaje inicial de carta | 0.22s `cubic-bezier(0.16,1,0.3,1)` | `scale 0.88→1` + `translate 0 6px` | ✅ Bien, pero solo en `entering` |
| `cardLand` | Fin de vuelo `flight-land` | 0.17s `ease-out` | `opacity 0→1` | ✅ Sutil, correcto |
| `flight-hidden` | Vuelo activo entre zonas | 0.34s (flight) + 0.18s landing | `opacity 0` + `startCardFlight` | ✅ Core, extender con bezier |
| `attackLungeUp/Down` | `attacking` class | 0.45s / `var(--fx-speed)` | `translate 0 -26px` + `brightness 1.25` | ✅ Bueno, pero sin hit stop |
| `blocking` | `blocking` class | — | `box-shadow cyan` | ⚠️ Estático, falta pulso |
| `targetPulse` | `targetable` class | 1.2s infinite | `box-shadow` + `border-color` | ⚠️ Infinito = ruido, debe ser beacon |
| `pendingSpin` | `is-pending` | 0.7s infinite | `rotate 360deg` spinner | ⚠️ Poco visible, necesita scale |
| `chosenPendingPulse` | `is-chosen-pending` | 0.6s infinite alternate | `box-shadow` | ⚠️ Similar a targetPulse, confunde |
| `stackSourcePulse` | Fuente en pila | 0.6s `ease-out` | `box-shadow 0→14px` | ✅ Bien para stack |
| `shakeHit` | Daño recibido | 0.38s | `margin-left` (¡layout thrashing!) | ❌ Usar `translateX` |
| `badgePop` | Contador nuevo | 0.28s `cubic-bezier(0.34,1.56,0.64,1)` | `scale 0.4→1.35→1` | ✅ Bueno |
| `sicknessFloat` | `sickness-badge` | 2s infinite alternate | `translateY -3px` + `rotate 15deg` | ⚠️ Distrae, debe ser veil |
| `sicknessVeil` | `sickness-veil` | 2.4s infinite alternate | `opacity 0.72→1` | ✅ Mejor que badge |
| `enteredGlow` | `enteredThisTurn` | 2.4s infinite alternate | `box-shadow inset` | ⚠️ Infinito, debe expirar |
| `recapMarkPulse` | `data-recap` | 1.6s ×3 | `outline-offset 2→5px` | ✅ Bien, 3 repeticiones |
| `tapped` | `tapped` prop | 0.28s | `rotate 90deg` + `margin` | ✅ Correcto, pero sin stagger |

**Gaps detectados:**
- No hay animación de **cast** (jugar carta) — solo `pending` genérico
- No hay **draw** (robar) — usa `cardAppear` genérico
- No hay **untap stagger** — todas giran a la vez
- `shakeHit` usa `margin-left` (fuerza reflow)
- `targetPulse` y `chosenPendingPulse` compiten visualmente

### 2.2 Tablero (`BoardZone.css` + `board/`)

| Animación | Trigger | Duración | Código | Estado |
|---|---|---|---|---|
| `useBandFit` | Resize de banda | 0.25s `cubic-bezier(0.16,1,0.3,1)` | `gap` + `cardW` recalculado | ✅ Suave |
| `StackPile` spread | Hover en pila | 0.25s `cubic-bezier(0.16,1,0.3,1)` | `left: var(--spread-x)` + `--spread-push` | ✅ Bien, sin reflow |
| `has-overflow` drag | Drag scroll | — | `cursor: grab→grabbing` | ✅ Funcional |
| `tap-tilted` | `tapStyle === 'tilted'` | — | `rotate 45deg scale 0.825` | ✅ Alternativa a 90deg |

**Gaps:**
- No hay transición entre `creatures` y `permanents` al cambiar layout
- No hay feedback al añadir carta a banda (solo `cardAppear` individual)

### 2.3 Game chrome (`GameScreen.css`, `ActionButton.css`, etc.)

| Animación | Trigger | Duración | Código | Estado |
|---|---|---|---|---|
| `GameDock` | `useDockOffset` | — | `bottom: var(--dock-bottom)` | ❌ Sin transición, salto brusco |
| `ActionButton` glow | `modeClass` | — | `box-shadow` estático | ⚠️ Sin pulso para waiting |
| `PhaseBar` | Cambio de `step` | — | Cambio de clase sin transición | ❌ Corte brusco |
| `TurnOrderRing` | Cambio de turno | — | — | ❌ Sin animación |
| `LowLifeVignette` | `life <= 5` | — | Vignette estático | ⚠️ Debe latir |
| `CombatArrowsOverlay` | Combate | — | SVG estático | ⚠️ Sin animación de trayectoria |
| `FeedbackOverlay` | Feedback | — | — | ❌ Sin entrada/salida |
| `ImpactOverlay` | Impacto | — | — | ❌ Sin definir |

### 2.4 Sistema (`fx.ts`, `tokens.css`, `useSettings`)

```ts
// web/src/board/fx.ts
export function fxDuration(ms: number): number {
  // respeta settings.animationSpeed y html.fx-off
}
export function applyFxRoot() {
  // aplica --fx-speed al root
}

// web/src/ui/tokens.css
--fx-speed: 1; // 0.5 = rápido, 2 = lento, 0 = off
html.fx-off * {
  animation: none !important;
  transition: none !important;
}
```

**Bien:** sistema centralizado. **Falta:** tokens de easing y duración estandarizados.

---

## 3. Principios de diseño y arquitectura

### 3.1 Principios

1. **Una animación, un mensaje:** si no puedes explicar en 5 palabras qué comunica, sobra
2. **Feedback antes que delight:** primero que el jugador sepa que su click llegó, luego que sea bonito
3. **Movimiento con propósito:** todo `translate`/`scale` debe guiar la mirada hacia la acción requerida
4. **Jerarquía de movimiento:**
   - **Nivel 1 (crítico):** acciones del jugador (cast, target, pass) — siempre animadas
   - **Nivel 2 (importante):** cambios de estado (fase, turno, prioridad) — animadas si no hay nivel 1
   - **Nivel 3 (ambiente):** vida baja, playmat, hover — solo si no hay nivel 1/2
5. **Respeto al jugador:** nunca bloquear input, nunca animar más de 2 elementos a la vez en viewport
6. **Performance primero:** `transform` y `opacity` únicamente; `will-change` solo durante animación

### 3.2 Tokens de animación (a definir en `tokens.css`)

```css
:root {
  /* Easing */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Duraciones base (se escalan con --fx-speed) */
  --dur-instant: 80ms;   /* feedback inmediato (cast press) */
  --dur-fast: 150ms;     /* micro-interacciones (hover, tap) */
  --dur-normal: 250ms;   /* transiciones de estado (fase, prioridad) */
  --dur-slow: 400ms;     /* movimientos largos (vuelo, draw) */
  --dur-ambient: 1200ms; /* loops sutiles (vignette, float) */

  /* Escala con fx-speed */
  --dur-fast-scaled: calc(var(--dur-fast) / var(--fx-speed, 1));
  --dur-normal-scaled: calc(var(--dur-normal) / var(--fx-speed, 1));
  /* ... */

  /* Distancias */
  --move-subtle: 4px;
  --move-medium: 12px;
  --move-large: 24px;
}
```

### 3.3 Arquitectura de implementación

```
web/src/
├── ui/tokens.css              # ← Tokens de animación (easing, duraciones)
├── board/fx.ts                # ← fxDuration(), applyFxRoot() (ya existe, extender)
├── board/flightManager.ts     # ← startCardFlight() con bezier (ya existe, mejorar)
├── board/animations/          # ← NUEVO: hooks y utils de animación
│   ├── useStagger.ts          # Hook para stagger (untap wave)
│   ├── useSpring.ts           # Hook para spring physics (opcional)
│   └── animationTokens.ts     # Tokens TS para JS animations
├── board/CardSlot.css         # ← Animaciones de carta (cast, damage, etc.)
├── board/BoardZone.css        # ← Animaciones de tablero (band fit, etc.)
├── game/animations.css        # ← NUEVO: animaciones de chrome (phase, turn, etc.)
└── game/GameScreen.css        # ← Transiciones de layout
```

**Regla de compatibilidad v1/v2:**
```tsx
// En componentes compartidos (CardSlot, BoardZone) — sin branch
<div className="card-slot casting" />

// En chrome específico — con branch
{gameUi === 'v2' ? <PhaseDial step={step} /> : <PhaseBar step={step} />}
// Ambos usan los mismos tokens CSS, solo cambia el componente
```

### 3.4 Consideraciones de accesibilidad

- `prefers-reduced-motion: reduce` → todas las animaciones a `0ms` o `opacity` solo
- `settings.animationSpeed === 0` → `html.fx-off` (ya existe)
- `settings.animationSpeed` 0.5–2 → escala duraciones con `calc(var(--dur) / var(--fx-speed))`
- Nunca animar si el usuario tiene `reduce motion` — verificar en cada `@keyframes`

```css
@media (prefers-reduced-motion: reduce) {
  .card-slot.casting,
  .phase-wipe,
  .draw-slide {
    animation: none !important;
    transition: none !important;
  }
}
```

### 3.5 Consideraciones de performance

- **Solo `transform` y `opacity`:** nunca `width`, `height`, `margin`, `top/left` (excepto `left` con `position: relative` en `StackPile` que ya está optimizado)
- **`will-change` temporal:** añadir solo durante animación, remover después
  ```ts
  el.style.willChange = 'transform';
  el.addEventListener('animationend', () => el.style.willChange = 'auto');
  ```
- **`contain: layout` en `board-zone`:** ya existe implícitamente con `overflow: hidden`
- **Stagger con `animation-delay`:** no con `setTimeout` en JS (más eficiente)
- **Medir con `perfMark`:** ya existe en `CardSlot.handleClick` — extender a nuevas animaciones

---

---

## 4. Categoría A — Feedback inmediato de acción

> **Prioridad: CRÍTICA** — Toda acción del jugador debe tener respuesta visual <100ms, antes del eco del servidor.
> **Compatibilidad:** 100% capa compartida (`CardSlot`, `BoardZone`, `flightManager`) — funciona en v1 y v2 sin branch.

### 4.1 A1 — Cast Spell "Suck & Shoot"

**Problema:** Hoy al jugar una carta solo hay `is-pending` (`opacity: 0.72` + spinner 0.7s). En partida rápida es invisible; el jugador duda si el click llegó y hace doble-click (riesgo de doble envío, aunque `pendingAck` lo previene, genera frustración).

**Objetivo:** Confirmar instantáneamente que la carta se jugó y mostrar hacia dónde va (mano → stack → campo).

**Especificación:**

| Fase | Duración | Easing | Transform | Descripción |
|---|---|---|---|---|
| Press | 80ms | `ease-out` | `scale 0.92` | Feedback de press inmediato (como botón físico) |
| Pop | 120ms | `ease-spring` | `scale 1.08` | Rebote que confirma "enviado" |
| Flight | 340ms | `cubic-bezier(0.2,0,0,1)` bezier | `translate` + `scale 0.8` + `rotate -3deg` | Vuelo hacia destino con curva |
| Land | 180ms | `ease-out` | `scale 1` + `opacity 1` | Aterrizaje en destino |

**Destinos:**
- **Hechizo instantáneo/conjuro:** mano → `StackZone` (centro, arco corto, trail dorado)
- **Criatura/encantamiento:** mano → `BoardZone` creatures/permanents (caída con `rotate 5deg → 0`)
- **Tierra:** mano → `BoardZone` lands (deslizamiento lateral)

**Código (CardSlot.tsx):**

```tsx
const handleClick = onClick ? () => {
  // Fase 1: press inmediato
  slotRef.current?.classList.add('casting-press');
  setTimeout(() => slotRef.current?.classList.remove('casting-press'), 80);
  
  // Fase 2: pop + flight
  setPendingAck(ackKind);
  perfMark('ack', ackKind, undefined, { cardId: String(effectiveId ?? '') });
  
  // Determinar destino
  const dest = getCastDestination(card); // 'stack' | 'battlefield'
  const destEl = dest === 'stack' 
    ? document.querySelector('.stack-zone')
    : document.querySelector(`[data-player-id="${playerId}"] .bz-band`);
  
  if (destEl && slotRef.current) {
    const startRect = slotRef.current.getBoundingClientRect();
    const endRect = destEl.getBoundingClientRect();
    startCardFlight(card, startRect, endRect, 340, `[data-card-id="${effectiveId}"]`, {
      curve: 'bezier', // nuevo: curva en vez de linear
      trail: dest === 'stack' ? 'gold' : 'none',
    });
    setFlightState('hidden');
  }
  
  soundManager.play('tap', 'game');
  onClick();
} : undefined;
```

**CSS (CardSlot.css):**

```css
.card-slot.casting-press {
  transform: scale(0.92);
  transition: transform 80ms var(--ease-out);
}

.card-slot.casting-pop {
  animation: castPop 120ms var(--ease-spring) forwards;
}

@keyframes castPop {
  0% { transform: scale(0.92); }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/* Flight trail (gold para stack) */
.card-flight-trail.gold {
  background: radial-gradient(circle, rgb(var(--gold-rgb) / 0.8) 0%, transparent 70%);
  filter: blur(2px);
}
```

**Criterios de aceptación:**
- [ ] Press visible en <50ms (sin esperar network)
- [ ] Vuelo con curva bezier, no linear (más natural)
- [ ] Trail dorado solo para stack, no para campo
- [ ] Respeta `prefers-reduced-motion` (solo `opacity` si reduce)
- [ ] No bloquea input (siguiente carta jugable inmediatamente)
- [ ] Test: `CardSlot.test.tsx` — click añade `casting-press` y llama `startCardFlight`

**v1/v2:** Sin branch — `CardSlot` es compartido. Solo el selector de destino cambia si v2 usa `StackDeck` en vez de `StackZone`.

---

### 4.2 A2 — Mana Tap "Pulse"

**Problema:** Girar tierra hoy es solo `rotate 90deg` (0.28s). No hay feedback de que se generó maná; el jugador mira `ManaPoolView` para confirmar.

**Objetivo:** Conectar visualmente la tierra girada con el maná generado.

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Rotate | 150ms | `ease-out` | `rotate 90deg` (existente) + `brightness 1.3` flash |
| Pulse | 120ms | `ease-out` | `box-shadow` expansivo del color de maná |
| Particle | 400ms | `ease-in` | Partícula del color flota hacia `ManaPoolView` |

**Código (CardSlot.tsx para tierras):**

```tsx
// En renderCardItem, si es tierra y se gira
const isLand = types.includes('land');
const manaColor = getManaColor(perm); // 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

<CardSlot
  cardId={id}
  card={perm}
  tapped={isTapped}
  className={isLand && isTapped ? `tapped mana-${manaColor}` : ''}
  // ...
/>
```

**CSS:**

```css
.card-slot.tapped.mana-W { --mana-color: var(--mana-w-rgb); }
.card-slot.tapped.mana-U { --mana-color: var(--mana-u-rgb); }
/* ... */

.card-slot.tapped[class*="mana-"] {
  animation: manaPulse 120ms var(--ease-out) 150ms; /* después de rotate */
}

@keyframes manaPulse {
  0% { box-shadow: 0 0 0 0 rgb(var(--mana-color) / 0.8); }
  100% { box-shadow: 0 0 0 12px rgb(var(--mana-color) / 0); }
}

.mana-particle {
  position: fixed;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgb(var(--mana-color));
  pointer-events: none;
  z-index: 100;
  animation: manaFloat 400ms var(--ease-in) forwards;
}

@keyframes manaFloat {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.5); opacity: 0; }
}
```

**JS para partícula (opcional, si no es overkill):**

```ts
function spawnManaParticle(fromRect: DOMRect, toRect: DOMRect, color: string) {
  const particle = document.createElement('div');
  particle.className = `mana-particle mana-${color}`;
  particle.style.left = `${fromRect.left + fromRect.width/2}px`;
  particle.style.top = `${fromRect.top + fromRect.height/2}px`;
  particle.style.setProperty('--dx', `${toRect.left - fromRect.left}px`);
  particle.style.setProperty('--dy', `${toRect.top - fromRect.top}px`);
  document.body.appendChild(particle);
  particle.addEventListener('animationend', () => particle.remove());
}
```

**Criterios de aceptación:**
- [ ] Flash de brillo visible al girar (no solo rotación)
- [ ] Pulso del color correcto (WUBRG)
- [ ] Partícula opcional — solo si no afecta performance (medir con 10 tierras giradas a la vez)
- [ ] Respeta `fx-off` (sin partícula si animaciones off)
- [ ] Test: `CardSlot.test.tsx` — tierra girada tiene clase `mana-W` y animación

**v1/v2:** Sin branch — `CardSlot` compartido. `ManaPoolView` existe en ambos.

---

### 4.3 A3 — Damage "Hit Stop" + Número flotante

**Problema:** `shakeHit` actual usa `margin-left` (layout thrashing, fuerza reflow) y es sutil. No hay feedback de cuánto daño se hizo.

**Objetivo:** Impacto visceral que comunique daño sin ser molesto.

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Hit Stop | 60ms | `step-end` | Freeze frame (pausa todo) |
| Shake | 300ms | `ease-out` | `translateX -4px → 4px → -2px → 0` (no margin) |
| Flash | 120ms | `ease-out` | `brightness 1.5` + `saturate 1.5` |
| Number | 600ms | `ease-out` | `+3` flota hacia arriba y fade |

**CSS (corregir shakeHit):**

```css
/* ANTES (mal): */
@keyframes shakeHit {
  0%, 100% { margin-left: 0; } /* ¡reflow! */
  20% { margin-left: -4px; }
}

/* DESPUÉS (bien): */
@keyframes shakeHit {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.card-slot.took-damage {
  animation: shakeHit 300ms var(--ease-out), damageFlash 120ms var(--ease-out);
}

@keyframes damageFlash {
  0% { filter: brightness(1) saturate(1); }
  50% { filter: brightness(1.5) saturate(1.5); }
  100% { filter: brightness(1) saturate(1); }
}

.damage-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--fs-lg);
  font-weight: 800;
  color: var(--err);
  text-shadow: 0 2px 4px var(--shade-5);
  pointer-events: none;
  z-index: 10;
  animation: damageFloat 600ms var(--ease-out) forwards;
}

@keyframes damageFloat {
  0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
  100% { transform: translate(-50%, -80%) scale(1.2); opacity: 0; }
}
```

**JS (hit stop):**

```ts
function triggerHitStop(duration = 60) {
  document.documentElement.style.animationPlayState = 'paused';
  setTimeout(() => {
    document.documentElement.style.animationPlayState = 'running';
  }, duration);
}
```

**Criterios de aceptación:**
- [ ] Shake usa `translateX`, no `margin-left` (verificar con DevTools Performance — sin reflow)
- [ ] Hit stop de 60ms perceptible pero no molesto (probar con 3 daños seguidos)
- [ ] Número flotante con valor correcto (`+3`, no genérico)
- [ ] Solo para daño de combate y directo, no para pérdida de vida por efecto
- [ ] Test: `CardSlot.test.tsx` — daño añade `took-damage` y `damage-number`

**v1/v2:** Sin branch — `CardSlot` y `PlayerInfoBar` (para daño a jugador) compartidos.

---

### 4.4 A4 — Pending mejorado (reemplaza spinner genérico)

**Problema:** `is-pending` (`opacity 0.72` + spinner 0.7s) y `is-chosen-pending` (pulse 0.6s) son similares y confunden. El spinner es pequeño y no indica progreso.

**Objetivo:** Diferenciar claramente "enviando" vs "esperando confirmación" y dar feedback de progreso.

**Especificación:**

| Estado | Visual | Duración | Descripción |
|---|---|---|---|
| `is-pending` (jugable) | `scale 0.98` + `opacity 0.85` + barra de progreso fina abajo | 0.15s | Carta se hunde levemente, barra carga 3s (timeout `PENDING_ACK_MS`) |
| `is-chosen-pending` (objetivo) | Anillo expansivo dorado + `scale 1.02` | 0.6s loop | Anillo que confirma "objetivo elegido" |

**CSS:**

```css
.card-slot.is-pending {
  transform: scale(0.98);
  opacity: 0.85;
  transition: transform 150ms var(--ease-out), opacity 150ms var(--ease-out);
}

.card-slot.is-pending::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--gold-500);
  animation: pendingProgress 3000ms linear forwards; /* PENDING_ACK_MS */
}

@keyframes pendingProgress {
  0% { width: 0; }
  100% { width: 100%; }
}

.card-slot.is-chosen-pending {
  transform: scale(1.02);
  animation: chosenRing 600ms var(--ease-out) infinite;
}

@keyframes chosenRing {
  0% { box-shadow: 0 0 0 0 rgb(var(--gold-rgb) / 0.8); }
  100% { box-shadow: 0 0 0 8px rgb(var(--gold-rgb) / 0); }
}
```

**Criterios de aceptación:**
- [ ] `is-pending` y `is-chosen-pending` visualmente distintos (no confundir)
- [ ] Barra de progreso da sensación de tiempo (no spinner infinito)
- [ ] Timeout a los 3s limpia `pendingAck` (ya existe `PENDING_ACK_MS`)
- [ ] Test: `CardSlot.test.tsx` — pending muestra barra, chosen muestra anillo

**v1/v2:** Sin branch — `CardSlot` compartido.

---

### 4.5 Resumen Categoría A

| Animación | Esfuerzo | Impacto | Prioridad | v1/v2 |
|---|---|---|---|---|
| A1 Cast Suck&Shoot | Medio | Alto | P0 | Compartido |
| A2 Mana Tap Pulse | Bajo | Medio | P1 | Compartido |
| A3 Damage Hit Stop | Bajo | Alto | P0 | Compartido |
| A4 Pending mejorado | Bajo | Medio | P1 | Compartido |

**Orden de implementación:** A1 → A3 → A4 → A2 (A1 y A3 son P0, bloquean la percepción de acción)

---

## 5. Categoría B — Transiciones de estado

> **Prioridad: ALTA** — Cambios de fase, turno y prioridad son el esqueleto del juego. Hoy son cortes bruscos.
> **Compatibilidad:** Mixta — `PhaseBar`/`PhaseDial` y `GameStrip`/`GameTopBar` requieren branch v1/v2, pero `draw` y `untap` son compartidos.

### 5.1 B1 — Phase Change "Wipe"

**Problema:** `PhaseBar` cambia de `step` sin transición. El jugador no nota que pasó de "Main 1" a "Combat" si no mira el texto pequeño.

**Objetivo:** Hacer el cambio de fase imposible de perder, con dirección y ritmo.

**Especificación:**

| Elemento | Duración | Easing | Efecto |
|---|---|---|---|
| Indicador activo | 250ms | `ease-spring` | `translateX` con spring hacia nuevo segmento |
| Label fase | 200ms | `ease-out` | `fadeUp` (viejo `opacity 0` + `translateY 4px`, nuevo `opacity 1` + `translateY 0`) |
| Barra completa | 150ms | `ease-out` | `background` del segmento activo ilumina |

**v1 (PhaseBar):**

```tsx
// web/src/game/PhaseBar.tsx
const prevStep = useRef(step);
useEffect(() => {
  if (prevStep.current !== step) {
    // Trigger wipe
    barRef.current?.classList.add('phase-wipe');
    setTimeout(() => barRef.current?.classList.remove('phase-wipe'), 250);
    prevStep.current = step;
  }
}, [step]);
```

```css
.phase-bar {
  position: relative;
  overflow: hidden;
}

.phase-bar-segment.active {
  background: var(--gold-500);
  transition: background 150ms var(--ease-out), transform 250ms var(--ease-spring);
}

.phase-bar.phase-wipe .phase-bar-segment.active {
  animation: phaseWipe 250ms var(--ease-spring);
}

@keyframes phaseWipe {
  0% { transform: scaleX(0.8); opacity: 0.8; }
  100% { transform: scaleX(1); opacity: 1; }
}

.phase-name {
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}

.phase-name.entering {
  animation: phaseFadeUp 200ms var(--ease-out);
}

@keyframes phaseFadeUp {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

**v2 (PhaseDial):**

```css
.phase-dial-needle {
  transition: transform 250ms var(--ease-spring);
}

.phase-dial.phase-wipe .phase-dial-needle {
  animation: dialTick 250ms var(--ease-spring);
}

@keyframes dialTick {
  0% { transform: rotate(var(--prev-angle)); }
  100% { transform: rotate(var(--next-angle)); }
}
```

**Criterios de aceptación:**
- [ ] Cambio de fase visible sin mirar directamente (movimiento periférico)
- [ ] No anima si es el mismo `step` (evitar loop en re-renders)
- [ ] Respeta `prefers-reduced-motion` (solo `opacity`)
- [ ] Test: `PhaseBar.test.tsx` — cambio de `step` añade `phase-wipe`

**v1/v2:** Branch — `PhaseBar` vs `PhaseDial`, pero mismos tokens y duración.

---

### 5.2 B2 — Turn Change "Glow + Scale"

**Problema:** Cambio de turno es solo número `game.turn` que incrementa. No hay celebración ni claridad de "ahora es tu turno".

**Objetivo:** Marcar el inicio de turno como evento, especialmente cuando cambia el jugador activo.

**Especificación:**

| Elemento | Duración | Easing | Efecto |
|---|---|---|---|
| Turn number | 400ms | `ease-spring` | `scale 1.05` + `glow` dorado + `text-shadow` |
| GameStrip/TopBar | 300ms | `ease-out` | `background` sutil dorado que fade out |
| Active player | 250ms | `ease-out` | `PlayerInfoBar` del jugador activo hace `scale 1.02` + `border` dorado |

**Código (GameScreen.tsx):**

```tsx
const prevTurn = useRef(game?.turn);
const prevActive = useRef(game?.activePlayerId);

useEffect(() => {
  if (game && prevTurn.current !== game.turn) {
    // Nuevo turno
    document.querySelector('.game-turn')?.classList.add('turn-glow');
    setTimeout(() => document.querySelector('.game-turn')?.classList.remove('turn-glow'), 400);
    prevTurn.current = game.turn;
  }
  if (game && prevActive.current !== game.activePlayerId) {
    // Cambio de jugador activo
    document.querySelector(`[data-player-id="${game.activePlayerId}"]`)?.classList.add('active-glow');
    setTimeout(() => document.querySelector(`[data-player-id="${game.activePlayerId}"]`)?.classList.remove('active-glow'), 300);
    prevActive.current = game.activePlayerId;
  }
}, [game?.turn, game?.activePlayerId]);
```

**CSS:**

```css
.game-turn.turn-glow {
  animation: turnGlow 400ms var(--ease-spring);
}

@keyframes turnGlow {
  0% { transform: scale(1); text-shadow: 0 0 0 var(--gold-500); }
  50% { transform: scale(1.05); text-shadow: 0 0 12px var(--gold-500); }
  100% { transform: scale(1); text-shadow: 0 0 0 var(--gold-500); }
}

.player-info-bar.active-glow {
  animation: activeGlow 300ms var(--ease-out);
}

@keyframes activeGlow {
  0% { border-color: transparent; transform: scale(1); }
  50% { border-color: var(--gold-500); transform: scale(1.02); }
  100% { border-color: transparent; transform: scale(1); }
}
```

**Criterios de aceptación:**
- [ ] Turno nuevo visible aunque el jugador mire el campo (glow periférico)
- [ ] No anima en cada `GAME_UPDATE`, solo cuando `turn` o `activePlayerId` cambian
- [ ] Test: `GameScreen.test.tsx` — incremento de `turn` añade `turn-glow`

**v1/v2:** Compartido — `game.turn` y `activePlayerId` existen en ambos. Solo el selector CSS cambia (`GameStrip` vs `GameTopBar`).

---

### 5.3 B3 — Priority Pass "Orb"

**Problema:** Pasar prioridad es solo cambio de clase `has-priority` (borde verde). No hay dirección — el jugador no sabe hacia quién pasó.

**Objetivo:** Visualizar el flujo de prioridad como un orbe que viaja entre avatares.

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Orb spawn | 100ms | `ease-out` | `scale 0 → 1` + `opacity 0 → 1` en origen |
| Orb travel | 400ms | `ease-in-out` | `translate` con curva bezier entre avatares |
| Orb land | 150ms | `ease-spring` | `scale 1.2 → 1` + `glow` en destino |

**Código (GameScreen.tsx):**

```tsx
const prevPriority = useRef<string | null>(null);

useEffect(() => {
  const currentPriority = game?.players.find(p => p.hasPriority)?.playerId;
  if (currentPriority && prevPriority.current && currentPriority !== prevPriority.current) {
    // Pasar prioridad
    const fromEl = document.querySelector(`[data-player-id="${prevPriority.current}"] .player-avatar`);
    const toEl = document.querySelector(`[data-player-id="${currentPriority}"] .player-avatar`);
    if (fromEl && toEl) {
      spawnPriorityOrb(fromEl.getBoundingClientRect(), toEl.getBoundingClientRect());
    }
  }
  prevPriority.current = currentPriority ?? null;
}, [game?.players]);

function spawnPriorityOrb(fromRect: DOMRect, toRect: DOMRect) {
  const orb = document.createElement('div');
  orb.className = 'priority-orb';
  orb.style.left = `${fromRect.left + fromRect.width/2}px`;
  orb.style.top = `${fromRect.top + fromRect.height/2}px`;
  document.body.appendChild(orb);
  
  const dx = toRect.left + toRect.width/2 - (fromRect.left + fromRect.width/2);
  const dy = toRect.top + toRect.height/2 - (fromRect.top + fromRect.height/2);
  orb.style.setProperty('--dx', `${dx}px`);
  orb.style.setProperty('--dy', `${dy}px`);
  
  orb.addEventListener('animationend', () => orb.remove());
}
```

**CSS:**

```css
.priority-orb {
  position: fixed;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--gold-300) 0%, var(--gold-500) 100%);
  box-shadow: 0 0 8px var(--gold-500);
  pointer-events: none;
  z-index: 100;
  animation: orbTravel 400ms var(--ease-in-out) 100ms forwards, orbLand 150ms var(--ease-spring) 500ms forwards;
}

@keyframes orbTravel {
  0% { transform: translate(0, 0) scale(0); opacity: 0; }
  10% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 1; }
}

@keyframes orbLand {
  0% { transform: translate(var(--dx), var(--dy)) scale(1); }
  50% { transform: translate(var(--dx), var(--dy)) scale(1.2); }
  100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
}
```

**Criterios de aceptación:**
- [ ] Orb visible solo cuando cambia `hasPriority` entre jugadores (no en cada update)
- [ ] Curva bezier, no linear (más natural)
- [ ] No interfiere con clicks (pointer-events: none)
- [ ] Test: `GameScreen.test.tsx` — cambio de `hasPriority` spawnea `priority-orb`

**v1/v2:** Compartido — `PlayerInfoBar` existe en ambos. Solo el layout de avatares cambia (v2 usa `PortraitBoard` con avatares más grandes).

---

### 5.4 B4 — Draw Card "Slide from Deck"

**Problema:** Robar carta usa `cardAppear` genérico (scale 0.88→1). No hay origen — parece que la carta aparece de la nada.

**Objetivo:** Mostrar de dónde viene la carta (biblioteca) y hacia dónde va (mano).

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Slide | 400ms | `ease-out` | `translate` desde `ResourceBar` deck count + `rotate -5deg → 0` + `scale 0.8 → 1` |
| Land | 150ms | `ease-spring` | `scale 1.02 → 1` en mano |

**Código (BoardZone.tsx):**

```tsx
// Detectar nueva carta en mano
const prevHandCount = useRef(Object.keys(hand ?? {}).length);
useEffect(() => {
  const currentCount = Object.keys(hand ?? {}).length;
  if (currentCount > prevHandCount.current) {
    // Nueva carta robada
    const deckEl = document.querySelector(`[data-player-id="${player.playerId}"] .resource-deck`);
    const handEl = document.querySelector(`[data-player-id="${player.playerId}"] .hand-zone`);
    if (deckEl && handEl) {
      const newCardId = Object.keys(hand ?? {}).find(id => !prevHandIds.current.has(id));
      if (newCardId) {
        const cardEl = document.querySelector(`[data-card-id="${newCardId}"]`);
        if (cardEl) {
          cardEl.classList.add('draw-slide');
          cardEl.style.setProperty('--from-x', `${deckEl.getBoundingClientRect().left - handEl.getBoundingClientRect().left}px`);
          cardEl.style.setProperty('--from-y', `${deckEl.getBoundingClientRect().top - handEl.getBoundingClientRect().top}px`);
        }
      }
    }
  }
  prevHandCount.current = currentCount;
}, [hand]);
```

**CSS:**

```css
.card-slot.draw-slide {
  animation: drawSlide 400ms var(--ease-out), drawLand 150ms var(--ease-spring) 400ms;
}

@keyframes drawSlide {
  0% { 
    transform: translate(var(--from-x), var(--from-y)) rotate(-5deg) scale(0.8); 
    opacity: 0.8; 
  }
  100% { 
    transform: translate(0, 0) rotate(0) scale(1); 
    opacity: 1; 
  }
}

@keyframes drawLand {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
```

**Para oponente (dorso):**

```css
.card-slot.draw-slide.face-down {
  animation: drawSlideBack 400ms var(--ease-out);
}

@keyframes drawSlideBack {
  0% { transform: translate(var(--from-x), var(--from-y)) scale(0.8); opacity: 0; }
  100% { transform: translate(0, 0) scale(1); opacity: 1; }
}
```

**Criterios de aceptación:**
- [ ] Carta robada desliza desde biblioteca, no aparece de la nada
- [ ] Oponente ve dorso deslizando (no carta revelada)
- [ ] No anima si es carta inicial (mulligan) — solo robos durante partida
- [ ] Test: `BoardZone.test.tsx` — nueva carta en mano añade `draw-slide`

**v1/v2:** Compartido — `ResourceBar` y `HandZone` existen en ambos.

---

### 5.5 B5 — Untap Step "Wave" (stagger)

**Problema:** En untap, todas las cartas giradas hacen `rotate 90→0` simultáneamente. Es brusco y no hay ritmo.

**Objetivo:** Dar ritmo al untap con cascada (stagger) de izquierda a derecha.

**Especificación:**

| Elemento | Duración | Delay | Easing | Efecto |
|---|---|---|---|---|
| Cada carta girada | 250ms | `index * 40ms` | `ease-out` | `rotate 90deg → 0` con stagger |

**Código (BoardZone.tsx):**

```tsx
// Detectar untap (todas las tapped pasan a no tapped)
const prevTapped = useRef<Set<string>>(new Set());
useEffect(() => {
  const currentTapped = new Set(
    Object.entries(player.battlefield ?? {})
      .filter(([, p]) => p.tapped)
      .map(([id]) => id)
  );
  
  // Si había tapped y ahora no hay (untap)
  if (prevTapped.current.size > 0 && currentTapped.size === 0) {
    // Aplicar stagger a todas las que estaban giradas
    prevTapped.current.forEach((id, index) => {
      const cardEl = document.querySelector(`[data-card-id="${id}"]`);
      if (cardEl) {
        cardEl.classList.add('untap-wave');
        (cardEl as HTMLElement).style.animationDelay = `${index * 40}ms`;
      }
    });
  }
  prevTapped.current = currentTapped;
}, [player.battlefield]);
```

**CSS:**

```css
.card-slot.untap-wave {
  animation: untapWave 250ms var(--ease-out) forwards;
}

@keyframes untapWave {
  0% { transform: rotate(90deg); }
  100% { transform: rotate(0); }
}

/* Para tilted */
.card-slot.untap-wave.tapped {
  animation: untapWaveTilted 250ms var(--ease-out) forwards;
}

@keyframes untapWaveTilted {
  0% { transform: rotate(45deg) scale(0.825); }
  100% { transform: rotate(0) scale(1); }
}
```

**Hook reutilizable (board/animations/useStagger.ts):**

```ts
export function useStagger(ids: string[], trigger: boolean, delay = 40) {
  useEffect(() => {
    if (!trigger) return;
    ids.forEach((id, index) => {
      const el = document.querySelector(`[data-card-id="${id}"]`);
      if (el) {
        (el as HTMLElement).style.animationDelay = `${index * delay}ms`;
        el.classList.add('stagger-animate');
      }
    });
  }, [ids, trigger, delay]);
}
```

**Criterios de aceptación:**
- [ ] Cartas giradas hacen untap en cascada, no simultáneo
- [ ] Delay 40ms por carta (10 cartas = 400ms total, aceptable)
- [ ] Funciona con `tapStyle: 'tilted'` (45deg) y normal (90deg)
- [ ] No anima si solo 1 carta girada (sin stagger innecesario)
- [ ] Test: `BoardZone.test.tsx` — untap añade `untap-wave` con `animationDelay`

**v1/v2:** Compartido — `BoardZone` y `player.battlefield` existen en ambos.

---

### 5.6 Resumen Categoría B

| Animación | Esfuerzo | Impacto | Prioridad | v1/v2 |
|---|---|---|---|---|
| B1 Phase Wipe | Bajo | Alto | P0 | Branch |
| B2 Turn Glow | Bajo | Alto | P0 | Compartido |
| B3 Priority Orb | Medio | Alto | P1 | Compartido |
| B4 Draw Slide | Medio | Alto | P1 | Compartido |
| B5 Untap Wave | Bajo | Medio | P2 | Compartido |

**Orden de implementación:** B1 → B2 → B4 → B3 → B5 (B1 y B2 son P0, críticos para ritmo)

---

## 6. Categoría C — Atención dirigida

> **Prioridad: ALTA** — Guiar la mirada del jugador hacia lo que requiere acción. Hoy el `targetPulse` infinito es ruido.
> **Compatibilidad:** Mixta — `targetBeacon` y `stackResolve` son compartidos, `lowLife` y `timer` son específicos de `PlayerInfoBar`.

### 6.1 C1 — Target Required "Beacon"

**Problema:** `targetPulse` (1.2s infinite) y `chosenPendingPulse` (0.6s infinite) compiten y se vuelven ruido. El jugador no sabe qué es objetivo obligatorio vs opcional.

**Objetivo:** Reemplazar pulso infinito por beacon intermitente que guíe sin molestar.

**Especificación:**

| Estado | Visual | Frecuencia | Descripción |
|---|---|---|---|
| `targetable` (obligatorio) | Anillo expansivo dorado + flecha desde fuente | Cada 1.5s | Beacon que llama la atención |
| `targetable-optional` (opcional) | Borde dorado sutil + `scale 1.01` | — | Menos prominente, sin beacon |
| `chosen` | `scale 1.02` + `border err` | — | Confirmado, sin animación |

**CSS (reemplaza targetPulse):**

```css
/* ELIMINAR targetPulse infinito */
/* @keyframes targetPulse { ... } — borrar */

.card-slot.targetable {
  border-color: var(--gold-500);
  animation: targetBeacon 1.5s var(--ease-out) infinite;
}

@keyframes targetBeacon {
  0% { box-shadow: 0 0 0 0 rgb(var(--gold-rgb) / 0.8); }
  70% { box-shadow: 0 0 0 8px rgb(var(--gold-rgb) / 0); }
  100% { box-shadow: 0 0 0 0 rgb(var(--gold-rgb) / 0); }
}

.card-slot.targetable-optional {
  border-color: var(--gold-300);
  transform: scale(1.01);
  transition: transform 150ms var(--ease-out);
}

.card-slot.chosen {
  border-color: var(--err);
  transform: scale(1.02);
  box-shadow: 0 0 12px rgb(var(--err-rgb) / 0.5);
}
```

**Flecha desde fuente (CombatArrowsOverlay extendido):**

```tsx
// web/src/board/CombatArrowsOverlay.tsx — extender para targeting general
interface TargetArrowProps {
  sourceId: string;
  targetIds: string[];
}

export function TargetArrows({ sourceId, targetIds }: TargetArrowProps) {
  const sourceEl = document.querySelector(`[data-card-id="${sourceId}"]`);
  const targetEls = targetIds.map(id => document.querySelector(`[data-card-id="${id}"]`));
  
  if (!sourceEl || targetEls.length === 0) return null;
  
  return (
    <svg className="target-arrows" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {targetEls.map((targetEl, i) => {
        if (!targetEl) return null;
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        return (
          <path
            key={i}
            d={`M ${sourceRect.left + sourceRect.width/2} ${sourceRect.top + sourceRect.height/2} Q ${(sourceRect.left + targetRect.left)/2} ${sourceRect.top - 20} ${targetRect.left + targetRect.width/2} ${targetRect.top + targetRect.height/2}`}
            stroke="var(--gold-500)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 4"
            className="target-arrow-path"
          />
        );
      })}
    </svg>
  );
}
```

```css
.target-arrow-path {
  animation: dashMove 1s linear infinite;
}

@keyframes dashMove {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 8; }
}
```

**Criterios de aceptación:**
- [ ] `targetable` con beacon cada 1.5s, no pulso continuo
- [ ] `targetable-optional` sin beacon (menos prominente)
- [ ] Flecha desde fuente solo si `sourceId` existe (no siempre)
- [ ] Eliminar `targetPulse` y `chosenPendingPulse` infinitos
- [ ] Test: `CardSlot.test.tsx` — `targetable` tiene `targetBeacon`, no `targetPulse`

**v1/v2:** Compartido — `CardSlot` y `CombatArrowsOverlay` existen en ambos.

---

### 6.2 C2 — Stack Resolve "Countdown"

**Problema:** `StackZone` es estático. No hay indicación de que la pila va a resolver ni de cuánto tiempo queda.

**Objetivo:** Dar urgencia y claridad al resolver la pila.

**Especificación:**

| Elemento | Duración | Easing | Efecto |
|---|---|---|---|
| Carta superior | 1s loop | `ease-in-out` | `scale 1.02` pulsante |
| Barra progreso | 3s | `linear` | Barra fina abajo que carga (auto-resolve) |
| Resolver | 200ms | `ease-spring` | `scale 1.1 → 0` + `flash` blanco |

**Código (StackZone.tsx):**

```tsx
const topCard = stack[stack.length - 1];
const [isResolving, setIsResolving] = useState(false);

useEffect(() => {
  if (topCard && !isResolving) {
    // Auto-resolve en 3s si nadie responde (como en Arena)
    const timer = setTimeout(() => {
      setIsResolving(true);
      // Trigger resolve animation
      document.querySelector(`[data-card-id="${topCard.id}"]`)?.classList.add('stack-resolving');
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [topCard, isResolving]);
```

**CSS:**

```css
.stack-zone .card-slot.top-card {
  animation: stackPulse 1s var(--ease-in-out) infinite;
}

@keyframes stackPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.stack-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--gold-500);
  animation: stackProgress 3000ms linear forwards;
}

@keyframes stackProgress {
  0% { width: 0; }
  100% { width: 100%; }
}

.card-slot.stack-resolving {
  animation: stackResolve 200ms var(--ease-spring) forwards;
}

@keyframes stackResolve {
  0% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.1); filter: brightness(1.5); }
  100% { transform: scale(0); filter: brightness(2); opacity: 0; }
}
```

**Criterios de aceptación:**
- [ ] Carta superior pulsa sutilmente (no molesto)
- [ ] Barra de progreso da sensación de tiempo (3s)
- [ ] Resolver con scale + flash, no desaparición brusca
- [ ] Solo si hay pila, no en cada `GAME_UPDATE`
- [ ] Test: `StackZone.test.tsx` — carta superior tiene `stackPulse` y `stack-progress`

**v1/v2:** Branch — v1 usa `StackZone` en `GameDrawer`, v2 usa `StackDeck` (rail lateral). Misma lógica, diferente contenedor.

---

### 6.3 C3 — Low Life "Vignette Pulse"

**Problema:** `LowLifeVignette` es estático. A 5 vidas no hay urgencia; a 1 vida debería ser alarmante.

**Objetivo:** Escalar la urgencia visual con la vida restante.

**Especificación:**

| Vida | Efecto | Frecuencia |
|---|---|---|
| 5-3 | Vignette sutil + `PlayerInfoBar` vida `pulse` | 2s |
| 2-1 | Vignette intenso + heartbeat + `shake` sutil | 1s (60bpm → 120bpm) |

**CSS:**

```css
.low-life-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgb(var(--err-rgb) / 0.15) 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 300ms var(--ease-out);
}

.low-life-vignette.active {
  opacity: 1;
  animation: vignettePulse 2s var(--ease-in-out) infinite;
}

.low-life-vignette.critical {
  background: radial-gradient(ellipse at center, transparent 50%, rgb(var(--err-rgb) / 0.3) 100%);
  animation: vignetteCritical 1s var(--ease-in-out) infinite;
}

@keyframes vignettePulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes vignetteCritical {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}

.player-info-bar.low-life .life-value {
  animation: lifePulse 2s var(--ease-in-out) infinite;
}

.player-info-bar.critical .life-value {
  animation: lifeCritical 1s var(--ease-in-out) infinite;
  color: var(--err);
}

@keyframes lifePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes lifeCritical {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(1); }
}
```

**Código (LowLifeVignette.tsx):**

```tsx
export default function LowLifeVignette({ game }: { game: GameView | null }) {
  const me = game?.players.find(p => p.controlled);
  const life = me?.life ?? 20;
  
  if (life > 5) return null;
  
  const isCritical = life <= 2;
  return (
    <div className={`low-life-vignette ${isCritical ? 'critical' : 'active'}`} />
  );
}
```

**Criterios de aceptación:**
- [ ] Vignette aparece solo a ≤5 vidas (no siempre)
- [ ] Crítico (≤2) más intenso y rápido (1s vs 2s)
- [ ] `PlayerInfoBar` vida pulsa en sincronía
- [ ] No molesta en partida normal (solo low life)
- [ ] Test: `LowLifeVignette.test.tsx` — vida 5 muestra `active`, vida 1 muestra `critical`

**v1/v2:** Compartido — `LowLifeVignette` y `PlayerInfoBar` existen en ambos.

---

### 6.4 C4 — Timer Urgency "Tick"

**Problema:** Timer ≤10s es solo número rojo. No hay urgencia visual ni feedback de cada segundo.

**Objetivo:** Hacer el timer imposible de ignorar en los últimos segundos.

**Especificación:**

| Tiempo | Efecto | Frecuencia |
|---|---|---|
| 30-10s | `color warn` + `scale 1.02` | — |
| 10-5s | `color err` + `scale 1.05` cada segundo + `shake` sutil | 1s |
| 5-0s | `color err` + `scale 1.1` + `flash` + `shake` intenso | 1s |

**CSS:**

```css
.player-timer-badge {
  transition: color 200ms var(--ease-out), transform 200ms var(--ease-out);
}

.player-timer-badge.warn {
  color: var(--warn);
  transform: scale(1.02);
}

.player-timer-badge.urgent {
  color: var(--err);
  animation: timerTick 1s var(--ease-out) infinite;
}

.player-timer-badge.critical {
  color: var(--err);
  animation: timerCritical 1s var(--ease-out) infinite;
}

@keyframes timerTick {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes timerCritical {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(1); }
  75% { transform: translateX(-1px); }
}
```

**Código (PlayerInfoBar.tsx):**

```tsx
const timeLeft = useTickingTimer(player.priorityTimeLeftSecs, hasPriority);
const isWarn = timeLeft <= 30 && timeLeft > 10;
const isUrgent = timeLeft <= 10 && timeLeft > 5;
const isCritical = timeLeft <= 5 && timeLeft > 0;

<span className={`player-timer-badge ${isCritical ? 'critical' : isUrgent ? 'urgent' : isWarn ? 'warn' : ''}`}>
  {formatTimer(timeLeft)}
</span>
```

**Criterios de aceptación:**
- [ ] Timer cambia color y escala según tiempo restante
- [ ] Últimos 10s con tick cada segundo (no continuo)
- [ ] Últimos 5s más intenso (scale 1.1 + shake)
- [ ] Sonido `timer_tick` ya existe — sincronizar con animación
- [ ] Test: `PlayerInfoBar.test.tsx` — timer 5s tiene `critical`

**v1/v2:** Compartido — `PlayerInfoBar` existe en ambos.

---

### 6.5 Resumen Categoría C

| Animación | Esfuerzo | Impacto | Prioridad | v1/v2 |
|---|---|---|---|---|
| C1 Target Beacon | Bajo | Alto | P0 | Compartido |
| C2 Stack Countdown | Medio | Medio | P1 | Branch |
| C3 Low Life Pulse | Bajo | Medio | P2 | Compartido |
| C4 Timer Tick | Bajo | Alto | P0 | Compartido |

**Orden de implementación:** C1 → C4 → C2 → C3 (C1 y C4 son P0, críticos para acción)

---

## 7. Categoría D — Delight e inmersión

> **Prioridad: BAJA** — Pulido visual que no afecta gameplay, pero eleva la percepción de calidad. Solo si no hay animaciones de nivel 1/2 activas.
> **Compatibilidad:** 100% capa compartida, excepto `playmatParallax` que es específico de `GameScreen`.

### 7.1 D1 — Playmat Parallax

**Problema:** `playmat-layer` es estático. No hay profundidad ni respuesta al movimiento del ratón.

**Objetivo:** Dar sensación de profundidad sutil sin distraer.

**Especificación:**

| Elemento | Duración | Easing | Efecto |
|---|---|---|---|
| Playmat | 300ms | `ease-out` | `translate 2-3px` según `pointermove` sobre `board-wrap` |

**Código (GameScreen.tsx):**

```tsx
const boardWrapRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const wrap = boardWrapRef.current;
  if (!wrap) return;
  
  const handlePointerMove = (e: PointerEvent) => {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 a 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
    const playmat = wrap.querySelector('.playmat-layer') as HTMLElement;
    if (playmat) {
      playmat.style.transform = `translate(${x * 3}px, ${y * 3}px)`;
    }
  };
  
  wrap.addEventListener('pointermove', handlePointerMove);
  return () => wrap.removeEventListener('pointermove', handlePointerMove);
}, []);
```

**CSS:**

```css
.playmat-layer {
  transition: transform 300ms var(--ease-out);
  will-change: transform;
}
```

**Criterios de aceptación:**
- [ ] Movimiento sutil (2-3px máximo, no mareo)
- [ ] Solo en desktop (no en móvil, sin hover)
- [ ] Respeta `prefers-reduced-motion` (sin parallax)
- [ ] No afecta performance (solo `transform`)

**v1/v2:** Compartido — `playmat-layer` existe en ambos, pero v2 tiene `board-wrap[data-ui='v2']` con padding diferente.

---

### 7.2 D2 — Card Hover "Tilt 3D"

**Problema:** Hover en mano es solo `translateY -24px scale 1.06`. No hay profundidad 3D.

**Objetivo:** Hacer el hover más inmersivo con tilt según posición del cursor.

**Especificación:**

| Elemento | Duración | Easing | Efecto |
|---|---|---|---|
| Carta en mano | 150ms | `ease-out` | `rotateX/Y 5deg` según cursor + `box-shadow` dinámico |

**Código (CardSlot.tsx, solo en mano):**

```tsx
const handlePointerMove = (e: React.PointerEvent) => {
  if (!isInHand) return; // solo en mano
  
  const rect = slotRef.current?.getBoundingClientRect();
  if (!rect) return;
  
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  
  slotRef.current!.style.transform = `rotateX(${y * -5}deg) rotateY(${x * 5}deg) translateY(-24px) scale(1.06)`;
  slotRef.current!.style.boxShadow = `${x * 10}px ${y * 10 + 14}px 32px var(--shade-5)`;
};

<div
  ref={slotRef}
  onPointerMove={handlePointerMove}
  onPointerLeave={() => {
    slotRef.current!.style.transform = '';
    slotRef.current!.style.boxShadow = '';
  }}
/>
```

**CSS:**

```css
.card-slot:hover {
  transition: transform 150ms var(--ease-out), box-shadow 150ms var(--ease-out);
  transform-style: preserve-3d;
}
```

**Nota:** `FloatingCardPreview` ya tiene `usePointerTilt` — reutilizar ese hook si existe.

**Criterios de aceptación:**
- [ ] Tilt solo en mano, no en campo (distrae en campo)
- [ ] 5deg máximo (sutil, no exagerado)
- [ ] `box-shadow` sigue al tilt (profundidad)
- [ ] Respeta `prefers-reduced-motion`

**v1/v2:** Compartido — `CardSlot` en mano existe en ambos.

---

### 7.3 D3 — Token Create "Pop"

**Problema:** Fichas nuevas usan `cardAppear` genérico (scale 0.88→1). No hay celebración de creación.

**Objetivo:** Hacer la creación de fichas más festiva.

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Pop | 300ms | `ease-spring` | `scale 0 → 1.2 → 1` + `rotate 5deg → 0` |
| Particles | 400ms | `ease-out` | Partículas pequeñas que explotan desde el centro |

**CSS:**

```css
.card-slot.token-pop {
  animation: tokenPop 300ms var(--ease-spring);
}

@keyframes tokenPop {
  0% { transform: scale(0) rotate(5deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(-2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

.token-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold-500);
  pointer-events: none;
  animation: tokenParticle 400ms var(--ease-out) forwards;
}

@keyframes tokenParticle {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}
```

**Código (BoardZone.tsx):**

```tsx
// Detectar nueva ficha (isToken)
const prevTokens = useRef<Set<string>>(new Set());
useEffect(() => {
  const currentTokens = new Set(
    Object.entries(player.battlefield ?? {})
      .filter(([, p]) => p.isToken)
      .map(([id]) => id)
  );
  
  currentTokens.forEach(id => {
    if (!prevTokens.current.has(id)) {
      const cardEl = document.querySelector(`[data-card-id="${id}"]`);
      if (cardEl) {
        cardEl.classList.add('token-pop');
        // Spawn particles
        for (let i = 0; i < 6; i++) {
          const particle = document.createElement('div');
          particle.className = 'token-particle';
          const angle = (i / 6) * Math.PI * 2;
          const dist = 20 + Math.random() * 10;
          particle.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          particle.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          cardEl.appendChild(particle);
          particle.addEventListener('animationend', () => particle.remove());
        }
      }
    }
  });
  prevTokens.current = currentTokens;
}, [player.battlefield]);
```

**Criterios de aceptación:**
- [ ] Ficha hace pop con scale y rotate, no solo appear
- [ ] Partículas opcionales (solo si no afecta performance con 5 fichas a la vez)
- [ ] Solo para fichas (`isToken`), no para cartas normales
- [ ] Test: `BoardZone.test.tsx` — nueva ficha tiene `token-pop`

**v1/v2:** Compartido — `BoardZone` y `isToken` existen en ambos.

---

### 7.4 D4 — Graveyard/Exile "Dissolve"

**Problema:** Carta que va a cementerio/exilio desaparece bruscamente (sin animación). No hay feedback de a dónde fue.

**Objetivo:** Mostrar el destino de la carta con dissolve hacia `ResourceBar`.

**Especificación:**

| Fase | Duración | Easing | Efecto |
|---|---|---|---|
| Dissolve | 300ms | `ease-in` | `scale 0.9` + `opacity 0` + `grayscale` hacia cementerio |

**CSS:**

```css
.card-slot.dissolving {
  animation: dissolve 300ms var(--ease-in) forwards;
}

@keyframes dissolve {
  0% { transform: scale(1); opacity: 1; filter: grayscale(0); }
  100% { transform: scale(0.9); opacity: 0; filter: grayscale(1); }
}
```

**Código (BoardZone.tsx):**

```tsx
// Detectar carta que deja el campo (va a cementerio/exilio)
const prevBattlefield = useRef<Record<string, PermanentView>>(player.battlefield ?? {});
useEffect(() => {
  const current = player.battlefield ?? {};
  Object.keys(prevBattlefield.current).forEach(id => {
    if (!current[id]) {
      // Carta ya no está en campo — ¿a dónde fue?
      const cardEl = document.querySelector(`[data-card-id="${id}"]`);
      if (cardEl) {
        // Verificar si está en cementerio o exilio
        const inGrave = player.graveyard?.[id];
        const inExile = player.exile?.[id];
        if (inGrave || inExile) {
          cardEl.classList.add('dissolving');
          // Opcional: vuelo hacia ResourceBar
          const destEl = document.querySelector(`[data-player-id="${player.playerId}"] .resource-${inGrave ? 'grave' : 'exile'}`);
          if (destEl) {
            const startRect = cardEl.getBoundingClientRect();
            const endRect = destEl.getBoundingClientRect();
            startCardFlight(prevBattlefield.current[id], startRect, endRect, 300, `[data-card-id="${id}"]`);
          }
        }
      }
    }
  });
  prevBattlefield.current = current;
}, [player.battlefield, player.graveyard, player.exile]);
```

**Criterios de aceptación:**
- [ ] Carta que va a cementerio hace dissolve, no desaparece brusco
- [ ] Opcional: vuelo hacia `ResourceBar` cementerio/exilio
- [ ] Solo si la carta realmente cambia de zona (no en cada update)
- [ ] Test: `BoardZone.test.tsx` — carta que deja campo añade `dissolving`

**v1/v2:** Compartido — `BoardZone` y `ResourceBar` existen en ambos.

---

### 7.5 Resumen Categoría D

| Animación | Esfuerzo | Impacto | Prioridad | v1/v2 |
|---|---|---|---|---|
| D1 Playmat Parallax | Bajo | Bajo | P3 | Compartido |
| D2 Card Tilt 3D | Bajo | Bajo | P3 | Compartido |
| D3 Token Pop | Bajo | Medio | P2 | Compartido |
| D4 Graveyard Dissolve | Medio | Medio | P2 | Compartido |

**Orden de implementación:** D3 → D4 → D2 → D1 (D3 y D4 son P2, más visibles)

---

## 8. Matriz de priorización y roadmap

### 8.1 Matriz esfuerzo/impacto

```
Impacto
  Alto | A1 Cast      B1 Phase    C1 Beacon
       | A3 Damage    B2 Turn     C4 Timer
       |              B4 Draw     
       |----------------------------------
  Medio| A4 Pending   B3 Orb      C2 Stack    D3 Token
       | A2 Mana      B5 Untap    C3 LowLife  D4 Dissolve
       |----------------------------------
  Bajo |              D2 Tilt    D1 Parallax
       |__________________________________
         Bajo        Medio       Alto
                    Esfuerzo
```

### 8.2 Roadmap por fases

**Fase 1 — Crítico (P0) — 1 semana**
- A1 Cast Suck&Shoot
- A3 Damage Hit Stop
- B1 Phase Wipe
- B2 Turn Glow
- C1 Target Beacon
- C4 Timer Tick

**Fase 2 — Importante (P1) — 1 semana**
- A4 Pending mejorado
- B3 Priority Orb
- B4 Draw Slide
- C2 Stack Countdown
- A2 Mana Tap Pulse

**Fase 3 — Pulido (P2) — 1 semana**
- B5 Untap Wave
- C3 Low Life Pulse
- D3 Token Pop
- D4 Graveyard Dissolve

**Fase 4 — Delight (P3) — opcional**
- D1 Playmat Parallax
- D2 Card Tilt 3D

### 8.3 Dependencias

```
Fase 1 (P0) ──→ Fase 2 (P1) ──→ Fase 3 (P2) ──→ Fase 4 (P3)
   │              │              │
   └─ Tokens CSS  └─ flightManager └─ useStagger
      fx.ts         bezier         hook
```

**Bloqueadores:**
- Fase 1 requiere `tokens.css` + `fx.ts` extendido (1 día)
- Fase 2 requiere `flightManager` con bezier (ya existe, solo mejorar)
- Fase 3 requiere `useStagger` hook (nuevo, 1 día)

### 8.4 Estimación total

| Fase | Animaciones | Días | Esfuerzo |
|---|---|---|---|
| Fase 1 (P0) | 6 | 5 | Alto |
| Fase 2 (P1) | 5 | 5 | Medio |
| Fase 3 (P2) | 4 | 3 | Bajo |
| Fase 4 (P3) | 2 | 2 | Bajo |
| **Total** | **17** | **15** | **3 semanas** |

---

## 9. Guía de implementación técnica

### 9.1 Estructura de archivos

```
web/src/
├── ui/tokens.css                    # ← AÑADIR: tokens de animación (easing, duraciones)
├── board/fx.ts                      # ← EXTENDER: fxDuration, applyFxRoot, nuevos helpers
├── board/flightManager.ts           # ← MEJORAR: bezier curves, trail support
├── board/animations/                # ← NUEVO: carpeta de hooks de animación
│   ├── useStagger.ts                # Hook para stagger (untap wave)
│   ├── usePriorityOrb.ts            # Hook para orb de prioridad
│   ├── useDrawSlide.ts              # Hook para draw slide
│   └── animationTokens.ts           # Tokens TS para JS animations
├── board/CardSlot.css               # ← EXTENDER: A1, A2, A3, A4, C1, D2, D3, D4
├── board/CardSlot.tsx               # ← EXTENDER: lógica de cast, damage, pending
├── board/BoardZone.css              # ← EXTENDER: B5, D3, D4
├── board/BoardZone.tsx              # ← EXTENDER: untap wave, token pop, dissolve
├── game/animations.css              # ← NUEVO: B1, B2, B3, C2, C3, C4, D1
├── game/GameScreen.tsx              # ← EXTENDER: phase wipe, turn glow, priority orb, parallax
├── game/GameScreen.css              # ← EXTENDER: transiciones de layout
├── game/PhaseBar.tsx                # ← EXTENDER: B1 phase wipe (v1)
├── game/PhaseDial.tsx               # ← EXTENDER: B1 phase wipe (v2)
├── game/PlayerInfoBar.tsx           # ← EXTENDER: C3, C4, B2
├── game/PlayerInfoBar.css           # ← EXTENDER: low life, timer tick
├── game/StackZone.tsx               # ← EXTENDER: C2 stack countdown (v1)
├── board/StackDeck.tsx              # ← EXTENDER: C2 stack countdown (v2)
└── board/CombatArrowsOverlay.tsx    # ← EXTENDER: C1 target arrows
```

### 9.2 Tokens CSS (web/src/ui/tokens.css)

```css
:root {
  /* Easing */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  /* Duraciones base */
  --dur-instant: 80ms;
  --dur-fast: 150ms;
  --dur-normal: 250ms;
  --dur-slow: 400ms;
  --dur-ambient: 1200ms;

  /* Duraciones escaladas con fx-speed */
  --dur-instant-scaled: calc(var(--dur-instant) / var(--fx-speed, 1));
  --dur-fast-scaled: calc(var(--dur-fast) / var(--fx-speed, 1));
  --dur-normal-scaled: calc(var(--dur-normal) / var(--fx-speed, 1));
  --dur-slow-scaled: calc(var(--dur-slow) / var(--fx-speed, 1));
  --dur-ambient-scaled: calc(var(--dur-ambient) / var(--fx-speed, 1));

  /* Distancias */
  --move-subtle: 4px;
  --move-medium: 12px;
  --move-large: 24px;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 0ms;
    --dur-fast: 0ms;
    --dur-normal: 0ms;
    --dur-slow: 0ms;
    --dur-ambient: 0ms;
  }
}
```

### 9.3 Helpers TS (web/src/board/fx.ts)

```ts
export function fxDuration(ms: number): number {
  const speed = getFxSpeed(); // de settings.animationSpeed
  return ms / speed;
}

export function getFxSpeed(): number {
  const settings = useStore.getState().settings;
  return settings.animationSpeed ?? 1;
}

export function isFxOff(): boolean {
  return document.documentElement.classList.contains('fx-off') || 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function applyFxRoot() {
  const speed = getFxSpeed();
  document.documentElement.style.setProperty('--fx-speed', String(speed));
  if (speed === 0) {
    document.documentElement.classList.add('fx-off');
  } else {
    document.documentElement.classList.remove('fx-off');
  }
}
```

### 9.4 Flight Manager mejorado (web/src/board/flightManager.ts)

```ts
interface FlightOptions {
  curve?: 'linear' | 'bezier';
  trail?: 'none' | 'gold' | 'mana';
  sourceSize?: { w: number; h: number };
  toCompact?: boolean;
}

export function startCardFlight(
  card: CardView | PermanentView,
  fromRect: DOMRect,
  toRect: DOMRect,
  duration: number,
  selector: string,
  options: FlightOptions = {}
): string | null {
  const { curve = 'linear', trail = 'none' } = options;
  
  // Crear elemento de vuelo
  const flightEl = document.createElement('div');
  flightEl.className = `card-flight ${trail !== 'none' ? `trail-${trail}` : ''}`;
  
  // Calcular curva bezier si es necesario
n  if (curve === 'bezier') {
    const cpX = (fromRect.left + toRect.left) / 2;
    const cpY = Math.min(fromRect.top, toRect.top) - 40; // arco hacia arriba
    flightEl.style.setProperty('--cp-x', `${cpX}px`);
    flightEl.style.setProperty('--cp-y', `${cpY}px`);
  }
  
  // Animar
  flightEl.animate([
    { transform: `translate(${fromRect.left}px, ${fromRect.top}px) scale(1)` },
    { transform: `translate(${toRect.left}px, ${toRect.top}px) scale(0.8)` }
  ], {
    duration: fxDuration(duration),
    easing: curve === 'bezier' ? 'cubic-bezier(0.2, 0, 0, 1)' : 'ease-out',
  });
  
  // ... resto de lógica
}
```

### 9.5 Hooks de animación (web/src/board/animations/)

**useStagger.ts:**

```ts
import { useEffect } from 'react';

export function useStagger(
  ids: string[],
  trigger: boolean,
  delay = 40,
  className = 'stagger-animate'
) {
  useEffect(() => {
    if (!trigger || ids.length <= 1) return;
    
    ids.forEach((id, index) => {
      const el = document.querySelector(`[data-card-id="${id}"]`);
      if (el) {
        (el as HTMLElement).style.animationDelay = `${index * delay}ms`;
        el.classList.add(className);
        el.addEventListener('animationend', () => {
          el.classList.remove(className);
          (el as HTMLElement).style.animationDelay = '';
        }, { once: true });
      }
    });
  }, [ids, trigger, delay, className]);
}
```

**usePriorityOrb.ts:**

```ts
import { useEffect, useRef } from 'react';

export function usePriorityOrb(
  fromPlayerId: string | null,
  toPlayerId: string | null
) {
  const prevTo = useRef<string | null>(null);
  
  useEffect(() => {
    if (!fromPlayerId || !toPlayerId || toPlayerId === prevTo.current) return;
    
    const fromEl = document.querySelector(`[data-player-id="${fromPlayerId}"] .player-avatar`);
    const toEl = document.querySelector(`[data-player-id="${toPlayerId}"] .player-avatar`);
    
    if (fromEl && toEl) {
      spawnOrb(fromEl.getBoundingClientRect(), toEl.getBoundingClientRect());
    }
    
    prevTo.current = toPlayerId;
  }, [fromPlayerId, toPlayerId]);
}

function spawnOrb(fromRect: DOMRect, toRect: DOMRect) {
  const orb = document.createElement('div');
  orb.className = 'priority-orb';
  // ... lógica de orb
  document.body.appendChild(orb);
  orb.addEventListener('animationend', () => orb.remove());
}
```

### 9.6 Consideraciones de performance

1. **Solo transform y opacity:** Nunca animar `width`, `height`, `margin`, `top/left` (excepto `StackPile` que ya está optimizado con `left` + `position: relative`)
2. **will-change temporal:** Añadir solo durante animación
   ```ts
   el.style.willChange = 'transform';
   el.addEventListener('animationend', () => el.style.willChange = 'auto', { once: true });
   ```
3. **contain: layout:** Ya existe implícitamente con `overflow: hidden` en `board-zone`
4. **Stagger con animation-delay:** No con `setTimeout` en JS (más eficiente)
5. **Medir con perfMark:** Ya existe en `CardSlot.handleClick` — extender
   ```ts
   perfMark('animation', 'cast-flight', undefined, { cardId, duration: 340 });
   ```
6. **Limitar animaciones simultáneas:** Máximo 2 en viewport, priorizar nivel 1 (crítico)

### 9.7 Accesibilidad

```css
/* Respetar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .card-slot.casting,
  .phase-wipe,
  .draw-slide,
  .priority-orb,
  .target-beacon {
    animation: none !important;
    transition: none !important;
  }
  
  /* Solo opacity para feedback esencial */
  .card-slot.is-pending {
    opacity: 0.85; /* sin scale ni movimiento */
  }
}

/* Respetar fx-off */
html.fx-off * {
  animation: none !important;
  transition: none !important;
}
```

```ts
// En JS, verificar antes de animar
if (isFxOff()) return; // no animar si fx-off o reduce motion
```

---

## 10. Testing y validación

### 10.1 Estrategia de testing

| Tipo | Herramienta | Qué testear |
|---|---|---|
| Unit | Vitest | Lógica de triggers (cuándo animar), hooks `useStagger`, `usePriorityOrb` |
| Component | Vitest + Testing Library | Clases CSS añadidas, `animationend` events, `prefers-reduced-motion` |
| E2E | Playwright | Animaciones visibles en flujo real, no bloquean input, performance 60fps |
| Visual | Playwright screenshots | Regresión visual (comparar antes/después) |
| Manual | Dev + QA | Percepción de fluidez, no mareo, jerarquía correcta |

### 10.2 Tests unitarios (ejemplos)

**CardSlot.test.tsx — A1 Cast:**

```tsx
test('click añade casting-press y llama startCardFlight', async () => {
  const card = { id: '1', name: 'Lightning Bolt' };
  const onClick = vi.fn();
  const { container } = render(<CardSlot card={card} onClick={onClick} />);
  
  const slot = container.querySelector('[data-card-id="1"]');
  await userEvent.click(slot!);
  
  expect(slot).toHaveClass('casting-press');
  expect(startCardFlight).toHaveBeenCalledWith(
    card,
    expect.any(DOMRect),
    expect.any(DOMRect),
    340,
    '[data-card-id="1"]',
    expect.objectContaining({ curve: 'bezier' })
  );
  expect(onClick).toHaveBeenCalled();
});
```

**PhaseBar.test.tsx — B1 Phase Wipe:**

```tsx
test('cambio de step añade phase-wipe', () => {
  const { rerender, container } = render(<PhaseBar step="main1" />);
  const bar = container.querySelector('.phase-bar');
  
  rerender(<PhaseBar step="combat" />);
  
  expect(bar).toHaveClass('phase-wipe');
  // Verificar que se limpia después de 250ms
  vi.advanceTimersByTime(250);
  expect(bar).not.toHaveClass('phase-wipe');
});
```

**BoardZone.test.tsx — B5 Untap Wave:**

```tsx
test('untap añade untap-wave con stagger', () => {
  const player = {
    playerId: '1',
    battlefield: {
      'a': { id: 'a', tapped: true },
      'b': { id: 'b', tapped: true },
    }
  };
  
  const { rerender } = render(<BoardZone player={player} />);
  
  // Untap: todas dejan de estar giradas
  const untappedPlayer = {
    ...player,
    battlefield: {
      'a': { id: 'a', tapped: false },
      'b': { id: 'b', tapped: false },
    }
  };
  rerender(<BoardZone player={untappedPlayer} />);
  
  const cardA = document.querySelector('[data-card-id="a"]');
  const cardB = document.querySelector('[data-card-id="b"]');
  
  expect(cardA).toHaveClass('untap-wave');
  expect(cardB).toHaveClass('untap-wave');
  expect(cardA).toHaveStyle('animation-delay: 0ms');
  expect(cardB).toHaveStyle('animation-delay: 40ms');
});
```

### 10.3 Tests E2E (Playwright)

**game-animations.spec.ts:**

```ts
test('cast spell muestra vuelo bezier', async ({ page }) => {
  await page.goto('/game/test-cast');
  
  const card = page.locator('[data-card-id="bolt"]');
  const stack = page.locator('.stack-zone');
  
  await card.click();
  
  // Verificar que aparece flight element
  const flight = page.locator('.card-flight');
  await expect(flight).toBeVisible();
  
  // Verificar que llega al stack
  await expect(flight).not.toBeVisible({ timeout: 500 });
  await expect(stack.locator('[data-card-id="bolt"]')).toBeVisible();
});

test('phase wipe visible en cambio de fase', async ({ page }) => {
  await page.goto('/game/test-phase');
  
  const phaseBar = page.locator('.phase-bar');
  await expect(phaseBar).not.toHaveClass('phase-wipe');
  
  // Simular cambio de fase (via WS mock)
  await page.evaluate(() => window.mockPhaseChange('combat'));
  
  await expect(phaseBar).toHaveClass('phase-wipe');
  await expect(phaseBar).not.toHaveClass('phase-wipe', { timeout: 300 });
});

test('no animaciones con prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/game/test-cast');
  
  const card = page.locator('[data-card-id="bolt"]');
  await card.click();
  
  // Verificar que no hay animación
  const flight = page.locator('.card-flight');
  await expect(flight).not.toBeVisible();
  
  // Pero sí hay feedback de opacity
  await expect(card).toHaveCSS('opacity', '0.85');
});
```

### 10.4 Validación de performance

**Métricas a medir:**
- **FPS:** 60fps con 20+ permanentes en campo (usar `requestAnimationFrame` + `performance.now()`)
- **Reflow:** 0 reflows durante animaciones (verificar con DevTools Performance — sin `margin`, `width`, `height` animados)
- **Long tasks:** <50ms por frame (evitar JS bloqueante durante animaciones)

**Herramientas:**
- Chrome DevTools Performance tab
- `perfMark` ya existente en `CardSlot.handleClick`
- Lighthouse Performance audit

**Criterios de aceptación:**
- [ ] 60fps con 20 cartas en campo + 5 animaciones simultáneas
- [ ] 0 reflows durante `shakeHit`, `cast`, `draw` (solo `transform`/`opacity`)
- [ ] <50ms long tasks durante animaciones

### 10.5 Validación manual (QA checklist)

- [ ] **Feedback <100ms:** Toda acción del jugador tiene respuesta visual inmediata
- [ ] **Jerarquía:** Solo 1-2 animaciones visibles a la vez, no todo animado
- [ ] **No bloquea input:** Puedo jugar siguiente carta mientras anima la anterior
- [ ] **Accesibilidad:** Con `prefers-reduced-motion`, solo `opacity` (sin movimiento)
- [ ] **v1/v2:** Animaciones funcionan en ambos layouts (toggle `gameUi`)
- [ ] **No mareo:** Parallax y tilt sutiles, no exagerados
- [ ] **Performance:** 60fps en partida real con 4 jugadores (pod)

---

## 11. Checklist de implementación

### Fase 1 — Crítico (P0) — 1 semana
- [ ] Tokens CSS (`tokens.css` + `fx.ts` extendido)
- [ ] A1 Cast Suck&Shoot (`CardSlot.tsx` + `flightManager.ts` bezier)
- [ ] A3 Damage Hit Stop (corregir `shakeHit` + número flotante)
- [ ] B1 Phase Wipe (`PhaseBar.tsx`/`PhaseDial.tsx`)
- [ ] B2 Turn Glow (`GameScreen.tsx`)
- [ ] C1 Target Beacon (reemplazar `targetPulse`)
- [ ] C4 Timer Tick (`PlayerInfoBar.tsx`)
- [ ] Tests unitarios + E2E para Fase 1
- [ ] QA manual + performance check

### Fase 2 — Importante (P1) — 1 semana
- [ ] A4 Pending mejorado (`CardSlot.tsx`)
- [ ] B3 Priority Orb (`GameScreen.tsx` + `usePriorityOrb` hook)
- [ ] B4 Draw Slide (`BoardZone.tsx` + `useDrawSlide` hook)
- [ ] C2 Stack Countdown (`StackZone.tsx`/`StackDeck.tsx`)
- [ ] A2 Mana Tap Pulse (`CardSlot.tsx`)
- [ ] Tests + QA

### Fase 3 — Pulido (P2) — 1 semana
- [ ] B5 Untap Wave (`BoardZone.tsx` + `useStagger` hook)
- [ ] C3 Low Life Pulse (`LowLifeVignette.tsx` + `PlayerInfoBar.tsx`)
- [ ] D3 Token Pop (`BoardZone.tsx`)
- [ ] D4 Graveyard Dissolve (`BoardZone.tsx`)
- [ ] Tests + QA

### Fase 4 — Delight (P3) — opcional
- [ ] D1 Playmat Parallax (`GameScreen.tsx`)
- [ ] D2 Card Tilt 3D (`CardSlot.tsx`)
- [ ] Tests + QA

---

## 12. Referencias

- **Código existente:** `web/src/board/CardSlot.tsx`, `web/src/board/BoardZone.tsx`, `web/src/game/GameScreen.tsx`, `web/src/board/fx.ts`, `web/src/board/flightManager.ts`
- **Rama v2:** `feat/game-ui-v2` (flag `gameUi: 'v1'|'v2'`, `DEFAULT='v2'`)
- **Design tokens:** `web/src/ui/tokens.css`
- **Accesibilidad:** `prefers-reduced-motion`, `settings.animationSpeed`, `html.fx-off`
- **Performance:** `perfMark` en `web/src/system/perfProbe.ts`

---

**Fin del plan — 17 animaciones en 3 semanas, con compatibilidad v1/v2 y accesibilidad garantizada.**