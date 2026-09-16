import * as Slider from '@radix-ui/react-slider'
import * as Switch from '@radix-ui/react-switch'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { WidgetCard } from '@/components/WidgetCard'
import type { WidgetProps } from '@/features/registry/types'
import { useToast } from '@/hooks/useToast'
import { postWidgetAction } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { DynamicFormData, FormField } from '@/types/schema'

type Values = Record<string, string | number | boolean>

/**
 * Schema-driven form.
 *
 * Both the CONTROLS and their VALIDATION RULES come from the payload — there is
 * no per-field code in this component. Adding a field server-side requires no
 * client change, which is the property that makes this "generative" rather than
 * a hardcoded form behind a JSON-shaped door.
 */
export function DynamicForm({ id, title, subtitle, data }: WidgetProps<DynamicFormData>) {
  const initial = useMemo<Values>(
    () => Object.fromEntries(data.fields.map((f) => [f.name, f.default])),
    [data.fields],
  )

  const [values, setValues] = useState<Values>(initial)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const errors = useMemo(() => validate(data.fields, values), [data.fields, values])
  const hasErrors = Object.keys(errors).length > 0

  const setValue = useCallback((name: string, value: Values[string]) => {
    setValues((v) => ({ ...v, [name]: value }))
    setTouched((t) => ({ ...t, [name]: true }))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Reveal every error at once on submit, not just the fields already touched.
    setTouched(Object.fromEntries(data.fields.map((f) => [f.name, true])))
    if (hasErrors) return

    const previous = values
    setSubmitting(true)

    // Optimistic: the form reports success immediately. On rejection the values
    // are restored and the toast explains what happened.
    toast.push({ tone: 'success', title: 'Parameters applied', detail: 'Syncing with the agent…' })

    try {
      await postWidgetAction({ widgetId: id, action: 'submit', payload: values })
    } catch (error) {
      setValues(previous)
      toast.push({
        tone: 'error',
        title: 'Parameters reverted',
        detail: error instanceof Error ? error.message : 'The agent rejected the update.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
        <div className="flex flex-1 flex-col gap-4">
          {data.fields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name]}
              error={touched[field.name] ? errors[field.name] : undefined}
              onChange={setValue}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'mt-1 inline-flex items-center justify-center gap-2 rounded-chip px-4 py-2.5',
            'bg-accent text-sm font-medium text-accent-fg',
            'transition-all duration-150 hover:bg-accent-hover',
            'active:scale-95 disabled:opacity-60',
          )}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {data.submitLabel}
        </button>
      </form>
    </WidgetCard>
  )
}

/* --- Validation ----------------------------------------------------------- */

/** Rules are derived from the field descriptors, never hardcoded per field. */
function validate(fields: FormField[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const value = values[field.name]

    if (field.type === 'text') {
      const text = String(value ?? '')
      if (field.required && text.trim().length === 0) {
        errors[field.name] = `${field.label} is required`
      } else if (field.maxLength && text.length > field.maxLength) {
        errors[field.name] = `Must be ${field.maxLength} characters or fewer`
      }
    }

    if (field.type === 'slider') {
      const n = Number(value)
      if (Number.isNaN(n) || n < field.min || n > field.max) {
        errors[field.name] = `Must be between ${field.min} and ${field.max}`
      }
    }

    if (field.type === 'select' && !field.options.includes(String(value))) {
      errors[field.name] = 'Select a valid option'
    }
  }

  return errors
}

/* --- Field renderer ------------------------------------------------------- */

interface FieldProps {
  field: FormField
  value: Values[string] | undefined
  error?: string
  onChange: (name: string, value: Values[string]) => void
}

function Field({ field, value, error, onChange }: FieldProps) {
  const errorId = `${field.name}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={field.name} className="text-xs font-medium text-text-muted">
          {field.label}
        </label>
        {field.type === 'slider' && (
          <span className="numeric text-xs text-text">{Number(value).toFixed(2)}</span>
        )}
        {field.type === 'toggle' && (
          <Switch.Root
            id={field.name}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(field.name, v)}
            className={cn(
              'relative h-5.5 w-9.5 shrink-0 rounded-full border border-border transition-colors duration-200',
              'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-sunken',
            )}
          >
            <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-text-muted transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-4.5 data-[state=checked]:bg-accent-fg" />
          </Switch.Root>
        )}
      </div>

      {field.type === 'slider' && (
        <Slider.Root
          id={field.name}
          min={field.min}
          max={field.max}
          step={field.step}
          value={[Number(value ?? field.default)]}
          onValueChange={([v]) => onChange(field.name, v ?? field.min)}
          className="relative flex h-5 w-full touch-none select-none items-center"
        >
          <Slider.Track className="relative h-1 w-full grow rounded-full bg-surface-sunken">
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            aria-label={field.label}
            className="block size-4 rounded-full border-2 border-accent bg-bg-elevated transition-shadow hover:shadow-focus-ring focus-visible:shadow-focus-ring"
          />
        </Slider.Root>
      )}

      {field.type === 'select' && (
        <select
          id={field.name}
          value={String(value ?? field.default)}
          onChange={(e) => onChange(field.name, e.target.value)}
          className="rounded-chip border border-border bg-surface-sunken px-3 py-2 text-sm text-text transition-colors hover:border-border-strong"
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'text' && (
        <input
          id={field.name}
          type="text"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cn(
            'rounded-chip border bg-surface-sunken px-3 py-2 text-sm text-text placeholder:text-text-dim',
            'transition-colors',
            error ? 'border-danger' : 'border-border hover:border-border-strong',
          )}
        />
      )}

      {/* Error slot is always in the DOM at a fixed height. Showing and hiding
       *  it would reflow every field below on each keystroke. */}
      <div className="h-4">
        <motion.p
          id={errorId}
          initial={false}
          animate={{ opacity: error ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-micro text-danger"
        >
          {error}
        </motion.p>
      </div>
    </div>
  )
}
