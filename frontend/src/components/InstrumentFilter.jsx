import { useState, useEffect, Fragment } from 'react'
import { listInstruments } from '../api'

export default function InstrumentFilter({ value, onChange }) {
  const [instruments, setInstruments] = useState([])

  useEffect(() => {
    listInstruments().then(setInstruments).catch(() => {})
  }, [])

  // Group primary instruments by family, with companions nested under parent
  const families = {}
  for (const inst of instruments) {
    if (!inst.parent_id) {
      if (!families[inst.family]) families[inst.family] = []
      families[inst.family].push(inst)
    }
  }

  const sortedFamilies = Object.entries(families).sort(([a], [b]) => a.localeCompare(b))

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}
      className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800
        focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
    >
      <option value="">All Instruments</option>
      {sortedFamilies.map(([family, parents]) => (
        <optgroup key={family} label={family}>
          {parents.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
            <Fragment key={p.id}>
              <option value={p.id}>{p.name}</option>
              {(p.companions || []).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                <option key={c.id} value={c.id}>
                  {'\u00A0\u00A0\u00A0\u00A0'}↳ {c.name}
                </option>
              ))}
            </Fragment>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
