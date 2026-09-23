export type SoundKey =
  | 'tap'
  | 'play_card'
  | 'draw'
  | 'stack_cast'
  | 'priority'
  | 'combat_hit'
  | 'life_gain'
  | 'life_loss'
  | 'destroy'
  | 'game_start'
  | 'victory'
  | 'defeat'
  | 'timer_tick'
  | 'ui_click'
  | 'prompt_open'
  | 'whisper'
  | 'player_join'
  | 'player_leave'
  | 'impact_heavy'
  | 'impact_epic'
  | 'heartbeat'
  | 'exile'

export type SoundCategory = 'game' | 'ui'

export interface AudioSettings {
  soundEnabled: boolean
  masterVolume: number
  sfxVolume: number
  uiVolume: number
}
