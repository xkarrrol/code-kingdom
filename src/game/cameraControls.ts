import { gameViewport } from './camera.ts'

interface CameraControls {
  pan: (x: number, y: number) => void
  zoom: (delta: number, x: number, y: number) => void
  follow: () => void
  hover?: (x: number, y: number) => void
  leave?: () => void
}

export function bindCameraControls(element: HTMLElement, controls: CameraControls, globalEvents: EventTarget = window) {
  let drag: { id: number; x: number; y: number } | null = null
  const originalCursor = element.style.cursor
  const point = (event: { clientX: number; clientY: number }) => {
    const rect = element.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * gameViewport.width / rect.width,
      y: (event.clientY - rect.top) * gameViewport.height / rect.height,
    }
  }
  const stop = () => {
    const id = drag?.id
    drag = null
    element.style.cursor = originalCursor
    if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id)
  }
  const down = (event: PointerEvent) => {
    element.focus({ preventScroll: true })
    if (event.button !== 2 || drag) return
    event.preventDefault()
    drag = { id: event.pointerId, ...point(event) }
    element.setPointerCapture(event.pointerId)
    element.style.cursor = 'grabbing'
  }
  const move = (event: PointerEvent) => {
    const cursor = point(event)
    controls.hover?.(cursor.x, cursor.y)
    if (!drag || event.pointerId !== drag.id) return
    if (!(event.buttons & 2)) { stop(); return }
    const next = point(event)
    controls.pan(next.x - drag.x, next.y - drag.y)
    drag = { id: drag.id, ...next }
    event.preventDefault()
  }
  const up = (event: PointerEvent) => {
    if (drag?.id === event.pointerId && !(event.buttons & 2)) stop()
  }
  const cancel = (event: PointerEvent) => { if (drag?.id === event.pointerId) stop() }
  const menu = (event: Event) => event.preventDefault()
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    const cursor = point(event)
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? gameViewport.height : 1
    controls.zoom(event.deltaY * units, cursor.x, cursor.y)
  }
  const doubleClick = (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    stop()
    controls.follow()
  }
  const leave = () => controls.leave?.()

  element.addEventListener('pointerdown', down)
  element.addEventListener('pointermove', move)
  element.addEventListener('pointerup', up)
  element.addEventListener('pointercancel', cancel)
  element.addEventListener('lostpointercapture', cancel)
  element.addEventListener('contextmenu', menu)
  element.addEventListener('wheel', wheel, { passive: false })
  element.addEventListener('dblclick', doubleClick)
  element.addEventListener('pointerleave', leave)
  globalEvents.addEventListener('pointerup', up as EventListener)
  globalEvents.addEventListener('blur', stop)

  return () => {
    stop()
    element.removeEventListener('pointerdown', down)
    element.removeEventListener('pointermove', move)
    element.removeEventListener('pointerup', up)
    element.removeEventListener('pointercancel', cancel)
    element.removeEventListener('lostpointercapture', cancel)
    element.removeEventListener('contextmenu', menu)
    element.removeEventListener('wheel', wheel)
    element.removeEventListener('dblclick', doubleClick)
    element.removeEventListener('pointerleave', leave)
    globalEvents.removeEventListener('pointerup', up as EventListener)
    globalEvents.removeEventListener('blur', stop)
  }
}
