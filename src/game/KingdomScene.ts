import Phaser from 'phaser'
import { kingdomMap } from './map'
import type { TilePosition } from './map'
import { getWorkerDestination } from './movement'
import type { Direction } from './movement'
import { WorkerCommands } from './commands'
import type { WorkerCommand } from './commands'
import { chopWood, createResources } from './resources'

const arrowCommands: Record<string, WorkerCommand | undefined> = {
  ArrowUp: 'move_up',
  ArrowDown: 'move_down',
  ArrowLeft: 'move_left',
  ArrowRight: 'move_right',
}

export class KingdomScene extends Phaser.Scene {
  private workerPosition: TilePosition = { ...kingdomMap.worker }
  private workerGraphics?: Phaser.GameObjects.Graphics
  private isMoving = false
  private pendingMove?: Promise<boolean>
  private finishMove?: (moved: boolean) => void
  commands?: WorkerCommands
  private readonly onCommandsReady?: (commands: WorkerCommands) => void
  private readonly onWoodChanged?: (wood: number) => void
  private resources = createResources(kingdomMap.trees)
  private treeGraphics = new Map<string, Phaser.GameObjects.Graphics>()

  constructor(onCommandsReady?: (commands: WorkerCommands) => void, onWoodChanged?: (wood: number) => void) {
    super('KingdomScene')
    this.onCommandsReady = onCommandsReady
    this.onWoodChanged = onWoodChanged
  }

