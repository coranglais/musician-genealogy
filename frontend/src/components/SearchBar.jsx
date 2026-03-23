import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { autocomplete } from '../api'

export default function SearchBar({ compact = false, autoFocus = false, onNavigate }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await autocomplete(query)
        setSuggestions(results)
        setShowDropdown(results.length > 0)
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
      }
    }, 250)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSubmit(e) {
    e.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      navigate(`/musician/${suggestions[activeIndex].musician_id}`)
    } else if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
    setShowDropdown(false)
    onNavigate?.()
  }

  function handleKeyDown(e) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  function formatDates(s) {
    if (!s.birth_date && !s.death_date) return ''
    return `(${s.birth_date || '?'}–${s.death_date || ''})`
  }

  return (
    <div ref={wrapperRef} className="relative">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder="Search musicians..."
          className={`w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-stone-900
            placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200
            ${compact ? 'text-sm py-1.5 px-3' : 'text-base'}`}
        />
      </form>

      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={s.musician_id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${i === activeIndex ? 'bg-amber-50 text-amber-900' : 'text-stone-800 hover:bg-stone-50'}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  navigate(`/musician/${s.musician_id}`)
                  setShowDropdown(false)
                  setQuery('')
                  onNavigate?.()
                }}
              >
                <span className="font-medium">{s.display_name}</span>
                {formatDates(s) && (
                  <span className="ml-2 text-stone-400">{formatDates(s)}</span>
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 border-t border-stone-100"
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(query.trim())}`)
                setShowDropdown(false)
                onNavigate?.()
              }}
            >
              Search all results for "<span className="font-medium text-stone-700">{query}</span>"
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
