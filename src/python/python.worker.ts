import { loadPyodide, version } from 'pyodide'
import type { PythonRequest } from './messages'
import { createPythonSession } from './session.ts'

// Worker oddziela obliczenia od interfejsu, ale nie jest pełną izolacją bezpieczeństwa.

const handle = createPythonSession({
  load: () => loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
    // Nie przesyłamy nieograniczonego strumienia print() do interfejsu.
    stdout: () => {},
    stderr: () => {},
  }),
  send: message => self.postMessage(message),
})

self.onmessage = (event: MessageEvent<PythonRequest>) => { void handle(event.data) }
