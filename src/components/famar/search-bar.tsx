'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  onSearch?: (query: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({ onSearch, placeholder = 'Buscar productos...', autoFocus = false }: SearchBarProps) {
  const { searchQuery, setSearch, navigate } = useAppStore()
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const syncQuery = window.setTimeout(() => setLocalQuery(searchQuery), 0)
    return () => window.clearTimeout(syncQuery)
  }, [searchQuery])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleChange = (value: string) => {
    setLocalQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      onSearch?.(value)
    }, 300)
  }

  const handleClear = () => {
    setLocalQuery('')
    setSearch('')
    onSearch?.('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigate('catalog')
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-9"
      />
      {localQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-9 hover:bg-transparent"
          onClick={handleClear}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}
