import assert from 'node:assert/strict'
import test from 'node:test'
import { kingdomMap } from '../src/game/map.ts'
import { getSurroundings } from '../src/game/surroundings.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { chopWood, createResources } from '../src/game/resources.ts'
import type { TerrainType } from '../src/game/terrain.ts'

function smallMap() {
  return {
    ...kingdomMap, columns: 5, rows: 5,
    castle: { column: 1, row: 2, columns: 1, rows: 1 },
    trees: [{ column: 3, row: 2 }],
    terrain: Array.from({ length: 5 }, () => Array<TerrainType>(5).fill('grass')),
  }
}

test('cztery sąsiednie pola rozróżniają wodę, góry, zamek i drzewo', () => {
  const map = smallMap()
  map.terrain[1][2] = 'water'
  map.terrain[3][2] = 'mountain'
  const before = structuredClone(map)
  assert.deepEqual(getSurroundings(map, { column: 2, row: 2 }), {
    up: 'water', down: 'mountain', left: 'castle', right: 'tree',
  })
  assert.deepEqual(map, before)
})

test('trawa, ścieżka i przechodni las dają empty; krawędzie dają boundary', () => {
  const map = smallMap()
  map.terrain[0][1] = 'forest'
  map.terrain[1][0] = 'path'
  assert.deepEqual(getSurroundings(map, { column: 0, row: 0 }), {
    up: 'boundary', down: 'empty', left: 'boundary', right: 'empty',
  })
  assert.deepEqual(getSurroundings(map, { column: 4, row: 4 }), {
    up: 'empty', down: 'boundary', left: 'empty', right: 'boundary',
  })
})

test('dalsze pola i przekątne nie zmieniają opisu otoczenia', () => {
  const map = smallMap()
  const position = { column: 2, row: 2 }
  const before = getSurroundings(map, position)
  map.trees.push({ column: 3, row: 3 }, { column: 2, row: 0 })
  map.terrain[0][2] = 'water'
  map.terrain[3][3] = 'mountain'
  assert.deepEqual(getSurroundings(map, position), before)
  assert.deepEqual(Object.keys(before).sort(), ['down', 'left', 'right', 'up'])
})

test('ścięte drzewo znika z aktualnego opisu dopiero po wyczerpaniu drewna', () => {
  const map = smallMap()
  const worker = { column: 2, row: 2, facing: 'right' as const }
  let resources = createResources(map.trees)
  for (let i = 0; i < 3; i++) {
    assert.equal(getSurroundings({ ...map, trees: resources.trees }, worker).right, 'tree')
    resources = chopWood(resources, worker)
  }
  assert.equal(getSurroundings({ ...map, trees: resources.trees }, worker).right, 'empty')
})

test('opis empty zgadza się z kolizjami w każdym kierunku na całej mapie', () => {
  for (let row = 0; row < kingdomMap.rows; row++) {
    for (let column = 0; column < kingdomMap.columns; column++) {
      const position = { column, row }
      const nearby = getSurroundings(kingdomMap, position)
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        assert.equal(nearby[direction] === 'empty', getWorkerDestination(kingdomMap, position, direction) !== null)
      }
    }
  }
})
