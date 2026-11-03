import type { PyodideInterface } from 'pyodide'
import type { ExperimentMessage, ExperimentRequest } from './protocol'
import { runQueryTest } from './queryTest.ts'

export function createExperimentSession(options: {
  version: string
  jspi: boolean
  load: () => Promise<PyodideInterface>
  send: (message: ExperimentMessage) => void
}) {
  let started = false
  let resolveQuery: ((value: boolean) => void) | undefined
  return async (message: ExperimentRequest) => {
    if (message.type === 'response') {
      if (message.requestId === 1 && typeof message.value === 'boolean' && resolveQuery) {
        const resolve = resolveQuery
        resolveQuery = undefined
        resolve(message.value)
      }
      return
    }
    if (message.type !== 'start' || started) return
    started = true
    options.send({ type: 'capabilities', version: options.version, jspi: options.jspi })
    if (!options.jspi) {
      options.send({ type: 'unsupported', reason: 'Brak WebAssembly.Suspending lub WebAssembly.promising w Workerze. Test wymaga JSPI; nie zastosowano obejścia.' })
      return
    }
    try {
      const pyodide = await options.load()
      const value = await runQueryTest(pyodide, () => new Promise<boolean>(resolve => {
        resolveQuery = resolve
        options.send({ type: 'query', requestId: 1 })
      }))
      options.send({ type: 'result', value })
    } catch (error) {
      options.send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      resolveQuery = undefined
    }
  }
}
