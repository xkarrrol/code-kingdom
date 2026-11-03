export type CameraPanKey = 'h' | 'j' | 'k' | 'l'
export type CameraKeyboardAction =
  | { type: 'press' | 'release'; key: CameraPanKey }
  | { type: 'clear' | 'follow' }

export function getCameraPanKey(key: string): CameraPanKey | null {
  const value = key.toLowerCase()
  return value === 'h' || value === 'j' || value === 'k' || value === 'l' ? value : null
}

// Wynik jest przesunięciem w pikselach widoku, zgodnym z istniejącym panCamera().
export function cameraKeyboardDelta(keys: ReadonlySet<CameraPanKey>, deltaMs: number) {
  const horizontal = Number(keys.has('l')) - Number(keys.has('h'))
  const vertical = Number(keys.has('j')) - Number(keys.has('k'))
  const length = Math.hypot(horizontal, vertical) || 1
  const distance = 320 * Math.max(0, deltaMs) / 1000
  return {
    x: horizontal === 0 ? 0 : -horizontal / length * distance,
    y: vertical === 0 ? 0 : -vertical / length * distance,
  }
}

export function updateCameraKeys(keys: Set<CameraPanKey>, action: CameraKeyboardAction) {
  if (action.type === 'press') keys.add(action.key)
  else if (action.type === 'release') keys.delete(action.key)
  else keys.clear()
}
