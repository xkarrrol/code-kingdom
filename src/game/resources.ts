import type { kingdomMap, TilePosition } from './map'
import type { WorkerState } from './workerState'
import { getFacingTile } from './workerState.ts'

export interface TreeResource extends TilePosition {
  wood: number
}

export interface ResourceState {
  trees: TreeResource[]
  workerWood: number
  kingdomWood: number
}

export const WOOD_CAPACITY = 5
export interface Inventory { wood: number; capacity: number }
export interface WoodStatus { inventory: Inventory; kingdomWood: number }

export function getInventory(state: ResourceState): Inventory {
  return { wood: state.workerWood, capacity: WOOD_CAPACITY }
}

export function getWoodStatus(state: ResourceState): WoodStatus {
  return { inventory: getInventory(state), kingdomWood: state.kingdomWood }
}

export function createResources(trees: readonly TilePosition[]): ResourceState {
  return { trees: trees.map(tree => ({ ...tree, wood: 3 })), workerWood: 0, kingdomWood: 0 }
}

// Wspólny wybór drzewa dla odczytu świata i ścinania.
export function getTreeAhead(state: ResourceState, worker: WorkerState): TreeResource | undefined {
  const front = getFacingTile(worker)
  return state.trees.find(tree => tree.wood > 0 && tree.column === front.column && tree.row === front.row)
}

// Czysta logika zasobów: żadnych zależności od Reacta, Phasera ani Pythona.
export function chopWood(state: ResourceState, worker: WorkerState): ResourceState {
  if (state.workerWood >= WOOD_CAPACITY) return state
  const target = getTreeAhead(state, worker)
  if (!target) return state

  return {
    ...state,
    workerWood: state.workerWood + 1,
    trees: state.trees
      .map(tree => tree === target ? { ...tree, wood: tree.wood - 1 } : tree)
      .filter(tree => tree.wood > 0),
  }
}

export function depositWood(state: ResourceState, worker: TilePosition, castle: typeof kingdomMap.castle): ResourceState {
  const beside = worker.row >= castle.row && worker.row < castle.row + castle.rows
    && (worker.column === castle.column - 1 || worker.column === castle.column + castle.columns)
  const aboveOrBelow = worker.column >= castle.column && worker.column < castle.column + castle.columns
    && (worker.row === castle.row - 1 || worker.row === castle.row + castle.rows)
  if (state.workerWood === 0 || (!beside && !aboveOrBelow)) return state
  return { ...state, workerWood: 0, kingdomWood: state.kingdomWood + state.workerWood }
}
