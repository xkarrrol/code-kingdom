import { loadPyodide, version } from 'pyodide'
import { supportsJSPI } from './protocol.ts'
import type { ExperimentRequest } from './protocol'
import { createExperimentSession } from './session.ts'

const handle = createExperimentSession({
  version,
  jspi: supportsJSPI(WebAssembly),
  load: () => loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
    stdout: () => {}, stderr: () => {},
  }),
  send: message => self.postMessage(message),
})

self.onmessage = (event: MessageEvent<ExperimentRequest>) => { void handle(event.data) }
