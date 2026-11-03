export type ExperimentRequest = { type: 'start' } | { type: 'response'; requestId: number; value: boolean }
export type ExperimentMessage =
  | { type: 'capabilities'; version: string; jspi: boolean }
  | { type: 'unsupported'; reason: string }
  | { type: 'query'; requestId: number }
  | { type: 'result'; value: 'True' }
  | { type: 'error'; message: string }

export function supportsJSPI(api: unknown): boolean {
  if (!api || typeof api !== 'object') return false
  return 'Suspending' in api && typeof api.Suspending === 'function'
    && 'promising' in api && typeof api.promising === 'function'
}
