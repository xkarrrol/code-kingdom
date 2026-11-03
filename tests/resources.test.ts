import assert from 'node:assert/strict'
import test from 'node:test'
import { chopWood, createResources } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { WorkerCommands } from '../src/game/commands.ts'
import { completeWorkerMove, createWorkerState } from '../src/game/workerState.ts'
import type { WorkerState } from '../src/game/workerState.ts'

test('każde drzewo otrzymuje 3 drewna, licznik zaczyna od zera, mapa pozostaje niezmieniona', () => {
  const before = structuredClone(kingdomMap)
  const state = createResources(kingdomMap.trees)
  assert.equal(state.collectedWood, 0)
  assert.equal(state.trees.length, kingdomMap.trees.length)
  assert(state.trees.every(tree => tree.wood === 3))
  assert.deepEqual(kingdomMap, before)
})

test('ścinanie działa z czterech sąsiednich pól i zbiera dokładnie jedną jednostkę', () => {
  const workers: WorkerState[] = [
    { column: 3, row: 2, facing: 'down' }, { column: 3, row: 4, facing: 'up' },
    { column: 2, row: 3, facing: 'right' }, { column: 4, row: 3, facing: 'left' },
  ]
  for (const worker of workers) {
    const state = createResources([{ column: 3, row: 3 }])
    const next = chopWood(state, worker)
    assert.equal(next.collectedWood, 1)
    assert.equal(next.trees[0].wood, 2)
    assert.equal(state.trees[0].wood, 3)
    assert.equal(state.collectedWood, 0)
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
  assert.equal(state.collectedWood, 3)
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
  assert.deepEqual(next.trees.map(tree => tree.wood), [2, 3, 3, 3])
  assert.equal(next.collectedWood, 1)
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
  assert.equal(state.collectedWood, 0)
  finish(true)
  await sequence
  assert.equal(state.collectedWood, 2)
  assert.equal(state.trees[0].wood, 1)
  // Kolejny program korzysta z zachowanego stanu zasobów.
  await commands.runCommands(['chop_wood'])
  assert.equal(state.collectedWood, 3)
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
  assert.equal(state.collectedWood, 1)
})

test('wyczerpanie drzewa z przodu nie przenosi ścinania na drugie sąsiednie drzewo', () => {
  let state = createResources([{ column: 3, row: 2 }, { column: 4, row: 3 }])
  const worker: WorkerState = { column: 3, row: 3, facing: 'up' }
  for (let i = 0; i < 5; i++) state = chopWood(state, worker)
  assert.equal(state.collectedWood, 3)
  assert.deepEqual(state.trees, [{ column: 4, row: 3, wood: 3 }])
})
