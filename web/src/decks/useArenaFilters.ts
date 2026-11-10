import { useState } from 'react'
import type { Rarity, StatFilter } from './filterQuery'

/** Estado de los filtros de la barra Arena (Buscar y Sugerencias comparten
 *  controles pero mantienen instancias independientes). */
export function useArenaFilters() {
  const [rawQuery, setRawQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [cmcFilter, setCmcFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(new Set())
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set())
  const [powerFilter, setPowerFilter] = useState<StatFilter | null>(null)
  const [toughnessFilter, setToughnessFilter] = useState<StatFilter | null>(null)
  const [setFilter, setSetFilter] = useState<string | null>(null)
  const [oracleText, setOracleText] = useState('')

  const toggleColor = (color: string) => {
    setColorFilter((prev) => {
      const next = new Set(prev)
      if (next.has(color)) {
        next.delete(color)
      } else if (color === 'C') {
        next.clear()
        next.add('C')
      } else {
        next.delete('C')
        next.add(color)
      }
      return next
    })
  }

  const toggleRarity = (rarity: Rarity) => {
    setRarityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(rarity)) next.delete(rarity)
      else next.add(rarity)
      return next
    })
  }

  const toggleType = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const toggleKeyword = (keyword: string) => {
    setKeywordFilter((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  const reset = () => {
    setRawQuery('')
    setColorFilter(new Set())
    setCmcFilter(null)
    setTypeFilter(new Set())
    setRarityFilter(new Set())
    setKeywordFilter(new Set())
    setPowerFilter(null)
    setToughnessFilter(null)
    setSetFilter(null)
    setOracleText('')
  }

  return {
    rawQuery,
    setRawQuery,
    colorFilter,
    toggleColor,
    cmcFilter,
    setCmcFilter,
    typeFilter,
    toggleType,
    setTypeFilter,
    rarityFilter,
    toggleRarity,
    keywordFilter,
    toggleKeyword,
    powerFilter,
    setPowerFilter,
    toughnessFilter,
    setToughnessFilter,
    setFilter,
    setSetFilter,
    oracleText,
    setOracleText,
    reset,
  }
}
