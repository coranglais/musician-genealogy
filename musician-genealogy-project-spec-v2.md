# Musician Genealogy Project — Specification Document (v2)

## Project Overview

A modern web application for exploring pedagogical genealogies of musicians — who studied with whom, where, and when. The project launches with **oboe** as the inaugural instrument but is designed from day one to support any instrument. The long-term vision includes importing an existing pianist genealogy dataset (~5,000 records) and expanding to other instruments.

The core differentiator from existing genealogy sites (which tend to be flat searchable tables) is an **interactive tree visualization** that lets users explore teacher-student lineages visually.

### Project Name

**TBD** — working candidates include: MusicLineage, StudioTree, Pedagogical Tree, or a musical term. The codebase should use `musician-genealogy` as the repo/project name until a final name is chosen.

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | **FastAPI** (Python) | REST API with automatic OpenAPI docs |
| Database | **PostgreSQL** | Via Railway managed Postgres; use **SQLAlchemy** ORM so code is DB-agnostic (SQLite works for local dev) |
| Migrations | **Alembic** | Schema versioning |
| Frontend | **React** (Vite) | SPA with React Router |
| Tree Visualization | **D3.js** | Force-directed or hierarchical tree layout |
| Search | PostgreSQL full-text search + **unidecode** for diacritical-normalized matching |
| Deployment | **Railway** | Backend + Postgres + static frontend |
| HTTPS | Railway provides this automatically |

---

## Editorial and Governance Model

### Centrally Managed, Not Self-Service

This project uses a **curated editorial model**. All data is managed by editors (initially just the project owner). Users cannot directly create or modify their own entries in the tree.

**Rationale:** A self-service model invites problems that undermine credibility: people inflating casual encounters into formal study, disputes about who really studied with whom, people inserting themselves into prestigious lineages, and outright fabrication. The oboe world is small enough that inaccuracies would be noticed quickly. The pianist-genealogy.com project (Robert Craig) has successfully used a curated model for 5,000+ entries. Editorial control is what gives a genealogy site its authority.

### Contribution Workflow

Anyone can **suggest** additions or corrections via a structured submission form, but submissions enter a **review queue** and are only published after editorial approval.

Submission form fields:

- Submitter name and email (required)
- Relationship: I studied with [teacher] at [institution] from [year] to [year]
- Relationship type (dropdown: formal study, private lessons, masterclass, workshop/festival, other)
- Supporting information and notes (free text)
- How can we verify this? (free text, e.g. Check the 2003 Aspen Music Festival roster)

Workflow states:

- **Submitted** — visible only to submitter and editors
- **Under Review** — editor is researching and verifying
- **Approved** — published to the tree
- **Rejected** — with editor note explaining why (not publicly visible)

Editors can also add data directly without going through the submission queue (for batch imports, research, etc.).

### Future: Trusted Contributors

If the project grows, a trusted contributor role could allow vetted individuals (e.g., university professors, known community members) to submit data with lighter-touch review. This is a Phase 5+ consideration, not a launch feature.

---

## Relationship Types and Visual Weighting

### The Spectrum of Musical Influence

Not all teacher-student relationships are equal. The data model captures the nature of the relationship, and the tree visualization reflects this visually.

| Type | Code | Description | Visual Weight |
|------|------|-------------|---------------|
| Conservatory/University Study | formal_study | Enrolled student studying with a professor over semesters/years. The core of pedagogical lineage. | **Solid line** (primary) |
| Private Study | private_study | Regular private lessons outside an institution, typically over an extended period. | **Solid line** (primary) |
| Apprenticeship | apprenticeship | Extended mentorship, often within an orchestra or ensemble. | **Solid line** (primary) |
| Summer Festival / Intensive | festival | Multi-week study at a festival (Aspen, Tanglewood, Interlochen, etc.), especially if repeated over multiple summers. | **Dashed line** (secondary) |
| Masterclass | masterclass | A single or small number of masterclass sessions. Can be impactful but is not sustained study. | **Dotted line** (tertiary) |
| Workshop | workshop | Short-term group instruction. | **Dotted line** (tertiary) |
| Informal Mentorship | informal | Worked with — significant artistic influence without formal student-teacher structure. E.g., Alan Vogel working with Lothar Koch on a Fulbright. | **Dashed line** (secondary) |

### Visualization Behavior

