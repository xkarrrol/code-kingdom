import { parentPort } from 'node:worker_threads'
import { loadPyodide } from 'pyodide'
import { executePython } from '../../src/python/executePython.ts'

// Adapter testowy: prawdziwy Pyodide, lokalne pliki pakietu, osobny wątek Node.
let pyodide
parentPort.on('message', async message => {
  try {
    if (message.type === 'init') {
      pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} })
      parentPort.postMessage({ type: 'ready' })
    } else if (message.type === 'run') {
      const commands = await executePython(pyodide, message.code)
      parentPort.postMessage({ type: 'result', commands })
    }
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: String(error) })
  }
})
