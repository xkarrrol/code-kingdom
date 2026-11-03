import assert from 'node:assert/strict'
import test from 'node:test'
import { createCameraState, followWorker, gameViewport, getCameraScroll, panCamera, updateCamera, zoomCamera } from '../src/game/camera.ts'
import { kingdomMap } from '../src/game/map.ts'
import { WorkerCommands } from '../src/game/commands.ts'

const area = {
  worldWidth: kingdomMap.columns * kingdomMap.tileSize,
  worldHeight: kingdomMap.rows * kingdomMap.tileSize,
  viewWidth: gameViewport.width,
  viewHeight: gameViewport.height,
}

test('widoczny obszar jest niezależny od wymiarów świata', () => {
  assert.deepEqual(gameViewport, { width: 512, height: 512 })
  assert.equal(area.worldWidth, 1920)
  assert.equal(area.worldHeight, 1280)
})

test('kamera zaczyna przy robotniku i płynnie podąża za jego pozycją', () => {
  const initial = createCameraState({ x: 400, y: 300 }, area)
  assert.deepEqual(initial, { x: 144, y: 44, zoom: 1, following: true })
  const worker = { x: 464, y: 364 }
  let state = updateCamera(initial, worker, area, 16)
  assert(state.x > initial.x && state.x < 208)
  assert(state.y > initial.y && state.y < 108)
  for (let i = 0; i < 120; i++) state = updateCamera(state, worker, area, 16)
  assert(Math.abs(state.x - 208) < 0.01)
  assert(Math.abs(state.y - 108) < 0.01)
})

test('przeciągnięcie uwzględnia zoom, wyłącza śledzenie i nie przesuwa robotnika', () => {
  const worker = { x: 800, y: 600 }
  const initial = { ...createCameraState(worker, area), zoom: 1.5 }
  const state = panCamera(initial, { x: 150, y: -75 }, area)
  assert.equal(state.x, initial.x - 100)
  assert.equal(state.y, initial.y + 50)
  assert.equal(state.following, false)
  assert.equal(updateCamera(state, { x: 1000, y: 700 }, area, 1000), state)
  assert.deepEqual(worker, { x: 800, y: 600 })
  assert.equal(panCamera(initial, { x: 0, y: 0 }, area), initial)
})

test('zoom pozostaje w zakresie 0.8–1.5 i zachowuje bieżący tryb śledzenia', () => {
  const initial = createCameraState({ x: 800, y: 600 }, area)
  const near = zoomCamera(initial, { x: 200, y: 200 }, -100_000, area)
  assert.equal(near.zoom, 1.5)
  assert.equal(near.following, true)
  const far = zoomCamera(near, { x: 200, y: 200 }, 100_000, area)
  assert.equal(far.zoom, 0.8)
  assert.equal(zoomCamera(far, { x: 200, y: 200 }, 100, area), far)
  const manual = panCamera(initial, { x: 10, y: 0 }, area)
  assert.equal(zoomCamera(manual, { x: 200, y: 200 }, -100, area).following, false)
})

test('przybliżanie i oddalanie zachowują punkt świata pod kursorem', () => {
  const initial = createCameraState({ x: 800, y: 600 }, area)
  const cursor = { x: 123, y: 357 }
  for (const delta of [-200, 200]) {
    const next = zoomCamera(initial, cursor, delta, area)
    assert(Math.abs(initial.x + cursor.x / initial.zoom - next.x - cursor.x / next.zoom) < 1e-9)
    assert(Math.abs(initial.y + cursor.y / initial.zoom - next.y - cursor.y / next.zoom) < 1e-9)
    assert.equal(next.following, initial.following)
  }
})

