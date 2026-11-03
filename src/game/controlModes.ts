import type { SelectionAction } from './selection'
import { getCameraPanKey } from './cameraKeyboard.ts'
import type { CameraKeyboardAction } from './cameraKeyboard'

export type ControlMode = 'CODE' | 'EXPLORE'
export interface ControlState { mode: ControlMode }
type Area = 'editor' | 'map' | 'other'
type Shortcut = Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing'> & { shiftKey?: boolean }

export function changeMode(state: ControlState, mode: ControlMode): ControlState {
  return state.mode === mode ? state : { ...state, mode }
}

export function keyboardAction(mode: ControlMode, event: Shortcut, area: Area, editable: boolean) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return null
  if (area === 'editor' && event.key === 'Escape') return 'explore'
  if (mode !== 'EXPLORE' || editable) return null
  if (event.key.toLowerCase() === 'i') return 'code'
  if (event.key.toLowerCase() === 'f') return 'follow-worker'
  const panKey = getCameraPanKey(event.key)
  if (panKey) return `pan-${panKey}` as const
  if (event.key === 'Tab') return event.shiftKey ? 'select-previous' : 'select-next'
  if (event.key === 'Enter') return 'show-info'
  if (event.key === 'Escape') return 'hide-info'
  return null
}

// Obsługa fokusu i skrótów jest ograniczona do obszaru aplikacji.
export function bindControlModes(
  root: HTMLElement, editor: HTMLTextAreaElement, map: HTMLElement,
  onChange: (state: ControlState) => void,
  globalEvents: EventTarget = root.ownerDocument?.defaultView ?? root,
) {
  let state: ControlState = { mode: 'CODE' }
  const sendCamera = (action: CameraKeyboardAction) => {
    map.dispatchEvent(new CustomEvent<CameraKeyboardAction>('explore-camera', { detail: action }))
  }
  const clearCamera = () => sendCamera({ type: 'clear' })
  const areaOf = (target: EventTarget | null): Area => {
    if (!(target instanceof Element)) return 'other'
    if (editor.contains(target)) return 'editor'
    if (map.contains(target)) return 'map'
    return 'other'
  }
  const publish = (next: ControlState) => {
    if (next === state) return
    state = next
    if (state.mode === 'CODE') clearCamera()
    onChange(state)
  }
  const selectArea = (event: Event) => {
    const area = areaOf(event.target)
    if (area !== 'other') publish(changeMode(state, area === 'editor' ? 'CODE' : 'EXPLORE'))
  }
  const keydown = (event: KeyboardEvent) => {
    const editable = event.target instanceof Element && !!event.target.closest('textarea,input,select,[contenteditable]')
    const action = keyboardAction(state.mode, event, areaOf(event.target), editable)
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'code' || action === 'explore') {
      publish(changeMode(state, action === 'code' ? 'CODE' : 'EXPLORE'))
      const target = action === 'code' ? editor : map
      target.focus({ preventScroll: true })
    } else if (action === 'follow-worker') {
      sendCamera({ type: 'follow' })
    } else if (action === 'pan-h' || action === 'pan-j' || action === 'pan-k' || action === 'pan-l') {
      sendCamera({ type: 'press', key: getCameraPanKey(event.key)! })
    } else {
      map.dispatchEvent(new CustomEvent<SelectionAction>('explore-selection', { detail: action }))
    }
  }
  const keyup = (event: Event) => {
    const key = getCameraPanKey((event as KeyboardEvent).key)
    if (key) sendCamera({ type: 'release', key })
  }
  root.addEventListener('focusin', selectArea)
  root.addEventListener('pointerdown', selectArea, true)
  root.addEventListener('keydown', keydown, true)
  root.addEventListener('focusout', clearCamera)
  globalEvents.addEventListener('keyup', keyup)
  globalEvents.addEventListener('blur', clearCamera)
  editor.focus({ preventScroll: true })
  return () => {
    clearCamera()
    root.removeEventListener('focusin', selectArea)
    root.removeEventListener('pointerdown', selectArea, true)
    root.removeEventListener('keydown', keydown, true)
    root.removeEventListener('focusout', clearCamera)
    globalEvents.removeEventListener('keyup', keyup)
    globalEvents.removeEventListener('blur', clearCamera)
  }
}
