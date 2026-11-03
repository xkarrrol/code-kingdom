import type { kingdomMap, TilePosition } from './map'
import type { WorkerState } from './workerState'
import { getFacingTile } from './workerState.ts'
import { isBesideArea } from './areas.ts'
import type { SawmillInventory } from './productionData'

export const resourceDefinitions = {
  wood: { label: 'drewno' },
  stone: { label: 'kamień' },
  planks: { label: 'deski' },
} as const
export const naturalResourceDefinitions = {
  wood: { nodes: 'trees', initialAmount: 3 },
  stone: { nodes: 'stones', initialAmount: 5 },
} as const
export type ResourceKind = keyof typeof resourceDefinitions
export type HarvestableResourceKind = keyof typeof naturalResourceDefinitions
export type ResourceAmounts = Record<ResourceKind, number>
export interface ResourceNode extends TilePosition { amount: number }
export type TreeResource = ResourceNode
export type ResourceState = Record<typeof naturalResourceDefinitions[HarvestableResourceKind]['nodes'], ResourceNode[]> & {
  worker: ResourceAmounts
  kingdom: ResourceAmounts
}

export const INVENTORY_CAPACITY = 5
export type Inventory = ResourceAmounts & { capacity: number }
export interface ResourceStatus { inventory: Inventory; kingdom: ResourceAmounts; sawmill: SawmillInventory | null }

const emptyAmounts = (): ResourceAmounts => Object.fromEntries(
  Object.keys(resourceDefinitions).map(kind => [kind, 0]),
) as ResourceAmounts

export function inventorySize(state: ResourceState): number {
  return Object.values(state.worker).reduce((total, amount) => total + amount, 0)
}

export function getInventory(state: ResourceState): Inventory {
  return { ...state.worker, capacity: INVENTORY_CAPACITY }
}

export function getResourceStatus(state: ResourceState, sawmill: SawmillInventory | null = null): ResourceStatus {
  return { inventory: getInventory(state), kingdom: { ...state.kingdom }, sawmill: sawmill ? { ...sawmill } : null }
}

export function createResources(trees: readonly TilePosition[], stones: readonly TilePosition[] = []): ResourceState {
  const positions = { trees, stones }
  const nodes = Object.fromEntries(Object.values(naturalResourceDefinitions).map(def => [
    def.nodes, positions[def.nodes].map(position => ({ ...position, amount: def.initialAmount })),
  ])) as Pick<ResourceState, 'trees' | 'stones'>
  return { ...nodes, worker: emptyAmounts(), kingdom: emptyAmounts() }
}

export function getResourceAhead(state: ResourceState, worker: WorkerState, kind: HarvestableResourceKind): ResourceNode | undefined {
  const front = getFacingTile(worker)
  return state[naturalResourceDefinitions[kind].nodes].find(node => node.amount > 0 && node.column === front.column && node.row === front.row)
}

export const getTreeAhead = (state: ResourceState, worker: WorkerState) => getResourceAhead(state, worker, 'wood')
export const getStoneAhead = (state: ResourceState, worker: WorkerState) => getResourceAhead(state, worker, 'stone')

// Jeden algorytm wydobycia dla wszystkich rodzajów zasobów.
export function gatherResource(state: ResourceState, worker: WorkerState, kind: HarvestableResourceKind): ResourceState {
  if (inventorySize(state) >= INVENTORY_CAPACITY) return state
  const target = getResourceAhead(state, worker, kind)
  if (!target) return state
  const key = naturalResourceDefinitions[kind].nodes
  return {
    ...state,
    worker: { ...state.worker, [kind]: state.worker[kind] + 1 },
    [key]: state[key].map(node => node === target ? { ...node, amount: node.amount - 1 } : node).filter(node => node.amount > 0),
  }
}

export const chopWood = (state: ResourceState, worker: WorkerState) => gatherResource(state, worker, 'wood')
export const mineStone = (state: ResourceState, worker: WorkerState) => gatherResource(state, worker, 'stone')

export function depositResource(state: ResourceState, worker: TilePosition, castle: typeof kingdomMap.castle, kind: ResourceKind): ResourceState {
  if (state.worker[kind] === 0 || !isBesideArea(worker, castle)) return state
  return {
    ...state, worker: { ...state.worker, [kind]: 0 },
    kingdom: { ...state.kingdom, [kind]: state.kingdom[kind] + state.worker[kind] },
  }
}

export const depositWood = (state: ResourceState, worker: TilePosition, castle: typeof kingdomMap.castle) => depositResource(state, worker, castle, 'wood')
export const depositStone = (state: ResourceState, worker: TilePosition, castle: typeof kingdomMap.castle) => depositResource(state, worker, castle, 'stone')
export const depositPlanks = (state: ResourceState, worker: TilePosition, castle: typeof kingdomMap.castle) => depositResource(state, worker, castle, 'planks')
