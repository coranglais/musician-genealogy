import MarkdownPage from '../components/MarkdownPage'
import featuresMd from '../content/features.md?raw'

export default function HowItWorksPage() {
  return <MarkdownPage content={featuresMd} />
}
