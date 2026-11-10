import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from './useEscape'
import { useTranslation } from '../i18n'
import './Select.css'

export type SelectValue = string | number

export interface SelectOption<V extends SelectValue> {
  value: V
  label: ReactNode
  text?: string
  disabled?: boolean
  className?: string
  group?: ReactNode
}

export interface SelectSearch {
  query: string
  onQueryChange: (query: string) => void
  label?: string
  placeholder?: string
  onEnter?: (query: string) => boolean
  empty?: boolean
}

export interface SelectProps<V extends SelectValue> {
  value?: V
  selectedValues?: readonly V[]
  multiple?: boolean
  options: readonly SelectOption<V>[]
  onChange: (value: V) => void
  keepOpen?: (value: V) => boolean
  summary?: ReactNode
  search?: SelectSearch
  boundary?: string
  panelTestId?: string
  id?: string
  className?: string
  title?: string
  disabled?: boolean
  searchable?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

export const SELECT_SEARCH_THRESHOLD = 12
const PANEL_GAP = 6
const VIEWPORT_MARGIN = 8
const MIN_PANEL_HEIGHT = 120
const TYPEAHEAD_RESET_MS = 600

export function normalizeOptionText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim()
}

export function optionText<V extends SelectValue>(option: SelectOption<V>): string {
  if (option.text != null) return option.text
  if (typeof option.label === 'string' || typeof option.label === 'number') return String(option.label)
  return String(option.value)
}

function surfaceClassOf(el: Element | null): string {
  const surface = el?.closest('.chrome-surface, .board-surface')
  if (!surface) return ''
  return surface.classList.contains('chrome-surface') ? 'chrome-surface' : 'board-surface'
}

function nameOf(trigger: HTMLButtonElement | null, ariaLabel?: string, labelledBy?: string): string | undefined {
  if (ariaLabel) return ariaLabel
  if (!trigger) return undefined
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (text) return text
  }
  const label = trigger.labels?.[0]
  if (!label) return undefined
  const clone = label.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button, [role="combobox"]').forEach((n) => n.remove())
  return clone.textContent?.trim() || undefined
}

