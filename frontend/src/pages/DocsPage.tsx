import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
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
import { ChevronDown, List, Search, X } from 'lucide-react'

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

interface TocEntry {
  level: number
  text: string
  slug: string
}

function extractHeadings(markdown: string): TocEntry[] {
  const headings: TocEntry[] = []
  // Match ## and ### headings (not inside code blocks)
  let inCodeBlock = false
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      const text = match[2]
        .replace(/`([^`]+)`/g, '$1') // strip inline code backticks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links
      headings.push({
        level: match[1].length,
        text,
        slug: slugify(text),
      })
    }
  }
  return headings
}

function TableOfContents({
  headings,
  contentRef,
}: {
  headings: TocEntry[]
  contentRef: React.RefObject<HTMLDivElement | null>
}) {
  const [activeSlug, setActiveSlug] = React.useState<string>('')

  React.useEffect(() => {
    const container = contentRef.current
    if (!container || headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveSlug(visible[0].target.id)
        }
      },
      { root: container, rootMargin: '0px 0px -70% 0px', threshold: 0.1 }
    )

    const elements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.slug)}`))
      .filter(Boolean) as Element[]
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [headings, contentRef])

  const scrollTo = (slug: string) => {
    const container = contentRef.current
    if (!container) return
    const el = container.querySelector(`#${CSS.escape(slug)}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (headings.length === 0) return null

  return (
    <nav className="space-y-0.5">
      {headings.map((h) => (
        <button
          key={h.slug}
          onClick={() => scrollTo(h.slug)}
          className={cn(
            'block w-full text-left text-[12px] leading-relaxed py-0.5 transition-colors truncate',
            h.level === 3 ? 'pl-3' : 'pl-0',
            activeSlug === h.slug
              ? 'text-primary font-medium'
              : 'text-muted-foreground/60 hover:text-foreground/80'
          )}
        >
          {h.text}
        </button>
      ))}
    </nav>
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

// Search
interface SearchResult {
  docId: DocId
  docLabel: string
  heading: string
  slug: string
  snippet: string
}

function searchDocs(query: string): SearchResult[] {
  if (query.length < 2) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const doc of allDocs) {
    const lines = doc.content.split('\n')
    let currentHeading = doc.label
    let currentSlug = ''
    let inCodeBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        continue
      }

      // Track current heading
      if (!inCodeBlock) {
        const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
        if (headingMatch) {
          currentHeading = headingMatch[2]
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          currentSlug = slugify(currentHeading)
        }
      }

      if (line.toLowerCase().includes(q)) {
        // Avoid duplicate results for same heading
        if (results.length > 0) {
          const last = results[results.length - 1]
          if (last.docId === doc.id && last.slug === currentSlug) continue
        }

        // Build snippet: trim and highlight around match
        const idx = line.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 40)
        const end = Math.min(line.length, idx + query.length + 40)
        let snippet = (start > 0 ? '...' : '') +
          line.slice(start, end).replace(/^#+\s+/, '').trim() +
          (end < line.length ? '...' : '')

        results.push({
          docId: doc.id,
          docLabel: doc.label,
          heading: currentHeading,
          slug: currentSlug,
          snippet,
        })

        if (results.length >= 20) return results
      }
    }
  }

  return results
}

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

// Extract plain text from React children (handles <code> elements etc.)
function getTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(getTextContent).join('')
  if (React.isValidElement(children) && children.props) {
    return getTextContent((children.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export function DocsPage({ hideLogo = false }: { hideLogo?: boolean } = {}) {
  const [activeDoc, setActiveDoc] = React.useState<DocId>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [tocOpen, setTocOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const searchResults = React.useMemo(() => searchDocs(searchQuery), [searchQuery])

  const openSearch = React.useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  const closeSearch = React.useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const handleSearchSelect = React.useCallback((result: SearchResult) => {
    setActiveDoc(result.docId)
    closeSearch()
    setMobileMenuOpen(false)
    requestAnimationFrame(() => {
      if (result.slug) {
        const el = document.getElementById(result.slug)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }
      contentRef.current?.scrollTo(0, 0)
    })
  }, [closeSearch])

  // Keyboard shortcut: Cmd/Ctrl+K to open search, Escape to close
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen, openSearch, closeSearch])

  const currentDoc = allDocs.find((d) => d.id === activeDoc)!
  const headings = React.useMemo(() => extractHeadings(currentDoc.content), [currentDoc.content])

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
      code({ className, children, node, ...props }) {
        const match = /language-(\w+)/.exec(className || '')
        const codeString = String(children).replace(/\n$/, '')
        const isBlock = node?.position && String(children).includes('\n')
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
        if (isBlock) {
          return (
            <SyntaxHighlighter
              style={oneDark}
              language="text"
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
        const text = getTextContent(children)
        return (
          <h1 id={slugify(text)} className="mb-6 text-2xl font-bold tracking-tight text-foreground">
            {children}
          </h1>
        )
      },
      h2({ children }) {
        const text = getTextContent(children)
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
        const text = getTextContent(children)
        return (
          <h3 id={slugify(text)} className="mb-3 mt-8 text-lg font-semibold text-foreground">
            {children}
          </h3>
        )
      },
      h4({ children }) {
        const text = getTextContent(children)
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
            {/* Mobile search trigger */}
            <button
              onClick={openSearch}
              className="mb-2 flex w-full items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-[13px] text-muted-foreground/60"
            >
              <Search className="h-3.5 w-3.5" />
              Search docs...
            </button>
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
          {/* Logo (hidden when embedded in signed-in view) */}
          {!hideLogo && (
            <div className="mb-5 flex justify-center">
              <img src="/logo.png" alt="AutoPay" className="h-10 w-auto brightness-0 opacity-60" />
            </div>
          )}
          {/* Search trigger */}
          <button
            onClick={openSearch}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-[13px] text-muted-foreground/50 transition-colors hover:border-border hover:text-muted-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium lg:inline">⌘K</kbd>
          </button>
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

      {/* Content area + TOC */}
      <div className="flex min-h-0 flex-1">
        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
          {/* Mobile TOC */}
          {headings.length > 0 && (
            <div className="border-b border-border/50 px-4 py-2 md:hidden">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="flex w-full items-center gap-2 text-[12px] font-medium text-muted-foreground"
              >
                <List className="h-3.5 w-3.5" />
                <span>On this page</span>
                <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', tocOpen && 'rotate-180')} />
              </button>
              {tocOpen && (
                <div className="pt-2 pb-1">
                  <TableOfContents headings={headings} contentRef={contentRef} />
                </div>
              )}
            </div>
          )}
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {currentDoc.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Desktop TOC sidebar */}
        {headings.length > 0 && (
          <div className="hidden w-fit min-w-[180px] flex-shrink-0 border-l border-border/50 lg:block">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </div>
              <TableOfContents headings={headings} contentRef={contentRef} />
            </div>
          </div>
        )}
      </div>

      {/* Search modal overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={closeSearch}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground/50" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
              {searchQuery ? (
                <button
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}
                  className="text-muted-foreground/50 hover:text-foreground/80"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="rounded border border-border/50 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {searchQuery.length < 2 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground/60">
                  Type to search across all documentation
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.docId}-${r.slug}-${i}`}
                      onClick={() => handleSearchSelect(r)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="mt-0.5 flex-shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {r.docLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{r.heading}</div>
                        <div className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                          {r.snippet}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
