import assert from 'node:assert/strict'
import test from 'node:test'
import { WorkerBridge } from '../src/python/WorkerBridge.ts'
import type { PythonMessage } from '../src/python/messages.ts'

test('most dopasowuje odpowiedzi po obu identyfikatorach, również poza kolejnością', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('run-A', message => sent.push(message))
  const first = bridge.getWorkerPosition()
  const second = bridge.getWorkerPosition()
  assert.deepEqual(sent, [
    { type: 'query', runId: 'run-A', requestId: 1, operation: 'get_worker_position' },
    { type: 'query', runId: 'run-A', requestId: 2, operation: 'get_worker_position' },
  ])
  bridge.receive({ type: 'response', runId: 'old-run', requestId: 1, ok: true, value: { x: 99, y: 99 } })
  bridge.receive({ type: 'response', runId: 'run-A', requestId: 99, ok: true, value: { x: 99, y: 99 } })
  bridge.receive({ type: 'response', runId: 'run-A', requestId: 2, ok: true, value: { x: 7, y: 6 } })
  bridge.receive({ type: 'response', runId: 'run-A', requestId: 1, ok: true, value: { x: 5, y: 4 } })
  assert.deepEqual(await first, { x: 5, y: 4 })
  assert.deepEqual(await second, { x: 7, y: 6 })
})

test('błędy odpowiedzi i nieprawidłowe współrzędne odrzucają oczekujące zapytanie', async () => {
  const bridge = new WorkerBridge('run-A', () => {})
  const error = bridge.getWorkerPosition()
  bridge.receive({ type: 'response', runId: 'run-A', requestId: 1, ok: false, error: 'Odczyt niedostępny' })
  await assert.rejects(error, /Odczyt niedostępny/)
  const invalid = bridge.getWorkerPosition()
  bridge.receive({ type: 'response', runId: 'run-A', requestId: 2, ok: true, value: { x: -1, y: 2 } })
  await assert.rejects(invalid, /Nieprawidłowa odpowiedź/)
})

test('zamknięcie mostu zwalnia oczekujące zapytania', async () => {
  const bridge = new WorkerBridge('run-A', () => {})
  const pending = bridge.getWorkerPosition()
  bridge.dispose()
  await assert.rejects(pending, /zamknięty/)
  await assert.rejects(bridge.executeCommand('move_up'), /zamknięty/)
})

test('komendy i odczyty mają wspólne requestId, osobne limity i sprawdzane typy wyników', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('run-A', message => sent.push(message))
  for (let i = 0; i < 100; i++) {
    const action = bridge.executeCommand('move_right')
    assert.deepEqual(sent.at(-1), { type: 'command', runId: 'run-A', requestId: 2 * i + 1, command: 'move_right' })
    bridge.receive({ type: 'response', runId: 'run-A', requestId: 2 * i + 1, ok: true, value: false })
    assert.equal(await action, false)
    const query = bridge.getWorkerPosition()
    bridge.receive({ type: 'response', runId: 'run-A', requestId: 2 * i + 2, ok: true, value: { x: 5, y: 4 } })
    assert.deepEqual(await query, { x: 5, y: 4 })
  }
  await assert.rejects(bridge.executeCommand('turn_up'), /100 komend/)
  assert.throws(() => bridge.checkLimits(), /100 komend/)
  assert.equal(sent.length, 200)

  const invalidBridge = new WorkerBridge('run-B', () => {})
  const invalid = invalidBridge.executeCommand('move_up')
  invalidBridge.receive({ type: 'response', runId: 'run-B', requestId: 1, ok: true, value: { x: 5, y: 4 } })
  await assert.rejects(invalid, /Nieprawidłowa odpowiedź/)
})

test('most ogranicza liczbę zapytań niezależnie od liczby komend', async () => {
  const bridge = new WorkerBridge('run-A', () => {})
  const requests = Array.from({ length: 100 }, () => bridge.getWorkerPosition())
  const all = Promise.allSettled(requests)
  await assert.rejects(bridge.getWorkerPosition(), /100 zapytań/)
  bridge.dispose()
  assert((await all).every(result => result.status === 'rejected'))
})

