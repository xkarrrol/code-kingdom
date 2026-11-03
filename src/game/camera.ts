export const gameViewport = { width: 512, height: 512 }

interface Point { x: number; y: number }
export interface CameraArea {
  worldWidth: number
  worldHeight: number
  viewWidth: number
  viewHeight: number
}
export interface CameraState extends Point {
  zoom: number
  following: boolean
}

export const MIN_ZOOM = 0.8
export const MAX_ZOOM = 1.5
const FOLLOW_SPEED = 8
const clamp = (value: number, max: number) => Math.max(0, Math.min(value, Math.max(0, max)))

function constrain(state: CameraState, area: CameraArea): CameraState {
  return {
    ...state,
    x: clamp(state.x, area.worldWidth - area.viewWidth / state.zoom),
    y: clamp(state.y, area.worldHeight - area.viewHeight / state.zoom),
  }
}

export function createCameraState(worker: Point, area: CameraArea): CameraState {
  return followWorker({ x: 0, y: 0, zoom: 1, following: true }, worker, area)
}

export function followWorker(state: CameraState, worker: Point, area: CameraArea): CameraState {
  return constrain({
    ...state, following: true,
    x: worker.x - area.viewWidth / state.zoom / 2,
    y: worker.y - area.viewHeight / state.zoom / 2,
  }, area)
}

export function updateCamera(state: CameraState, worker: Point, area: CameraArea, deltaMs: number): CameraState {
  if (!state.following) return state
  const target = followWorker(state, worker, area)
  const blend = 1 - Math.exp(-FOLLOW_SPEED * Math.max(0, deltaMs) / 1000)
  return constrain({
    ...state,
    x: state.x + (target.x - state.x) * blend,
    y: state.y + (target.y - state.y) * blend,
  }, area)
}

export function panCamera(state: CameraState, delta: Point, area: CameraArea): CameraState {
  if (delta.x === 0 && delta.y === 0) return state
  return constrain({
    ...state, following: false,
    x: state.x - delta.x / state.zoom,
    y: state.y - delta.y / state.zoom,
  }, area)
}

export function zoomCamera(state: CameraState, cursor: Point, wheelDelta: number, area: CameraArea): CameraState {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * Math.exp(-wheelDelta * 0.001)))
  if (zoom === state.zoom) return state
  // Świat pod kursorem przed zoomem = świat pod kursorem po zoomie.
  return constrain({
    x: state.x + cursor.x / state.zoom - cursor.x / zoom,
    y: state.y + cursor.y / state.zoom - cursor.y / zoom,
    zoom, following: state.following,
  }, area)
}

// Phaser powiększa obraz względem środka widoku; stan przechowuje lewy górny róg świata.
export function getCameraScroll(state: CameraState, area: CameraArea): Point {
  return {
    x: state.x + (area.viewWidth / state.zoom - area.viewWidth) / 2,
    y: state.y + (area.viewHeight / state.zoom - area.viewHeight) / 2,
  }
}

export function getHoveredTile(state: CameraState, cursor: Point, area: CameraArea, tileSize: number) {
  if (cursor.x < 0 || cursor.y < 0 || cursor.x >= area.viewWidth || cursor.y >= area.viewHeight) return null
  const x = state.x + cursor.x / state.zoom
  const y = state.y + cursor.y / state.zoom
  if (x < 0 || y < 0 || x >= area.worldWidth || y >= area.worldHeight) return null
  return { column: Math.floor(x / tileSize), row: Math.floor(y / tileSize) }
}