- **Default view:** Show only primary relationships (solid lines). This keeps the core pedagogical tree clean and readable.
- **Show all connections toggle:** Reveals secondary and tertiary relationships as dashed/dotted lines.
- **Node click/hover:** Always shows ALL relationships for the selected musician regardless of current filter, so users can discover the full picture for any individual.
- The editorial decision about whether a given relationship is significant enough to include at all (regardless of type) is made by the editor during the review process. Not every masterclass needs to be in the database.

---

## Data Model

### Core Entities

#### instruments

Reference table for instruments, voice, and disciplines. Multi-instrument from day one. This table covers not just instruments but also voice and non-instrument disciplines like composition and conducting — the pedagogical lineage patterns are identical.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR(100) | e.g., Oboe, Piano, Violin, Voice, Composer, Conductor |
| family | VARCHAR(50) | e.g., Woodwind, Keyboard, String, Voice, Discipline |
| created_at | TIMESTAMP | |

The family column distinguishes true instruments from disciplines, enabling sensible grouping in the UI:
- Woodwind: Oboe, Flute, Clarinet, Bassoon, etc.
- Brass: Trumpet, Horn, Trombone, Tuba, etc.
- String: Violin, Viola, Cello, Bass, etc.
- Keyboard: Piano, Organ, Harpsichord, etc.
- Percussion: Timpani, Percussion, etc.
- Voice: Voice (could subdivide by range later if needed)
- Discipline: Composer, Conductor, Music Theory, etc.

#### musicians

The central entity. One row per person.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| last_name | VARCHAR(200) | Primary display name, use the canonical correct spelling |
| first_name | VARCHAR(200) | |
| birth_date | VARCHAR(50) | Free text to handle partial dates like 1936 or c. 1820 |
| death_date | VARCHAR(50) | Free text, nullable |
| nationality | VARCHAR(100) | Nullable |
| bio_notes | TEXT | Free-form biographical notes |
| name_search | VARCHAR(500) | Auto-generated: lowercased, diacriticals stripped via unidecode, for search |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Design note on dates:** Dates are stored as free text strings rather than DATE columns because historical records frequently have partial dates (July 1795), approximate dates (c. 1820), or no dates at all. Display and sort by these fields should handle this gracefully.

**Design note on names:** The canonical name should be the single correct spelling. Common misspellings (e.g., Tabetau for Tabuteau) should NOT be stored as alternate names — they are simply errors, and fuzzy search handles them. The alternate names table is reserved for legitimate variants: transliterations, maiden/married names, diacritical forms, stage names, etc.

#### musician_names

Handles legitimate alternate names. Musicians can have many name variants (up to 10+ in some cases). Supports diacritical variants, transliterations, maiden/married names, etc.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| musician_id | FK to musicians | |
| name | VARCHAR(400) | The alternate name as displayed |
| name_search | VARCHAR(400) | Normalized for search |
| name_type | VARCHAR(50) | e.g., transliteration, maiden_name, stage_name, diacritical_variant |

**Not for misspellings.** Common misspellings are handled by fuzzy/partial search, not by polluting this table.

#### musician_instruments

Many-to-many: a musician can play multiple instruments; an instrument has many players.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| musician_id | FK to musicians | |
| instrument_id | FK to instruments | |
| is_primary | BOOLEAN | Default true |

#### lineage

The heart of the project. Each row represents a teacher to student relationship. This is a DAG (directed acyclic graph), not a tree — students routinely have multiple teachers (Titus Underwood has approximately 8, Linda Stroman has 5).

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| teacher_id | FK to musicians | |
| student_id | FK to musicians | |
| institution_id | FK to institutions | Nullable, not always known |
| start_year | INTEGER | Nullable |
| end_year | INTEGER | Nullable |
| relationship_type | VARCHAR(50) | One of: formal_study, private_study, apprenticeship, festival, masterclass, workshop, informal (see Relationship Types section) |
| notes | TEXT | e.g., Studied summers only, Fulbright fellowship |
| created_at | TIMESTAMP | |

**Unique constraint** on (teacher_id, student_id, institution_id) to prevent exact duplicates while allowing the same teacher-student pair at different institutions.

#### institutions

Conservatories, universities, festivals where study occurred.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR(300) | Current or most common name |
| city | VARCHAR(100) | |
| country | VARCHAR(100) | |
| founded_year | INTEGER | Nullable |
| created_at | TIMESTAMP | |

