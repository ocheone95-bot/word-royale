// Лениво загружает словарь при первом обращении и кэширует в локальный стейт.
// Пакет @word-royale/dictionary внутри тоже кэширует Set, так что повторные
// вызовы хука дешёвые.

import { useEffect, useState } from 'react'
import { loadDictionary } from '@word-royale/dictionary'

interface DictionaryState {
  dict: Set<string> | null
  error: Error | null
}

export function useDictionary(): DictionaryState {
  const [state, setState] = useState<DictionaryState>({ dict: null, error: null })

  useEffect(() => {
    let cancelled = false
    loadDictionary()
      .then((dict) => {
        if (!cancelled) setState({ dict, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            dict: null,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