test('tree_ahead przechodzi przez protokół, wymaga boolean i dzieli limit odczytów', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('run-tree', message => sent.push(message))
  const query = bridge.treeAhead()
  assert.deepEqual(sent[0], { type: 'query', runId: 'run-tree', requestId: 1, operation: 'tree_ahead' })
  bridge.receive({ type: 'response', runId: 'run-tree', requestId: 1, ok: true, value: false })
  assert.equal(await query, false)
  for (let requestId = 2; requestId <= 100; requestId++) {
    const position = bridge.getWorkerPosition()
    bridge.receive({ type: 'response', runId: 'run-tree', requestId, ok: true, value: { x: 5, y: 4 } })
    await position
  }
  await assert.rejects(bridge.treeAhead(), /100 zapytań/)
  assert.equal(sent.length, 100)

  const invalid = new WorkerBridge('invalid', () => {})
  const result = invalid.treeAhead()
  invalid.receive({ type: 'response', runId: 'invalid', requestId: 1, ok: true, value: { x: 5, y: 4 } })
  await assert.rejects(result, /Nieprawidłowa odpowiedź/)
})

test('stone_ahead używa identyfikatorów i wspólnego limitu 100 odczytów', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('stone', message => sent.push(message))
  for (let requestId = 1; requestId <= 100; requestId++) {
    const query = bridge.stoneAhead()
    assert.deepEqual(sent.at(-1), { type: 'query', runId: 'stone', requestId, operation: 'stone_ahead' })
    bridge.receive({ type: 'response', runId: 'stone', requestId, ok: true, value: true })
    assert.equal(await query, true)
  }
  await assert.rejects(bridge.getInventory(), /100 zapytań/)
  assert.equal(sent.length, 100)
})

test('magazyn tartaku ma własny typ odpowiedzi, pasujące identyfikatory i wspólny limit odczytów', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('sawmill', message => sent.push(message))
  for (let requestId = 1; requestId <= 100; requestId++) {
    const result = bridge.getSawmillInventory()
    assert.deepEqual(sent.at(-1), { type: 'query', runId: 'sawmill', requestId, operation: 'get_sawmill_inventory' })
    bridge.receive({ type: 'response', runId: 'old', requestId, ok: true, value: { wood: 1, planks: 0 } })
    bridge.receive({ type: 'response', runId: 'sawmill', requestId, ok: true, value: { wood: 10, planks: 10 } })
    assert.deepEqual(await result, { wood: 10, planks: 10 })
  }
  await assert.rejects(bridge.getInventory(), /100 zapytań/)
  assert.equal(sent.length, 100)
})

test('magazyn tartaku odrzuca niepoprawne ilości i nie ujawnia dodatkowych danych', async () => {
  for (const value of [false, { wood: 11, planks: 0 }, { wood: 0, planks: 11 }, { wood: -1, planks: 0 },
    { wood: 1.5, planks: 0 }, { wood: 0 }, { wood: 1, planks: 1, capacity: 10 }]) {
    const bridge = new WorkerBridge('invalid', () => {})
    const result = bridge.getSawmillInventory()
    bridge.receive({ type: 'response', runId: 'invalid', requestId: 1, ok: true, value } as Parameters<WorkerBridge['receive']>[0])
    await assert.rejects(result, /Nieprawidłowa odpowiedź/)
  }
})

