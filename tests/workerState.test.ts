import assert from 'node:assert/strict'
import test from 'node:test'
import { completeWorkerMove, createWorkerState, getFacingTile } from '../src/game/workerState.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { kingdomMap } from '../src/game/map.ts'
import type { Direction } from '../src/game/movement.ts'

test('początkowo robotnik patrzy w dół', () => {
  assert.deepEqual(createWorkerState({ column: 2, row: 2 }), { column: 2, row: 2, facing: 'down' })
})

test('każdy ukończony ruch aktualizuje pozycję i kierunek bez modyfikowania poprzedniego stanu', () => {
  const worker = createWorkerState({ column: 2, row: 2 })
  for (const direction of ['up', 'down', 'left', 'right'] as const) {
    const destination = getWorkerDestination(kingdomMap, worker, direction)
    assert(destination)
    assert.deepEqual(completeWorkerMove(worker, destination, direction), { ...destination, facing: direction })
  }
  assert.deepEqual(worker, { column: 2, row: 2, facing: 'down' })
})

test('ruch zablokowany przez drzewo, zamek lub granicę nie zmienia kierunku', () => {
  const cases: { column: number; row: number; direction: Direction }[] = [
    { column: 5, row: 2, direction: 'up' },
    { column: 5, row: 4, direction: 'left' },
    { column: 0, row: 0, direction: 'up' },
  ]
  for (const { column, row, direction } of cases) {
    const worker = createWorkerState({ column, row })
    const destination = getWorkerDestination(kingdomMap, worker, direction)
    assert.equal(destination, null)
    assert.equal(completeWorkerMove(worker, destination, direction), worker)
  }
})

test('pole przed robotnikiem zależy wyłącznie od pozycji i kierunku', () => {
  const expected = {
    up: { column: 3, row: 2 }, down: { column: 3, row: 4 },
    left: { column: 2, row: 3 }, right: { column: 4, row: 3 },
  }
  for (const facing of ['up', 'down', 'left', 'right'] as const) {
    assert.deepEqual(getFacingTile({ column: 3, row: 3, facing }), expected[facing])
  }
})
