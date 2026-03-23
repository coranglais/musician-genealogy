import MarkdownPage from '../components/MarkdownPage'
import aboutMd from '../content/about.md?raw'

export default function AboutPage() {
  return <MarkdownPage content={aboutMd} />
}
