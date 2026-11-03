import type { ResourceAmounts } from './resources'
import type { BuildingKind } from './buildingData'

export const SAWMILL_CAPACITY = { wood: 10, planks: 10 } as const
export type SawmillInventory = Pick<ResourceAmounts, 'wood' | 'planks'>

export interface ProductionRecipe {
  building: BuildingKind
  inputs: Partial<ResourceAmounts>
  outputs: Partial<ResourceAmounts>
}

export const productionRecipes = {
  planks: { building: 'sawmill', inputs: { wood: 2 }, outputs: { planks: 1 } },
} as const satisfies Record<string, ProductionRecipe>
