import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraKeyboardDelta, getCameraPanKey, updateCameraKeys } from '../src/game/cameraKeyboard.ts'
import type { CameraPanKey } from '../src/game/cameraKeyboard.ts'
import { createCameraState, followWorker, panCamera } from '../src/game/camera.ts'

const area = { worldWidth: 1920, worldHeight: 1280, viewWidth: 512, viewHeight: 512 }

test('rozpoznaje H/J/K/L niezależnie od wielkości liter', () => {
  for (const key of ['h', 'j', 'k', 'l'] as const) {
    assert.equal(getCameraPanKey(key), key)
    assert.equal(getCameraPanKey(key.toUpperCase()), key)
  }
  assert.equal(getCameraPanKey('ArrowRight'), null)
  assert.equal(getCameraPanKey('a'), null)
})

test('zapamiętuje przytrzymanie, puszczenie i czyszczenie klawiszy', () => {
  const keys = new Set<CameraPanKey>()
  updateCameraKeys(keys, { type: 'press', key: 'h' })
  updateCameraKeys(keys, { type: 'press', key: 'h' })
  assert.equal(keys.size, 1)
  updateCameraKeys(keys, { type: 'release', key: 'h' })
  assert.equal(keys.size, 0)
  updateCameraKeys(keys, { type: 'press', key: 'l' })
  updateCameraKeys(keys, { type: 'clear' })
  assert.equal(keys.size, 0)
  updateCameraKeys(keys, { type: 'press', key: 'j' })
  updateCameraKeys(keys, { type: 'follow' })
  assert.equal(keys.size, 0)
})

test('H/J/K/L przesuwają kamerę w odpowiednie strony i wyłączają śledzenie', () => {
  const initial = createCameraState({ x: 800, y: 600 }, area)
  const expected = {
    h: { x: initial.x - 32, y: initial.y }, j: { x: initial.x, y: initial.y + 32 },
    k: { x: initial.x, y: initial.y - 32 }, l: { x: initial.x + 32, y: initial.y },
  }
  for (const key of ['h', 'j', 'k', 'l'] as const) {
    const state = panCamera(initial, cameraKeyboardDelta(new Set([key]), 100), area)
    assert.equal(state.x, expected[key].x)
    assert.equal(state.y, expected[key].y)
    assert.equal(state.following, false)
  }
})

test('płynne przesuwanie jest niezależne od liczby klatek i zatrzymuje się po puszczeniu', () => {
  const keys = new Set<CameraPanKey>(['l'])
  const initial = createCameraState({ x: 800, y: 600 }, area)
  let state = initial
  for (let frame = 0; frame < 10; frame++) state = panCamera(state, cameraKeyboardDelta(keys, 50), area)
  const single = panCamera(initial, cameraKeyboardDelta(keys, 500), area)
  assert(Math.abs(state.x - single.x) < 1e-9)
  assert.equal(state.x - initial.x, 160)
  updateCameraKeys(keys, { type: 'release', key: 'l' })
  assert.equal(panCamera(state, cameraKeyboardDelta(keys, 500), area), state)
})

test('przeciwne kierunki znoszą się, a ruch po przekątnej nie jest szybszy', () => {
  assert.deepEqual(cameraKeyboardDelta(new Set(['h', 'l', 'j', 'k']), 100), { x: 0, y: 0 })
  const diagonal = cameraKeyboardDelta(new Set(['l', 'k']), 100)
  assert(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 32) < 1e-9)
  assert.deepEqual(cameraKeyboardDelta(new Set(['l']), -1), { x: -0, y: 0 })
})

test('przesuwanie respektuje granice przy różnym zoomie; powrót przywraca śledzenie', () => {
  const worker = { x: 800, y: 600 }
  for (const zoom of [0.8, 1.5]) {
    let state = { ...createCameraState(worker, area), zoom }
    for (const key of ['h', 'j', 'k', 'l'] as const) {
      state = panCamera(state, cameraKeyboardDelta(new Set([key]), 100_000), area)
      assert(state.x >= 0 && state.y >= 0)
      assert(state.x + 512 / zoom <= area.worldWidth + 1e-9)
      assert(state.y + 512 / zoom <= area.worldHeight + 1e-9)
    }
    const following = followWorker(state, worker, area)
    assert.equal(following.following, true)
    assert.equal(following.zoom, zoom)
    assert.equal(following.x + 256 / zoom, worker.x)
  }
})