#### institution_names

Tracks historical name changes. The Paris Conservatoire alone has had many names over the centuries.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| institution_id | FK to institutions | |
| name | VARCHAR(300) | Historical name |
| start_year | INTEGER | Nullable, when this name was in use |
| end_year | INTEGER | Nullable |

#### sources

Where lineage data came from. Critical for credibility.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| title | VARCHAR(500) | e.g., book title, article title |
| author | VARCHAR(300) | Nullable |
| source_type | VARCHAR(50) | book, interview, web, personal_communication, program_notes |
| url | VARCHAR(500) | Nullable, for web sources |
| isbn | VARCHAR(20) | Nullable, for books |
| notes | TEXT | Nullable |

#### lineage_sources

Many-to-many: a lineage relationship can be attested by multiple sources.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| lineage_id | FK to lineage | |
| source_id | FK to sources | |
| page_reference | VARCHAR(100) | Nullable, e.g. pp. 234-236 |

#### submissions

The contribution/review queue. Public users submit suggested additions or corrections here.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| submitter_name | VARCHAR(200) | |
| submitter_email | VARCHAR(200) | |
| submission_type | VARCHAR(50) | new_musician, new_relationship, correction, other |
| teacher_name | VARCHAR(300) | Free text, may not match existing records |
| student_name | VARCHAR(300) | Free text |
| institution_name | VARCHAR(300) | Free text, nullable |
| relationship_type | VARCHAR(50) | From the standard type codes |
| start_year | INTEGER | Nullable |
| end_year | INTEGER | Nullable |
| notes | TEXT | Free-form details from submitter |
| verification_info | TEXT | How can we verify this? |
| status | VARCHAR(20) | submitted, under_review, approved, rejected |
| editor_notes | TEXT | Internal notes from editor during review |
| created_at | TIMESTAMP | |
| reviewed_at | TIMESTAMP | Nullable |

---

## API Design

### Base URL: /api/v1/

#### Musicians
- GET /musicians — List/search. Params: q, instrument, page, per_page
- GET /musicians/{id} — Full detail with alternate names, instruments, bio
- GET /musicians/{id}/lineage — Recursive tree. Params: depth (default 3), include_secondary (default false)
- GET /musicians/{id}/teachers — Direct teachers only
- GET /musicians/{id}/students — Direct students only
- POST /musicians — Create (admin auth)
- PUT /musicians/{id} — Update (admin auth)

#### Lineage
- GET /lineage — List with filters
- POST /lineage — Create relationship (admin auth)
- PUT /lineage/{id} — Update (admin auth)
- DELETE /lineage/{id} — Remove (admin auth)

#### Instruments
- GET /instruments — List all
- GET /instruments/{id}/musicians — Musicians for an instrument

#### Institutions
- GET /institutions — List/search
- GET /institutions/{id} — Detail with historical names

#### Search
- GET /search — Global search across musicians, institutions. Normalized matching. Categorized results.

#### Submissions (Public)
- POST /submissions — Submit suggestion. No auth. Returns ID.
- GET /submissions/{id}/status — Check status (ID + submitter email).

#### Submissions (Admin)
- GET /admin/submissions — List with status filter. Admin auth.
- PUT /admin/submissions/{id} — Update status/notes. Admin auth.

### Search Implementation

1. On create/update, generate name_search via unidecode() + lowercase.
2. On queries, normalize input the same way.
3. PostgreSQL ILIKE on normalized fields for partial matching.
4. Also search musician_names for alternate name matches.
5. Rank: exact > starts-with > contains.

### Lineage Tree Query (Recursive CTE)

```sql
WITH RECURSIVE ancestors AS (
    SELECT teacher_id, student_id, relationship_type, 1 as depth
    FROM lineage WHERE student_id = :musician_id
    -- When include_secondary=false: AND relationship_type IN ('formal_study','private_study','apprenticeship')
    UNION ALL
    SELECT l.teacher_id, l.student_id, l.relationship_type, a.depth + 1
    FROM lineage l JOIN ancestors a ON l.student_id = a.teacher_id
    WHERE a.depth < :max_depth
)
SELECT DISTINCT m.*, a.depth, a.relationship_type
FROM ancestors a JOIN musicians m ON m.id = a.teacher_id;
```

