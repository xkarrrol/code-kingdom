import { parentPort, workerData } from 'node:worker_threads'
import { loadPyodide, version } from 'pyodide'
import { supportsJSPI } from '../../src/experiments/jspi/protocol.ts'
import { createExperimentSession } from '../../src/experiments/jspi/session.ts'

const handle = createExperimentSession({
  version,
  jspi: !workerData?.unsupported && supportsJSPI(WebAssembly),
  load: () => loadPyodide({ stdout: () => {}, stderr: () => {} }),
  send: message => parentPort.postMessage(message),
})
parentPort.on('message', message => { void handle(message) })
