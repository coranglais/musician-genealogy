import { useState, useEffect, useRef } from 'react'

export default function AutocompleteInput({
  label,
  value,
  onChange,
  onSearch,
  onSelect,
  renderItem,
  getItemKey,
  required = false,
  placeholder = '',
  minChars = 2,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
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
    if (value.length < minChars) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(value)
        setSuggestions(results)
        setShowDropdown(results.length > 0)
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
      }
    }, 250)

    return () => clearTimeout(debounceRef.current)
  }, [value])

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
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      onSelect(suggestions[activeIndex])
      setShowDropdown(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-stone-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-800
          focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-stone-200 bg-white shadow-lg
          overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((item, i) => (
            <li key={getItemKey(item)}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors
                  ${i === activeIndex ? 'bg-amber-50 text-amber-900' : 'text-stone-800 hover:bg-stone-50'}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onSelect(item)
                  setShowDropdown(false)
                }}
              >
                {renderItem(item, i === activeIndex)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
