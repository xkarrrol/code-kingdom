import assert from 'node:assert/strict'
import test from 'node:test'
import { Worker } from 'node:worker_threads'
import { runJSPIExperiment } from '../src/experiments/jspi/client.ts'
import type { ExperimentWorker } from '../src/experiments/jspi/client.ts'
import { supportsJSPI } from '../src/experiments/jspi/protocol.ts'
import type { ExperimentMessage, ExperimentRequest } from '../src/experiments/jspi/protocol.ts'
import { createExperimentSession } from '../src/experiments/jspi/session.ts'

function realWorker(unsupported = false): ExperimentWorker {
  const worker = new Worker(new URL('./helpers/jspi-worker.mjs', import.meta.url), { workerData: { unsupported } })
  const adapter: ExperimentWorker = {
    onmessage: null, onerror: null,
    postMessage: message => worker.postMessage(message),
    terminate: () => { void worker.terminate() },
  }
  worker.on('message', data => adapter.onmessage?.(new MessageEvent('message', { data })))
  worker.on('error', error => adapter.onerror?.({ message: error.message } as ErrorEvent))
  return adapter
}

test('detekcja wymaga obu standardowych funkcji JSPI', () => {
  assert.equal(supportsJSPI(undefined), false)
  assert.equal(supportsJSPI({}), false)
  assert.equal(supportsJSPI({ Suspending: () => {} }), false)
  assert.equal(supportsJSPI({ promising: () => {} }), false)
  assert.equal(supportsJSPI({ Suspending: true, promising: () => {} }), false)
  assert.equal(supportsJSPI({ Suspending: () => {}, promising: () => {} }), true)
})

test('brak JSPI jest zgłaszany bez ładowania Pythona i bez obejścia', async () => {
  const messages: ExperimentMessage[] = []
  const handle = createExperimentSession({
    version: 'test-version', jspi: false,
    load: async () => { assert.fail('Nie wolno ładować Pythona bez JSPI') },
    send: message => messages.push(message),
  })
  await handle({ type: 'start' })
  await handle({ type: 'start' })
  assert.equal(messages.length, 2)
  assert.deepEqual(messages[0], { type: 'capabilities', version: 'test-version', jspi: false })
  assert.equal(messages[1].type, 'unsupported')
})

test('prawdziwy Pyodide: synchroniczne test_query czeka na postMessage i zwraca bool True', async t => {
  if (!supportsJSPI(WebAssembly)) { t.skip('Ten Node nie udostępnia JSPI'); return }
  const logs: string[] = []
  const result = await runJSPIExperiment(() => realWorker(), message => logs.push(message))
  assert.deepEqual(result, { status: 'passed', pythonValue: 'True' })
  assert(logs.some(message => /Pyodide/.test(message)))
  assert(logs.some(message => /czeka/.test(message)))
  assert(logs.some(message => /odpowiedź asynchroniczna/.test(message)))
  assert(logs.at(-1)?.includes('TEST ZALICZONY'))
})

test('odpowiedź False nie może zaliczyć testu Pythona', async t => {
  if (!supportsJSPI(WebAssembly)) { t.skip('Ten Node nie udostępnia JSPI'); return }
  await assert.rejects(runJSPIExperiment(() => realWorker(), () => {}, async () => false), /AssertionError|Oczekiwano True/)
})

test('komunikat braku wsparcia przechodzi przez rzeczywisty Worker', async () => {
  const result = await runJSPIExperiment(() => realWorker(true), () => {})
  assert.equal(result.status, 'unsupported')
})

class FakeWorker implements ExperimentWorker {
  onmessage: ExperimentWorker['onmessage'] = null
  onerror: ExperimentWorker['onerror'] = null
  terminated = false
  requests: ExperimentRequest[] = []
  postMessage(message: ExperimentRequest) { this.requests.push(message) }
  terminate() { this.terminated = true }
  send(message: ExperimentMessage) { void this.onmessage?.(new MessageEvent('message', { data: message })) }
}

test('nie akceptuje wyniku bez żądania i odpowiedzi', async () => {
  const worker = new FakeWorker()
  const result = runJSPIExperiment(() => worker, () => {})
  worker.send({ type: 'result', value: 'True' })
  await assert.rejects(result, /potwierdzonej wymiany/)
  assert.equal(worker.terminated, true)
})

test('timeout kończy Worker; test można uruchomić ponownie', async () => {
  const worker = new FakeWorker()
  await assert.rejects(runJSPIExperiment(() => worker, () => {}, undefined, 20), /Timeout/)
  assert.equal(worker.terminated, true)
  const fresh = new FakeWorker()
  const next = runJSPIExperiment(() => fresh, () => {})
  fresh.send({ type: 'unsupported', reason: 'Brak JSPI' })
  assert.deepEqual(await next, { status: 'unsupported', reason: 'Brak JSPI' })
})
