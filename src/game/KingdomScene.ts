import Phaser from 'phaser'
import { kingdomMap } from './map'
import type { TilePosition } from './map'
import { getWorkerDestination } from './movement'
import { getSurroundings } from './surroundings'
import type { Direction } from './movement'
import { WorkerCommands } from './commands'
import type { WorkerCommand } from './commands'
import { chopWood, createResources, depositWood, getInventory, getTreeAhead, getWoodStatus, WOOD_CAPACITY } from './resources'
import type { WoodStatus } from './resources'
import { completeWorkerMove, createWorkerState, turnWorker } from './workerState'
import type { WorkerStatus } from './workerState'
import { createCameraState, followWorker, gameViewport, getCameraScroll, getHoveredTile, panCamera, updateCamera, zoomCamera } from './camera'
import type { CameraState } from './camera'
import { applySelectionAction, getSelectableObjects, getSelectedObject, reconcileSelection } from './selection'
import type { SelectionAction, SelectionState, SelectionView, SelectableObject } from './selection'
import { cameraKeyboardDelta, updateCameraKeys } from './cameraKeyboard'
import type { CameraKeyboardAction, CameraPanKey } from './cameraKeyboard'
import { renderTerrain } from './renderTerrain'

const arrowCommands: Record<string, WorkerCommand | undefined> = {
  ArrowUp: 'move_up',
  ArrowDown: 'move_down',
  ArrowLeft: 'move_left',
  ArrowRight: 'move_right',
}

export class KingdomScene extends Phaser.Scene {
  private workerState = createWorkerState(kingdomMap.worker)
  private workerGraphics?: Phaser.GameObjects.Graphics
  private isMoving = false
  private pendingMove?: Promise<boolean>
  private finishMove?: (moved: boolean) => void
  commands?: WorkerCommands
  private readonly onCommandsReady?: (commands: WorkerCommands) => void
  private readonly onWoodChanged?: (wood: WoodStatus) => void
  private readonly onStatusChanged?: (status: WorkerStatus) => void
  private resources = createResources(kingdomMap.trees)
  private treeGraphics = new Map<string, Phaser.GameObjects.Graphics>()
  private cameraState?: CameraState
  private exploreMode = false
  private gridGraphics?: Phaser.GameObjects.Graphics
  private pointerPosition?: { x: number; y: number }
  private lastHoveredTile: TilePosition | null = null
  private readonly onHoverChanged?: (tile: TilePosition | null) => void
  private selection: SelectionState = { selectedId: null, infoOpen: false }
  private selectionGraphics?: Phaser.GameObjects.Graphics
  private selectionCameraTarget: string | null = null
  private selectionSnapshot = ''
  private readonly onSelectionChanged?: (view: SelectionView) => void
  private cameraPanKeys = new Set<CameraPanKey>()

  constructor(
    onCommandsReady?: (commands: WorkerCommands) => void,
    onWoodChanged?: (wood: WoodStatus) => void,
    onStatusChanged?: (status: WorkerStatus) => void,
    onHoverChanged?: (tile: TilePosition | null) => void,
    onSelectionChanged?: (view: SelectionView) => void,
  ) {
    super('KingdomScene')
    this.onCommandsReady = onCommandsReady
    this.onWoodChanged = onWoodChanged
    this.onStatusChanged = onStatusChanged
    this.onHoverChanged = onHoverChanged
    this.onSelectionChanged = onSelectionChanged
  }

