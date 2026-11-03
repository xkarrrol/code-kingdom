import type { TilePosition } from './map'
import type { TreeResource } from './resources'

export interface SelectableObject extends TilePosition {
  id: string
  kind: 'unit' | 'building' | 'resource'
  name: string
  columns: number
  rows: number
  wood?: number
}
export interface SelectionState { selectedId: string | null; infoOpen: boolean }
export interface SelectionView { object: SelectableObject | null; infoOpen: boolean }
export type SelectionAction = 'select-next' | 'select-previous' | 'show-info' | 'hide-info'

// Stałe identyfikatory pozwalają później dopisywać jednostki i budynki do tej samej listy.
export function getSelectableObjects(
  worker: TilePosition,
  castle: TilePosition & { columns: number; rows: number },
  trees: readonly TreeResource[],
): SelectableObject[] {
  return [
    { ...worker, id: 'worker', kind: 'unit', name: 'Robotnik', columns: 1, rows: 1 },
    { ...castle, id: 'castle', kind: 'building', name: 'Zamek' },
    ...trees.filter(tree => tree.wood > 0).map(tree => ({
      ...tree, id: `tree:${tree.column},${tree.row}`, kind: 'resource' as const,
      name: 'Drzewo', columns: 1, rows: 1,
    })),
  ]
}

export function getSelectedObject(objects: readonly SelectableObject[], state: SelectionState) {
  return objects.find(object => object.id === state.selectedId) ?? null
}

export function reconcileSelection(objects: readonly SelectableObject[], state: SelectionState): SelectionState {
  return getSelectedObject(objects, state) ? state : { selectedId: null, infoOpen: false }
}

export function applySelectionAction(
  objects: readonly SelectableObject[], state: SelectionState, action: SelectionAction,
): SelectionState {
  const current = reconcileSelection(objects, state)
  if (action === 'hide-info') return { ...current, infoOpen: false }
  if (action === 'show-info') return { ...current, infoOpen: current.selectedId !== null }
  if (!objects.length) return current
  const index = objects.findIndex(object => object.id === current.selectedId)
  const reverse = action === 'select-previous'
  const next = index < 0 ? (reverse ? objects.length - 1 : 0)
    : (index + (reverse ? -1 : 1) + objects.length) % objects.length
  return { selectedId: objects[next].id, infoOpen: false }
}
