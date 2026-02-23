import * as React from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  label?: string
  placeholder?: string
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ label, placeholder, tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
        setInputValue('')
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // Check if the user just typed a comma
    if (val.endsWith(',')) {
      const raw = val.slice(0, -1)
      if (raw.trim()) {
        addTag(raw)
        setInputValue('')
        return
      }
    }
    setInputValue(val)
  }

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue)
      setInputValue('')
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    const items = pasted.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
    const newTags = items.filter(t => !tags.includes(t))
    if (newTags.length) onChange([...tags, ...newTags])
  }

  return (
    <div className="space-y-1 md:space-y-2">
      {label && (
        <label className="text-[12px] md:text-sm font-medium leading-none text-foreground">
          {label}
        </label>
      )}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[40px] w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm ring-offset-background transition-all duration-200 focus-within:ring-2 focus-within:ring-ring/40 focus-within:ring-offset-1 focus-within:border-primary/30 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium animate-in fade-in zoom-in-95 duration-150"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i) }}
              className="hover:bg-primary/20 rounded-sm p-px transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none placeholder:text-muted-foreground/60 py-0.5"
        />
      </div>
    </div>
  )
}
