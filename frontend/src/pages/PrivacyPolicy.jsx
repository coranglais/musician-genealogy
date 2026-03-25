import { useState, useEffect } from 'react'
import MarkdownPage from '../components/MarkdownPage'
import { getPublicConfig } from '../api'
import privacyMd from '../content/privacy-policy.md?raw'

export default function PrivacyPolicy() {
  const [content, setContent] = useState(privacyMd)

  useEffect(() => {
    getPublicConfig().then(config => {
      let md = privacyMd
      if (config.contact_email) {
        md = md.replace(
          '[your contact email]',
          `[${config.contact_email}](mailto:${config.contact_email})`
        )
      }
      if (config.verification_expiry_days) {
        md = md.replace('14 days', `${config.verification_expiry_days} days`)
      }
      setContent(md)
    }).catch(() => {})
  }, [])

  return <MarkdownPage content={content} />
}