Return nested JSON with visual_weight derived from relationship_type.

---

## Frontend Architecture

### Routes
- / — HomePage: search bar, featured lineages, instrument filter
- /search?q=... — SearchResults: paginated, instrument facets
- /musician/:id — MusicianDetail: bio + interactive tree
- /musician/:id/tree — FullTree: full-page visualization
- /instrument/:id — InstrumentPage: browse musicians
- /submit — SubmissionForm: community contributions
- /about — AboutPage: sources, credits, editorial policy

### Interactive Tree Visualization (Key Feature)
- Bidirectional: teachers UP, students DOWN from selected root
- Expandable nodes: click to lazy-load via API
- Visual weight: Solid=primary, Dashed=secondary, Dotted=tertiary
- Show all connections toggle (default: primary only)
- Node hover/click: shows ALL relationships regardless of filter
- Zoom, pan (D3 zoom behavior)
- Layout options: vertical tree (default), horizontal, force-directed
- Responsive with mobile touch support

D3: d3.hierarchy() + d3.tree() with formal_study/private_study as backbone. Overlay secondary/tertiary as dashed/dotted. Force-directed fallback for complex DAGs.


---

## Search Architecture: Multilingual, Fuzzy, Cross-Script

The search system must serve an international community. Four distinct problems:

### Problem 1: Typos and Bad Spelling (Fuzzy Matching)

Use PostgreSQL pg_trgm (trigram) extension.

Setup:
- CREATE EXTENSION IF NOT EXISTS pg_trgm;
- GIN trigram indexes on name_search columns
- similarity() function and percent operator for fuzzy matching
- Default similarity_threshold of 0.3

Result: Ferillo matches ferrillo at ~0.85. Gomburg matches gomberg at ~0.7.

### Problem 2: Transliteration Variants (Systematic, Not Errors)

Rachmaninoff vs Rachmaninov vs Rachmaninow. Different romanization systems, all legitimate.

Solution: musician_names table with name_type = transliteration. Curated editorial decision. Patterns by source language:

- Russian: Multiple romanization systems. -off/-ov/-ow endings. Ch/C/Tch. Sh/S.
- Chinese: Pinyin vs Wade-Giles vs informal. Tonal marks optional.
- Japanese: Hepburn vs Kunrei-shiki. Long vowels (ou/o/oh).
- Czech/Polish/Hungarian: Diacritical stripping via unidecode plus established anglicized forms.
- Arabic/Farsi: Highly variable romanization.
- Korean: Revised Romanization vs McCune-Reischauer vs informal.

Auto-complete queries both canonical name_search AND musician_names entries.

### Problem 3: Cross-Script Search (Cyrillic, CJK, etc.)

unidecode transliterates non-Latin scripts to ASCII approximations:
- Cyrillic -> approximate romanization (trigram matches against stored variants)
- Chinese -> Mandarin reading (may not match actual romanized name)
- Japanese katakana -> approximate (needs trigram fuzzy)

Pipeline: input -> unidecode() -> lowercase -> trigram search. Combined with stored transliteration variants covers most cross-script queries.

Limitation: For important musicians with CJK names, store correct romanization in musician_names.

### Problem 4: Auto-Complete UX

Both search bar and submission form provide auto-complete.

Endpoint: GET /api/v1/search/autocomplete?q=fer&limit=8

Strategy:
1. Prefix match on musicians.name_search (fast starts-with)
2. Trigram similarity on musicians.name_search (fuzzy)
3. Same against musician_names.name_search (transliterations)
4. Merge, deduplicate by musician_id, rank by best score
5. Return: musician_id, display_name, dates, match_score, matched_via

On submission form: double duty - finds existing musicians (reduces duplicates) and soft validation. No match shows: We do not have this person yet, we will add them if approved.

Debounce: 2+ chars, 200-300ms.

### PostgreSQL Search Setup

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_musicians_name_trgm ON musicians USING gin (name_search gin_trgm_ops);
CREATE INDEX idx_musician_names_trgm ON musician_names USING gin (name_search gin_trgm_ops);

Combined auto-complete query uses similarity() across both tables, DISTINCT ON musician_id, ordered by match_score DESC.

---

## Localization (i18n / L10n)

International art form, international platform. Three layers.

### Layer 1: UI Localization

All user-facing strings externalized into JSON translation files. No hardcoded English.

