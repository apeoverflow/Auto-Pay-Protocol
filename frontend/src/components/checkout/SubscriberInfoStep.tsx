import * as React from 'react'
import { UserCircle } from 'lucide-react'
import type { CheckoutField, SubscriberFieldKey } from '../../types/checkout'

const FIELD_LABELS: Record<SubscriberFieldKey, string> = {
  email: 'Email Address',
  name: 'Full Name',
  discord: 'Discord Handle',
  telegram: 'Telegram Username',
  twitter: 'X / Twitter Handle',
  mobile: 'Mobile Number',
}

const FIELD_TYPES: Record<SubscriberFieldKey, string> = {
  email: 'email',
  name: 'text',
  discord: 'text',
  telegram: 'text',
  twitter: 'text',
  mobile: 'tel',
}

const FIELD_PLACEHOLDERS: Record<SubscriberFieldKey, string> = {
  email: 'you@example.com',
  name: 'John Doe',
  discord: 'username#1234',
  telegram: '@username',
  twitter: '@handle',
  mobile: '+1 555 123 4567',
}

interface SubscriberInfoStepProps {
  fields: CheckoutField[]
  onContinue: (formData: Record<string, string>) => void
  cancelUrl: string
}

export function SubscriberInfoStep({ fields, onContinue, cancelUrl }: SubscriberInfoStepProps) {
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of fields) initial[f.key] = ''
    return initial
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    for (const field of fields) {
      const val = values[field.key]?.trim()
      if (field.required && !val) {
        newErrors[field.key] = `${FIELD_LABELS[field.key]} is required`
      }
      if (field.key === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        newErrors[field.key] = 'Please enter a valid email address'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Only submit non-empty values
    const formData: Record<string, string> = {}
    for (const [key, val] of Object.entries(values)) {
      if (val.trim()) formData[key] = val.trim()
    }
    onContinue(formData)
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <UserCircle className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Your information</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The merchant requires some details to manage your subscription
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-foreground mb-1">
              {FIELD_LABELS[field.key]}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <input
              type={FIELD_TYPES[field.key]}
              placeholder={FIELD_PLACEHOLDERS[field.key]}
              value={values[field.key] || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                errors[field.key] ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors[field.key] && (
              <p className="text-xs text-destructive mt-1">{errors[field.key]}</p>
            )}
          </div>
        ))}

        <button
          type="submit"
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors mt-4"
        >
          Continue
        </button>
      </form>

      <div className="text-center mt-4">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
