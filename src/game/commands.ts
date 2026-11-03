import type { Direction } from './movement'
import type { TilePosition } from './map'
import type { Surroundings } from './surroundings'
import type { Inventory } from './resources'
import type { SawmillInventory } from './productionData'

type MoveCommand = 'move_up' | 'move_down' | 'move_left' | 'move_right'
type TurnCommand = 'turn_up' | 'turn_down' | 'turn_left' | 'turn_right'
export type WorkerCommand = MoveCommand | TurnCommand | 'chop_wood' | 'deposit_wood' | 'mine_stone' | 'deposit_stone' | 'build_sawmill'
  | 'deposit_to_sawmill' | 'process_wood' | 'collect_planks' | 'deposit_planks'

interface ProductionActions {
  deposit: () => Promise<boolean>
  process: () => Promise<boolean>
  collect: () => Promise<boolean>
  depositPlanks: () => Promise<boolean>
  inventory: () => SawmillInventory
}

interface StoneActions {
  mine: () => Promise<boolean>
  deposit: () => Promise<boolean>
  ahead: () => boolean
}

const commandDirections: Record<MoveCommand | TurnCommand, Direction> = {
  move_up: 'up',
  move_down: 'down',
  move_left: 'left',
  move_right: 'right',
  turn_up: 'up',
  turn_down: 'down',
  turn_left: 'left',
  turn_right: 'right',
}

export const exampleCommands: readonly WorkerCommand[] = ['move_up', 'move_right', 'move_left']

// Wykonawca ruchu zwraca Promise dopiero po zakończeniu animacji.
export class WorkerCommands {
  manualInputEnabled = true
  private running = false
  private disposed = false
  private readonly move: (direction: Direction) => Promise<boolean>
  private readonly chop: () => Promise<boolean>
  private readonly turn: (direction: Direction) => Promise<boolean>
  private readonly readPosition?: () => TilePosition
  private readonly checkMove?: (direction: Direction) => boolean
  private readonly checkTreeAhead?: () => boolean
  private readonly readSurroundings?: () => Surroundings
  private readonly deposit: () => Promise<boolean>
  private readonly readInventory?: () => Inventory
  private readonly stone?: StoneActions
  private readonly buildSawmill: () => Promise<boolean>
  private readonly production?: ProductionActions

  constructor(
    move: (direction: Direction) => Promise<boolean>,
    chop: () => Promise<boolean> = async () => false,
    turn: (direction: Direction) => Promise<boolean> = async () => false,
    readPosition?: () => TilePosition,
    checkMove?: (direction: Direction) => boolean,
    checkTreeAhead?: () => boolean,
    readSurroundings?: () => Surroundings,
    deposit: () => Promise<boolean> = async () => false,
    readInventory?: () => Inventory,
    stone?: StoneActions,
    buildSawmill: () => Promise<boolean> = async () => false,
    production?: ProductionActions,
  ) {
    this.move = move
    this.chop = chop
    this.turn = turn
    this.readPosition = readPosition
    this.checkMove = checkMove
    this.checkTreeAhead = checkTreeAhead
    this.readSurroundings = readSurroundings
    this.deposit = deposit
    this.readInventory = readInventory
    this.stone = stone
    this.buildSawmill = buildSawmill
    this.production = production
  }

  getWorkerPosition(): TilePosition {
    if (this.disposed || !this.readPosition) throw new Error('Stan robotnika jest niedostępny.')
    const position = this.readPosition()
    return { column: position.column, row: position.row }
  }

  get isRunning() {
    return this.running
  }

  canMove(direction: Direction): boolean {
    if (this.disposed || !this.checkMove) throw new Error('Stan mapy jest niedostępny.')
    return this.checkMove(direction)
  }

  treeAhead(): boolean {
    if (this.disposed || !this.checkTreeAhead) throw new Error('Stan drzew jest niedostępny.')
    return this.checkTreeAhead()
  }

  getSurroundings(): Surroundings {
    if (this.disposed || !this.readSurroundings) throw new Error('Stan otoczenia jest niedostępny.')
    return { ...this.readSurroundings() }
  }

  executeCommand(command: WorkerCommand): Promise<boolean> {
    if (!this.manualInputEnabled || this.running || this.disposed) return Promise.resolve(false)
    return this.perform(command)
  }

  getInventory(): Inventory {
    if (this.disposed || !this.readInventory) throw new Error('Ekwipunek robotnika jest niedostępny.')
    return { ...this.readInventory() }
  }

  private perform(command: WorkerCommand): Promise<boolean> {
    if (command === 'chop_wood') return this.chop()
    if (command === 'deposit_wood') return this.deposit()
    if (command === 'mine_stone') return this.stone?.mine() ?? Promise.resolve(false)
    if (command === 'deposit_stone') return this.stone?.deposit() ?? Promise.resolve(false)
    if (command === 'build_sawmill') return this.buildSawmill()
    if (command === 'deposit_to_sawmill') return this.production?.deposit() ?? Promise.resolve(false)
    if (command === 'process_wood') return this.production?.process() ?? Promise.resolve(false)
    if (command === 'collect_planks') return this.production?.collect() ?? Promise.resolve(false)
    if (command === 'deposit_planks') return this.production?.depositPlanks() ?? Promise.resolve(false)
    if (command === 'turn_up' || command === 'turn_down' || command === 'turn_left' || command === 'turn_right') {
      return this.turn(commandDirections[command])
    }
    return this.move(commandDirections[command])
  }

  stoneAhead(): boolean {
    if (this.disposed || !this.stone) throw new Error('Stan złóż kamienia jest niedostępny.')
    return this.stone.ahead()
  }

  getSawmillInventory(): SawmillInventory {
    if (this.disposed || !this.production) throw new Error('Magazyn tartaku jest niedostępny.')
    return { ...this.production.inventory() }
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
