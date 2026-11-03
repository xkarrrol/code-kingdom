import type { TilePosition } from './map'
import type { WorkerState } from './workerState'
import { getFacingTile } from './workerState.ts'

export interface TreeResource extends TilePosition {
  wood: number
}

export interface ResourceState {
  trees: TreeResource[]
  collectedWood: number
}

export function createResources(trees: readonly TilePosition[]): ResourceState {
  return { trees: trees.map(tree => ({ ...tree, wood: 3 })), collectedWood: 0 }
}

// Wspólny wybór drzewa dla odczytu świata i ścinania.
export function getTreeAhead(state: ResourceState, worker: WorkerState): TreeResource | undefined {
  const front = getFacingTile(worker)
  return state.trees.find(tree => tree.wood > 0 && tree.column === front.column && tree.row === front.row)
}

// Czysta logika zasobów: żadnych zależności od Reacta, Phasera ani Pythona.
export function chopWood(state: ResourceState, worker: WorkerState): ResourceState {
  const target = getTreeAhead(state, worker)
  if (!target) return state

  return {
    collectedWood: state.collectedWood + 1,
    trees: state.trees
      .map(tree => tree === target ? { ...tree, wood: tree.wood - 1 } : tree)
      .filter(tree => tree.wood > 0),
  }
}
