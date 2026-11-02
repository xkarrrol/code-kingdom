import type { TilePosition } from './map'

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

// Czysta logika zasobów: żadnych zależności od Reacta, Phasera ani Pythona.
export function chopWood(state: ResourceState, worker: TilePosition): ResourceState {
  const neighbours = [
    { column: worker.column, row: worker.row - 1 },
    { column: worker.column, row: worker.row + 1 },
    { column: worker.column - 1, row: worker.row },
    { column: worker.column + 1, row: worker.row },
  ]
  let target: TreeResource | undefined
  for (const neighbour of neighbours) {
    target = state.trees.find(tree => tree.wood > 0 && tree.column === neighbour.column && tree.row === neighbour.row)
    if (target) break
  }
  if (!target) return state

  return {
    collectedWood: state.collectedWood + 1,
    trees: state.trees
      .map(tree => tree === target ? { ...tree, wood: tree.wood - 1 } : tree)
      .filter(tree => tree.wood > 0),
  }
}
