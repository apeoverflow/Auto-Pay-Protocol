import * as React from 'react'
import { cn } from '../../lib/utils'

interface CodeHighlightProps {
  code: string
  className?: string
}

/**
 * Lightweight JS/TS syntax highlighter.
 * Highlights: keywords, strings, numbers, comments, imports, and property keys.
 */
export function CodeHighlight({ code, className }: CodeHighlightProps) {
  const highlighted = React.useMemo(() => {
    const lines = code.split('\n')

    return lines.map((line, i) => {
      const parts: React.ReactNode[] = []
      let remaining = line
      let key = 0

      while (remaining.length > 0) {
        // Line comment
        const commentMatch = remaining.match(/^(\/\/.*)/)
        if (commentMatch) {
          parts.push(<span key={key++} className="code-comment">{commentMatch[1]}</span>)
          remaining = ''
          continue
        }

        // Keywords
        const kwMatch = remaining.match(/^(import|from|export|const|let|var|function|return|async|await|if|else|new|typeof|throw)\b/)
        if (kwMatch) {
          parts.push(<span key={key++} className="code-keyword">{kwMatch[1]}</span>)
          remaining = remaining.slice(kwMatch[0].length)
          continue
        }

        // Single-quoted string
        const sqMatch = remaining.match(/^('(?:[^'\\]|\\.)*')/)
        if (sqMatch) {
          parts.push(<span key={key++} className="code-string">{sqMatch[1]}</span>)
          remaining = remaining.slice(sqMatch[0].length)
          continue
        }

        // Double-quoted string
        const dqMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/)
        if (dqMatch) {
          parts.push(<span key={key++} className="code-string">{dqMatch[1]}</span>)
          remaining = remaining.slice(dqMatch[0].length)
          continue
        }

        // Template literal (simple, no expressions)
        const tlMatch = remaining.match(/^(`(?:[^`\\]|\\.)*`)/)
        if (tlMatch) {
          parts.push(<span key={key++} className="code-string">{tlMatch[1]}</span>)
          remaining = remaining.slice(tlMatch[0].length)
          continue
        }

        // Number
        const numMatch = remaining.match(/^(\d+\.?\d*)/)
        if (numMatch) {
          parts.push(<span key={key++} className="code-number">{numMatch[1]}</span>)
          remaining = remaining.slice(numMatch[0].length)
          continue
        }

        // Object key (word followed by colon)
        const propMatch = remaining.match(/^(\s*)([\w]+)(\s*:\s*)/)
        if (propMatch) {
          if (propMatch[1]) parts.push(propMatch[1])
          parts.push(<span key={key++} className="code-prop">{propMatch[2]}</span>)
          parts.push(propMatch[3])
          remaining = remaining.slice(propMatch[0].length)
          continue
        }

        // Function/method call
        const fnMatch = remaining.match(/^([\w]+)(\s*\()/)
        if (fnMatch) {
          parts.push(<span key={key++} className="code-fn">{fnMatch[1]}</span>)
          parts.push(fnMatch[2])
          remaining = remaining.slice(fnMatch[0].length)
          continue
        }

        // Destructured import names { x, y }
        const braceMatch = remaining.match(/^([{}()\[\],;])/)
        if (braceMatch) {
          parts.push(<span key={key++} className="code-punct">{braceMatch[1]}</span>)
          remaining = remaining.slice(1)
          continue
        }

        // Default: take one character
        parts.push(remaining[0])
        remaining = remaining.slice(1)
      }

      return (
        <div key={i} className="code-line">
          {parts}
        </div>
      )
    })
  }, [code])

  return (
    <pre className={cn('code-highlight', className)}>
      <code>{highlighted}</code>
    </pre>
  )
}