Technology: react-i18next + JSON files per locale.

Structure: frontend/src/locales/{en,fr,de}/common.json, search.json, musician.json, submit.json, about.json

Launch: English. Priority additions: French and German (covers most of the oboe world and its literature).

Future (community demand): Spanish, Russian, Chinese, Japanese, Korean, Italian, Czech, Dutch.

Backend: API errors respect Accept-Language header, fallback English.

Language selector in site header. Persisted via cookie. Default to browser language.

### Layer 2: Data Display Localization

Dates: Format per locale. 3 March 1887 vs 3 mars 1887 vs 3. Maerz 1887. Best-effort since dates are free text: parse full dates and reformat, pass partial dates through.

Institution names: institution_names table gains optional locale column, serving double duty:
- Row with locale=NULL and start/end years = historical name tracking
- Row with locale=fr/en/de and no years = localized display name
- API returns locale-matched name when available, canonical fallback

Musician display names: Locale-aware formatter handles Last-First vs First-Last conventions.

Relationship type labels: Internal codes are not user-facing. Display labels localized: Formal Study / Etudes formelles / Regulaeres Studium. Masterclass / Cours de maitre / Meisterkurs.

### Layer 3: Content Localization (Future, Phase 5+)

Multilingual bios are a major editorial burden. Launch with English bio_notes only. Future content_translations table possible. Do NOT build in Phase 1-4.

### Data Model Update

institution_names table adds locale column:
- locale VARCHAR(10), nullable
- NULL = historical name (existing behavior)
- fr/en/de etc = localized display name

### i18n Notes for Claude Code

1. react-i18next with browser language detection, fallback en. useTranslation() everywhere.
2. Small page-scoped translation files for lazy loading.
3. Intl.DateTimeFormat where dates are parseable.
4. Institution API accepts Accept-Language, returns locale-matched name or canonical fallback.
5. Auto-complete is language-agnostic (normalized ASCII). No localization needed for search matching.
6. Use logical CSS properties (margin-inline-start not margin-left) from start for future RTL support.


---

## Seed Data: Oboe Genealogy

Compiled from general knowledge and Danny Cruz's article "Who was your oboe teacher's teacher?" (oboefiles.com, including comments). All data should be verified against authoritative sources.

**Note:** Danny Cruz explicitly wants to build an interactive oboe family tree. Potential collaborator.
**Note on spelling:** Tabuteau is the only correct spelling. Variants are errors.

### The French Root

- **Georges Gillet** (1854-1920) — Professor, Paris Conservatoire. Established the French school.
  - Students: A.M.R. Barret, Georges Longy, Marcel Tabuteau
- **Georges Longy** — Principal oboe, BSO. Founded Longy School of Music.

### Marcel Tabuteau and the American School

- **Marcel Tabuteau** (1887-1966) — Studied with Gillet, Paris Conservatoire. Principal oboe, Philadelphia Orchestra (1915-1954). Professor, Curtis Institute. Founder of American school of oboe playing.
  - Students: John de Lancie, John Mack, Robert Bloom, Marc Lifschey, Harold Gomberg, Ralph Gomberg, Wayne Rapier, Laila Storch, Radames Angelucci, Bill Criss

### Generation 2: Tabuteau's Major Students

- **John de Lancie** (1921-2002) — Curtis. Principal oboe, Philadelphia Orchestra (1954-1977). Director of Curtis. Commissioned Strauss Oboe Concerto.
  - Students: Richard Woodhams, John Ferrillo, James Caldwell, Robert Walters (all Curtis)
- **Robert Bloom** (1908-1976) — Principal oboe multiple orchestras. Yale and Juilliard. Championed Bach cantatas.
  - Students: Ray Still, Richard Killmer, Bob Atherholt (Juilliard), Steven Taylor, Alan Vogel, Linda Stroman, Jane Marvine
- **John Mack** (1927-2006) — Curtis. Principal oboe, Cleveland Orchestra (1965-2001).
  - Students: Elaine Douvas, Joseph Robinson, Robert Walters, Nicholas Stovall (CIM), Frank Rosenwein (CIM), Titus Underwood (CIM), Linda Stroman, Jane Marvine, Humbert Lucarelli
