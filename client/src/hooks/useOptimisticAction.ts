import { useCallback, useRef, useState } from 'react'
import { postWidgetAction } from '@/lib/api'
import { useToast } from './useToast'

interface Options<T> {
  widgetId: string
  initial: Record<string, T>
}

interface Result<T> {
  state: Record<string, T>
  /** Keys with a request in flight, for subtle pending affordances. */
  pending: ReadonlySet<string>
  commit: (
    key: string,
    next: T,
    opts?: { action?: string; forceFail?: boolean; label?: string },
  ) => Promise<boolean>
}

/**
 * Optimistic state for widget interactions.
 *
 * Sequence: apply locally → fire the request → on failure, restore the value
 * that was there before and surface a non-blocking toast. The UI never waits on
 * the network, and a failure is never silent.
 *
 * State is KEYED and rollback is PER KEY, which is the whole reason this is not
 * three lines. Snapshotting the entire object and restoring it wholesale would
 * be correct only while exactly one request is in flight; with two overlapping
 * toggles, a failure on the first would silently revert the second. Keyed
 * functional updates touch only the field that actually failed.
 *
 * `snapshots` is a ref rather than state: it is bookkeeping for the rollback
 * path, and re-rendering when it changes would be pure waste.
 */
export function useOptimisticAction<T>({ widgetId, initial }: Options<T>): Result<T> {
  const [state, setState] = useState<Record<string, T>>(initial)
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const snapshots = useRef(new Map<string, T>())
  const toast = useToast()

  const commit = useCallback(
    async (
      key: string,
      next: T,
      opts?: { action?: string; forceFail?: boolean; label?: string },
    ): Promise<boolean> => {
      // Snapshot before the optimistic write, and only if this key is not
      // already in flight — otherwise a second failure would roll back to the
      // first request's optimistic value instead of the last confirmed one.
      setState((prev) => {
        if (!snapshots.current.has(key)) {
          snapshots.current.set(key, prev[key] as T)
        }
        return { ...prev, [key]: next }
      })

      setPending((prev) => new Set(prev).add(key))

      try {
        await postWidgetAction({
          widgetId,
          action: opts?.action ?? 'update',
          payload: { [key]: next },
          forceFail: opts?.forceFail,
        })
        snapshots.current.delete(key)
        return true
      } catch (error) {
        const previous = snapshots.current.get(key)
        snapshots.current.delete(key)

        setState((prev) => ({ ...prev, [key]: previous as T }))

        toast.push({
          tone: 'error',
          title: 'Change reverted',
          detail:
            error instanceof Error
              ? `${opts?.label ?? 'Update'} failed — ${error.message}`
              : 'The server rejected the update.',
          onRetry: () => void commit(key, next, opts),
        })
        return false
      } finally {
        setPending((prev) => {
          const nextSet = new Set(prev)
          nextSet.delete(key)
          return nextSet
        })
      }
    },
    [widgetId, toast],
  )

  return { state, pending, commit }
}
