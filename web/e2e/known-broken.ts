// Títulos grep EXACTOS de tests fake rotos que se excluyen con grepInvert por
// defecto en playwright.config.ts (E2E_INCLUDE_KNOWN_BROKEN=1 los incluye).
// Formato: valor de _grepTitleWithTags (archivo + describes/tags/título unidos
// por espacio, con el espacio inicial del suite raíz recortado).
// Estado 2026-09-11: los 77 títulos del bug del SetupWizard (pisaba ?proxyPort=
// y lanzaba los tests fake contra el proxy real) quedaron arreglados. Quedan
// solo los 2 de deep links (#watch=/#join=, commit 6e2c5cfa03): la página
// alcanza el staging de espectador (staging-back ✓) pero vuelve al lobby antes
// del segundo aserto y los botones `invite-copy-*`/diálogo de mazo no llegan;
// el escenario no emite WATCHGAME y ActiveTablesBar marca la mesa como propia
// (isMyTable por controllerName='e2e'). Pendiente de triage.
// Al añadir una entrada: documentar firma + evidencia en AGENTS.md.

export const KNOWN_BROKEN_TITLES: readonly string[] = [
  "invite-link.spec.ts Invite deep links (#join= / #watch=) watch link especta la mesa y muestra botones de invitación",
  "invite-link.spec.ts Invite deep links (#join= / #watch=) join link abre el diálogo de mazo",
]
