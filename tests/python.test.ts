import assert from 'node:assert/strict'
import test from 'node:test'
import { Worker } from 'node:worker_threads'
import { PythonRunner } from '../src/python/PythonRunner.ts'
import type { PythonWorker } from '../src/python/PythonRunner.ts'
import type { PythonRequest } from '../src/python/messages.ts'
import { WorkerCommands } from '../src/game/commands.ts'
import { chopWood, createResources } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'
import { getWorkerDestination } from '../src/game/movement.ts'

function createRealWorker(): PythonWorker {
  const worker = new Worker(new URL('./helpers/python-worker.mjs', import.meta.url))
  const adapter: PythonWorker = {
    onmessage: null,
    onerror: null,
    postMessage: message => worker.postMessage(message),
    terminate: () => { void worker.terminate() },
  }
  worker.on('message', data => adapter.onmessage?.(new MessageEvent('message', { data })))
  worker.on('error', error => adapter.onerror?.({ message: error.message } as ErrorEvent))
  return adapter
}

test('Python zapisuje ruch i ścinanie; gra zbiera drewno i pozwala wejść na wycięte pole', async () => {
  const runner = new PythonRunner(createRealWorker)
  let state = createResources(kingdomMap.trees)
  let position = { ...kingdomMap.worker }
  const commands = await runner.run(`
move_up()
move_right()
for i in range(3):
    chop_wood()
move_up()
`)
  assert.deepEqual(commands, ['move_up', 'move_right', 'chop_wood', 'chop_wood', 'chop_wood', 'move_up'])
  assert.equal(state.collectedWood, 0)
  const game = new WorkerCommands(async direction => {
    const next = getWorkerDestination({ ...kingdomMap, trees: state.trees }, position, direction)
    if (!next) return false
    position = next
    return true
  }, async () => {
    const next = chopWood(state, position)
    const changed = next !== state
    state = next
    return changed
  })
  await game.runCommands(commands)
  assert.equal(state.collectedWood, 3)
  assert.deepEqual(position, { column: 6, row: 2 })
  assert.equal(state.trees.length, kingdomMap.trees.length - 1)

  await assert.rejects(async () => {
    const invalid = await runner.run('chop_wood()\nraise ValueError("test")')
    await game.runCommands(invalid)
  }, /ValueError/)
  assert.equal(state.collectedWood, 3)
  await assert.rejects(runner.run('for i in range(101):\n    chop_wood()'), /limit 100/)
  assert.equal(state.collectedWood, 3)
})

test('prawdziwy Python: pętla for, zmienna, funkcja i kolejność komend', async () => {
  const runner = new PythonRunner(createRealWorker)
  const commands = await runner.run(`
steps = 2
def walk():
    for i in range(steps):
        move_right()
    move_up()
walk()
move_left()
move_down()
`)
  assert.deepEqual(commands, ['move_right', 'move_right', 'move_up', 'move_left', 'move_down'])
  const moves: string[] = []
  await new WorkerCommands(async direction => { moves.push(direction); return true }).runCommands(commands)
  assert.deepEqual(moves, ['right', 'right', 'up', 'left', 'down'])
})

test('błąd Pythona po komendzie nie przekazuje żadnych ruchów do gry', async () => {
  const runner = new PythonRunner(createRealWorker)
  const moves: string[] = []
  const game = new WorkerCommands(async direction => { moves.push(direction); return true })
  await assert.rejects(async () => {
    const commands = await runner.run('move_up()\nmissing_function()')
    await game.runCommands(commands)
  }, /NameError/)
  assert.deepEqual(moves, [])
  await assert.rejects(runner.run('for'), /SyntaxError/)
})

test('dopuszcza 100 komend, odrzuca 101 także po przechwyceniu wyjątku', async () => {
  const runner = new PythonRunner(createRealWorker)
  assert.equal((await runner.run('for i in range(100):\n    move_up()')).length, 100)
  await assert.rejects(runner.run('for i in range(101):\n    move_up()'), /limit 100/)
  await assert.rejects(runner.run(`
try:
    for i in range(101):
        move_down()
except Exception:
    pass
`), /limit 100/)
})

test('nieskończona pętla jest przerywana po 2 sekundach, następny program działa', async () => {
  const runner = new PythonRunner(createRealWorker)
  await assert.rejects(runner.run('move_up()\nwhile True:\n    pass'), /2 sekund/)
  assert.deepEqual(await runner.run('move_left()'), ['move_left'])
})

test('blokuje równoczesne uruchomienia i nie przenosi zmiennych między programami', async () => {
  const runner = new PythonRunner(createRealWorker)
  const first = runner.run('x = 1\nmove_up()')
  await assert.rejects(runner.run('move_down()'), /już działa/)
  assert.deepEqual(await first, ['move_up'])
  await assert.rejects(runner.run('print(x)'), /NameError/)
})

class FakeWorker implements PythonWorker {
  onmessage: PythonWorker['onmessage'] = null
  onerror: PythonWorker['onerror'] = null
  requests: PythonRequest[] = []
  terminated = false
  postMessage(message: PythonRequest) { this.requests.push(message) }
  terminate() { this.terminated = true }
  send(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })) }
}

test('główny wątek sprawdza nazwy i rozmiar listy odebranej z Workera', async () => {
  for (const commands of [['jump'], Array(101).fill('move_up'), 'move_up']) {
    const worker = new FakeWorker()
    const runner = new PythonRunner(() => worker)
    const result = runner.run('move_up()')
    worker.send({ type: 'ready' })
    worker.send({ type: 'result', commands })
    await assert.rejects(result, /Nieprawidłowa/)
    assert.equal(worker.terminated, true)
  }
})

test('czeka na załadowanie środowiska, a dispose kończy Worker i zwalnia blokadę', async () => {
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const result = runner.run('move_up()')
  assert.deepEqual(worker.requests, [{ type: 'init' }])
  runner.dispose()
  await assert.rejects(result, /anulowano/)
  assert.equal(worker.terminated, true)
  const next = runner.run('move_down()')
  worker.send({ type: 'ready' })
  assert.deepEqual(worker.requests.at(-1), { type: 'run', code: 'move_down()' })
  worker.send({ type: 'result', commands: ['move_down'] })
  assert.deepEqual(await next, ['move_down'])
})
