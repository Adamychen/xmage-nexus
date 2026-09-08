# Mejoras de Alto Valor para XMage Nexus — Superando al Cliente Desktop

> **Visión**: XMage Nexus no busca ser únicamente un clon web funcional del cliente clásico de escritorio (`Mage.Client`, Java Swing); busca convertirse en la **plataforma moderna definitiva** para jugar a Magic con motor de reglas completo.  
> Aprovechando que la arquitectura corre sobre un stack web moderno (**React 19 + TypeScript + Web Audio + CSS3 Hardware Accelerated**), podemos implementar capacidades que en Java Swing eran inviables o prohibitivas.
>
> **Principio de diseño**: Todas las mejoras aquí catalogadas son **100% del lado del cliente (Client-Only)**: aprovechan el flujo reactivo de eventos JSON y el contrato existente con el proxy, sin necesidad de modificar el servidor XMage ni alterar el motor de reglas de Java.

---

## Índice de Módulos de Mejora

1. [Asistentes de Partida y Calidad de Vida (In-Game Companions)](#1-asistentes-de-partida-y-calidad-de-vida-in-game-companions)
2. [La "Ventaja Web": Social, Enlaces y Compartición](#2-la-ventaja-web-social-enlaces-y-compartición)
3. [Ergonomía Táctil y Soporte para iPad / Tablets](#3-ergonomía-táctil-y-soporte-para-ipad--tablets)
4. [Inteligencia en el Editor de Mazos (Scryfall + EDHREC)](#4-inteligencia-en-el-editor-de-mazos-scryfall--edhrec)
5. [Inmersión Estética, Tapetes y "Bling" Digital](#5-inmersión-estética-tapetes-y-bling-digital)
6. [Matriz de Priorización (Impacto vs. Esfuerzo)](#6-matriz-de-priorización-impacto-vs-esfuerzo)

---

## 1. Asistentes de Partida y Calidad de Vida (In-Game Companions)

Inspirado en herramientas como *17Lands*, *Untap Companion* o *MTG Arena Tool*. El cliente oficial de XMage requiere memorizar la lista o consultar ventanas externas; Nexus puede ofrecer asistentes transparentes en tiempo real.

### 1.1 In-Game Deck Tracker (Visor de Biblioteca Restante)
* **Descripción**: Panel lateral colapsable (o desplegable desde la biblioteca) que calcula las cartas restantes en el mazo.
* **Mecánica**:
  * Cruza la lista inicial del mazo cargado con los objetos visibles (`hand`, `battlefield`, `graveyard`, `exile`, `stack`).
  * Muestra copias restantes de cada carta agrupadas por tipo/CMC.
  * **Cálculo de probabilidad en vivo**: porcentaje exacto de robar una tierra en el siguiente turno o un hechizo de un tipo determinado (ej. *"Tierras: 14/38 (36.8%) | Criaturas: 12/38 (31.5%)"*).
* **Impacto**: ⭐⭐⭐⭐⭐ (Es la funcionalidad nº 1 más solicitada por jugadores competitivos en cualquier juego de cartas digital).

### 1.2 Calculadora de Daño Letal y Planificador de Combate
* **Descripción**: Detección anticipada de letal y balance de combate.
* **Mecánica**:
  * Durante la fase previa al combate o al declarar atacantes, evalúa si la suma del poder de las criaturas atacables (descontando bloqueadoras obvias o considerando evasión como volar/menace) supera las vidas del defensor.
  * Muestra un indicador sutil: badge *"Lethal on Board"* y previsualiza las vidas resultantes antes de hacer clic en *"Confirmar ataque"*.
* **Impacto**: ⭐⭐⭐⭐ (Acelera los turnos finales y previene descuidos matemáticos en mesas abarrotadas).

### 1.3 Historial Gráfico de Vidas y Línea Temporal de Turnos
* **Descripción**: Gráfico SVG interactivo de evolución de vidas turno a turno, sustituyendo la necesidad de leer 600 líneas de log plano.
* **Mecánica**:
  * Registra los cambios de vidas e hitos clave por turno (`T1, T2...`).
  * Puntos interactivos: al hacer hover sobre un nodo del gráfico, muestra qué ocurrió (ej. *"Turno 4: Lightning Bolt a Jugador (-3) | Ataque de 2 criaturas (-4)"*).
* **Impacto**: ⭐⭐⭐⭐ (Permite repasar instantáneamente cómo se desarrolló la partida).

### 1.4 Asistente de Evaluación de London Mulligan
* **Descripción**: Métricas y probabilidades automáticas durante el diálogo de decisión de Mulligan.
* **Mecánica**:
  * Muestra en el pie del `MulliganDialog`:
    * Ratio Tierras / Hechizos de la mano (ej. *"2 Tierras / 5 Hechizos"*).
    * Colores de maná que la mano puede producir en T1 y T2.
    * Probabilidad de robar la tercera tierra en T3 si te quedas una mano de 2 tierras.
* **Impacto**: ⭐⭐⭐⭐ (Reduce drásticamente los errores en la fase más crítica de Magic).

---

## 2. La "Ventaja Web": Social, Enlaces y Compartición

Capacidades exclusivas de la web que una aplicación monolítica de escritorio en Java nunca podrá ofrecer.

### 2.1 Deep Linking e Invitaciones Directas ("One-Click Join")
> ✅ **Implementado 2026-09-08** — `lobby/deepLink.ts` + `useInviteLink` + `InviteLinkButton` en staging; formato `#join=<tableId>&pwd=…&server=host:port` / `#watch=…`; join abre el diálogo de mazo con password pre-rellenada; servidor distinto pide confirmación (el proxy no cambia).
* **Descripción**: URLs directas para unirse o espectar mesas sin pasar por el explorador del lobby.
* **Mecánica**:
  * Botón *"Copiar enlace de invitación"* en la sala de espera (`SpectatorStagingScreen`) o dentro de la partida.
  * Enlace con formato: `https://nexus.app/#join=tableId&pwd=hash` o `#watch=tableId`.
  * Un amigo recibe el enlace por Discord o WhatsApp, hace clic y el cliente se conecta automáticamente al proxy, entra en la sala y ocupa el asiento libre sin fricción.
* **Impacto**: ⭐⭐⭐⭐⭐ (Elimina el 90% de la fricción al organizar partidas con amigos).

### 2.2 Sistema de Pings Tácticos en el Tablero (Especial Commander / 4P)
* **Descripción**: Comunicación visual no verbal rápida sobre permanentes y jugadores.
* **Mecánica**:
  * `Alt + Clic` (o rueda central) sobre cualquier permanente o jugador despliega una rueda de 3 pings:
    * 🎯 *"Atacar / Objetivo sugerido"* (rojo).
    * ⚠️ *"Peligro / Amenaza"* (amarillo).
    * ❓ *"Consulta / Interacción"* (azul).
  * Emite una animación de onda pulsante en el elemento señalado y reproduce un sonido suave para todos los jugadores de la mesa.
* **Impacto**: ⭐⭐⭐⭐⭐ (Revoluciona las partidas de Commander multijugador, donde la política y la agilidad visual son clave).

### 2.3 Modo Espectador / Streaming Overlay
* **Descripción**: Disposición limpia para retransmisiones en Twitch, YouTube o Discord.
* **Mecánica**:
  * Toggle en el menú de partida que oculta botones de acción, agranda las cartas en el campo y permite ver las dos manos abiertas simultáneamente (modo comentarista).
* **Impacto**: ⭐⭐⭐ (Facilita que creadores de contenido organicen torneos y casteos).

### 2.4 Tarjeta Resumen de Partida Descargable (Match Recap)
* **Descripción**: Generación de una imagen resumen al terminar la partida lista para compartir en redes o Discord.
* **Mecánica**:
  * Render en canvas offscreen con: nombres de los jugadores, comandantes/mazos utilizados, duración, resultado, gráfico de vidas y la carta MVP (la que más daño hizo o más disparadas generó).
* **Impacto**: ⭐⭐⭐ (Fomenta la comunidad y el boca a boca orgánico).

---

## 3. Ergonomía Táctil y Soporte para iPad / Tablets

El cliente Swing de XMage es 100% inutilizable en dispositivos móviles o táctiles debido a botones minúsculos y dependencia de menús contextuales con clic derecho. Nexus puede ser el **primer cliente completo de XMage táctil del mundo**.

### 3.1 Gestos y Adaptación Táctil
* **Mecánica**:
  * **Pulsación larga**: despliega la vista previa flotante de la carta (`FloatingCardPreview`).
  * **Doble tap**: acción por defecto (jugar tierra, lanzar hechizo si hay maná suficiente, declarar atacante).
  * **Deslizar arriba (Swipe up)**: pasar prioridad (equivalente a `Space` / `F4`).
  * **Targeting táctil**: arrastrar desde la carta origen hacia el objetivo para trazar la flecha Bézier.
* **Impacto**: ⭐⭐⭐⭐⭐ (Abre la puerta a jugar partidas completas, Drafts y Commander cómodamente desde el sofá o la cama).

### 3.2 Modo PWA Completo (Progressive Web App)
* **Mecánica**:
  * Añadir `manifest.json` y Service Worker con caché de activos estáticos.
  * Permite "Instalar en pantalla de inicio" en iOS y Android, eliminando las barras de navegación del navegador y comportándose como una aplicación nativa a pantalla completa.
* **Impacto**: ⭐⭐⭐⭐.

---

## 4. Inteligencia en el Editor de Mazos (Scryfall + EDHREC)

El editor actual ya supera al de XMage gracias a Scryfall y los importadores. Podemos llevarlo al siguiente nivel con integración de datos comunitarios:

### 4.1 Recomendaciones de Sinergias EDHREC Integradas
* **Descripción**: Al editar un mazo de Commander, ofrecer sugerencias de cartas sin salir de Nexus.
* **Mecánica**:
  * Al seleccionar la carta de Comandante, se consulta la API pública de EDHREC para ese comandante.
  * Nueva pestaña *"Sugerencias"* en el buscador del mazo con las 30 cartas más sinérgicas (clasificadas por criaturas, aceleración, interacción y tierras).
  * Clic directo para añadir al mazo.
* **Impacto**: ⭐⭐⭐⭐⭐ (Ahorra tener 5 pestañas de navegador abiertas mientras se crea una baraja).

### 4.2 Estimador de Precios y Presupuesto
* **Descripción**: Valoración económica del mazo en tiempo real.
* **Mecánica**:
  * Scryfall devuelve los precios aproximados en USD ($) y EUR (€ de Cardmarket).
  * Muestra el coste total del mazo en la cabecera y permite filtrar cartas por precio (ideal para formatos de presupuesto limitado como *Budget Commander* o *Penny Dreadful*).
* **Impacto**: ⭐⭐⭐.

### 4.3 Solitario / Goldfish Interactivo Extendido
* **Descripción**: Extensión del actual simulador T1–T3 a un modo de juego en solitario completo.
* **Mecánica**:
  * Permite jugar turnos libres contra un muñeco de prueba (*dummy* de 20/40 vidas), contando el daño acumulado por turno para comprobar la velocidad y consistencia del mazo.
* **Impacto**: ⭐⭐⭐⭐.

---

## 5. Inmersión Estética, Tapetes y "Bling" Digital

### 5.1 Selector de Tapetes (Playmats) con Ilustraciones Temáticas
* **Descripción**: Personalización del fondo de la mesa de juego.
* **Mecánica**:
  * Catálogo de tapetes predefinidos con artes icónicas de Magic en alta definición (Planicies de Serra, Volcanic Island, Black Lotus, Phyrexia, Elesh Norn).
  * Opción de subir una imagen personalizada que se almacena localmente en `IndexedDB` / `localStorage`.
  * Textura opcional de tela/neopreno con borde cosido CSS.
* **Impacto**: ⭐⭐⭐⭐ (Aumenta exponencialmente el apego y la sensación de juego prémium).

### 5.2 Variantes Estéticas de Cartas (Showcase / Retro / Borderless)
* **Descripción**: Elección visual de versiones sin afectar al juego.
* **Mecánica**:
  * Al hacer clic derecho o inspeccionar una carta en el mazo o en el campo, permitir elegir su arte alternativo de Scryfall (Marco Retro, Sin borde, Showcase temático).
  * Guardar las preferencias estéticas en el perfil local del jugador.
* **Impacto**: ⭐⭐⭐.

---

## 6. Matriz de Priorización (Impacto vs. Esfuerzo)

| # | Funcionalidad | Impacto | Complejidad técnica | Dependencias | Recomendación |
|---|---|---|---|---|---|
| **1** | **In-Game Deck Tracker** | 🟢 Muy Alto | 🟡 Media (~2-3 días) | Solo cliente (lectura de `deck` + `gameView`) | 🏆 **Top 1 Prioridad** |
| **2** | **Deep Linking (Enlace directo a mesa)** | 🟢 Muy Alto | 🟢 Baja (~1 día) | Hash router en `App.tsx` + auto-join | 🏆 **Top 2 Prioridad** |
| **3** | **Pings Tácticos en Tablero (Commander)** | 🟢 Muy Alto | 🟡 Media (~2 días) | Evento WS chat/broadcast o canal local | 🏆 **Top 3 Prioridad** |
| **4** | **Recomendaciones EDHREC en Deck Builder** | 🟢 Alto | 🟢 Baja (~1-2 días) | Fetch API pública EDHREC en `DeckBuilder` | ⚡ **Quick Win** |
| **5** | **Evaluador de London Mulligan** | 🟢 Alto | 🟢 Baja (~1 día) | Cálculo probabilístico en `MulliganDialog` | ⚡ **Quick Win** |
| **6** | **Selector de Tapetes (Playmats)** | 🟡 Medio | 🟢 Baja (~1 día) | CSS background en `BoardShell.tsx` | 🎨 **Estético rápido** |
| **7** | **Gestos y Adaptación Táctil (iPad)** | 🟢 Muy Alto | 🔴 Alta (~4-5 días) | Pointer events / touch events en zonas | 📱 **Evolutivo estratégico** |
| **8** | **Calculadora de Letal en Combate** | 🟡 Medio | 🟡 Media (~2 días) | Heurística en `CombatBar.tsx` | 💡 **QoL Competitivo** |
| **9** | **Historial Gráfico de Vidas** | 🟡 Medio | 🟢 Baja (~1 día) | SVG timeline en `GameMenu` / fin partida | 📊 **Visual** |

---

## Conclusión

El cliente de escritorio de XMage cumple como motor de reglas pero está estancado en la experiencia de usuario de 2012.  

Con la incorporación de este paquete de mejoras —encabezado por el **Deck Tracker**, el **Deep Linking para invitaciones con un clic** y los **Pings Tácticos para Commander**—, XMage Nexus deja de ser una alternativa web para convertirse en la **opción claramente superior y preferida por los jugadores**.
