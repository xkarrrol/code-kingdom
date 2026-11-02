import type { WorkerCommand } from '../game/commands'

export const MAX_COMMANDS = 100
export const COMPUTE_TIMEOUT_MS = 2000

export type PythonRequest = { type: 'init' } | { type: 'run'; code: string }
export type PythonMessage =
  | { type: 'ready' }
  | { type: 'result'; commands: WorkerCommand[] }
  | { type: 'error'; message: string }

export function isWorkerCommand(value: unknown): value is WorkerCommand {
  return value === 'move_up' || value === 'move_down' || value === 'move_left' || value === 'move_right' || value === 'chop_wood'
}

export function isCommandList(value: unknown): value is WorkerCommand[] {
  return Array.isArray(value) && value.length <= MAX_COMMANDS && value.every(isWorkerCommand)
}
