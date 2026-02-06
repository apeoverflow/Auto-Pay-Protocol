import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml'
import { cn } from '../lib/utils'
import { ChevronDown } from 'lucide-react'

import overviewMd from '../../../documentation/overview.md?raw'
import subscriberGuideMd from '../../../documentation/subscriber-guide.md?raw'
import merchantGuideMd from '../../../documentation/merchant-guide.md?raw'
import sdkFrontendMd from '../../../documentation/sdk-frontend.md?raw'
import sdkBackendMd from '../../../documentation/sdk-backend.md?raw'
import relayerLocalSetupMd from '../../../documentation/relayer-local-setup.md?raw'
import relayerConfigMd from '../../../documentation/relayer-configuration.md?raw'
import relayerOperationsMd from '../../../documentation/relayer-operations.md?raw'
import relayerDeploymentMd from '../../../documentation/relayer-deployment.md?raw'

SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)
SyntaxHighlighter.registerLanguage('toml', toml)

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'inherit',
})

let mermaidCounter = 0

function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const id = `mermaid-${++mermaidCounter}`
    mermaid.render(id, chart).then(({ svg }) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = svg
      }
    })
  }, [chart])

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-border/50 bg-white p-4"
    />
  )
}

type DocId =
  | 'overview'
  | 'subscriber-guide'
  | 'merchant-guide'
  | 'sdk-frontend'
  | 'sdk-backend'
  | 'relayer-local-setup'
  | 'relayer-config'
  | 'relayer-operations'
  | 'relayer-deployment'

interface DocEntry {
  id: DocId
  label: string
  content: string
}

interface DocCategory {
  label: string
  docs: DocEntry[]
}

const categories: DocCategory[] = [
  {
    label: 'Getting Started',
    docs: [
      { id: 'overview', label: 'Overview', content: overviewMd },
      { id: 'subscriber-guide', label: 'Subscriber Guide', content: subscriberGuideMd },
      { id: 'merchant-guide', label: 'Merchant Guide', content: merchantGuideMd },
    ],
  },
  {
    label: 'SDK Integration',
    docs: [
      { id: 'sdk-frontend', label: 'Frontend Guide', content: sdkFrontendMd },
      { id: 'sdk-backend', label: 'Backend Guide', content: sdkBackendMd },
    ],
  },
  {
    label: 'Relayer',
    docs: [
      { id: 'relayer-local-setup', label: 'Local Setup', content: relayerLocalSetupMd },
      { id: 'relayer-config', label: 'Configuration', content: relayerConfigMd },
      { id: 'relayer-operations', label: 'Operations', content: relayerOperationsMd },
      { id: 'relayer-deployment', label: 'Deployment', content: relayerDeploymentMd },
    ],
  },
]

const allDocs = categories.flatMap((c) => c.docs)

