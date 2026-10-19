import { useRef, useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { readReplayFile, startReplay } from '../game/replayFile'
import Tabs from '../ui/Tabs'
import { useTranslation } from '../i18n'
import FinishedMatchesPanel from './FinishedMatchesPanel'
import MyMatchStats from './MyMatchStats'
import type { UsersView } from '../net/types'
import './MatchesSection.css'

type Source = 'server' | 'mine'

interface MatchesSectionProps {
  users: UsersView[]
  onInspectUser: (username: string) => void
}

export default function MatchesSection({ users, onInspectUser }: MatchesSectionProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<Source>('server')
  const [replayError, setReplayError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const openFile = async (file: File | undefined) => {
    if (!file) return
    const replay = await readReplayFile(file)
    if (!replay) {
      setReplayError(true)
      return
    }
    setReplayError(false)
    startReplay(replay)
  }
  return (
    <div className="matches-section">
      <div className="matches-toolbar">
        <Tabs<Source>
          variant="underline"
          size="sm"
          value={source}
          onChange={setSource}
          className="matches-source-tabs"
          items={[
            { id: 'server', label: t('lobby', 'history_server') },
            { id: 'mine', label: t('lobby', 'history_mine') },
          ]}
        />
        <div className="matches-replay-open">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.gz,application/json,application/gzip"
            hidden
            data-testid="replay-file-input"
            onChange={(e) => {
              void openFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="ghost" data-testid="replay-open" title={t('game', 'replay_open_hint')} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={12} /> {t('game', 'replay_open')}
          </Button>
          {replayError && (
            <span className="matches-replay-error" role="alert" data-testid="replay-invalid">
              {t('game', 'replay_invalid')}
            </span>
          )}
        </div>
      </div>
      {source === 'server' ? <FinishedMatchesPanel users={users} onInspectUser={onInspectUser} /> : <MyMatchStats />}
    </div>
  )
}
