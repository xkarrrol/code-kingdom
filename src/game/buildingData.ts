import type { TilePosition } from './map'
import type { TileArea } from './areas'
import type { ResourceAmounts } from './resources'
import { SAWMILL_CAPACITY } from './productionData.ts'

export const buildingDefinitions = {
  sawmill: { name: 'Tartak', columns: 2, rows: 2, cost: { wood: 3, stone: 2 } satisfies Partial<ResourceAmounts>, storageCapacity: SAWMILL_CAPACITY },
} as const
export type BuildingKind = keyof typeof buildingDefinitions
export interface BuildingSite extends TilePosition { id: string; kind: BuildingKind }
export interface PlacedBuilding extends TileArea { id: string; kind: BuildingKind; storage?: Partial<ResourceAmounts> }

// Jedno ręcznie wybrane miejsce. Python nie wybiera lokalizacji budowy.
export const sawmillSite: BuildingSite = { id: 'sawmill-1', kind: 'sawmill', column: 7, row: 5 }

export function getBuildingArea(site: BuildingSite): PlacedBuilding {
  const definition = buildingDefinitions[site.kind]
  return { ...site, columns: definition.columns, rows: definition.rows }
}

export function createBuilding(site: BuildingSite): PlacedBuilding {
  const storage = Object.fromEntries(Object.keys(buildingDefinitions[site.kind].storageCapacity).map(kind => [kind, 0]))
  return { ...getBuildingArea(site), storage }
}