- **Harold Gomberg** (1916-1985) — Curtis. Principal oboe, NY Phil (1943-1977).
- **Ralph Gomberg** (1921-2006) — Curtis. Principal oboe, BSO (1950-1987).
  - Students: Eugene Izotov, Russ Deluna
- **Marc Lifschey** (1926-2000) — Curtis. Principal oboe, Cleveland Orch, SF Symphony, Met Opera.
  - Students: Jane Marvine
- **Wayne Rapier** (1938-) — Curtis. BSO. Faculty, NEC.
- **Laila Storch** (1921-2012) — Curtis. Tabuteau biographer. Faculty, U of Washington.
- **Radames Angelucci** — 1930s Tabuteau student. Principal oboe, Minneapolis/Minnesota Symphony (1936-1980+).
  - Students: Don (oboefiles commenter, 1961-1967)
- **Bill Criss** — Tabuteau student. Students: David Sherr

### Generation 3: Students of Tabuteau's Students

- **Ray Still** — Bloom student. Principal oboe, Chicago Symphony.
  - Students: Michael Henoch, Linda Stroman, Peter Cooper, Jane Marvine, Sherry Sylar, James Austin Smith, Russ Deluna
- **Richard Killmer** — Bloom student. Also Gower (Colorado State, undergrad) and Henderson (El Paso Symphony). Faculty, Eastman.
  - Students: Nancy Ambrose King (Eastman), Marion Kuszyk, Andrew Parker (Eastman), Jason Lichtenwalter, Rebecca Henderson (Eastman)
- **Richard Woodhams** (1949-) — De Lancie student, Curtis. Principal oboe, Philadelphia Orch (1977-2016).
  - Students: Katherine Needleman (Curtis), Linda Stroman, Titus Underwood
- **Elaine Douvas** (1952-) — Mack student. Principal oboe, Met Opera. Faculty, Juilliard.
  - Students: Pedro Diaz, Nathan Hughes, Julia Derosa, Ryan Roberts, Nicholas Stovall, Titus Underwood (all Juilliard), Frank Rosenwein
- **Joseph Robinson** (1940-) — Mack student. Principal oboe, NY Phil (1978-2005).
  - Students: Titus Underwood
- **John Ferrillo** — De Lancie student, Curtis. Principal oboe, BSO. Faculty, NEC.
- **Steven Taylor** — Bloom and Louis Wann student. Faculty, Yale.
  - Students: James Austin Smith
- **Bob Atherholt** — Bloom student, Juilliard. Faculty, Rice. Students: Titus Underwood
- **Alan Vogel** — Bloom student. Also Koch (Berlin, Fulbright, informal), F. Gillet, Marx. DMA Yale. Faculty, USC.
  - Students: Titus Underwood (Colburn, Artist Diploma 2013)
- **James Caldwell** — De Lancie student, Curtis. Faculty, Oberlin.
  - Students: Toyin Spelman Diaz (Oberlin), Marion Kuszyk, Jason Lichtenwalter
- **Robert Walters** — Curtis grad, both de Lancie and Mack. Faculty, Oberlin.

### Generation 4+