// Map markdown filenames to DocIds for cross-doc links
const filenameToDocId: Record<string, DocId> = {
  'overview.md': 'overview',
  'subscriber-guide.md': 'subscriber-guide',
  'merchant-guide.md': 'merchant-guide',
  'sdk-frontend.md': 'sdk-frontend',
  'sdk-backend.md': 'sdk-backend',
  'relayer-local-setup.md': 'relayer-local-setup',
  'relayer-configuration.md': 'relayer-config',
  'relayer-operations.md': 'relayer-operations',
  'relayer-deployment.md': 'relayer-deployment',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function DocsPage() {
  const [activeDoc, setActiveDoc] = React.useState<DocId>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const currentDoc = allDocs.find((d) => d.id === activeDoc)!

  const navigateTo = React.useCallback((docId: DocId, hash?: string) => {
    setActiveDoc(docId)
    setMobileMenuOpen(false)
    // Scroll to top or to anchor after render
    requestAnimationFrame(() => {
      if (hash) {
        const el = document.getElementById(hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
          return
        }
      }
      contentRef.current?.scrollTo(0, 0)
    })
  }, [])

  const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = React.useMemo(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '')
        const codeString = String(children).replace(/\n$/, '')
        if (match?.[1] === 'mermaid') {
          return <MermaidDiagram chart={codeString} />
        }
        if (match) {
          return (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                lineHeight: 1.6,
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          )
        }
        return (
          <code
            className="rounded bg-muted px-1.5 py-0.5 text-[0.8rem] font-mono text-foreground/90"
            {...props}
          >
            {children}
          </code>
        )
      },
      pre({ children }) {
        return <div className="my-4 overflow-x-auto rounded-lg border border-border/50">{children}</div>
      },
      h1({ children }) {
        const text = String(children)
        return (
          <h1 id={slugify(text)} className="mb-6 text-2xl font-bold tracking-tight text-foreground">
            {children}
          </h1>
        )
      },
      h2({ children }) {
        const text = String(children)
        return (
          <h2
            id={slugify(text)}
            className="mb-4 mt-10 border-b border-border/50 pb-2 text-xl font-semibold text-foreground"
          >
            {children}
          </h2>
        )
      },
      h3({ children }) {
        const text = String(children)
        return (
          <h3 id={slugify(text)} className="mb-3 mt-8 text-lg font-semibold text-foreground">
            {children}
          </h3>
        )
      },
      h4({ children }) {
        const text = String(children)
        return (
          <h4 id={slugify(text)} className="mb-2 mt-6 text-base font-semibold text-foreground">
            {children}
          </h4>
        )
      },
      p({ children }) {
        return <p className="mb-4 leading-7 text-foreground/80">{children}</p>
      },
      a({ href, children }) {
        if (href) {
          // Handle relative cross-doc links
          const relMatch = href.match(/^\.\/([a-z-]+\.md)(#.*)?$/)
          if (relMatch) {
            const docId = filenameToDocId[relMatch[1]]
            if (docId) {
              const hash = relMatch[2]?.slice(1)
              return (
                <button
                  onClick={() => navigateTo(docId, hash)}
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {children}
                </button>
              )
            }
          }
          // Handle anchor-only links
          if (href.startsWith('#')) {
            return (
              <a
                href={href}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {children}
              </a>
            )
          }
          // External links
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          )
        }
        return <>{children}</>
      },
      table({ children }) {
        return (
          <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">{children}</table>
          </div>
        )
      },
      thead({ children }) {
        return <thead className="bg-muted/50">{children}</thead>
      },
      th({ children }) {
        return (
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {children}
          </th>
        )
      },
      td({ children }) {
        return (
          <td className="border-t border-border/30 px-4 py-2.5 text-foreground/80">{children}</td>
        )
      },
      blockquote({ children }) {
        return (
          <blockquote className="my-4 border-l-4 border-primary/30 bg-primary/5 py-2 pl-4 pr-3 text-foreground/80 [&>p]:mb-0">
            {children}
          </blockquote>
        )
      },
      ul({ children }) {
        return <ul className="mb-4 ml-6 list-disc space-y-1 text-foreground/80">{children}</ul>
      },
      ol({ children }) {
        return <ol className="mb-4 ml-6 list-decimal space-y-1 text-foreground/80">{children}</ol>
      },
      li({ children }) {
        return <li className="leading-7">{children}</li>
      },
      hr() {
        return <hr className="my-8 border-border/50" />
      },
      strong({ children }) {
        return <strong className="font-semibold text-foreground">{children}</strong>
      },
    }),
    [navigateTo]
  )

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Mobile dropdown */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background p-3 md:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium"
        >
          <span>{currentDoc.label}</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', mobileMenuOpen && 'rotate-180')}
          />
        </button>
        {mobileMenuOpen && (
          <div className="mt-2 rounded-lg border border-border/50 bg-background p-2 shadow-lg">
            {categories.map((cat) => (
              <div key={cat.label}>
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat.label}
                </div>
                {cat.docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => navigateTo(doc.id)}
                    className={cn(
                      'flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      activeDoc === doc.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground/70 hover:bg-muted/50'
                    )}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden w-[220px] flex-shrink-0 border-r border-border/50 bg-muted/20 md:block">
        <div className="sticky top-0 p-4">
          {categories.map((cat) => (
            <div key={cat.label} className="mb-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.label}
              </div>
              <div className="space-y-0.5">
                {cat.docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => navigateTo(doc.id)}
                    className={cn(
                      'flex w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                      activeDoc === doc.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground/60 hover:bg-muted/50 hover:text-foreground/80'
                    )}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {currentDoc.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
