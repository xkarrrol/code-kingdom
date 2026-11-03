import type { TilePosition } from './map'
import type { Direction } from './movement'
import { getAdjacentTile } from './movement.ts'

export interface WorkerState extends TilePosition {
  facing: Direction
}

export interface WorkerStatus {
  facing: Direction
  message: string
}

export function createWorkerState(position: TilePosition): WorkerState {
  return { ...position, facing: 'down' }
}

export function turnWorker(worker: WorkerState, direction: Direction): WorkerState {
  return { ...worker, facing: direction }
}

// Wywoływane po zakończeniu kroku; nieudany ruch nie zmienia kierunku.
export function completeWorkerMove(worker: WorkerState, destination: TilePosition | null, direction: Direction): WorkerState {
  return destination ? { ...destination, facing: direction } : worker
}

export function getFacingTile(worker: WorkerState): TilePosition {
  return getAdjacentTile(worker, worker.facing)
}
