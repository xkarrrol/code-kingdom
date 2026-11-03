import { parentPort, workerData } from 'node:worker_threads'
import { loadPyodide } from 'pyodide'
import { createPythonSession } from '../../src/python/session.ts'

// Adapter testowy: prawdziwy Pyodide, lokalne pliki pakietu, osobny wątek Node.
const handle = createPythonSession({
  load: () => loadPyodide({ stdout: () => {}, stderr: () => {} }),
  send: message => parentPort.postMessage(message),
  jspi: workerData?.jspi,
})
parentPort.on('message', message => { void handle(message) })