test('get_inventory weryfikuje ekwipunek i korzysta ze wspólnego limitu odczytów', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('inventory', message => sent.push(message))
  for (let requestId = 1; requestId <= 100; requestId++) {
    const result = bridge.getInventory()
    assert.deepEqual(sent.at(-1), { type: 'query', runId: 'inventory', requestId, operation: 'get_inventory' })
    bridge.receive({ type: 'response', runId: 'inventory', requestId, ok: true, value: { wood: 5, stone: 0, planks: 0, capacity: 5 } })
    assert.deepEqual(await result, { wood: 5, stone: 0, planks: 0, capacity: 5 })
  }
  await assert.rejects(bridge.getWorkerPosition(), /100 zapytań/)
  assert.equal(sent.length, 100)
  for (const value of [{ wood: 6, stone: 0, planks: 0, capacity: 5 }, { wood: -1, stone: 0, planks: 0, capacity: 5 }, { wood: 1.5, stone: 0, planks: 0, capacity: 5 }, { wood: 1, stone: 0, planks: 0, capacity: 10 }, { wood: 3, stone: 3, planks: 0, capacity: 5 }, { wood: 0, stone: -1, planks: 0, capacity: 5 }, { wood: 2, stone: 1, planks: 3, capacity: 5 }, { wood: 0, stone: 0, planks: -1, capacity: 5 }]) {
    const invalid = new WorkerBridge('invalid', () => {})
    const result = invalid.getInventory()
    invalid.receive({ type: 'response', runId: 'invalid', requestId: 1, ok: true, value })
    await assert.rejects(result, /Nieprawidłowa odpowiedź/)
  }
})

test('get_surroundings wysyła jedno zapytanie i współdzieli limit z pozostałymi odczytami', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('nearby', message => sent.push(message))
  const nearby = { up: 'tree', down: 'water', left: 'castle', right: 'empty' } as const
  for (let requestId = 1; requestId <= 99; requestId++) {
    const result = bridge.getSurroundings()
    assert.deepEqual(sent.at(-1), { type: 'query', runId: 'nearby', requestId, operation: 'get_surroundings' })
    bridge.receive({ type: 'response', runId: 'nearby', requestId, ok: true, value: nearby })
    assert.deepEqual(await result, nearby)
  }
  const position = bridge.getWorkerPosition()
  bridge.receive({ type: 'response', runId: 'nearby', requestId: 100, ok: true, value: { x: 5, y: 4 } })
  await position
  await assert.rejects(bridge.getSurroundings(), /100 zapytań/)
  assert.equal(sent.length, 100)
})

test('get_surroundings odrzuca nieznane typy, brakujące kierunki i dodatkowe informacje', async () => {
  const valid = { up: 'empty', down: 'tree', left: 'mountain', right: 'boundary' }
  for (const value of [false, { ...valid, up: 'grass' }, { ...valid, right: undefined }, { ...valid, distant: 'tree' }]) {
    const bridge = new WorkerBridge('invalid', () => {})
    const result = bridge.getSurroundings()
    bridge.receive({ type: 'response', runId: 'invalid', requestId: 1, ok: true, value } as Parameters<WorkerBridge['receive']>[0])
    await assert.rejects(result, /Nieprawidłowa odpowiedź/)
  }
})

test('can_move przesyła kierunek, wymaga boolean i dzieli limit z odczytem pozycji', async () => {
  const sent: PythonMessage[] = []
  const bridge = new WorkerBridge('run-A', message => sent.push(message))
  for (let i = 0; i < 100; i++) {
    const isPosition = i % 2 === 0
    const result = isPosition ? bridge.getWorkerPosition() : bridge.canMove('left')
    assert.deepEqual(sent.at(-1), isPosition
      ? { type: 'query', runId: 'run-A', requestId: i + 1, operation: 'get_worker_position' }
      : { type: 'query', runId: 'run-A', requestId: i + 1, operation: 'can_move', direction: 'left' })
    bridge.receive({ type: 'response', runId: 'run-A', requestId: i + 1, ok: true, value: isPosition ? { x: 5, y: 4 } : false })
    assert.deepEqual(await result, isPosition ? { x: 5, y: 4 } : false)
  }
  await assert.rejects(bridge.canMove('right'), /100 zapytań/)
  assert.throws(() => bridge.checkLimits(), /100 zapytań/)
  assert.equal(sent.length, 100)

  const invalidBridge = new WorkerBridge('run-B', () => {})
  const result = invalidBridge.canMove('up')
  invalidBridge.receive({ type: 'response', runId: 'run-B', requestId: 1, ok: true, value: { x: 5, y: 4 } })
  await assert.rejects(result, /Nieprawidłowa odpowiedź/)
})