  create() {
    const graphics = this.add.graphics()
    const { columns, rows, tileSize, castle, worker } = kingdomMap
    this.resources = createResources(kingdomMap.trees)
    this.treeGraphics.clear()
    this.onWoodChanged?.(this.resources.collectedWood)

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        graphics.fillStyle((column + row) % 2 === 0 ? 0x79ad57 : 0x71a34f)
        graphics.fillRect(column * tileSize, row * tileSize, tileSize, tileSize)
        graphics.lineStyle(1, 0x547e3a)
        graphics.strokeRect(column * tileSize, row * tileSize, tileSize, tileSize)
      }
    }

    for (const tree of this.resources.trees) {
      const treeGraphic = this.add.graphics()
      this.drawTree(treeGraphic, tree)
      this.treeGraphics.set(`${tree.column},${tree.row}`, treeGraphic)
    }

    // Zamek jest wyśrodkowany w obrębie swojego obszaru 2 × 2 pól.
    const x = (castle.column + castle.columns / 2) * tileSize
    const y = (castle.row + castle.rows / 2) * tileSize
    graphics.fillStyle(0x596473)
    graphics.fillRect(x - 48, y - 35, 96, 82)
    graphics.fillStyle(0xc7cbd1)
    graphics.fillRect(x - 39, y - 24, 78, 62)

    for (const towerX of [x - 43, x + 25]) {
      graphics.fillStyle(0xdde0e4)
      graphics.fillRect(towerX, y - 42, 18, 84)
      graphics.fillStyle(0x9b4040)
      graphics.fillTriangle(towerX - 5, y - 42, towerX + 9, y - 60, towerX + 23, y - 42)
    }

    graphics.fillStyle(0x45352b)
    graphics.fillRect(x - 12, y + 10, 24, 37)
    graphics.fillStyle(0x43596e)
    graphics.fillRect(x - 23, y - 13, 12, 15)
    graphics.fillRect(x + 11, y - 13, 12, 15)

    this.workerPosition = { ...worker }
    this.isMoving = false
    this.workerGraphics = this.add.graphics()
    this.drawWorker(this.workerGraphics)
    const center = this.tileCenter(worker)
    this.workerGraphics.setPosition(center.x, center.y)
    this.commands = new WorkerCommands(direction => this.moveWorker(direction), () => this.chopWorkerWood())
    this.onCommandsReady?.(this.commands)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.commands?.dispose()
      this.commands = undefined
      this.workerGraphics = undefined
      // Zwolnij oczekującą sekwencję również przy zamknięciu sceny.
      this.finishMove?.(false)
    })

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.addCapture('UP,DOWN,LEFT,RIGHT')
      const onKeyDown = (event: KeyboardEvent) => {
        // Przytrzymanie klawisza nie powoduje kolejnych kroków.
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
        const command = arrowCommands[event.key]
        if (command && !this.isMoving) void this.commands?.executeCommand(command)
      }
      keyboard.on('keydown', onKeyDown)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off('keydown', onKeyDown)
        keyboard.removeCapture('UP,DOWN,LEFT,RIGHT')
      })
    }
  }

  private async moveWorker(direction: Direction): Promise<boolean> {
    // Przycisk może zostać kliknięty w trakcie kroku rozpoczętego strzałką.
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false

    const destination = getWorkerDestination({ ...kingdomMap, trees: this.resources.trees }, this.workerPosition, direction)
    if (!destination) return false

    this.isMoving = true
    const center = this.tileCenter(destination)
    const movement = new Promise<boolean>(resolve => {
      this.finishMove = moved => {
        this.isMoving = false
        this.pendingMove = undefined
        this.finishMove = undefined
        resolve(moved)
      }
    })
    this.pendingMove = movement
    this.tweens.add({
      targets: this.workerGraphics,
      x: center.x,
      y: center.y,
      duration: 180,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.workerPosition = destination
        this.finishMove?.(true)
      },
    })
    return movement
  }

  private async chopWorkerWood(): Promise<boolean> {
    // Także pierwsze ścinanie czeka na ewentualny krok rozpoczęty strzałką.
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const next = chopWood(this.resources, this.workerPosition)
    if (next === this.resources) return false

    for (const tree of this.resources.trees) {
      if (!next.trees.some(remaining => remaining.column === tree.column && remaining.row === tree.row)) {
        const key = `${tree.column},${tree.row}`
        this.treeGraphics.get(key)?.destroy()
        this.treeGraphics.delete(key)
      }
    }
    this.resources = next
    this.onWoodChanged?.(next.collectedWood)
    return true
  }

  private tileCenter(position: TilePosition) {
    return {
      x: (position.column + 0.5) * kingdomMap.tileSize,
      y: (position.row + 0.5) * kingdomMap.tileSize,
    }
  }

  private drawTree(graphics: Phaser.GameObjects.Graphics, position: TilePosition) {
    const { x, y } = this.tileCenter(position)
    graphics.fillStyle(0x75472c)
    graphics.fillRect(x - 5, y + 3, 10, 24)
    graphics.fillStyle(0x245c35)
    graphics.fillCircle(x, y - 5, 22)
    graphics.fillStyle(0x327a43)
    graphics.fillCircle(x - 6, y - 11, 13)
  }

  private drawWorker(graphics: Phaser.GameObjects.Graphics) {
    // Figury robotnika są rysowane wokół lokalnego punktu (0, 0).
    // Animacja przesuwa cały obiekt Graphics, bez ponownego rysowania mapy.
    const x = 0
    const y = 0
    graphics.fillStyle(0x45352b)
    graphics.fillRect(x - 10, y + 13, 7, 12)
    graphics.fillRect(x + 3, y + 13, 7, 12)
    graphics.fillStyle(0x355d9b)
    graphics.fillRect(x - 11, y - 3, 22, 22)
    graphics.fillStyle(0xf0c49a)
    graphics.fillCircle(x, y - 13, 9)
    graphics.fillStyle(0xe0ae46)
    graphics.fillRect(x - 12, y - 23, 24, 7)
    graphics.fillStyle(0x75472c)
    graphics.fillRect(x + 16, y - 6, 4, 30)
    graphics.fillStyle(0xc7cbd1)
    graphics.fillRect(x + 11, y - 9, 14, 7)
  }
}
