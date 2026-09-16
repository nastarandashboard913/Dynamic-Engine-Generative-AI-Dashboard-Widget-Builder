import type { ComponentType, LazyExoticComponent } from 'react'
import type { ZodType } from 'zod'

/** Props every widget component receives after its payload has been validated. */
export interface WidgetProps<T> {
  id: string
  title?: string
  subtitle?: string
  /** Already parsed by the registry — components never re-validate. */
  data: T
}

/**
 * One archetype's registration.
 *
 * Pairing the schema with the component is the point: a component can only be
 * reached through its own validator, so a widget is structurally incapable of
 * receiving a payload it did not declare. There is no path where a component
 * renders unvalidated data.
 */
export interface RegistryEntry<T = unknown> {
  /** Human-readable name, used in fallback copy and dev tooling. */
  label: string
  /** Runtime validator for `envelope.data`. */
  schema: ZodType<T>
  /**
   * Lazy so each archetype is a separate chunk. A dashboard of four metric
   * cards never downloads the virtualised table or the form runtime.
   */
  Component: LazyExoticComponent<ComponentType<WidgetProps<T>>>
}

/** Why a widget could not be rendered normally. */
export type FallbackReason =
  | { kind: 'unknown-type'; type: string }
  | { kind: 'invalid-payload'; type: string; issues: string[] }
  | { kind: 'render-error'; type: string; message: string }
