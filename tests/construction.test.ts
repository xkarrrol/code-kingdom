import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBuilding, buildSawmill } from '../src/game/construction.ts'
import type { ConstructionState } from '../src/game/construction.ts'
import { buildingDefinitions, createBuilding, sawmillSite } from '../src/game/buildingData.ts'
import { kingdomMap } from '../src/game/map.ts'
import { createResources } from '../src/game/resources.ts'
import { getTileType, getWorkerDestination } from '../src/game/movement.ts'
import type { MovementMap } from '../src/game/movement.ts'
import { getSurroundings } from '../src/game/surroundings.ts'
import { getSelectableObjects } from '../src/game/selection.ts'
import { createMission, updateMission } from '../src/game/mission.ts'

const worker = { column: 7, row: 4 }
function prepared(wood = 3, stone = 2): ConstructionState {
  return { resources: { ...createResources(kingdomMap.trees, kingdomMap.stones), kingdom: { wood, stone, planks: 0 } }, buildings: [] }
}

test('stałe miejsce tartaku ma 2×2 wolne pola w pobliżu zamku', () => {
  assert.equal(buildingDefinitions.sawmill.columns, 2)
  assert.equal(buildingDefinitions.sawmill.rows, 2)
  for (let row = 5; row <= 6; row++) {
    for (let column = 7; column <= 8; column++) assert.equal(getTileType(kingdomMap, { column, row }), 'empty')
  }
  assert.deepEqual(getWorkerDestination(kingdomMap, worker, 'down'), { column: 7, row: 5 })
})

test('poprawna budowa odejmuje wyłącznie 3 drewna i 2 kamienie królestwa, bez mutowania wejścia', () => {
  for (const [wood, stone] of [[3, 2], [7, 5]]) {
    const state = prepared(wood, stone)
    state.resources.worker = { wood: 1, stone: 2, planks: 0 }
    const before = structuredClone(state)
    const result = buildSawmill(state, kingdomMap, worker)
    assert(result.ok)
    assert.deepEqual(result.state.resources.kingdom, { wood: wood - 3, stone: stone - 2, planks: 0 })
    assert.deepEqual(result.state.resources.worker, state.resources.worker)
    assert.deepEqual(result.state.buildings, [createBuilding(sawmillSite)])
    assert.deepEqual(state, before)
  }
})

test('brak dowolnego surowca odrzuca budowę; ekwipunek nie zastępuje zasobów królestwa', () => {
  for (const [wood, stone] of [[0, 0], [2, 2], [3, 1], [100, 0], [0, 100]]) {
    const state = prepared(wood, stone)
    state.resources.worker = { wood: 3, stone: 2, planks: 0 }
    const result = buildSawmill(state, kingdomMap, worker)
    assert.equal(result.ok, false)
    assert.equal(result.state, state)
    assert.match(result.message, /Brak zasobów/)
  }
})

test('ponowna budowa nie tworzy kolejnego budynku ani nie odejmuje kosztu', () => {
  const first = buildSawmill(prepared(10, 10), kingdomMap, worker)
  const repeat = buildSawmill(first.state, kingdomMap, worker)
  assert.equal(repeat.ok, false)
  assert.equal(repeat.state, first.state)
  assert.equal(repeat.state.buildings.length, 1)
  assert.match(repeat.message, /już istnieje/)
})

test('robotnik musi stać przy boku obszaru: każdy bok działa, skosy, wnętrze i dalekie pola nie', () => {
  for (const point of [
    { column: 6, row: 5 }, { column: 6, row: 6 }, { column: 9, row: 5 }, { column: 9, row: 6 },
    { column: 7, row: 4 }, { column: 8, row: 4 }, { column: 7, row: 7 }, { column: 8, row: 7 },
  ]) assert.equal(buildSawmill(prepared(), kingdomMap, point).ok, true)
  for (const point of [
    { column: 6, row: 4 }, { column: 9, row: 4 }, { column: 6, row: 7 }, { column: 9, row: 7 },
    { column: 7, row: 5 }, { column: 8, row: 6 }, { column: 5, row: 4 },
  ]) {
    const state = prepared()
    const result = buildSawmill(state, kingdomMap, point)
    assert.equal(result.ok, false)
    assert.equal(result.state, state)
  }
})

test('każde z czterech pól jest sprawdzane pod kątem terenu, zasobów, zamku i innych budynków', () => {
  for (let row = 5; row <= 6; row++) {
    for (let column = 7; column <= 8; column++) {
      const tree = { ...kingdomMap, trees: [...kingdomMap.trees, { column, row }] }
      const stone = { ...kingdomMap, stones: [...kingdomMap.stones, { column, row }] }
      const castle = { ...kingdomMap, castle: { column, row, columns: 1, rows: 1 } }
      const occupied = { ...kingdomMap, buildings: [{ column, row, columns: 1, rows: 1 }] }
      const maps: MovementMap[] = [tree, stone, castle, occupied]
      for (const type of ['water', 'mountain'] as const) {
        const terrain = kingdomMap.terrain.map(tiles => [...tiles])
        terrain[row][column] = type
        maps.push({ ...kingdomMap, terrain })
      }
      for (const map of maps) {
        const state = prepared()
        const result = buildSawmill(state, map, worker)
        assert.equal(result.ok, false, `${column},${row}`)
        assert.equal(result.state, state)
        assert.match(result.message, /zajęte lub teren jest niedostępny/)
      }
    }
  }
})

test('obszar wychodzący poza mapę nie może zostać zabudowany', () => {
  const state = prepared()
  const result = buildBuilding(state, kingdomMap, { column: 28, row: 19 }, { ...sawmillSite, column: 29, row: 19 })
  assert.equal(result.ok, false)
  assert.equal(result.state, state)
})

test('gotowy tartak blokuje wszystkie swoje pola z czterech stron i pojawia się w wyborze EXPLORE', () => {
  const result = buildSawmill(prepared(), kingdomMap, worker)
  const map = { ...kingdomMap, buildings: result.state.buildings }
  for (let row = 5; row <= 6; row++) {
    for (let column = 7; column <= 8; column++) {
      for (const [direction, dx, dy] of [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]] as const) {
        assert.equal(getWorkerDestination(map, { column: column + dx, row: row + dy }, direction), null)
      }
    }
  }
  assert.equal(getSurroundings(map, worker).down, 'building')
  const selectable = getSelectableObjects(worker, kingdomMap.castle, [], [], result.state.buildings)
  const sawmill = selectable.find(object => object.id === 'building:sawmill-1')!
  assert.equal(sawmill.name, 'Tartak')
  assert.equal(sawmill.kind, 'building')
  assert.equal(sawmill.columns, 2)
  assert.equal(sawmill.rows, 2)
})

test('wydanie drewna na budowę nie cofa ukończonej misji dostawy', () => {
  const mission = updateMission(createMission(), 3)
  const result = buildSawmill(prepared(), kingdomMap, worker)
  assert.equal(updateMission(mission, result.state.resources.kingdom.wood), mission)
})