export default function Select<V extends SelectValue>({
  value,
  selectedValues,
  multiple = false,
  options,
  onChange,
  keepOpen,
  summary,
  search,
  boundary,
  panelTestId,
  id,
  className = '',
  title,
  disabled = false,
  searchable,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'data-testid': testId,
}: SelectProps<V>) {
  const { t } = useTranslation()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [ownQuery, setOwnQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [surface, setSurface] = useState('')
  const [listName, setListName] = useState<string | undefined>(undefined)
  const [navByKey, setNavByKey] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const openedByKey = useRef(false)

  const query = search ? search.query : ownQuery
  const withSearch = search ? true : searchable ?? options.length > SELECT_SEARCH_THRESHOLD
  const isSelected = useCallback(
    (option: SelectOption<V>) => (selectedValues ? selectedValues.includes(option.value) : option.value === value),
    [selectedValues, value],
  )
  const picksWhileClosed = !multiple && !selectedValues
  const selected = options.find(isSelected)
  const visible = useMemo(() => {
    const needle = normalizeOptionText(query)
    if (search || !needle) return options
    return options.filter((o) => normalizeOptionText(optionText(o)).includes(needle))
  }, [options, query, search])
  const showEmpty = search?.empty ?? visible.length === 0

  const firstEnabled = useCallback((list: readonly SelectOption<V>[], from = 0, step = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) {
      if (!list[i].disabled) return i
    }
    return -1
  }, [])

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setOwnQuery('')
    if (returnFocus) triggerRef.current?.focus()
  }, [])
  const closeOnEscape = useCallback(() => close(true), [close])
  useEscape(closeOnEscape, open)

  const openList = (byKey = false) => {
    if (disabled) return
    openedByKey.current = byKey
    const index = options.findIndex(isSelected)
    setActive(index >= 0 && !options[index].disabled ? index : firstEnabled(options))
    setOwnQuery('')
    setNavByKey(false)
    setSurface(surfaceClassOf(triggerRef.current))
    setListName(nameOf(triggerRef.current, ariaLabel, ariaLabelledBy))
    setOpen(true)
  }

  const choose = (option: SelectOption<V> | undefined) => {
    if (!option || option.disabled) return
    if (multiple || !isSelected(option)) onChange(option.value)
    if (multiple || keepOpen?.(option.value)) return
    close(true)
  }

  useEffect(() => {
    if (disabled && open) close(false)
  }, [disabled, open, close])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return
      const rect = trigger.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      panel.style.minWidth = `${rect.width}px`
      const below = vh - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN
      const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN
      const up = panel.scrollHeight > below && above > below
      panel.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT, up ? above : below)}px`
      panel.style.top = up ? '' : `${rect.bottom + PANEL_GAP}px`
      panel.style.bottom = up ? `${vh - rect.top + PANEL_GAP}px` : ''
      const width = panel.getBoundingClientRect().width || panel.offsetWidth
      const limit = boundary ? trigger.closest(boundary)?.getBoundingClientRect().right : undefined
      const right = Math.min(vw - VIEWPORT_MARGIN, limit ?? Number.POSITIVE_INFINITY)
      const overflowsRight = rect.left + width > right
      panel.style.left = `${overflowsRight ? Math.max(VIEWPORT_MARGIN, rect.right - width) : rect.left}px`
      panel.dataset.side = up ? 'top' : 'bottom'
      panel.dataset.align = overflowsRight ? 'end' : 'start'
    }
    place()
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      place()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, visible.length, boundary])

  useEffect(() => {
    if (!open || !withSearch) return
    if (window.matchMedia?.('(pointer: coarse)').matches && !openedByKey.current) return
    searchRef.current?.focus()
  }, [open, withSearch])

  const activeId = open && active >= 0 && active < visible.length ? `${listId}-${active}` : undefined
  useEffect(() => {
    if (!activeId) return
    document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  const moveActive = (key: string): boolean => {
    const last = visible.length - 1
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(key)) setNavByKey(true)
    switch (key) {
      case 'ArrowDown': {
        const next = firstEnabled(visible, active + 1)
        if (next >= 0) setActive(next)
        return true
      }
      case 'ArrowUp': {
        const prev = firstEnabled(visible, Math.min(active - 1, last), -1)
        if (prev >= 0) setActive(prev)
        return true
      }
      case 'Home':
        setActive(firstEnabled(visible))
        return true
      case 'End':
        setActive(firstEnabled(visible, last, -1))
        return true
      case 'PageDown': {
        const next = firstEnabled(visible, Math.min(active + 10, last))
        setActive(next >= 0 ? next : firstEnabled(visible, last, -1))
        return true
      }
      case 'PageUp': {
        const prev = firstEnabled(visible, Math.max(active - 10, 0), -1)
        setActive(prev >= 0 ? prev : firstEnabled(visible))
        return true
      }
      default:
        return false
    }
  }

  const typeaheadMatch = (key: string): number => {
    const now = Date.now()
    const state = typeahead.current
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? key : state.text + key
    state.at = now
    const needle = normalizeOptionText(state.text)
    const repeated = needle.length > 1 && [...needle].every((c) => c === needle[0])
    const prefix = repeated ? needle[0] : needle
    const current = open ? active : options.findIndex(isSelected)
    const start = repeated || needle.length === 1 ? current + 1 : Math.max(current, 0)
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length
      const option = options[i]
      if (!option.disabled && normalizeOptionText(optionText(option)).startsWith(prefix)) return i
    }
    return -1
  }

  const isPrintable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList(true)
        return
      }
      if (isPrintable(e) && picksWhileClosed) {
        const index = typeaheadMatch(e.key)
        if (index >= 0 && options[index].value !== value) onChange(options[index].value)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'Tab') {
      close(false)
      return
    }
    if (e.key === 'Enter' || (e.key === ' ' && Date.now() - typeahead.current.at > TYPEAHEAD_RESET_MS)) {
      e.preventDefault()
      choose(visible[active])
      return
    }
    if (moveActive(e.key)) {
      e.preventDefault()
      return
    }
    if (isPrintable(e)) {
      e.preventDefault()
      const index = typeaheadMatch(e.key)
      if (index >= 0) {
        setActive(index)
        setNavByKey(true)
      }
    }
  }

  const onTriggerKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ') e.preventDefault()
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!navByKey && search?.onEnter?.(search.query)) {
        if (!multiple) close(true)
        return
      }
      choose(visible[active])
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp') && moveActive(e.key)) {
      e.preventDefault()
    }
  }

  const onQueryChange = (next: string) => {
    if (search) {
      search.onQueryChange(next)
      setActive(0)
      return
    }
    setOwnQuery(next)
    const needle = normalizeOptionText(next)
    const list = needle ? options.filter((o) => normalizeOptionText(optionText(o)).includes(needle)) : options
    setActive(firstEnabled(list))
  }

  const panel = open && (
    <div
      ref={panelRef}
      className={['ui-select-panel', surface].filter(Boolean).join(' ')}
      data-nav={navByKey ? 'keys' : undefined}
      data-testid={panelTestId ?? (testId ? `${testId}-panel` : undefined)}
    >
      {withSearch && (
        <input
          ref={searchRef}
          className="ui-select-search"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={search?.label ?? t('common', 'search')}
          placeholder={search?.placeholder ?? t('common', 'search')}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      )}
      <div id={listId} role="listbox" aria-label={listName} aria-multiselectable={multiple || undefined} className="ui-select-list">
        {visible.map((option, i) => {
          const chosen = isSelected(option)
          const cls = [
            'ui-select-option',
            chosen ? 'is-selected' : '',
            i === active ? 'is-active' : '',
            option.disabled ? 'is-disabled' : '',
            option.className ?? '',
          ].filter(Boolean).join(' ')
          const header = option.group != null && (i === 0 || visible[i - 1].group !== option.group)
          return (
            <Fragment key={String(option.value)}>
            {header && <div className="ui-select-group" role="presentation">{option.group}</div>}
            <div
              id={`${listId}-${i}`}
              role="option"
              aria-selected={chosen}
              aria-disabled={option.disabled || undefined}
              className={cls}
              onPointerDown={(e) => e.preventDefault()}
              onPointerMove={() => {
                if (navByKey) setNavByKey(false)
                if (!option.disabled && i !== active) setActive(i)
              }}
              onClick={() => choose(option)}
            >
              {multiple && <span className="ui-select-check" aria-hidden="true">{chosen ? '✓' : ''}</span>}
              <span className="ui-select-option-label">{option.label}</span>
            </div>
            </Fragment>
          )
        })}
        {showEmpty && (
          <p className="ui-select-empty" role="status">{t('decks', 'builder_search_no_results', { query: query.trim() })}</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !withSearch ? activeId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        data-testid={testId}
        className={['ui-select-trigger', open ? 'is-open' : '', className].filter(Boolean).join(' ')}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onTriggerKeyDown}
        onKeyUp={onTriggerKeyUp}
      >
        <span className="ui-select-value">{summary ?? selected?.label ?? ''}</span>
        <span className="ui-select-chevron" aria-hidden="true" />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  )
}
