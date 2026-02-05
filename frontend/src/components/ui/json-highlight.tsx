import * as React from 'react'
import { cn } from '../../lib/utils'

interface JsonHighlightProps {
  json: string
  className?: string
}

/**
 * Lightweight JSON syntax highlighter.
 * Highlights: strings, numbers, booleans, null, and property keys.
 */
export function JsonHighlight({ json, className }: JsonHighlightProps) {
  const highlighted = React.useMemo(() => {
    const lines = json.split('\n')

    return lines.map((line, i) => {
      const parts: React.ReactNode[] = []
      let remaining = line
      let key = 0

      // Process the line character by character for proper tokenization
      while (remaining.length > 0) {
        // Match property key: "key":
        const keyMatch = remaining.match(/^(\s*)("[\w\-]+")(\s*:\s*)/)
        if (keyMatch) {
          if (keyMatch[1]) parts.push(keyMatch[1]) // whitespace
          parts.push(<span key={key++} className="json-key">{keyMatch[2]}</span>)
          parts.push(keyMatch[3]) // colon and space
          remaining = remaining.slice(keyMatch[0].length)
          continue
        }

        // Match string value: "..."
        const stringMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/)
        if (stringMatch) {
          parts.push(<span key={key++} className="json-string">{stringMatch[1]}</span>)
          remaining = remaining.slice(stringMatch[0].length)
          continue
        }

        // Match number
        const numberMatch = remaining.match(/^(-?\d+\.?\d*)/)
        if (numberMatch) {
          parts.push(<span key={key++} className="json-number">{numberMatch[1]}</span>)
          remaining = remaining.slice(numberMatch[0].length)
          continue
        }

        // Match boolean/null
        const boolMatch = remaining.match(/^(true|false|null)/)
        if (boolMatch) {
          parts.push(<span key={key++} className="json-bool">{boolMatch[1]}</span>)
          remaining = remaining.slice(boolMatch[0].length)
          continue
        }

        // No match - take one character
        parts.push(remaining[0])
        remaining = remaining.slice(1)
      }

      return (
        <div key={i} className="json-line">
          {parts}
        </div>
      )
    })
  }, [json])

  return (
    <pre className={cn('json-highlight', className)}>
      <code>{highlighted}</code>
    </pre>
  )
}
