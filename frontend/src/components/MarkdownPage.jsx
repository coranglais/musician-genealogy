import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'

function MarkdownLink({ href, children, ...props }) {
  if (href && href.startsWith('/')) {
    return <Link to={href} {...props}>{children}</Link>
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
}

const components = { a: MarkdownLink }

export default function MarkdownPage({ content }) {
  return (
    <div className="max-w-2xl mx-auto prose prose-stone prose-headings:text-stone-800
      prose-a:text-amber-700 prose-strong:text-stone-700">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
