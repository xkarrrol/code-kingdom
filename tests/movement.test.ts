import assert from 'node:assert/strict'
import test from 'node:test'
import { kingdomMap } from '../src/game/map.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import type { Direction } from '../src/game/movement.ts'

test('każdy kierunek przesuwa dokładnie o jedno pole', () => {
  const position = { column: 2, row: 2 }
  for (const [direction, expected] of [
    ['up', { column: 2, row: 1 }],
    ['down', { column: 2, row: 3 }],
    ['left', { column: 1, row: 2 }],
    ['right', { column: 3, row: 2 }],
  ] as const) {
    assert.deepEqual(getWorkerDestination(kingdomMap, position, direction), expected)
  }
})

test('wszystkie krawędzie planszy blokują wyjście', () => {
  for (let coordinate = 0; coordinate < kingdomMap.rows; coordinate++) {
    assert.equal(getWorkerDestination(kingdomMap, { column: 0, row: coordinate }, 'left'), null)
    assert.equal(getWorkerDestination(kingdomMap, { column: kingdomMap.columns - 1, row: coordinate }, 'right'), null)
  }
  for (let coordinate = 0; coordinate < kingdomMap.columns; coordinate++) {
    assert.equal(getWorkerDestination(kingdomMap, { column: coordinate, row: 0 }, 'up'), null)
    assert.equal(getWorkerDestination(kingdomMap, { column: coordinate, row: kingdomMap.rows - 1 }, 'down'), null)
  }
})

test('świat ma 30 na 20 pól po 64 px i robotnik może wejść poza dawny obszar 8 na 8', () => {
  assert.equal(kingdomMap.columns, 30)
  assert.equal(kingdomMap.rows, 20)
  assert.equal(kingdomMap.tileSize, 64)
  assert.deepEqual(getWorkerDestination(kingdomMap, { column: 7, row: 10 }, 'right'), { column: 8, row: 10 })
  assert.deepEqual(getWorkerDestination(kingdomMap, { column: 10, row: 7 }, 'down'), { column: 10, row: 8 })
})

test('każde drzewo i wszystkie cztery pola zamku blokują wejście z każdej strony', () => {
  const { castle } = kingdomMap
  const blocked = [...kingdomMap.trees]
  for (let column = castle.column; column < castle.column + castle.columns; column++) {
    for (let row = castle.row; row < castle.row + castle.rows; row++) {
      blocked.push({ column, row })
    }
  }
  for (const target of blocked) {
    const approaches: [Direction, number, number][] = [
      ['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0],
    ]
    for (const [direction, columnOffset, rowOffset] of approaches) {
      const start = { column: target.column + columnOffset, row: target.row + rowOffset }
      assert.equal(getWorkerDestination(kingdomMap, start, direction), null)
    }
  }
})

test('robotnik może poruszać się obok przeszkody, a dane wejściowe pozostają bez zmian', () => {
  const before = structuredClone(kingdomMap)
  const start = { ...kingdomMap.worker }
  assert.equal(getWorkerDestination(kingdomMap, start, 'left'), null)
  assert.deepEqual(getWorkerDestination(kingdomMap, start, 'up'), { column: 5, row: 3 })
  assert.deepEqual(start, kingdomMap.worker)
  assert.deepEqual(kingdomMap, before)
})