  create() {
    const graphics = this.add.graphics()
    const { columns, rows, tileSize, castle, worker } = kingdomMap
    this.resources = createResources(kingdomMap.trees)
    this.treeGraphics.clear()
    this.onWoodChanged?.(getWoodStatus(this.resources))

    renderTerrain(graphics, kingdomMap.terrain, tileSize)
    this.gridGraphics = this.add.graphics().setDepth(1)
    this.gridGraphics.lineStyle(1, 0xffffff, 0.18)
    for (let column = 0; column <= columns; column++) {
      this.gridGraphics.lineBetween(column * tileSize, 0, column * tileSize, rows * tileSize)
    }
    for (let row = 0; row <= rows; row++) {
      this.gridGraphics.lineBetween(0, row * tileSize, columns * tileSize, row * tileSize)
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

    this.workerState = createWorkerState(worker)
    this.reportStatus('')
    this.isMoving = false
    this.workerGraphics = this.add.graphics()
    this.drawWorker(this.workerGraphics)
    const center = this.tileCenter(worker)
    this.workerGraphics.setPosition(center.x, center.y)
    this.selection = { selectedId: null, infoOpen: false }
    this.selectionGraphics = this.add.graphics().setDepth(2)
    this.selectionCameraTarget = null
    this.cameraPanKeys.clear()
    this.updateSelectionView()
    this.cameraState = createCameraState(center, this.cameraArea())
    this.cameras.main.setBounds(0, 0, columns * tileSize, rows * tileSize)
    this.applyCamera()
    this.commands = new WorkerCommands(
      direction => this.moveWorker(direction),
      () => this.chopWorkerWood(),
      direction => this.turnWorkerFacing(direction),
      () => this.workerState,
      direction => getWorkerDestination({ ...kingdomMap, trees: this.resources.trees }, this.workerState, direction) !== null,
      () => getTreeAhead(this.resources, this.workerState) !== undefined,
      () => getSurroundings({ ...kingdomMap, trees: this.resources.trees }, this.workerState),
      () => this.depositWorkerWood(),
      () => getInventory(this.resources),
    )
    this.onCommandsReady?.(this.commands)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.commands?.dispose()
      this.commands = undefined
      this.workerGraphics = undefined
      this.cameraState = undefined
      this.gridGraphics = undefined
      this.selectionGraphics = undefined
      this.selectionCameraTarget = null
      this.cameraPanKeys.clear()
      this.pointerPosition = undefined
      // Zwolnij oczekującą sekwencję również przy zamknięciu sceny.
      this.finishMove?.(false)
    })

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.addCapture('UP,DOWN,LEFT,RIGHT')
      const onKeyDown = (event: KeyboardEvent) => {
        if (!this.exploreMode) return
        if (event.altKey || event.ctrlKey || event.metaKey) return
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

  setExploreView(explore: boolean) {
    this.exploreMode = explore
    if (!explore) {
      this.cameraPanKeys.clear()
      this.selection = { ...this.selection, infoOpen: false }
      this.selectionCameraTarget = null
    }
    this.updateSelectionView()
    this.updateHoveredTile()
  }

  cameraKeyboardAction(action: CameraKeyboardAction) {
    if (action.type === 'release' || action.type === 'clear') {
      updateCameraKeys(this.cameraPanKeys, action)
      return
    }
    if (!this.exploreMode) return
    updateCameraKeys(this.cameraPanKeys, action)
    if (action.type === 'follow') this.followWorkerView()
  }

  selectObject(action: SelectionAction) {
    if (!this.exploreMode) return
    const objects = this.selectableObjects()
    this.selection = applySelectionAction(objects, this.selection, action)
    if (action === 'select-next' || action === 'select-previous') {
      this.selectionCameraTarget = this.selection.selectedId
      if (this.cameraState) this.cameraState = { ...this.cameraState, following: false }
    }
    this.updateSelectionView()
  }

  private selectableObjects() {
    return getSelectableObjects(this.workerState, kingdomMap.castle, this.resources.trees)
  }

  private objectCenter(object: SelectableObject) {
    if (object.id === 'worker' && this.workerGraphics) return { x: this.workerGraphics.x, y: this.workerGraphics.y }
    return {
      x: (object.column + object.columns / 2) * kingdomMap.tileSize,
      y: (object.row + object.rows / 2) * kingdomMap.tileSize,
    }
  }

  private updateSelectionView() {
    const objects = this.selectableObjects()
    this.selection = reconcileSelection(objects, this.selection)
    if (this.selectionCameraTarget && !objects.some(object => object.id === this.selectionCameraTarget)) {
      this.selectionCameraTarget = null
    }
    const object = this.exploreMode ? getSelectedObject(objects, this.selection) : null
    const graphics = this.selectionGraphics
    graphics?.clear()
    if (object && graphics) {
      const center = this.objectCenter(object)
      const width = object.columns * kingdomMap.tileSize
      const height = object.rows * kingdomMap.tileSize
      graphics.fillStyle(0xffdf75, 0.12)
      graphics.fillRect(center.x - width / 2, center.y - height / 2, width, height)
      graphics.lineStyle(2, 0xffdf75, 0.9)
      graphics.strokeRect(center.x - width / 2, center.y - height / 2, width, height)
    }
    const view = { object, infoOpen: this.exploreMode && this.selection.infoOpen }
    const snapshot = JSON.stringify(view)
    if (snapshot !== this.selectionSnapshot) {
      this.selectionSnapshot = snapshot
      this.onSelectionChanged?.(view)
    }
  }

  hoverView(x?: number, y?: number) {
    this.pointerPosition = x !== undefined && y !== undefined ? { x, y } : undefined
    this.updateHoveredTile()
  }

  private updateHoveredTile() {
    const tile = this.exploreMode && this.cameraState && this.pointerPosition
      ? getHoveredTile(this.cameraState, this.pointerPosition, this.cameraArea(), kingdomMap.tileSize) : null
    if (tile?.column === this.lastHoveredTile?.column && tile?.row === this.lastHoveredTile?.row) return
    this.lastHoveredTile = tile
    this.onHoverChanged?.(tile)
  }

  panView(x: number, y: number) {
    if (!this.cameraState) return
    if (x !== 0 || y !== 0) this.selectionCameraTarget = null
    this.cameraState = panCamera(this.cameraState, { x, y }, this.cameraArea())
    this.applyCamera()
  }

  zoomView(delta: number, x: number, y: number) {
    if (!this.cameraState) return
    this.cameraState = zoomCamera(this.cameraState, { x, y }, delta, this.cameraArea())
    this.applyCamera()
  }

  followWorkerView() {
    if (!this.cameraState || !this.workerGraphics) return
    this.cameraPanKeys.clear()
    this.selectionCameraTarget = null
    this.cameraState = followWorker(this.cameraState, this.workerGraphics, this.cameraArea())
    this.applyCamera()
  }

  private applyCamera() {
    if (!this.cameraState) return
    const scroll = getCameraScroll(this.cameraState, this.cameraArea())
    this.cameras.main.setZoom(this.cameraState.zoom).setScroll(scroll.x, scroll.y)
    this.updateHoveredTile()
  }

  private cameraArea() {
    return {
      worldWidth: kingdomMap.columns * kingdomMap.tileSize,
      worldHeight: kingdomMap.rows * kingdomMap.tileSize,
      viewWidth: gameViewport.width,
      viewHeight: gameViewport.height,
    }
  }

  update(_time: number, delta: number) {
    if (!this.workerGraphics || !this.cameraState) return
    if (this.exploreMode) {
      const pan = cameraKeyboardDelta(this.cameraPanKeys, delta)
      if (pan.x !== 0 || pan.y !== 0) this.panView(pan.x, pan.y)
    }
    this.updateSelectionView()
    const selectedTarget = this.exploreMode && this.selectionCameraTarget
      ? this.selectableObjects().find(object => object.id === this.selectionCameraTarget) : null
    if (selectedTarget) {
      this.cameraState = {
        ...updateCamera({ ...this.cameraState, following: true }, this.objectCenter(selectedTarget), this.cameraArea(), delta),
        following: false,
      }
      this.applyCamera()
      return
    }
    // Śledzimy pozycję graficzną w trakcie każdej animacji, także przy fokusie w edytorze.
    this.cameraState = updateCamera(this.cameraState, this.workerGraphics, this.cameraArea(), delta)
    this.applyCamera()
  }

  private async moveWorker(direction: Direction): Promise<boolean> {
    // Przycisk może zostać kliknięty w trakcie kroku rozpoczętego strzałką.
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false

    const destination = getWorkerDestination({ ...kingdomMap, trees: this.resources.trees }, this.workerState, direction)
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
        this.workerState = completeWorkerMove(this.workerState, destination, direction)
        this.reportStatus('')
        this.finishMove?.(true)
      },
    })
    return movement
  }

  private async turnWorkerFacing(direction: Direction): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    this.workerState = turnWorker(this.workerState, direction)
    this.reportStatus('')
    return true
  }

  private async chopWorkerWood(): Promise<boolean> {
    // Także pierwsze ścinanie czeka na ewentualny krok rozpoczęty strzałką.
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const next = chopWood(this.resources, this.workerState)
    if (next === this.resources) {
      this.reportStatus(this.resources.workerWood >= WOOD_CAPACITY
        ? 'Ekwipunek jest pełny. Dostarcz drewno do zamku.'
        : 'Przed robotnikiem nie ma drzewa. Podejdź do drzewa z odpowiedniej strony.')
      return false
    }

    for (const tree of this.resources.trees) {
      if (!next.trees.some(remaining => remaining.column === tree.column && remaining.row === tree.row)) {
        const key = `${tree.column},${tree.row}`
        this.treeGraphics.get(key)?.destroy()
        this.treeGraphics.delete(key)
      }
    }
    this.resources = next
    this.onWoodChanged?.(getWoodStatus(next))
    this.reportStatus('Zebrano 1 drewno.')
    return true
  }

  private async depositWorkerWood(): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const next = depositWood(this.resources, this.workerState, kingdomMap.castle)
    if (next === this.resources) {
      this.reportStatus(this.resources.workerWood === 0
        ? 'Ekwipunek jest pusty.' : 'Stań na polu obok zamku, aby dostarczyć drewno.')
      return false
    }
    this.resources = next
    this.onWoodChanged?.(getWoodStatus(next))
    this.reportStatus('Drewno dostarczono do zamku.')
    return true
  }

  private reportStatus(message: string) {
    this.onStatusChanged?.({ facing: this.workerState.facing, message })
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
