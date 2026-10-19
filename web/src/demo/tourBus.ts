export const DEMO_GO_EVENT = 'nexus:demo-go'

export type DemoTarget =
  | { kind: 'tables' }
  | { kind: 'decks' }
  | { kind: 'builder' }
  | { kind: 'history' }
  | { kind: 'ranking' }
  | { kind: 'settings' }
  | { kind: 'create' }

export function demoGo(target: DemoTarget): void {
  window.dispatchEvent(new CustomEvent<DemoTarget>(DEMO_GO_EVENT, { detail: target }))
}

export const AUTOSTART_KEY = 'nexus_demo_autostart'
