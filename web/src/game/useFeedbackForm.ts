import { useEffect, useMemo, useState } from 'react'
import * as cmds from '../net/commands'
import { clearFeedback, recordDungeonRoom, setStoreError, useStore } from '../state/store'
import { getState } from '../state/state'
import type { FeedbackOption, FeedbackPrompt } from './feedback'
import { ventureChoiceFromPrompt } from './dungeons'
import { useTranslation, t as tStatic } from '../i18n'

export function sendValue(prompt: FeedbackPrompt, value: string) {
  switch (prompt.mode) {
    case 'boolean':
      return cmds.sendPlayerBoolean(value === 'true', prompt.gameId)
    case 'string':
      return cmds.sendPlayerString(value, prompt.gameId)
    case 'uuid':
      return cmds.sendPlayerUUID(value, prompt.gameId)
    case 'mana':
      if (!prompt.playerId) return Promise.resolve({ ok: false, error: tStatic('errors', 'send_failed_mana') })
      return cmds.sendPlayerManaType(prompt.gameId, prompt.playerId, value)
    default:
      return Promise.resolve({ ok: false, error: tStatic('errors', 'generic_error') })
  }
}

function isResultOk(result: { ok: boolean; error?: string }, fallback: string) {
  if (result.ok) {
    clearFeedback()
    return true
  }
  setStoreError(result.error ?? fallback)
  return false
}

export interface UseFeedbackForm {
  prompt: FeedbackPrompt | null
  busy: boolean
  amount: number
  setAmount: React.Dispatch<React.SetStateAction<number>>
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  multiAmounts: Record<string, number>
  setMultiAmounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  textValue: string
  setTextValue: (v: string) => void
  filteredStringOptions: FeedbackOption[]
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => Promise<void>
  cancel: () => void
  finishOptionalTarget: () => void
  selectOption: (option: FeedbackOption) => void
  confirmSelected: () => void
  confirmAmount: () => void
  confirmMultiAmount: () => void
}

export function useFeedbackForm(): UseFeedbackForm {
  const { t } = useTranslation()
  const prompt = useStore((s) => s.feedback)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [multiAmounts, setMultiAmounts] = useState<Record<string, number>>({})
  const [textValue, setTextValue] = useState('')

  useEffect(() => {
    setBusy(false)
    setAmount(prompt?.min ?? 0)
    setSelected([])
    setMultiAmounts(Object.fromEntries((prompt?.items ?? []).map((item) => [item.id, item.defaultValue ?? item.min])))
    setTextValue('')
  }, [prompt?.method, prompt?.gameId])

  const filteredStringOptions = useMemo(() => {
    if (!prompt?.options) return []
    if (!textValue.trim()) return prompt.options
    const q = textValue.trim().toLowerCase()
    return prompt.options.filter((opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q))
  }, [prompt?.options, textValue])

  const send = async (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => {
    if (busy) return
    setBusy(true)
    try {
      isResultOk(await action(), fallback)
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    void send(() => cmds.sendPlayerBoolean(false, prompt!.gameId), t('errors', 'send_failed'))
  }

  const finishOptionalTarget = () => {
    void send(() => cmds.sendPlayerBoolean(false, prompt!.gameId), t('errors', 'send_failed'))
  }

  const selectOption = (option: FeedbackOption) => {
    if (!prompt) return
    if (prompt.mode === 'uuid' && prompt.max > 1) {
      setSelected((current) => current.includes(option.value)
        ? current.filter((value) => value !== option.value)
        : current.length < prompt.max ? [...current, option.value] : current)
      return
    }
    const current = prompt
    const venture = current.method === 'GAME_ASK' ? ventureChoiceFromPrompt(current.message, option.label) : null
    void send(async () => {
      const result = await sendValue(current, option.value)
      if (result.ok && venture) {
        const me = getState().game?.players?.find((p) => p.controlled)?.name ?? ''
        recordDungeonRoom(current.gameId, me, venture.dungeon, venture.room)
      }
      return result
    }, t('errors', 'send_failed'))
  }

  const confirmSelected = () => {
    if (!prompt) return
    const current = prompt
    void send(async () => {
      let result: { ok: boolean; error?: string } = { ok: true }
      for (const value of selected) {
        result = await sendValue(current, value)
        if (!result.ok) break
      }
      return result
    }, t('errors', 'send_failed'))
  }

  const confirmAmount = () => {
    if (!prompt) return
    if (prompt.mode === 'mana') {
      void send(() => cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, String(amount)), t('errors', 'send_failed_mana'))
      return
    }
    void send(() => cmds.sendPlayerInteger(amount, prompt.gameId), t('errors', 'send_failed_amount'))
  }

  const confirmMultiAmount = () => {
    if (!prompt) return
    const values = (prompt.items ?? []).map((item) => {
      const value = Math.max(item.min, Math.min(item.max, multiAmounts[item.id] ?? item.min))
      return value
    })
    const total = values.reduce((sum, value) => sum + value, 0)
    if (total < prompt.min || total > prompt.max) {
      setStoreError(t('game', 'sum_between', { min: prompt.min, max: prompt.max }))
      return
    }
    void send(() => cmds.sendPlayerString(values.join(' '), prompt.gameId), t('errors', 'send_failed_amount'))
  }

  return {
    prompt,
    busy,
    amount,
    setAmount,
    selected,
    setSelected,
    multiAmounts,
    setMultiAmounts,
    textValue,
    setTextValue,
    filteredStringOptions,
    send,
    cancel,
    finishOptionalTarget,
    selectOption,
    confirmSelected,
    confirmAmount,
    confirmMultiAmount,
  }
}
