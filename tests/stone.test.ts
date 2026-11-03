import assert from 'node:assert/strict'
import test from 'node:test'
import { kingdomMap } from '../src/game/map.ts'
import { createResources, chopWood, mineStone, depositWood, depositStone, getInventory, getStoneAhead } from '../src/game/resources.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { getSurroundings } from '../src/game/surroundings.ts'
import { isTerrainWalkable } from '../src/game/terrain.ts'
import { createMission, updateMission } from '../src/game/mission.ts'
import { getSelectableObjects, reconcileSelection } from '../src/game/selection.ts'

test('ręcznie rozmieszczone złoża są dostępne od boku, rozłączne i mają po 5 kamieni', () => {
  const state = createResources(kingdomMap.trees, kingdomMap.stones)
  assert(state.stones.length >= 3)
  assert(state.stones.every(node => node.amount === 5))
  assert.equal(new Set(state.stones.map(node => `${node.column},${node.row}`)).size, state.stones.length)
  for (const node of state.stones) {
    assert(node.column >= 0 && node.column < kingdomMap.columns && node.row >= 0 && node.row < kingdomMap.rows)
    assert(isTerrainWalkable(kingdomMap.terrain[node.row][node.column]))
    assert(!kingdomMap.trees.some(tree => tree.column === node.column && tree.row === node.row))
    const castle = kingdomMap.castle
    assert(!(node.column >= castle.column && node.column < castle.column + castle.columns && node.row >= castle.row && node.row < castle.row + castle.rows))
    assert.notDeepEqual(node, { ...kingdomMap.worker, amount: 5 })
    assert((['up', 'down', 'left', 'right'] as const).some(direction => getWorkerDestination(kingdomMap, node, direction)))
  }
})

test('kamień jest wykrywany i wydobywany tylko z pola przed robotnikiem w czterech kierunkach', () => {
  const workers = [
    { column: 3, row: 2, facing: 'down' }, { column: 3, row: 4, facing: 'up' },
    { column: 2, row: 3, facing: 'right' }, { column: 4, row: 3, facing: 'left' },
  ] as const
  for (const worker of workers) {
    const state = createResources([], [{ column: 3, row: 3 }])
    assert(getStoneAhead(state, worker))
    const next = mineStone(state, worker)
    assert.equal(next.worker.stone, 1)
    assert.equal(next.stones[0].amount, 4)
    assert.equal(state.stones[0].amount, 5)
    assert.equal(chopWood(state, worker), state)
  }
  const state = createResources([], [{ column: 3, row: 3 }])
  for (const worker of [{ column: 2, row: 3, facing: 'up' }, { column: 2, row: 2, facing: 'right' }] as const) {
    assert.equal(getStoneAhead(state, worker), undefined)
    assert.equal(mineStone(state, worker), state)
  }
})

test('złoże blokuje ruch, otoczenie zgłasza stone, piąte wydobycie usuwa złoże i odblokowuje pole', () => {
  let state = createResources([], [{ column: 8, row: 3 }])
  const worker = { column: 7, row: 3, facing: 'right' as const }
  const map = () => ({ ...kingdomMap, trees: state.trees, stones: state.stones })
  for (let i = 0; i < 5; i++) {
    assert.equal(getWorkerDestination(map(), worker, 'right'), null)
    assert.equal(getSurroundings(map(), worker).right, 'stone')
    state = mineStone(state, worker)
  }
  assert.equal(state.worker.stone, 5)
  assert.equal(state.stones.length, 0)
  assert.equal(getStoneAhead(state, worker), undefined)
  assert.equal(getSurroundings(map(), worker).right, 'empty')
  assert.deepEqual(getWorkerDestination(map(), worker, 'right'), { column: 8, row: 3 })
  assert.equal(mineStone(state, worker), state)
})

test('wspólny limit 5 blokuje oba surowce przy mieszanym ekwipunku', () => {
  for (const wood of [0, 1, 3, 5]) {
    const state = { ...createResources([{ column: 3, row: 2 }], [{ column: 4, row: 3 }]), worker: { wood, stone: 5 - wood, planks: 0 } }
    const before = structuredClone(state)
    assert.equal(chopWood(state, { column: 3, row: 3, facing: 'up' }), state)
    assert.equal(mineStone(state, { column: 3, row: 3, facing: 'right' }), state)
    assert.deepEqual(state, before)
  }
  let state = createResources([{ column: 3, row: 2 }], [{ column: 4, row: 3 }])
  state = chopWood(state, { column: 3, row: 3, facing: 'up' })
  for (let i = 0; i < 4; i++) state = mineStone(state, { column: 3, row: 3, facing: 'right' })
  assert.deepEqual(getInventory(state), { wood: 1, stone: 4, planks: 0, capacity: 5 })
  assert.equal(state.stones[0].amount, 1)
})

test('dostawy przenoszą tylko wskazany surowiec i kamień nie kończy misji drewna', () => {
  const initial = { ...createResources([]), worker: { wood: 3, stone: 2, planks: 0 } }
  const beside = { column: 5, row: 3 }
  const stoneDelivered = depositStone(initial, beside, kingdomMap.castle)
  assert.deepEqual(stoneDelivered.worker, { wood: 3, stone: 0, planks: 0 })
  assert.deepEqual(stoneDelivered.kingdom, { wood: 0, stone: 2, planks: 0 })
  assert.deepEqual(updateMission(createMission(), stoneDelivered.kingdom.wood), createMission())
  const woodDelivered = depositWood(stoneDelivered, beside, kingdomMap.castle)
  assert.deepEqual(woodDelivered.kingdom, { wood: 3, stone: 2, planks: 0 })
  assert.deepEqual(updateMission(createMission(), woodDelivered.kingdom.wood), { progress: 3, completed: true })
  assert.equal(depositStone(woodDelivered, beside, kingdomMap.castle), woodDelivered)
  assert.equal(depositStone(initial, { column: 5, row: 2 }, kingdomMap.castle), initial)
  assert.equal(depositStone(initial, { column: 0, row: 0 }, kingdomMap.castle), initial)
  const woodFirst = depositWood(initial, beside, kingdomMap.castle)
  assert.deepEqual(woodFirst.worker, { wood: 0, stone: 2, planks: 0 })
  assert.deepEqual(initial.worker, { wood: 3, stone: 2, planks: 0 })
})

test('wyczerpane złoże znika z wyboru obiektów', () => {
  let state = createResources([], [{ column: 8, row: 3 }])
  const worker = { column: 7, row: 3, facing: 'right' as const }
  const list = () => getSelectableObjects(worker, kingdomMap.castle, state.trees, state.stones)
  assert.equal(list().at(-1)?.stone, 5)
  const selection = { selectedId: 'stone:8,3', infoOpen: true }
  for (let i = 0; i < 5; i++) state = mineStone(state, worker)
  assert.deepEqual(reconcileSelection(list(), selection), { selectedId: null, infoOpen: false })
})
