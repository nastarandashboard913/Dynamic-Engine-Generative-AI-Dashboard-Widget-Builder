/* API layer. Relative URLs throughout: Vite proxies /api in dev and nginx
 * proxies it in Docker, so the client never needs to know the server's origin
 * and there is no CORS preflight on the stream. */

export interface WidgetActionRequest {
  widgetId: string
  action: string
  payload?: Record<string, unknown>
  /** Forces the server to fail — used by the "force failure" demo control. */
  forceFail?: boolean
}

export interface WidgetActionResponse {
  ok: true
  widgetId: string
  action: string
  state: Record<string, unknown>
  updatedAt: number
}

export class ApiError extends Error {
  // Written out rather than using a constructor parameter property: the
  // `erasableSyntaxOnly` compiler flag rejects syntax that cannot be erased
  // by a type-stripping transform.
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function postWidgetAction(
  req: WidgetActionRequest,
  signal?: AbortSignal,
): Promise<WidgetActionResponse> {
  const res = await fetch('/api/widget-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })

  if (!res.ok) {
    // The server explains its own failures; fall back to the status only if it
    // does not, so the toast never says "Error: undefined".
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status)
  }

  return (await res.json()) as WidgetActionResponse
}

export async function fetchInvestigations(signal?: AbortSignal) {
  const res = await fetch('/api/investigations', { signal })
  if (!res.ok) throw new ApiError('Could not load history', res.status)
  return (await res.json()) as { items: Array<{ id: string; prompt: string; createdAt: number }> }
}
