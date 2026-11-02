import type { WorkerCommand } from '../game/commands'
import type { PythonRequest } from './messages'
import { COMPUTE_TIMEOUT_MS, isCommandList } from './messages.ts'

// Wąski interfejs pozwala testować nadzór bez uruchamiania przeglądarki.
export interface PythonWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: PythonRequest): void
  terminate(): void
}

export class PythonRunner {
  private cancel?: () => void
  private readonly createWorker: () => PythonWorker

  constructor(createWorker: () => PythonWorker = () =>
    new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })) {
    this.createWorker = createWorker
  }

  run(code: string): Promise<WorkerCommand[]> {
    if (this.cancel) return Promise.reject(new Error('Program Python już działa.'))
    return new Promise((resolve, reject) => {
      const worker = this.createWorker()
      let computing = false
      let deadline = 0
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      const finish = (commands?: WorkerCommand[], error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        this.cancel = undefined
        if (error) reject(error)
        else resolve(commands!)
      }
      this.cancel = () => finish(undefined, new Error('Uruchomienie anulowano.'))
      // Osobny limit pobierania Pyodide, niezależny od czasu obliczeń.
      timer = setTimeout(() => finish(undefined, new Error('Nie udało się załadować Pyodide w ciągu 60 sekund.')), 60_000)
      worker.onerror = event => finish(undefined, new Error(`Błąd Workera: ${event.message}`))
      worker.onmessage = event => {
        const data = event.data
        if (!data || typeof data !== 'object' || !('type' in data)) {
          finish(undefined, new Error('Nieprawidłowa odpowiedź Workera.'))
          return
        }
        if (data.type === 'ready' && !computing) {
          computing = true
          clearTimeout(timer)
          deadline = performance.now() + COMPUTE_TIMEOUT_MS
          timer = setTimeout(() => finish(undefined, new Error('Przekroczono limit 2 sekund obliczeń.')), COMPUTE_TIMEOUT_MS)
          worker.postMessage({ type: 'run', code })
        } else if (computing && performance.now() > deadline) {
          finish(undefined, new Error('Przekroczono limit 2 sekund obliczeń.'))
        } else if (data.type === 'result' && computing && 'commands' in data && isCommandList(data.commands)) {
          finish(data.commands)
        } else if (data.type === 'error' && 'message' in data && typeof data.message === 'string') {
          finish(undefined, new Error(data.message))
        } else {
          finish(undefined, new Error('Nieprawidłowa odpowiedź Workera.'))
        }
      }
      try {
        worker.postMessage({ type: 'init' })
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  dispose() {
    this.cancel?.()
  }
}
