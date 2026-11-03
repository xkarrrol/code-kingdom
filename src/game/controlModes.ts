export type ControlMode = 'CODE' | 'EXPLORE'
export interface ControlState { mode: ControlMode; gridVisible: boolean }
type Area = 'editor' | 'map' | 'other'
type Shortcut = Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing'>

export function changeMode(state: ControlState, mode: ControlMode): ControlState {
  return state.mode === mode ? state : { ...state, mode }
}

export function keyboardAction(mode: ControlMode, event: Shortcut, area: Area, editable: boolean) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return null
  if (area === 'editor' && event.key === 'Escape') return 'explore'
  if (mode !== 'EXPLORE' || editable) return null
  if (event.key.toLowerCase() === 'i') return 'code'
  if (event.key.toLowerCase() === 'g') return 'grid'
  return null
}

// Obsługa fokusu i skrótów jest ograniczona do obszaru aplikacji.
export function bindControlModes(
  root: HTMLElement, editor: HTMLTextAreaElement, map: HTMLElement,
  onChange: (state: ControlState) => void,
) {
  let state: ControlState = { mode: 'CODE', gridVisible: false }
  const areaOf = (target: EventTarget | null): Area => {
    if (!(target instanceof Element)) return 'other'
    if (editor.contains(target)) return 'editor'
    if (map.contains(target)) return 'map'
    return 'other'
  }
  const publish = (next: ControlState) => {
    if (next === state) return
    state = next
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
    if (action === 'grid') publish({ ...state, gridVisible: !state.gridVisible })
    else {
      publish(changeMode(state, action === 'code' ? 'CODE' : 'EXPLORE'))
      const target = action === 'code' ? editor : map
      target.focus({ preventScroll: true })
    }
  }
  root.addEventListener('focusin', selectArea)
  root.addEventListener('pointerdown', selectArea, true)
  root.addEventListener('keydown', keydown, true)
  editor.focus({ preventScroll: true })
  return () => {
    root.removeEventListener('focusin', selectArea)
    root.removeEventListener('pointerdown', selectArea, true)
    root.removeEventListener('keydown', keydown, true)
  }
}
