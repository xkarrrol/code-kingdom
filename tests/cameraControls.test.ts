import assert from 'node:assert/strict'
import test from 'node:test'
import { bindCameraControls } from '../src/game/cameraControls.ts'

class MapElement extends EventTarget {
  style = { cursor: '' }
  captures = new Set<number>()
  focus() {}
  getBoundingClientRect() { return { left: 10, top: 20, width: 256, height: 256 } }
  setPointerCapture(id: number) { this.captures.add(id) }
  hasPointerCapture(id: number) { return this.captures.has(id) }
  releasePointerCapture(id: number) { this.captures.delete(id) }
}

function fire(target: EventTarget, type: string, properties = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, button: 2, buttons: 2, clientX: 100, clientY: 100,
  }, properties)
  target.dispatchEvent(event)
  return event
}

function setup() {
  const map = new MapElement()
  const globalEvents = new EventTarget()
  const pans: number[][] = []
  const zooms: number[][] = []
  let follows = 0
  const cleanup = bindCameraControls(map as unknown as HTMLElement, {
    pan: (x, y) => pans.push([x, y]),
    zoom: (delta, x, y) => zooms.push([delta, x, y]),
    follow: () => { follows++ },
  }, globalEvents)
  return { map, globalEvents, pans, zooms, get follows() { return follows }, cleanup }
}

test('tylko prawy przycisk rozpoczyna przeciąganie; ruch uwzględnia skalę elementu', () => {
  const s = setup()
  fire(s.map, 'pointerdown', { button: 0, buttons: 1 })
  fire(s.map, 'pointermove', { clientX: 110 })
  assert.deepEqual(s.pans, [])
  fire(s.map, 'pointerdown')
  assert(s.map.hasPointerCapture(1))
  fire(s.map, 'pointermove', { clientX: 110, clientY: 120 })
  assert.deepEqual(s.pans, [[20, 40]])
  s.cleanup()
})

test('puszczenie przycisku poza mapą kończy przeciąganie i zwalnia przechwycenie', () => {
  const s = setup()
  fire(s.map, 'pointerdown')
  fire(s.globalEvents, 'pointerup', { buttons: 0 })
  fire(s.map, 'pointermove', { clientX: 200 })
  assert.deepEqual(s.pans, [])
  assert.equal(s.map.hasPointerCapture(1), false)
  assert.equal(s.map.style.cursor, '')
  s.cleanup()
})

test('utrata fokusu, pointercancel i utrata przechwycenia kończą przeciąganie', () => {
  for (const type of ['blur', 'pointercancel', 'lostpointercapture']) {
    const s = setup()
    fire(s.map, 'pointerdown')
    fire(type === 'blur' ? s.globalEvents : s.map, type)
    fire(s.map, 'pointermove', { clientX: 200 })
    assert.deepEqual(s.pans, [])
    assert.equal(s.map.captures.size, 0)
    s.cleanup()
  }
})

test('brak prawego przycisku w pointermove także kończy przeciąganie', () => {
  const s = setup()
  fire(s.map, 'pointerdown')
  fire(s.map, 'pointermove', { buttons: 0, clientX: 200 })
  assert.deepEqual(s.pans, [])
  assert.equal(s.map.captures.size, 0)
  s.cleanup()
})

test('menu kontekstowe i przewijanie strony blokowane są wyłącznie na mapie', () => {
  const s = setup()
  assert.equal(fire(s.map, 'contextmenu').defaultPrevented, true)
  assert.equal(fire(s.globalEvents, 'contextmenu').defaultPrevented, false)
  const wheel = { deltaY: 3, deltaMode: 1, clientX: 138, clientY: 84 }
  assert.equal(fire(s.map, 'wheel', wheel).defaultPrevented, true)
  assert.deepEqual(s.zooms, [[48, 256, 128]])
  assert.equal(fire(s.globalEvents, 'wheel', wheel).defaultPrevented, false)
  s.cleanup()
})

test('podwójne lewe kliknięcie włącza śledzenie; prawe go nie włącza', () => {
  const s = setup()
  fire(s.map, 'dblclick', { button: 2 })
  assert.equal(s.follows, 0)
  fire(s.map, 'dblclick', { button: 0 })
  assert.equal(s.follows, 1)
  s.cleanup()
})

test('sprzątanie usuwa obsługę zdarzeń oraz aktywne przechwycenie', () => {
  const s = setup()
  fire(s.map, 'pointerdown')
  s.cleanup()
  assert.equal(s.map.captures.size, 0)
  assert.equal(fire(s.map, 'contextmenu').defaultPrevented, false)
  fire(s.map, 'wheel', { deltaY: 100, deltaMode: 0 })
  fire(s.map, 'dblclick', { button: 0 })
  assert.deepEqual(s.zooms, [])
  assert.equal(s.follows, 0)
})
