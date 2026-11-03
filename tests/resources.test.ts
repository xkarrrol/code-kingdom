import assert from 'node:assert/strict'
import test from 'node:test'
import { chopWood, createResources, depositWood, getInventory } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { WorkerCommands } from '../src/game/commands.ts'
import { completeWorkerMove, createWorkerState } from '../src/game/workerState.ts'
import type { WorkerState } from '../src/game/workerState.ts'

test('każde drzewo otrzymuje 3 drewna, licznik zaczyna od zera, mapa pozostaje niezmieniona', () => {
  const before = structuredClone(kingdomMap)
  const state = createResources(kingdomMap.trees)
  assert.equal(state.worker.wood, 0)
  assert.equal(state.kingdom.wood, 0)
  assert.deepEqual(getInventory(state), { wood: 0, stone: 0, planks: 0, capacity: 5 })
  assert.equal(state.trees.length, kingdomMap.trees.length)
  assert(state.trees.every(tree => tree.amount === 3))
  assert.deepEqual(kingdomMap, before)
})

test('pełny ekwipunek zatrzymuje ścinanie bez zużycia drewna z drzewa', () => {
  let resources = createResources([{ column: 3, row: 2 }, { column: 4, row: 3 }])
  for (let i = 0; i < 3; i++) resources = chopWood(resources, { column: 3, row: 3, facing: 'up' })
  for (let i = 0; i < 2; i++) resources = chopWood(resources, { column: 3, row: 3, facing: 'right' })
  assert.deepEqual(getInventory(resources), { wood: 5, stone: 0, planks: 0, capacity: 5 })
  const before = structuredClone(resources)
  assert.equal(chopWood(resources, { column: 3, row: 3, facing: 'right' }), resources)
  assert.deepEqual(resources, before)
  assert.equal(resources.trees[0].amount, 1)
  assert.equal(resources.kingdom.wood, 0)
})

test('dostawa działa na całym obwodzie zamku, bez względu na kierunek patrzenia', () => {
  const castle = kingdomMap.castle
  const positions = [
    { column: 2, row: 3 }, { column: 2, row: 4 }, { column: 5, row: 3 }, { column: 5, row: 4 },
    { column: 3, row: 2 }, { column: 4, row: 2 }, { column: 3, row: 5 }, { column: 4, row: 5 },
  ]
  for (const position of positions) {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      const resources = { ...createResources([]), worker: { wood: 5, stone: 0, planks: 0 }, kingdom: { wood: 2, stone: 0, planks: 0 } }
      const worker = { ...position, facing }
      const next = depositWood(resources, worker, castle)
      assert.equal(next.worker.wood, 0)
      assert.equal(next.kingdom.wood, 7)
      assert.equal(depositWood(next, worker, castle), next)
      assert.equal(resources.worker.wood, 5)
      assert.equal(resources.kingdom.wood, 2)
    }
  }
})

test('dostawa z daleka, po skosie, wewnątrz zamku i z pustym ekwipunkiem nic nie zmienia', () => {
  const resources = { ...createResources([]), worker: { wood: 3, stone: 0, planks: 0 } }
  for (const position of [
    { column: 0, row: 0 }, { column: 2, row: 2 }, { column: 5, row: 2 },
    { column: 2, row: 5 }, { column: 5, row: 5 }, { column: 3, row: 3 },
  ]) assert.equal(depositWood(resources, position, kingdomMap.castle), resources)
  const empty = createResources([])
  assert.equal(depositWood(empty, kingdomMap.worker, kingdomMap.castle), empty)
})

test('dostawa zwalnia miejsce na kolejne drewno; odczyt ekwipunku jest kopią', () => {
  let resources = { ...createResources([{ column: 5, row: 2 }]), worker: { wood: 5, stone: 0, planks: 0 } }
  resources = depositWood(resources, { column: 5, row: 3 }, kingdomMap.castle)
  resources = chopWood(resources, { column: 5, row: 3, facing: 'up' })
  assert.deepEqual(getInventory(resources), { wood: 1, stone: 0, planks: 0, capacity: 5 })
  assert.equal(resources.kingdom.wood, 5)
  const copy = getInventory(resources)
  copy.wood = 99
  copy.capacity = 99
  assert.deepEqual(getInventory(resources), { wood: 1, stone: 0, planks: 0, capacity: 5 })
})