- **Pedro Diaz** — Douvas, Juilliard. Students: Ryan Roberts, Titus Underwood
- **Nathan Hughes** — Douvas, Juilliard. Students: Ryan Roberts, Nicholas Stovall, Titus Underwood
- **Nancy Ambrose King** — Killmer (Eastman), Mariotti and Sargous (Michigan). Students: Andrew Parker
- **Frank Rosenwein** — Mack (CIM) and Douvas. Principal oboe, Cleveland Orchestra.
- **Katherine Needleman** — Woodhams. Curtis faculty. Fourth generation from Tabuteau.
- **Philip Tondre** — Bourgue, David Walter, Holliger. Curtis faculty. European-American reunification.
- **Nicholas Stovall** — Mack (CIM), Douvas/Hughes (Juilliard). Principal oboe, NSO. Faculty, Peabody.
- **Titus Underwood** — ~8 teachers: Mack/Rosenwein/Rathbun (CIM), Douvas/Hughes/Diaz (Juilliard), Vogel (Colburn), Robinson, Gabriele, Atherholt. Faculty, Cincinnati Conservatory.
- **Michael Henoch** — Still. Asst principal, CSO. Faculty, Northwestern.
- **Linda Stroman** — Mack, Still, Woodhams, Bloom, Colburn. Faculty, Indiana U, Juilliard, LSU.
- **Mark Hill** — Roseman. Mentors: Killmer, Robinson, Randall, Holliger. Faculty, Maryland.
- **Peter Cooper** — Still and Gladys Elliot. Principal oboe, Colorado Symphony. Faculty, CU Boulder.
- **Eugene Izotov** — R. Gomberg, Velikanov, A. Izotov. Faculty, SF Conservatory.
- **Marion Kuszyk** — Caldwell and Killmer. (Same pairing as Henderson and Hannigan.)
- **Erin Hannigan** — Caldwell and Killmer. Principal oboe, Dallas Symphony. Faculty, SMU.
- **Rebecca Henderson** — Killmer, Eastman. Former faculty, UT Austin.
- **Humbert Lucarelli** — Mack/Still/Bloom lineage. Faculty, Hartt School. Students: James Austin Smith, oboenora (commenter)
- **Jane Marvine** — Still, Lifschey, Bloom, Turner. All positions, Baltimore Symphony.
- **Sherry Sylar** — Still. Faculty, Manhattan School of Music.
- **James Austin Smith** — Taylor, Wetzel, Lucarelli, Still. Faculty, Manhattan School of Music.
- **Andrew Parker** — Killmer (Eastman/Yale), King (Michigan). Faculty, UT Austin.
- **Jason Lichtenwalter** — Caldwell and Killmer. English horn, Colorado Symphony. Faculty, CU Boulder.
- **Julia Derosa** — Juilliard (Douvas). Broadway and symphonic. Faculty, Mannes.
- **Ryan Roberts** — Douvas/Hughes/Diaz (Juilliard). English horn, NY Phil. Faculty, Mannes.
- **Toyin Spelman Diaz** — Caldwell, Oberlin. Chamber and new music. Faculty, Mannes.

### European Lineage (Modern)

- **David Walter** — Paris Conservatoire faculty. Students: Philip Tondre
- **Maurice Bourgue** — Students: Philip Tondre
- **Heinz Holliger** — Students: Philip Tondre. Also mentor to Mark Hill.

### Other Teachers Referenced

William Gower (UNC/Colorado State), Richard Henderson (El Paso Symphony), Arno Mariotti (Michigan), Harry Sargous (Michigan), Louis Wann, Ronald Roseman, Gladys Elliot, Jeff Rathbun (CIM), Anne Marie Gabriele, Steven Colburn, Joseph Turner, Christian Wetzel, Lothar Koch (Berlin Phil, informal with Vogel), Fernand Gillet, Josef Marx, Dan Stolper (Interlochen), Robert W. McCoy (Oberlin ~1950s), Robert Humiston (Western Michigan, studied with McCoy), Darrel Randall, Sergei Velikanov, Alexander Izotov, Jonathan Dlouhy, David Mariotti (son of Arno).

### Seed Institutions

Paris Conservatoire, Curtis Institute, Juilliard, NEC, Eastman, Yale, Northwestern, Oberlin, Rice, U of Michigan, Indiana U, USC, Mannes, Peabody, SF Conservatory, U of Maryland, CU Boulder, Cincinnati Conservatory, Cleveland Institute of Music, UT Austin, Manhattan School of Music, Colburn School, Colorado State/UNC, Interlochen, Longy School, Western Michigan U, Hartt School/U of Hartford, SMU, U of Washington, LSU.

### Seed Sources

- Storch, Laila. Marcel Tabuteau: How Do You Expect to Play the Oboe If You Can't Peel a Mushroom? (Indiana UP, 2008)
- Burgess/Haynes. The Oboe (Yale UP, 2004)
- Cruz, Danny. "Who was your oboe teacher's teacher?" oboefiles.com (web + comments)
- Various orchestra program notes and biographical archives
test

---

## Deployment Plan (Railway)

### Services
1. **API Service** — FastAPI, Dockerized, Python 3.12, uvicorn
2. **PostgreSQL** — Railway managed Postgres add-on
3. **Frontend** — Vite builds to dist/, FastAPI serves via StaticFiles mount (single service)

### Project Structure

```
musician-genealogy/
  backend/
    app/
      main.py, models.py, schemas.py, database.py
      routers/ (musicians, lineage, instruments, institutions, search, submissions)
      seed_data.py (idempotent)
    alembic/
    requirements.txt, Dockerfile, railway.toml
  frontend/
    src/
      App.jsx
      components/ (GenealogyTree, MusicianCard, SearchBar, SubmissionForm, ConnectionToggle)
      pages/ (Home, MusicianDetail, SearchResults, Submit)
    package.json, vite.config.js
  README.md
```

