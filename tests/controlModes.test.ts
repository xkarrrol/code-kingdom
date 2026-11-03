import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { bindControlModes, changeMode, keyboardAction } from '../src/game/controlModes.ts'
import type { ControlState } from '../src/game/controlModes.ts'
import { getHoveredTile } from '../src/game/camera.ts'

const key = (value: string, extra = {}) => ({
  key: value, repeat: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, ...extra,
})

test('zmiana trybu zachowuje ustawienie siatki i nie tworzy dodatkowych trybów', () => {
  const initial: ControlState = { mode: 'CODE', gridVisible: true }
  assert.equal(changeMode(initial, 'CODE'), initial)
  assert.deepEqual(changeMode(initial, 'EXPLORE'), { mode: 'EXPLORE', gridVisible: true })
})

test('Esc działa w edytorze, a I i G tylko w EXPLORE poza polami tekstowymi', () => {
  assert.equal(keyboardAction('CODE', key('Escape'), 'editor', true), 'explore')
  assert.equal(keyboardAction('EXPLORE', key('I'), 'map', false), 'code')
  assert.equal(keyboardAction('EXPLORE', key('g'), 'map', false), 'grid')
  for (const value of ['i', 'g', 'ArrowUp', 'a', 'Tab', 'Enter']) {
    assert.equal(keyboardAction('CODE', key(value), 'editor', true), null)
    assert.equal(keyboardAction('EXPLORE', key(value), 'editor', true), null)
  }
  assert.equal(keyboardAction('EXPLORE', key('Escape'), 'map', false), null)
})

test('powtarzanie, skróty systemowe i składanie znaków nie uruchamiają skrótów gry', () => {
  for (const property of ['repeat', 'ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
    for (const value of ['i', 'g']) {
      assert.equal(keyboardAction('EXPLORE', key(value, { [property]: true }), 'map', false), null)
    }
    assert.equal(keyboardAction('CODE', key('Escape', { [property]: true }), 'editor', true), null)
  }
})

// Mały model elementów DOM: testuje faktyczne listenery i przenoszenie fokusu bez bibliotek.
class TestElement extends EventTarget {
  children: TestElement[] = []
  editable = false
  onFocus = () => {}
  contains(target: TestElement) { return this === target || this.children.includes(target) }
  closest() { return this.editable ? this : null }
  focus() { this.onFocus() }
}

function setup(t: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Element')
  Object.defineProperty(globalThis, 'Element', { value: TestElement, configurable: true })
  const root = new TestElement()
  const editor = new TestElement()
  editor.editable = true
  const map = new TestElement()
  root.children = [editor, map]
  let active: TestElement | null = null
  const states: ControlState[] = []
  function emit(type: string, target: TestElement, properties = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), properties)
    Object.defineProperty(event, 'target', { value: target })
    root.dispatchEvent(event)
    return event
  }
  for (const element of [editor, map]) {
    element.onFocus = () => { active = element; emit('focusin', element) }
  }
  const cleanup = bindControlModes(
    root as unknown as HTMLElement, editor as unknown as HTMLTextAreaElement,
    map as unknown as HTMLElement, state => states.push(state),
  )
  t.after(() => {
    cleanup()
    if (descriptor) Object.defineProperty(globalThis, 'Element', descriptor)
    else Reflect.deleteProperty(globalThis, 'Element')
  })
  return { root, editor, map, states, emit, cleanup, get active() { return active } }
}

test('Esc usuwa fokus edytora, I przywraca fokus bez wpisania litery', t => {
  const s = setup(t)
  assert.equal(s.active, s.editor)
  const escape = s.emit('keydown', s.editor, key('Escape'))
  assert.equal(escape.defaultPrevented, true)
  assert.equal(s.active, s.map)
  assert.equal(s.states.at(-1)?.mode, 'EXPLORE')
  const i = s.emit('keydown', s.map, key('i'))
  assert.equal(i.defaultPrevented, true)
  assert.equal(s.active, s.editor)
  assert.equal(s.states.at(-1)?.mode, 'CODE')
  assert.equal(s.emit('keydown', s.editor, key('g')).defaultPrevented, false)
  assert.equal(s.emit('keydown', s.editor, key('i')).defaultPrevented, false)
})

test('kliknięcia i fokus wybierają tryb; G przełącza siatkę tylko na mapie', t => {
  const s = setup(t)
  s.emit('pointerdown', s.map)
  assert.equal(s.states.at(-1)?.mode, 'EXPLORE')
  assert.equal(s.emit('keydown', s.map, key('g')).defaultPrevented, true)
  assert.equal(s.states.at(-1)?.gridVisible, true)
  s.emit('keydown', s.map, key('g', { repeat: true }))
  assert.equal(s.states.at(-1)?.gridVisible, true)
  s.emit('keydown', s.map, key('g'))
  assert.equal(s.states.at(-1)?.gridVisible, false)
  s.emit('pointerdown', s.editor)
  assert.equal(s.states.at(-1)?.mode, 'CODE')
  s.map.focus()
  assert.equal(s.states.at(-1)?.mode, 'EXPLORE')
  s.editor.focus()
  assert.equal(s.states.at(-1)?.mode, 'CODE')
})

test('sprzątanie odłącza skróty i obsługę wyboru trybu', t => {
  const s = setup(t)
  s.cleanup()
  s.emit('pointerdown', s.map)
  assert.equal(s.emit('keydown', s.editor, key('Escape')).defaultPrevented, false)
  assert.deepEqual(s.states, [])
})

test('współrzędne pola uwzględniają kamerę, zoom i granice widoku', () => {
  const area = { worldWidth: 1920, worldHeight: 1280, viewWidth: 512, viewHeight: 512 }
  const state = { x: 128, y: 64, zoom: 1.5, following: false }
  assert.deepEqual(getHoveredTile(state, { x: 96, y: 192 }, area, 64), { column: 3, row: 3 })
  assert.deepEqual(getHoveredTile({ ...state, zoom: 0.8 }, { x: 128, y: 128 }, area, 64), { column: 4, row: 3 })
  assert.equal(getHoveredTile(state, { x: -1, y: 10 }, area, 64), null)
  assert.equal(getHoveredTile(state, { x: 512, y: 10 }, area, 64), null)
  assert.equal(getHoveredTile(state, { x: 10, y: 512 }, area, 64), null)
})