test('granice widoku uwzględniają zoom podczas przeciągania i śledzenia', () => {
  for (const zoom of [0.8, 1, 1.5]) {
    let state = { ...createCameraState({ x: 600, y: 600 }, area), zoom }
    for (const point of [{ x: 0, y: 0 }, { x: 1920, y: 1280 }]) {
      state = followWorker(state, point, area)
      state = zoomCamera(state, { x: 0, y: 512 }, 30, area)
      for (const delta of [{ x: -100_000, y: -100_000 }, { x: 100_000, y: 100_000 }]) {
        state = panCamera(state, delta, area)
        assert(state.x >= 0 && state.y >= 0)
        assert(state.x + area.viewWidth / state.zoom <= area.worldWidth + 1e-9)
        assert(state.y + area.viewHeight / state.zoom <= area.worldHeight + 1e-9)
      }
    }
  }
})

test('ponowne śledzenie centruje na aktualnym robotniku i zachowuje zoom', () => {
  const worker = { x: 800, y: 600 }
  const manual = { x: 10, y: 20, zoom: 1.2, following: false }
  const next = followWorker(manual, worker, area)
  assert.equal(next.following, true)
  assert.equal(next.zoom, manual.zoom)
  assert.equal(next.x + area.viewWidth / next.zoom / 2, worker.x)
  assert.equal(next.y + area.viewHeight / next.zoom / 2, worker.y)
})

test('przeliczenie scrolla Phasera zachowuje lewy górny róg świata przy dowolnym zoomie', () => {
  for (const zoom of [0.8, 1, 1.5]) {
    const state = { x: 300, y: 200, zoom, following: false }
    const scroll = getCameraScroll(state, area)
    assert(Math.abs(scroll.x + area.viewWidth / 2 - area.viewWidth / zoom / 2 - state.x) < 1e-9)
    assert(Math.abs(scroll.y + area.viewHeight / 2 - area.viewHeight / zoom / 2 - state.y) < 1e-9)
  }
})

test('wygładzanie śledzenia nie zależy od liczby klatek', () => {
  const initial = createCameraState({ x: 500, y: 500 }, area)
  const worker = { x: 600, y: 600 }
  const single = updateCamera(initial, worker, area, 32)
  const twice = updateCamera(updateCamera(initial, worker, area, 16), worker, area, 16)
  assert(Math.abs(single.x - twice.x) < 1e-9)
  assert(Math.abs(single.y - twice.y) < 1e-9)
})

test('każda klatka animacji jest śledzona dla pojedynczego ruchu i sekwencji Pythona', async () => {
  for (const source of ['arrows', 'python']) {
    const graphics = { x: 600, y: 600 }
    let state = createCameraState(graphics, area)
    state = zoomCamera(state, { x: 256, y: 256 }, -100, area)
    const positions: number[] = []
    const runner = new WorkerCommands(async () => {
      for (let frame = 1; frame <= 12; frame++) {
        graphics.x = 600 + frame / 12 * 64
        const previous = state.x
        state = updateCamera(state, graphics, area, 15)
        assert(state.x > previous, `${source}: kamera reaguje przed końcem kroku`)
        assert(state.x < graphics.x - area.viewWidth / state.zoom / 2)
        positions.push(state.x)
        await Promise.resolve()
      }
      return true
    })
    if (source === 'arrows') await runner.executeCommand('move_right')
    else await runner.runCommands(['move_right'])
    assert.equal(positions.length, 12)
    assert.equal(state.following, true)
  }
})

test('ręczny widok pozostaje nieruchomy podczas animacji aż do ponownego centrowania', () => {
  let state = createCameraState({ x: 600, y: 600 }, area)
  state = panCamera(state, { x: -100, y: 20 }, area)
  const manual = state
  for (let frame = 0; frame < 12; frame++) {
    state = updateCamera(state, { x: 600 + frame * 5, y: 600 }, area, 15)
    assert.equal(state, manual)
  }
  state = followWorker(state, { x: 660, y: 600 }, area)
  assert.equal(state.following, true)
  assert.equal(state.x + area.viewWidth / state.zoom / 2, 660)
  assert(updateCamera(state, { x: 680, y: 600 }, area, 15).x > state.x)
})
