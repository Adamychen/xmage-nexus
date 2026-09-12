// Títulos grep EXACTOS de tests fake rotos que se excluyen con grepInvert por
// defecto en playwright.config.ts (E2E_INCLUDE_KNOWN_BROKEN=1 los incluye).
// Formato: valor de _grepTitleWithTags (archivo + describes/tags/título unidos
// por espacio, con el espacio inicial del suite raíz recortado).
// Estado 2026-09-12: lista vacía — los 2 últimos (deep links #watch=/#join=,
// invite-link.spec) volvieron a pasar al re-ejecutarlos tras el fix del
// SetupWizard (el escenario fake no había cambiado; era coletazo del bug del
// ?proxyPort=). Si un test fake vuelve a fallar de forma estable, añadir aquí
// su título exacto (_grepTitleWithTags) con firma + evidencia en AGENTS.md.

export const KNOWN_BROKEN_TITLES: readonly string[] = []
