import { useState } from 'react'
import Tabs from '../ui/Tabs'
import { useTranslation } from '../i18n'
import FinishedMatchesPanel from './FinishedMatchesPanel'
import MyMatchStats from './MyMatchStats'
import type { UsersView } from '../net/types'

type Source = 'server' | 'mine'

interface MatchesSectionProps {
  users: UsersView[]
  onInspectUser: (username: string) => void
}

export default function MatchesSection({ users, onInspectUser }: MatchesSectionProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<Source>('server')
  return (
    <>
      <Tabs<Source>
        variant="underline"
        size="sm"
        value={source}
        onChange={setSource}
        items={[
          { id: 'server', label: t('lobby', 'history_server') },
          { id: 'mine', label: t('lobby', 'history_mine') },
        ]}
      />
      {source === 'server' ? <FinishedMatchesPanel users={users} onInspectUser={onInspectUser} /> : <MyMatchStats />}
    </>
  )
}
