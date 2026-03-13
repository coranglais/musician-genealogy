import { SITE_NAME, SITE_ACRONYM } from '../constants'

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-stone-800 mb-6">{SITE_NAME}</h1>

      <div className="space-y-4 text-stone-600 leading-relaxed">
        <p>
          Musical knowledge travels person to person — teacher to student,
          generation to generation. {SITE_NAME} exists to map that transmission:
          every instrument, every tradition, every teacher, regardless of fame or
          prestige.
        </p>
        <p>
          We believe the studio teacher whose students never grace a concert hall
          is as much a part of music's living tradition as the celebrated
          pedagogue. This project is for all of them.
        </p>
        <p>
          {SITE_ACRONYM} is a community-built resource, free and open. If you
          studied with someone, you belong here. Add yourself. Add your teacher.
          Help us trace the roots.
        </p>
      </div>
    </div>
  )
}
