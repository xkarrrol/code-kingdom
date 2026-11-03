import type { TilePosition } from './map'
import type { PlacedBuilding } from './buildingData'
import { buildingDefinitions } from './buildingData.ts'
import type { ResourceKind, ResourceState } from './resources'
import { inventorySize, INVENTORY_CAPACITY, resourceDefinitions } from './resources.ts'
import { isBesideArea } from './areas.ts'
import type { ProductionRecipe, SawmillInventory } from './productionData'
import { productionRecipes } from './productionData.ts'

export interface ProductionState { resources: ResourceState; buildings: readonly PlacedBuilding[] }
export interface ProductionResult { ok: boolean; state: ProductionState; message: string }

const sawmillOf = (buildings: readonly PlacedBuilding[]) => buildings.find(building => building.kind === 'sawmill')

export function getSawmillInventory(buildings: readonly PlacedBuilding[]): SawmillInventory {
  const sawmill = sawmillOf(buildings)
  if (!sawmill) throw new Error('Tartak jeszcze nie istnieje. Najpierw go zbuduj.')
  return { wood: sawmill.storage?.wood ?? 0, planks: sawmill.storage?.planks ?? 0 }
}

function unavailable(state: ProductionState, worker: TilePosition): ProductionResult | null {
  const sawmill = sawmillOf(state.buildings)
  if (!sawmill) return { ok: false, state, message: 'Tartak jeszcze nie istnieje. Najpierw go zbuduj.' }
  if (!isBesideArea(worker, sawmill)) return { ok: false, state, message: 'Stań na polu przy boku tartaku.' }
  return null
}

// Transport działa w obu kierunkach i respektuje limit magazynu docelowego.
function transferSawmillResource(state: ProductionState, worker: TilePosition, kind: 'wood' | 'planks', direction: 'deposit' | 'collect'): ProductionResult {
  const error = unavailable(state, worker)
  if (error) return error
  const sawmill = sawmillOf(state.buildings)!
  const stored = sawmill.storage?.[kind] ?? 0
  const capacity = buildingDefinitions[sawmill.kind].storageCapacity[kind]
  const available = direction === 'deposit' ? state.resources.worker[kind] : stored
  const room = direction === 'deposit' ? capacity - stored : INVENTORY_CAPACITY - inventorySize(state.resources)
  if (available === 0) return { ok: false, state, message: direction === 'deposit' ? 'Robotnik nie ma drewna do oddania.' : 'W tartaku nie ma desek do odebrania.' }
  if (room <= 0) return { ok: false, state, message: direction === 'deposit' ? 'Magazyn drewna tartaku jest pełny (10/10).' : 'Ekwipunek robotnika jest pełny.' }
  const amount = Math.min(available, room)
  const delta = direction === 'deposit' ? amount : -amount
  return {
    ok: true,
    state: {
      resources: { ...state.resources, worker: { ...state.resources.worker, [kind]: state.resources.worker[kind] - delta } },
      buildings: state.buildings.map(building => building.id === sawmill.id
        ? { ...building, storage: { ...building.storage, [kind]: stored + delta } } : building),
    },
    message: direction === 'deposit' ? `Przekazano do tartaku ${amount} drewna.` : `Odebrano z tartaku ${amount} desek.`,
  }
}

// Jedno wywołanie wykonuje jedną recepturę; brak zegara ani produkcji automatycznej.
export function processRecipe(state: ProductionState, worker: TilePosition, recipe: ProductionRecipe): ProductionResult {
  const error = unavailable(state, worker)
  if (error) return error
  const building = state.buildings.find(item => item.kind === recipe.building)
  if (!building) return { ok: false, state, message: 'Brak budynku obsługującego recepturę.' }
  const storage = { ...building.storage }
  for (const [kind, amount] of Object.entries(recipe.inputs) as [ResourceKind, number][]) {
    if ((storage[kind] ?? 0) < amount) return { ok: false, state, message: `Brak surowców w tartaku: ${resourceDefinitions[kind].label}, wymagane ${amount}.` }
    storage[kind] = (storage[kind] ?? 0) - amount
  }
  const capacities: Partial<Record<ResourceKind, number>> = buildingDefinitions[building.kind].storageCapacity
  for (const [kind, amount] of Object.entries(recipe.outputs) as [ResourceKind, number][]) {
    const next = (storage[kind] ?? 0) + amount
    if (next > (capacities[kind] ?? 0)) return { ok: false, state, message: `Brak miejsca w magazynie tartaku: ${resourceDefinitions[kind].label}, limit ${capacities[kind] ?? 0}.` }
    storage[kind] = next
  }
  const format = (amounts: ProductionRecipe['inputs']) => Object.entries(amounts).map(([kind, amount]) => `${resourceDefinitions[kind as ResourceKind].label}: ${amount}`).join(', ')
  return {
    ok: true,
    state: { ...state, buildings: state.buildings.map(item => item.id === building.id ? { ...item, storage } : item) },
    message: `Wykonano recepturę: ${format(recipe.inputs)} → ${format(recipe.outputs)}.`,
  }
}

export const depositToSawmill = (state: ProductionState, worker: TilePosition) => transferSawmillResource(state, worker, 'wood', 'deposit')
export const collectPlanks = (state: ProductionState, worker: TilePosition) => transferSawmillResource(state, worker, 'planks', 'collect')
export const processWood = (state: ProductionState, worker: TilePosition) => processRecipe(state, worker, productionRecipes.planks)