### Environment Variables
- DATABASE_URL (Railway Postgres)
- SECRET_KEY (session/token signing)
- ADMIN_PASSWORD (simple admin auth)
- CORS_ORIGINS (dev only; production same-origin)

Railway provides custom domains with automatic HTTPS via Let's Encrypt.

---

## Development Phases

### Phase 1: Foundation
- Data model + Alembic migrations (including submissions table)
- FastAPI CRUD endpoints for all entities
- Seed database with oboe genealogy data (idempotent script)
- Basic search with diacritical normalization
- Simple React frontend: search + musician detail (no tree yet)
- Simple admin auth (password vs environment variable)

### Phase 2: Tree Visualization
- Recursive lineage API with include_secondary parameter
- D3.js interactive tree component
- Expand/collapse nodes, bidirectional display
- Visual weight by relationship type (solid/dashed/dotted)
- Show all connections toggle

### Phase 3: Community and Polish
- Submission form (public), admin review queue, status tracking
- Responsive design
- Institution detail pages with historical names
- Source citations on lineage relationships

### Phase 4: SEO and Growth
- SEO-friendly URLs, Open Graph tags, analytics
- About page with editorial policy, sources, credits

### Phase 5: Multi-Instrument Expansion (Future)
- Import pianist genealogy data (if permission obtained)
- Add violin, flute, clarinet, etc.
- Trusted contributor role, bulk import tools

---

## Design and UX Notes

### Lessons Learned
1. **Names:** Up to 10+ variants. Normalized search + alternates table. Misspellings handled by search, NOT stored as alternates.
2. **Institution names change:** Canonical name + historical names table with date ranges.
3. **Dates are messy:** Free-text fields with best-effort sort parsing.
4. **Multiple teachers are the norm.** DAG is common case.
5. **Relationship types matter.** Visual weighting makes distinctions intuitive.
6. **Source citation builds credibility.** Per-record, not global bibliography.
7. **Community wants to contribute.** Submission workflow early, editorial control always.
8. **Central curation is essential.** Authority depends on editorial review.

### Visual Design
- Clean, modern, warm — music and people, not corporate data
- Tree: smooth animations, intuitive interaction
- Typography: proper diacriticals, elegant names
- Dark mode. Mobile-first for search/detail; tree desktop-optimized.

---

## Notes for Claude Code

### Implementation Decisions (Do Not Deviate)

- **Admin auth:** Login page that sets a session cookie. Password checked against ADMIN_PASSWORD env var. No bearer tokens, no HTTP Basic Auth, no user management table.
- **Frontend styling:** Tailwind CSS utility classes only. No component library (no shadcn, no Material UI). Keep it clean and custom.
- **Frontend build:** Vite builds to frontend/dist/. Dockerfile copies dist/ into the backend's static serving path. During local dev, Vite runs its own dev server on :5173 with API proxy to FastAPI on :8000. Do NOT have Vite output directly into a backend subdirectory.
- **Alembic:** Auto-generate initial migration from SQLAlchemy models. Do not hand-write the initial migration.
- **Build order:** Backend first (models, migrations, seed data, API endpoints, test with seed data), then frontend. Do not build both simultaneously.
- **Seed data:** Load from CSV files (seed-musicians.csv, seed-institutions.csv, seed-lineage.csv) via python -m app.seed_data. Script must be idempotent. CSVs use integer IDs for cross-referencing.

### Implementation Priorities

1. **Data model first.** Do not simplify the schema.
2. **SQLAlchemy 2.0 style** — mapped classes, select() statements.
3. **Recursive CTE** is the hardest query. Build early. Must support include_secondary filtering.
4. **D3 tree:** Vertical first, then expand/collapse, then visual weight, then polish.
5. **Search:** unidecode library. Test Czech and French names.
6. **Seed script** must be idempotent.
7. **Submissions table from Phase 1** even though form UI is Phase 3.
8. **CORS:** localhost:5173 in dev. Same-origin in production.
9. **pg_trgm extension:** Enable in initial Alembic migration. Create GIN indexes on name_search columns.
