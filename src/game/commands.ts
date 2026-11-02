import type { Direction } from './movement'

type MoveCommand = 'move_up' | 'move_down' | 'move_left' | 'move_right'
export type WorkerCommand = MoveCommand | 'chop_wood'

const commandDirections: Record<MoveCommand, Direction> = {
  move_up: 'up',
  move_down: 'down',
  move_left: 'left',
  move_right: 'right',
}

export const exampleCommands: readonly WorkerCommand[] = ['move_up', 'move_right', 'move_left']

// Wykonawca ruchu zwraca Promise dopiero po zakończeniu animacji.
export class WorkerCommands {
  manualInputEnabled = true
  private running = false
  private disposed = false
  private readonly move: (direction: Direction) => Promise<boolean>
  private readonly chop: () => Promise<boolean>

  constructor(move: (direction: Direction) => Promise<boolean>, chop: () => Promise<boolean> = async () => false) {
    this.move = move
    this.chop = chop
  }

  get isRunning() {
    return this.running
  }

  executeCommand(command: WorkerCommand): Promise<boolean> {
    if (!this.manualInputEnabled || this.running || this.disposed) return Promise.resolve(false)
    return this.perform(command)
  }

  private perform(command: WorkerCommand): Promise<boolean> {
    return command === 'chop_wood' ? this.chop() : this.move(commandDirections[command])
  }

  async runCommands(commands: readonly WorkerCommand[]): Promise<boolean> {
    if (this.running || this.disposed) return false
    this.running = true

    try {
      for (const command of [...commands]) {
        if (this.disposed) return false
        // Zablokowany krok zwraca false; kolejne polecenia nadal są wykonywane.
        await this.perform(command)
      }
      return !this.disposed
    } finally {
      this.running = false
    }
  }

  dispose() {
    this.disposed = true
  }
}
