import assert from 'node:assert/strict'
import test from 'node:test'
import { createBuilding, sawmillSite } from '../src/game/buildingData.ts'
import { collectPlanks, depositToSawmill, getSawmillInventory, processRecipe, processWood } from '../src/game/production.ts'
import type { ProductionState } from '../src/game/production.ts'
import { createResources, chopWood, mineStone, depositPlanks, getInventory, getResourceStatus } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'
import { createMission, updateMission } from '../src/game/mission.ts'

const beside = { column: 7, row: 4 }
function prepared(wood = 0, planks = 0): ProductionState {
  return { resources: createResources([]), buildings: [{ ...createBuilding(sawmillSite), storage: { wood, planks } }] }
}

test('nowy tartak ma pusty, niezależny magazyn; odczyt jest kopią i nie produkuje desek', () => {
  const state = prepared(4)
  const before = structuredClone(state)
  const first = createBuilding(sawmillSite)
  const second = createBuilding(sawmillSite)
  assert.notEqual(first.storage, second.storage)
  assert.deepEqual(first.storage, { wood: 0, planks: 0 })
  for (let i = 0; i < 10; i++) assert.deepEqual(getSawmillInventory(state.buildings), { wood: 4, planks: 0 })
  const copy = getSawmillInventory(state.buildings)
  copy.wood = 999
  copy.planks = 999
  assert.deepEqual(state, before)
  assert.throws(() => getSawmillInventory([]), /Tartak jeszcze nie istnieje/)
})

test('wszystkie operacje wymagają istniejącego tartaku i sąsiedztwa bokiem', () => {
  for (const operation of [depositToSawmill, processWood, collectPlanks]) {
    const missing: ProductionState = { resources: createResources([]), buildings: [] }
    assert.equal(operation(missing, beside).state, missing)
    assert.match(operation(missing, beside).message, /Tartak jeszcze nie istnieje/)
    for (const position of [{ column: 0, row: 0 }, { column: 6, row: 4 }, { column: 9, row: 7 }, { column: 7, row: 5 }]) {
      const state = prepared(2, 1)
      state.resources.worker.wood = 2
      const result = operation(state, position)
      assert.equal(result.ok, false)
      assert.equal(result.state, state)
      assert.match(result.message, /przy boku tartaku/)
    }
    for (const position of [
      { column: 6, row: 5 }, { column: 6, row: 6 }, { column: 9, row: 5 }, { column: 9, row: 6 },
      { column: 7, row: 4 }, { column: 8, row: 4 }, { column: 7, row: 7 }, { column: 8, row: 7 },
    ]) {
      const state = prepared(2, 1)
      state.resources.worker.wood = 2
      assert.equal(operation(state, position).ok, true)
    }
  }
})

test('oddawanie drewna do tartaku jest częściowe przy limicie 10, nie przenosi innych surowców', () => {
  const state = prepared(9, 10)
  state.resources.worker = { wood: 3, stone: 1, planks: 1 }
  const before = structuredClone(state)
  const result = depositToSawmill(state, beside)
  assert(result.ok)
  assert.deepEqual(result.state.resources.worker, { wood: 2, stone: 1, planks: 1 })
  assert.deepEqual(getSawmillInventory(result.state.buildings), { wood: 10, planks: 10 })
  assert.deepEqual(result.state.resources.kingdom, state.resources.kingdom)
  assert.deepEqual(state, before)
  const blocked = depositToSawmill(result.state, beside)
  assert.equal(blocked.state, result.state)
  assert.match(blocked.message, /pełny/)
  const empty = prepared()
  assert.equal(depositToSawmill(empty, beside).state, empty)
})

test('jedno wywołanie receptury zużywa dokładnie 2 drewna i produkuje 1 deskę, bez zmian ekwipunku', () => {
  const state = prepared(10)
  const before = structuredClone(state)
  const first = processWood(state, beside)
  assert(first.ok)
  assert.deepEqual(getSawmillInventory(first.state.buildings), { wood: 8, planks: 1 })
  assert.equal(first.state.resources, state.resources)
  const second = processWood(first.state, beside)
  assert.deepEqual(getSawmillInventory(second.state.buildings), { wood: 6, planks: 2 })
  assert.deepEqual(state, before)
})

