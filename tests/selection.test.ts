import assert from 'node:assert/strict'
import test from 'node:test'
import { applySelectionAction, getSelectableObjects, getSelectedObject, reconcileSelection } from '../src/game/selection.ts'
import { chopWood, createResources } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'
import { createCameraState, updateCamera } from '../src/game/camera.ts'

const initial = { selectedId: null, infoOpen: false }
const objects = () => getSelectableObjects(kingdomMap.worker, kingdomMap.castle, createResources(kingdomMap.trees).trees)

test('lista ma stałe identyfikatory, kolejność robotnik–zamek–drzewa i rozmiary obiektów', () => {
  const list = objects()
  assert.equal(list[0].id, 'worker')
  assert.equal(list[0].kind, 'unit')
  assert.equal(list[1].id, 'castle')
  assert.equal(list[1].kind, 'building')
  assert.equal(list[1].columns, 2)
  assert.equal(list[1].rows, 2)
  assert.equal(list[2].id, 'tree:1,1')
  assert.equal(list[2].wood, 3)
  assert.equal(list.length, kingdomMap.trees.length + 2)
})

test('Tab przechodzi przez całą listę i zawija do pierwszego obiektu', () => {
  const list = objects()
  let state = initial
  for (const object of list) {
    state = applySelectionAction(list, state, 'select-next')
    assert.equal(state.selectedId, object.id)
  }
  assert.equal(applySelectionAction(list, state, 'select-next').selectedId, 'worker')
})

test('Shift+Tab wybiera od końca i zawija w przeciwnym kierunku', () => {
  const list = objects()
  let state = initial
  for (const object of [...list].reverse()) {
    state = applySelectionAction(list, state, 'select-previous')
    assert.equal(state.selectedId, object.id)
  }
  assert.equal(applySelectionAction(list, state, 'select-previous').selectedId, list.at(-1)?.id)
})

test('Enter pokazuje tylko wybrany obiekt, Esc zamyka panel bez utraty zaznaczenia', () => {
  const list = objects()
  assert.equal(applySelectionAction(list, initial, 'show-info').infoOpen, false)
  const selected = applySelectionAction(list, initial, 'select-next')
  const open = applySelectionAction(list, selected, 'show-info')
  assert.equal(open.infoOpen, true)
  assert.equal(getSelectedObject(list, open)?.name, 'Robotnik')
  assert.deepEqual(applySelectionAction(list, open, 'hide-info'), selected)
  assert.equal(applySelectionAction(list, open, 'select-next').infoOpen, false)
})

test('dane panelu odzwierciedlają aktualną pozycję robotnika i pozostałe drewno', () => {
  let resources = createResources([{ column: 2, row: 1 }])
  const state = { selectedId: 'tree:2,1', infoOpen: true }
  resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
  const list = getSelectableObjects({ column: 8, row: 9 }, kingdomMap.castle, resources.trees)
  assert.equal(getSelectedObject(list, state)?.wood, 2)
  assert.equal(list[0].column, 8)
  assert.equal(list[0].row, 9)
  assert.equal(list[0].id, 'worker')
})

test('wycięte drzewo znika z listy; zaznaczenie i panel są czyszczone', () => {
  let resources = createResources([{ column: 2, row: 1 }, { column: 3, row: 2 }])
  const selected = { selectedId: 'tree:2,1', infoOpen: true }
  for (let i = 0; i < 3; i++) resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
  const list = getSelectableObjects(kingdomMap.worker, kingdomMap.castle, resources.trees)
  assert.equal(getSelectedObject(list, selected), null)
  assert.deepEqual(reconcileSelection(list, selected), initial)
  assert.equal(list.length, 3)
  let state = initial
  for (let i = 0; i < 8; i++) {
    state = applySelectionAction(list, state, 'select-next')
    assert.notEqual(state.selectedId, selected.selectedId)
  }
})

test('pusta lista i nieaktualny identyfikator nie powodują błędu', () => {
  const removed = { selectedId: 'removed', infoOpen: true }
  assert.deepEqual(applySelectionAction([], removed, 'select-next'), initial)
  assert.deepEqual(applySelectionAction([], removed, 'show-info'), initial)
  assert.equal(applySelectionAction(objects(), removed, 'select-next').selectedId, 'worker')
})

test('kamera płynnie zbliża się do środka zaznaczonego obiektu, zachowując zoom', () => {
  const area = { worldWidth: 1920, worldHeight: 1280, viewWidth: 512, viewHeight: 512 }
  const list = getSelectableObjects(kingdomMap.worker, kingdomMap.castle, [{ column: 20, row: 10, amount: 3 }])
  const state = applySelectionAction(list, initial, 'select-previous')
  const selected = getSelectedObject(list, state)!
  const target = { x: (selected.column + selected.columns / 2) * 64, y: (selected.row + selected.rows / 2) * 64 }
  const camera = { ...createCameraState({ x: 352, y: 288 }, area), zoom: 1.2 }
  const next = updateCamera(camera, target, area, 16)
  assert(next.x > camera.x && next.x < target.x - 512 / next.zoom / 2)
  assert(next.y > camera.y && next.y < target.y - 512 / next.zoom / 2)
  assert.equal(next.zoom, camera.zoom)
})
