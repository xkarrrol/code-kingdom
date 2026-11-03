import type { ExperimentMessage, ExperimentRequest } from './protocol'

export interface ExperimentWorker {
  onmessage: ((event: MessageEvent<ExperimentMessage>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: ExperimentRequest): void
  terminate(): void
}
export type ExperimentResult =
  | { status: 'passed'; pythonValue: 'True' }
  | { status: 'unsupported'; reason: string }

// Wywołanie tworzy Worker; import modułu sam nie uruchamia eksperymentu.
export function runJSPIExperiment(
  createWorker: () => ExperimentWorker,
  log: (message: string) => void,
  reply: () => Promise<boolean> = () => new Promise(resolve => setTimeout(() => resolve(true), 100)),
  timeoutMs = 60_000,
): Promise<ExperimentResult> {
  return new Promise((resolve, reject) => {
    const worker = createWorker()
    let finished = false
    let queried = false
    let replied = false
    const stop = () => {
      finished = true
      clearTimeout(timer)
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    const fail = (error: Error) => { if (!finished) { stop(); reject(error) } }
    const timer = setTimeout(() => fail(new Error('Timeout eksperymentu (ładowanie lub odpowiedź). Worker został zakończony.')), timeoutMs)
    worker.onerror = event => fail(new Error(event.message))
    worker.onmessage = async event => {
      if (finished) return
      const message = event.data
      try {
        switch (message.type) {
          case 'capabilities':
            log(`Worker: Pyodide ${message.version}; JSPI: ${message.jspi ? 'dostępne' : 'brak'}`)
            break
          case 'unsupported':
            stop()
            resolve({ status: 'unsupported', reason: message.reason })
            break
          case 'query': {
            if (queried || message.requestId !== 1) throw new Error('Nieprawidłowe żądanie test_query.')
            queried = true
            log('Worker → główny wątek: test_query() czeka na odpowiedź.')
            const value = await reply()
            if (finished) return
            replied = true
            log(`Główny wątek → Worker: ${String(value)} (odpowiedź asynchroniczna).`)
            worker.postMessage({ type: 'response', requestId: message.requestId, value })
            break
          }
          case 'result':
            if (!queried || !replied || message.value !== 'True') throw new Error('Wynik bez potwierdzonej wymiany wiadomości.')
            log('Python: test_query() zwróciło bool True. TEST ZALICZONY.')
            stop()
            resolve({ status: 'passed', pythonValue: message.value })
            break
          case 'error':
            fail(new Error(message.message))
            break
          default:
            throw new Error('Nieznana wiadomość eksperymentu.')
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    }
    try { worker.postMessage({ type: 'start' }) }
    catch (error) { fail(error instanceof Error ? error : new Error(String(error))) }
  })
}
