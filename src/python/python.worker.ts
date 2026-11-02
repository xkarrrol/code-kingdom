import { loadPyodide, version } from 'pyodide'
import type { PythonMessage, PythonRequest } from './messages'
import type { PyodideInterface } from 'pyodide'
import { executePython } from './executePython.ts'

// Worker oddziela obliczenia od interfejsu, ale nie jest pełną izolacją bezpieczeństwa.

function send(message: PythonMessage) {
  self.postMessage(message)
}

let initialized = false
let started = false
let pyodide: PyodideInterface | undefined

self.onmessage = async (event: MessageEvent<PythonRequest>) => {
  try {
    if (event.data.type === 'init' && !initialized) {
      initialized = true
      pyodide = await loadPyodide({
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
        // Nie przesyłamy nieograniczonego strumienia print() do interfejsu.
        stdout: () => {},
        stderr: () => {},
      })
      send({ type: 'ready' })
    } else if (event.data.type === 'run' && pyodide && !started) {
      started = true
      const commands = await executePython(pyodide, event.data.code)
      send({ type: 'result', commands })
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
