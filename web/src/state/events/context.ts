import { getState } from '../state'
import { gameViewFrom } from '../gameUtils'

export type Snapshot = ReturnType<typeof getState>
export type EmbeddedGame = NonNullable<ReturnType<typeof gameViewFrom>>
