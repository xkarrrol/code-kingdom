import type { WorkerCommand } from '../game/commands'

import type { Direction } from '../game/movement'
import type { Surroundings } from '../game/surroundings'
import type { Inventory } from '../game/resources'
import { INVENTORY_CAPACITY } from '../game/resources.ts'
import { SAWMILL_CAPACITY } from '../game/productionData.ts'
import type { SawmillInventory } from '../game/productionData'

export const MAX_COMMANDS = 100
export const COMPUTE_TIMEOUT_MS = 2000
export const MAX_QUERIES = 100
// Bezpiecznik na brak odpowiedzi silnika, niezależny od budżetu obliczeń.
export const RESPONSE_TIMEOUT_MS = 10_000

export interface WorkerPosition { x: number; y: number }
export type WorldQuery = { operation: 'get_worker_position' } | { operation: 'can_move'; direction: Direction } | { operation: 'tree_ahead' } | { operation: 'stone_ahead' } | { operation: 'get_surroundings' } | { operation: 'get_inventory' } | { operation: 'get_sawmill_inventory' }
export type WorldValue = WorkerPosition | boolean | Surroundings | Inventory | SawmillInventory
export type BridgeResponse = { type: 'response'; runId: string; requestId: number } & (
  | { ok: true; value: WorldValue }
  | { ok: false; error: string }
)

export type PythonRequest = { type: 'init'; runId: string } | { type: 'run'; runId: string; code: string } | BridgeResponse
export type PythonMessage =
  | { type: 'ready'; runId: string }
  | { type: 'result'; runId: string }
  | { type: 'error'; runId: string; message: string }
  | ({ type: 'query'; runId: string; requestId: number } & WorldQuery)
  | { type: 'command'; runId: string; requestId: number; command: WorkerCommand }

export function isWorkerPosition(value: unknown): value is WorkerPosition {
  if (!value || typeof value !== 'object' || !('x' in value) || !('y' in value)) return false
  return Number.isInteger(value.x) && Number.isInteger(value.y)
    && typeof value.x === 'number' && value.x >= 0 && typeof value.y === 'number' && value.y >= 0
}

export function isDirection(value: unknown): value is Direction {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right'
}

export function isSurroundings(value: unknown): value is Surroundings {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 4) return false
  const types = ['empty', 'tree', 'stone', 'water', 'mountain', 'castle', 'building', 'boundary']
  return (['up', 'down', 'left', 'right'] as const).every(direction =>
    Object.hasOwn(value, direction) && types.includes((value as Record<string, string>)[direction]))
}

export function isInventory(value: unknown): value is Inventory {
  return !!value && typeof value === 'object' && Object.keys(value).length === 4
    && 'wood' in value && typeof value.wood === 'number' && Number.isInteger(value.wood)
    && value.wood >= 0 && value.wood <= INVENTORY_CAPACITY
    && 'stone' in value && typeof value.stone === 'number' && Number.isInteger(value.stone)
    && value.stone >= 0
    && 'planks' in value && typeof value.planks === 'number' && Number.isInteger(value.planks) && value.planks >= 0
    && value.stone + value.wood + value.planks <= INVENTORY_CAPACITY
    && 'capacity' in value && value.capacity === INVENTORY_CAPACITY
}

export function isSawmillInventory(value: unknown): value is SawmillInventory {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2) return false
  return (['wood', 'planks'] as const).every(kind => {
    const amount = (value as Record<string, unknown>)[kind]
    return Object.hasOwn(value, kind) && typeof amount === 'number' && Number.isInteger(amount)
      && amount >= 0 && amount <= SAWMILL_CAPACITY[kind]
  })
}

export function isWorkerCommand(value: unknown): value is WorkerCommand {
  return value === 'move_up' || value === 'move_down' || value === 'move_left' || value === 'move_right'
    || value === 'turn_up' || value === 'turn_down' || value === 'turn_left' || value === 'turn_right'
    || value === 'chop_wood' || value === 'deposit_wood' || value === 'mine_stone' || value === 'deposit_stone' || value === 'build_sawmill'
    || value === 'deposit_to_sawmill' || value === 'process_wood' || value === 'collect_planks' || value === 'deposit_planks'
}
