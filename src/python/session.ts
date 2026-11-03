import type { PyodideInterface } from 'pyodide'
import type { PythonMessage, PythonRequest } from './messages'
import { executePython } from './executePython.ts'
import { supportsJSPI, WorkerBridge } from './WorkerBridge.ts'

export function createPythonSession(options: {
  load: () => Promise<PyodideInterface>
  send: (message: PythonMessage) => void
  jspi?: boolean
}) {
  let runId: string | undefined
  let pyodide: PyodideInterface | undefined
  let started = false
  let initialized = false
  let bridge: WorkerBridge | undefined
  return async (message: PythonRequest) => {
    if (message.type === 'init' && !runId) runId = message.runId
    if (!runId || message.runId !== runId) return
    if (message.type === 'response') { bridge?.receive(message); return }
    if (message.type === 'run' && (!pyodide || started)) return
    try {
      if (message.type === 'init' && !initialized) {
        initialized = true
        pyodide = await options.load()
        options.send({ type: 'ready', runId })
      } else if (message.type === 'run' && pyodide && !started) {
        started = true
        bridge = new WorkerBridge(runId, options.send)
        await executePython(pyodide, message.code, bridge, options.jspi ?? supportsJSPI(WebAssembly))
        options.send({ type: 'result', runId })
      }
    } catch (error) {
      options.send({ type: 'error', runId, message: error instanceof Error ? error.message : String(error) })
    } finally {
      if (message.type === 'run') { bridge?.dispose(); bridge = undefined }
    }
  }
}
