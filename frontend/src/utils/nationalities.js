import data from '../content/nationalities.json'

const allNationalities = [
  ...data.current.map(name => ({ name, display: name, section: 'current' })),
  ...data.historical.map(h => ({
    name: h.name,
    display: `${h.name} (${h.note})`,
    section: 'historical',
  })),
  ...data.compound.map(name => ({ name, display: name, section: 'compound' })),
]

export function searchNationalities(query) {
  const q = query.toLowerCase()
  return Promise.resolve(
    allNationalities.filter(n => n.name.toLowerCase().includes(q)).slice(0, 12)
  )
}
