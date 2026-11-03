import type { TilePosition } from './map'
import type { MovementMap } from './movement'
import { getTileType } from './movement.ts'
import type { ResourceAmounts, ResourceKind, ResourceState } from './resources'
import { resourceDefinitions } from './resources.ts'
import type { BuildingSite, PlacedBuilding } from './buildingData'
import { buildingDefinitions, createBuilding, getBuildingArea, sawmillSite } from './buildingData.ts'
import { containsTile, isBesideArea } from './areas.ts'

export interface ConstructionState { resources: ResourceState; buildings: readonly PlacedBuilding[] }
export interface BuildResult { ok: boolean; state: ConstructionState; message: string }

// Sprawdzenie i odjęcie kosztu stanowią jedną operację, bez zależności od renderowania.
export function buildBuilding(state: ConstructionState, map: MovementMap, worker: TilePosition, site: BuildingSite): BuildResult {
  const reject = (message: string): BuildResult => ({ ok: false, state, message })
  const definition = buildingDefinitions[site.kind]
  const cost: Partial<ResourceAmounts> = definition.cost
  const area = getBuildingArea(site)
  if (state.buildings.some(building => building.id === site.id)) return reject(`${definition.name} już istnieje.`)
  if (!isBesideArea(worker, area)) return reject(`Stań na polu przy boku oznaczonego miejsca budowy: ${definition.name}.`)
  const world = { ...map, buildings: [...(map.buildings ?? []), ...state.buildings] }
  for (let row = area.row; row < area.row + area.rows; row++) {
    for (let column = area.column; column < area.column + area.columns; column++) {
      if (getTileType(world, { column, row }) !== 'empty' || containsTile(area, worker)) {
        return reject('Miejsce budowy jest zajęte lub teren jest niedostępny.')
      }
    }
  }
  const kinds = Object.keys(resourceDefinitions) as ResourceKind[]
  if (kinds.some(kind => state.resources.kingdom[kind] < (cost[kind] ?? 0))) {
    const costText = kinds.filter(kind => (cost[kind] ?? 0) > 0).map(kind => `${resourceDefinitions[kind].label}: ${cost[kind]}`).join(', ')
    return reject(`Brak zasobów królestwa. ${definition.name} wymaga (${costText}).`)
  }
  const kingdom = Object.fromEntries(kinds.map(kind => [kind, state.resources.kingdom[kind] - (cost[kind] ?? 0)])) as ResourceAmounts
  return {
    ok: true,
    state: { resources: { ...state.resources, kingdom }, buildings: [...state.buildings, createBuilding(site)] },
    message: 'Zbudowano tartak.',
  }
}

export const buildSawmill = (state: ConstructionState, map: MovementMap, worker: TilePosition) =>
  buildBuilding(state, map, worker, sawmillSite)