test('brak drewna lub pełny magazyn desek odrzuca całą recepturę bez utraty drewna', () => {
  for (const [wood, planks] of [[0, 0], [1, 0], [2, 10], [10, 10]]) {
    const state = prepared(wood, planks)
    const before = structuredClone(state)
    const result = processWood(state, beside)
    assert.equal(result.ok, false)
    assert.equal(result.state, state)
    assert.deepEqual(state, before)
    assert.match(result.message, wood < 2 ? /Brak surowców/ : /Brak miejsca/)
  }
  const fits = processWood(prepared(2, 9), beside)
  assert(fits.ok)
  assert.deepEqual(getSawmillInventory(fits.state.buildings), { wood: 0, planks: 10 })
})

test('algorytm produkcji korzysta z danych receptury, a nie ze stałych zaszytych w funkcji', () => {
  const result = processRecipe(prepared(4), beside, { building: 'sawmill', inputs: { wood: 1 }, outputs: { planks: 2 } })
  assert(result.ok)
  assert.deepEqual(getSawmillInventory(result.state.buildings), { wood: 3, planks: 2 })
})

test('odbiór desek respektuje wspólne 5 miejsc, a reszta pozostaje w tartaku', () => {
  for (const [wood, stone, planks, available, collected] of [
    [2, 1, 1, 9, 1], [0, 0, 0, 10, 5], [0, 0, 0, 2, 2], [1, 1, 3, 5, 0],
  ]) {
    const state = prepared(8, available)
    state.resources.worker = { wood, stone, planks }
    const before = structuredClone(state)
    const result = collectPlanks(state, beside)
    assert.equal(result.ok, collected > 0)
    assert.deepEqual(getInventory(result.state.resources), { wood, stone, planks: planks + collected, capacity: 5 })
    assert.deepEqual(getSawmillInventory(result.state.buildings), { wood: 8, planks: available - collected })
    assert.deepEqual(state, before)
  }
  const empty = prepared()
  assert.equal(collectPlanks(empty, beside).state, empty)
})

test('deski zajmują miejsce przy ścinaniu i wydobyciu kamienia', () => {
  const state = createResources([{ column: 3, row: 2 }], [{ column: 4, row: 3 }])
  state.worker.planks = 5
  assert.equal(chopWood(state, { column: 3, row: 3, facing: 'up' }), state)
  assert.equal(mineStone(state, { column: 3, row: 3, facing: 'right' }), state)
})

test('transport do zamku przenosi wyłącznie deski i nie zwiększa postępu misji drewna', () => {
  const state = createResources([])
  state.worker = { wood: 1, stone: 1, planks: 3 }
  const delivered = depositPlanks(state, { column: 5, row: 3 }, kingdomMap.castle)
  assert.deepEqual(delivered.worker, { wood: 1, stone: 1, planks: 0 })
  assert.deepEqual(delivered.kingdom, { wood: 0, stone: 0, planks: 3 })
  assert.deepEqual(updateMission(createMission(), delivered.kingdom.wood), createMission())
  assert.equal(depositPlanks(delivered, { column: 5, row: 3 }, kingdomMap.castle), delivered)
  assert.equal(depositPlanks(state, { column: 5, row: 5 }, kingdomMap.castle), state)
})

test('cykl transport–produkcja–odbiór–zamek zachowuje ilości i poprawnie raportuje liczniki', () => {
  let state = prepared()
  state.resources.worker.wood = 4
  state = depositToSawmill(state, beside).state
  state = processWood(state, beside).state
  state = processWood(state, beside).state
  state = collectPlanks(state, beside).state
  state = { ...state, resources: depositPlanks(state.resources, { column: 5, row: 3 }, kingdomMap.castle) }
  assert.deepEqual(state.resources.worker, { wood: 0, stone: 0, planks: 0 })
  assert.deepEqual(state.resources.kingdom, { wood: 0, stone: 0, planks: 2 })
  const stock = getSawmillInventory(state.buildings)
  assert.deepEqual(stock, { wood: 0, planks: 0 })
  const status = getResourceStatus(state.resources, stock)
  assert.deepEqual(status.sawmill, stock)
  assert.equal(status.kingdom.planks, 2)
  stock.wood = 10
  assert.equal(status.sawmill!.wood, 0)
})
