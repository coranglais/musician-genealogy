import MarkdownPage from '../components/MarkdownPage'
import privacyMd from '../content/privacy-policy.md?raw'

export default function PrivacyPolicy() {
  return <MarkdownPage content={privacyMd} />
}
