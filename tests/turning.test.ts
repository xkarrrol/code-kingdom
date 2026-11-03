import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkerState, turnWorker, completeWorkerMove } from '../src/game/workerState.ts'
import { WorkerCommands } from '../src/game/commands.ts'
import { createResources, chopWood } from '../src/game/resources.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { kingdomMap } from '../src/game/map.ts'

test('cztery kierunki obrotu nie zmieniają pozycji ani poprzedniego stanu', () => {
  const worker = createWorkerState({ column: 0, row: 0 })
  for (const direction of ['up', 'down', 'left', 'right'] as const) {
    assert.deepEqual(turnWorker(worker, direction), { column: 0, row: 0, facing: direction })
  }
  assert.deepEqual(worker, { column: 0, row: 0, facing: 'down' })
})

test('komendy obrotu trafiają do obsługi obrotu, bez wykonywania ruchu', async () => {
  const directions: string[] = []
  const runner = new WorkerCommands(
    async () => { assert.fail('Obrót nie może wywołać ruchu') },
    async () => { assert.fail('Obrót nie może ścinać') },
    async direction => { directions.push(direction); return true },
  )
  await runner.runCommands(['turn_up', 'turn_down', 'turn_left', 'turn_right'])
  assert.deepEqual(directions, ['up', 'down', 'left', 'right'])
})

test('obrót i ścinanie czekają na animację poprzedniego ruchu', async () => {
  const events: string[] = []
  let finish!: (moved: boolean) => void
  const runner = new WorkerCommands(
    () => new Promise(resolve => { events.push('move'); finish = resolve }),
    async () => { events.push('chop'); return true },
    async direction => { events.push(`turn:${direction}`); return true },
  )
  const result = runner.runCommands(['move_up', 'turn_right', 'chop_wood', 'turn_down'])
  assert.deepEqual(events, ['move'])
  finish(true)
  await result
  assert.deepEqual(events, ['move', 'turn:right', 'chop', 'turn:down'])
})

test('obrót wybiera drzewo do ścinania, wyczerpanie nie zmienia celu na sąsiednie drzewo', async () => {
  let worker = createWorkerState({ column: 2, row: 2 })
  let resources = createResources([{ column: 2, row: 1 }, { column: 3, row: 2 }])
  const runner = new WorkerCommands(async direction => {
    const destination = getWorkerDestination({ ...kingdomMap, trees: resources.trees }, worker, direction)
    worker = completeWorkerMove(worker, destination, direction)
    return destination !== null
  }, async () => {
    const next = chopWood(resources, worker)
    const changed = next !== resources
    resources = next
    return changed
  }, async direction => {
    worker = turnWorker(worker, direction)
    return true
  })
  await runner.runCommands(['turn_up', 'move_up', 'chop_wood', 'chop_wood', 'chop_wood', 'chop_wood'])
  assert.deepEqual(worker, { column: 2, row: 2, facing: 'up' })
  assert.equal(resources.workerWood, 3)
  assert.deepEqual(resources.trees, [{ column: 3, row: 2, wood: 3 }])
  await runner.runCommands(['turn_right', 'chop_wood'])
  assert.deepEqual(worker, { column: 2, row: 2, facing: 'right' })
  assert.equal(resources.workerWood, 4)
  assert.equal(resources.trees[0].wood, 2)
})
