import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { bindControlModes, changeMode, keyboardAction } from '../src/game/controlModes.ts'
import type { ControlState } from '../src/game/controlModes.ts'
import { getHoveredTile } from '../src/game/camera.ts'

const key = (value: string, extra = {}) => ({
  key: value, repeat: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, ...extra,
})

test('zmiana trybu nie zawiera przełącznika siatki', () => {
  const initial: ControlState = { mode: 'CODE' }
  assert.equal(changeMode(initial, 'CODE'), initial)
  assert.deepEqual(changeMode(initial, 'EXPLORE'), { mode: 'EXPLORE' })
})

test('Esc działa w edytorze, I w EXPLORE, a G nie jest skrótem gry', () => {
  assert.equal(keyboardAction('CODE', key('Escape'), 'editor', true), 'explore')
  assert.equal(keyboardAction('EXPLORE', key('I'), 'map', false), 'code')
  assert.equal(keyboardAction('EXPLORE', key('g'), 'map', false), null)
  for (const value of ['i', 'g', 'ArrowUp', 'a', 'Tab', 'Enter']) {
    assert.equal(keyboardAction('CODE', key(value), 'editor', true), null)
    assert.equal(keyboardAction('EXPLORE', key(value), 'editor', true), null)
  }
  assert.equal(keyboardAction('EXPLORE', key('Escape'), 'map', false), 'hide-info')
})

test('powtarzanie, skróty systemowe i składanie znaków nie uruchamiają skrótów gry', () => {
  for (const property of ['repeat', 'ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
    for (const value of ['i', 'g']) {
      assert.equal(keyboardAction('EXPLORE', key(value, { [property]: true }), 'map', false), null)
    }
    assert.equal(keyboardAction('CODE', key('Escape', { [property]: true }), 'editor', true), null)
  }
})

test('skróty wyboru działają tylko w EXPLORE, z obsługą Shift+Tab', () => {
  const shortcuts = [
    [key('Tab'), 'select-next'], [key('Tab', { shiftKey: true }), 'select-previous'],
    [key('Enter'), 'show-info'], [key('Escape'), 'hide-info'],
  ] as const
  for (const [event, action] of shortcuts) {
    assert.equal(keyboardAction('EXPLORE', event, 'map', false), action)
    assert.equal(keyboardAction('CODE', event, 'map', false), null)
    if (event.key !== 'Escape') assert.equal(keyboardAction('CODE', event, 'editor', true), null)
    assert.equal(keyboardAction('EXPLORE', { ...event, repeat: true }, 'map', false), null)
    assert.equal(keyboardAction('EXPLORE', { ...event, ctrlKey: true }, 'map', false), null)
  }
})

test('H/J/K/L i F są skrótami tylko w EXPLORE i poza edytorem', () => {
  for (const value of ['h', 'j', 'k', 'l', 'f']) {
    const expected = value === 'f' ? 'follow-worker' : `pan-${value}`
    assert.equal(keyboardAction('EXPLORE', key(value), 'map', false), expected)
    assert.equal(keyboardAction('CODE', key(value), 'editor', true), null)
    assert.equal(keyboardAction('EXPLORE', key(value), 'editor', true), null)
    assert.equal(keyboardAction('EXPLORE', key(value, { ctrlKey: true }), 'map', false), null)
    assert.equal(keyboardAction('EXPLORE', key(value, { repeat: true }), 'map', false), null)
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

test('kliknięcia i fokus wybierają tryb; G nie jest przechwytywane w żadnym trybie', t => {
  const s = setup(t)
  s.emit('pointerdown', s.map)
  assert.equal(s.states.at(-1)?.mode, 'EXPLORE')
  const previous = s.states.at(-1)
  assert.equal(s.emit('keydown', s.map, key('g')).defaultPrevented, false)
  assert.equal(s.emit('keydown', s.map, key('g', { repeat: true })).defaultPrevented, false)
  assert.equal(s.states.at(-1), previous)
  s.emit('pointerdown', s.editor)
  assert.equal(s.states.at(-1)?.mode, 'CODE')
  assert.equal(s.emit('keydown', s.editor, key('g')).defaultPrevented, false)
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

test('wybór wysyła akcje do mapy bez zmiany fokusu; CODE nie przechwytuje Tab i Enter', t => {
  const s = setup(t)
  const actions: unknown[] = []
  s.map.addEventListener('explore-selection', event => actions.push((event as CustomEvent).detail))
  assert.equal(s.emit('keydown', s.editor, key('Tab')).defaultPrevented, false)
  assert.equal(s.emit('keydown', s.editor, key('Enter')).defaultPrevented, false)
  assert.deepEqual(actions, [])
  s.map.focus()
  for (const event of [key('Tab'), key('Tab', { shiftKey: true }), key('Enter'), key('Escape')]) {
    assert.equal(s.emit('keydown', s.map, event).defaultPrevented, true)
    assert.equal(s.active, s.map)
  }
  assert.deepEqual(actions, ['select-next', 'select-previous', 'show-info', 'hide-info'])
})

test('kamera otrzymuje wciśnięcie, puszczenie i F; CODE zachowuje litery', t => {
  const s = setup(t)
  const actions: unknown[] = []
  s.map.addEventListener('explore-camera', event => actions.push((event as CustomEvent).detail))
  for (const value of ['h', 'j', 'k', 'l', 'f']) {
    assert.equal(s.emit('keydown', s.editor, key(value)).defaultPrevented, false)
  }
  assert.deepEqual(actions, [])
  s.map.focus()
  assert.equal(s.emit('keydown', s.map, key('h')).defaultPrevented, true)
  s.emit('keyup', s.map, key('H'))
  assert.equal(s.emit('keydown', s.map, key('f')).defaultPrevented, true)
  assert.deepEqual(actions, [{ type: 'press', key: 'h' }, { type: 'release', key: 'h' }, { type: 'follow' }])
})

test('przejście do CODE i utrata fokusu zwalniają klawisze kamery', t => {
  const s = setup(t)
  const actions: unknown[] = []
  s.map.addEventListener('explore-camera', event => actions.push((event as CustomEvent).detail))
  s.map.focus()
  s.emit('keydown', s.map, key('l'))
  s.emit('keydown', s.map, key('i'))
  assert.deepEqual(actions.at(-1), { type: 'clear' })
  assert.equal(s.active, s.editor)
  s.map.focus()
  s.emit('keydown', s.map, key('j'))
  s.emit('focusout', s.map)
  assert.deepEqual(actions.at(-1), { type: 'clear' })
  s.emit('keydown', s.map, key('k'))
  s.emit('blur', s.root)
  assert.deepEqual(actions.at(-1), { type: 'clear' })
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
