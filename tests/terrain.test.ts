import assert from 'node:assert/strict'
import test from 'node:test'
import { kingdomMap } from '../src/game/map.ts'
import { isTerrainWalkable } from '../src/game/terrain.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import type { Direction } from '../src/game/movement.ts'
import { chopWood, createResources } from '../src/game/resources.ts'

const directions: Direction[] = ['up', 'down', 'left', 'right']
const inCastle = (column: number, row: number) => {
  const castle = kingdomMap.castle
  return column >= castle.column && column < castle.column + castle.columns
    && row >= castle.row && row < castle.row + castle.rows
}

test('ręczna mapa ma 20 wierszy po 30 pól i zawiera wszystkie pięć typów terenu', () => {
  assert.equal(kingdomMap.columns, 30)
  assert.equal(kingdomMap.rows, 20)
  assert.equal(kingdomMap.tileSize, 64)
  assert.equal(kingdomMap.terrain.length, kingdomMap.rows)
  const types = new Set(['grass', 'forest', 'water', 'mountain', 'path'])
  const present = new Set<string>()
  for (const row of kingdomMap.terrain) {
    assert.equal(row.length, kingdomMap.columns)
    for (const tile of row) {
      assert(types.has(tile))
      present.add(tile)
    }
  }
  assert.deepEqual(present, types)
})

test('trawa, las i ścieżka są dostępne, woda i skały niedostępne', () => {
  for (const terrain of ['grass', 'forest', 'path'] as const) assert.equal(isTerrainWalkable(terrain), true)
  for (const terrain of ['water', 'mountain', undefined] as const) assert.equal(isTerrainWalkable(terrain), false)
})

test('zamek, robotnik i drzewa znajdują się na dostępnym podłożu w granicach mapy', () => {
  const { castle, worker, trees } = kingdomMap
  const points = [worker, ...trees]
  for (let column = castle.column; column < castle.column + castle.columns; column++) {
    for (let row = castle.row; row < castle.row + castle.rows; row++) points.push({ column, row })
  }
  for (const point of points) {
    assert(point.column >= 0 && point.column < 30 && point.row >= 0 && point.row < 20)
    assert(isTerrainWalkable(kingdomMap.terrain[point.row][point.column]))
  }
  assert.equal(inCastle(worker.column, worker.row), false)
  assert(!trees.some(tree => tree.column === worker.column && tree.row === worker.row))
  assert.equal(new Set(trees.map(tree => `${tree.column},${tree.row}`)).size, trees.length)
  assert(trees.every(tree => !inCastle(tree.column, tree.row)))
})

test('kolizje sprawdzają teren każdego pola ze wszystkich czterech stron', () => {
  // Wyłączamy obiekty drzew, żeby sprawdzić samą warstwę terenu.
  const map = { ...kingdomMap, trees: [], stones: [] }
  const approaches: [Direction, number, number][] = [
    ['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0],
  ]
  for (let row = 0; row < map.rows; row++) {
    for (let column = 0; column < map.columns; column++) {
      for (const [direction, dx, dy] of approaches) {
        const start = { column: column + dx, row: row + dy }
        if (start.column < 0 || start.column >= map.columns || start.row < 0 || start.row >= map.rows) continue
        const expected = isTerrainWalkable(map.terrain[row][column]) && !inCastle(column, row) ? { column, row } : null
        assert.deepEqual(getWorkerDestination(map, start, direction), expected, `${column},${row}: ${direction}`)
      }
    }
  }
})

test('robotnik może opuścić start i dojść do wszystkich dostępnych obszarów bez ścinania', () => {
  const visited = new Set([`${kingdomMap.worker.column},${kingdomMap.worker.row}`])
  const queue = [{ ...kingdomMap.worker }]
  for (let i = 0; i < queue.length; i++) {
    for (const direction of directions) {
      const next = getWorkerDestination(kingdomMap, queue[i], direction)
      if (!next) continue
      const key = `${next.column},${next.row}`
      if (visited.has(key)) continue
      visited.add(key)
      queue.push(next)
    }
  }
  assert(visited.has('29,12'), 'Dostęp do wschodniej części świata')
  assert(visited.has('12,19'), 'Dostęp do południowej części świata')
  assert(visited.has('0,19'), 'Możliwość obejścia jeziora od zachodu')
  for (let row = 0; row < kingdomMap.rows; row++) {
    for (let column = 0; column < kingdomMap.columns; column++) {
      if (!isTerrainWalkable(kingdomMap.terrain[row][column]) || inCastle(column, row)) continue
      if (kingdomMap.trees.some(tree => tree.column === column && tree.row === row)) continue
      if (kingdomMap.stones.some(stone => stone.column === column && stone.row === row)) continue
      assert(visited.has(`${column},${row}`), `Odcięte dostępne pole: ${column},${row}`)
    }
  }
})

test('teren leśny nie zastępuje drzewa jako przeszkody ani źródła drewna', () => {
  const emptyResources = createResources([])
  const worker = { column: 1, row: 0, facing: 'left' as const }
  assert.equal(kingdomMap.terrain[0][0], 'forest')
  assert.deepEqual(getWorkerDestination({ ...kingdomMap, trees: [] }, worker, 'left'), { column: 0, row: 0 })
  assert.equal(chopWood(emptyResources, worker), emptyResources)
})