test('ścinanie działa z czterech sąsiednich pól i zbiera dokładnie jedną jednostkę', () => {
  const workers: WorkerState[] = [
    { column: 3, row: 2, facing: 'down' }, { column: 3, row: 4, facing: 'up' },
    { column: 2, row: 3, facing: 'right' }, { column: 4, row: 3, facing: 'left' },
  ]
  for (const worker of workers) {
    const state = createResources([{ column: 3, row: 3 }])
    const next = chopWood(state, worker)
    assert.equal(next.worker.wood, 1)
    assert.equal(next.trees[0].amount, 2)
    assert.equal(state.trees[0].amount, 3)
    assert.equal(state.worker.wood, 0)
  }
})

test('brak sąsiedniego drzewa, skos i to samo pole nie dają drewna', () => {
  const state = createResources([{ column: 3, row: 3 }])
  for (const worker of [
    { column: 2, row: 2 }, { column: 3, row: 3 }, { column: 0, row: 0 },
  ]) assert.equal(chopWood(state, createWorkerState(worker)), state)
  const empty = createResources([])
  assert.equal(chopWood(empty, createWorkerState({ column: 0, row: 0 })), empty)
})

test('trzecie ścinanie usuwa drzewo i odblokowuje pole; czwarte nie zwiększa licznika', () => {
  const worker: WorkerState = { column: 5, row: 2, facing: 'up' }
  let state = createResources([{ column: 5, row: 1 }])
  assert.equal(getWorkerDestination({ ...kingdomMap, trees: state.trees }, worker, 'up'), null)
  for (let i = 0; i < 3; i++) state = chopWood(state, worker)
  assert.equal(state.worker.wood, 3)
  assert.deepEqual(state.trees, [])
  assert.deepEqual(getWorkerDestination({ ...kingdomMap, trees: state.trees }, worker, 'up'), { column: 5, row: 1 })
  assert.equal(chopWood(state, worker), state)
})

test('przy wielu drzewach wybiera wyłącznie drzewo przed robotnikiem', () => {
  const state = createResources([
    { column: 4, row: 3 }, { column: 2, row: 3 },
    { column: 3, row: 4 }, { column: 3, row: 2 },
  ])
  const next = chopWood(state, { column: 3, row: 3, facing: 'right' })
  assert.deepEqual(next.trees.map(tree => tree.amount), [2, 3, 3, 3])
  assert.equal(next.worker.wood, 1)
})

test('ścinanie czeka na zakończenie ruchu i zachowuje kolejność sekwencji', async () => {
  let position = createWorkerState({ column: 5, row: 3 })
  let state = createResources([{ column: 5, row: 1 }])
  let finish!: (moved: boolean) => void
  const commands = new WorkerCommands(
    () => new Promise(resolve => {
      finish = moved => {
        position = completeWorkerMove(position, { column: 5, row: 2 }, 'up')
        resolve(moved)
      }
    }),
    async () => {
      const next = chopWood(state, position)
      const changed = next !== state
      state = next
      return changed
    },
  )
  const sequence = commands.runCommands(['chop_wood', 'move_up', 'chop_wood', 'chop_wood'])
  await Promise.resolve()
  assert.equal(state.worker.wood, 0)
  finish(true)
  await sequence
  assert.equal(state.worker.wood, 2)
  assert.equal(state.trees[0].amount, 1)
  // Kolejny program korzysta z zachowanego stanu zasobów.
  await commands.runCommands(['chop_wood'])
  assert.equal(state.worker.wood, 3)
  assert.deepEqual(state.trees, [])
})

test('drzewa po bokach i za robotnikiem pozostają nietknięte; komendy idą dalej', async () => {
  let state = createResources([{ column: 1, row: 2 }, { column: 2, row: 3 }, { column: 4, row: 2 }])
  let worker: WorkerState = { column: 2, row: 2, facing: 'up' }
  const results: boolean[] = []
  const runner = new WorkerCommands(async direction => {
    const destination = getWorkerDestination({ ...kingdomMap, trees: state.trees }, worker, direction)
    if (!destination) return false
    worker = completeWorkerMove(worker, destination, direction)
    return true
  }, async () => {
    const next = chopWood(state, worker)
    results.push(next !== state)
    state = next
    return results.at(-1)!
  })
  await runner.runCommands(['chop_wood', 'move_right', 'chop_wood'])
  assert.deepEqual(results, [false, true])
  assert.equal(state.worker.wood, 1)
})

test('wyczerpanie drzewa z przodu nie przenosi ścinania na drugie sąsiednie drzewo', () => {
  let state = createResources([{ column: 3, row: 2 }, { column: 4, row: 3 }])
  const worker: WorkerState = { column: 3, row: 3, facing: 'up' }
  for (let i = 0; i < 5; i++) state = chopWood(state, worker)
  assert.equal(state.worker.wood, 3)
  assert.deepEqual(state.trees, [{ column: 4, row: 3, amount: 3 }])
})
