import Phaser from 'phaser'
import { kingdomMap } from './map'
import type { TilePosition } from './map'
import { getWorkerDestination } from './movement'
import { getSurroundings } from './surroundings'
import type { Direction } from './movement'
import { WorkerCommands } from './commands'
import type { WorkerCommand } from './commands'
import { createResources, depositResource, gatherResource, getInventory, getResourceAhead, getResourceStatus, inventorySize, naturalResourceDefinitions, INVENTORY_CAPACITY } from './resources'
import type { HarvestableResourceKind, ResourceKind, ResourceStatus } from './resources'
import { completeWorkerMove, createWorkerState, turnWorker } from './workerState'
import type { WorkerStatus } from './workerState'
import { createCameraState, followWorker, gameViewport, getCameraScroll, getHoveredTile, panCamera, updateCamera, zoomCamera } from './camera'
import type { CameraState } from './camera'
import { applySelectionAction, getSelectableObjects, getSelectedObject, reconcileSelection } from './selection'
import type { SelectionAction, SelectionState, SelectionView, SelectableObject } from './selection'
import { cameraKeyboardDelta, updateCameraKeys } from './cameraKeyboard'
import type { CameraKeyboardAction, CameraPanKey } from './cameraKeyboard'
import { renderTerrain } from './renderTerrain'
import { buildingDefinitions, sawmillSite, getBuildingArea } from './buildingData'
import type { PlacedBuilding } from './buildingData'
import { buildSawmill } from './construction'
import { drawBuilding, drawBuildingSite } from './renderBuildings'
import { collectPlanks, depositToSawmill, getSawmillInventory, processWood } from './production'
import type { ProductionState, ProductionResult } from './production'

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
  private readonly onResourcesChanged?: (resources: ResourceStatus) => void
  private readonly onStatusChanged?: (status: WorkerStatus) => void
  private resources = createResources(kingdomMap.trees, kingdomMap.stones)
  private resourceGraphics = new Map<string, Phaser.GameObjects.Graphics>()
  private buildings: readonly PlacedBuilding[] = []
  private siteGraphics?: Phaser.GameObjects.Graphics
  private siteLabel?: Phaser.GameObjects.Text
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
    onResourcesChanged?: (resources: ResourceStatus) => void,
    onStatusChanged?: (status: WorkerStatus) => void,
    onHoverChanged?: (tile: TilePosition | null) => void,
    onSelectionChanged?: (view: SelectionView) => void,
  ) {
    super('KingdomScene')
    this.onCommandsReady = onCommandsReady
    this.onResourcesChanged = onResourcesChanged
    this.onStatusChanged = onStatusChanged
    this.onHoverChanged = onHoverChanged
    this.onSelectionChanged = onSelectionChanged
  }

  create() {
    const graphics = this.add.graphics()
    const { columns, rows, tileSize, castle, worker } = kingdomMap
    this.resources = createResources(kingdomMap.trees, kingdomMap.stones)
    this.resourceGraphics.clear()
    this.buildings = []
    this.siteGraphics = this.add.graphics().setDepth(1)
    drawBuildingSite(this.siteGraphics, sawmillSite, tileSize)
    const siteArea = getBuildingArea(sawmillSite)
    const siteDefinition = buildingDefinitions[sawmillSite.kind]
    this.siteLabel = this.add.text(
      (siteArea.column + siteArea.columns / 2) * tileSize,
      (siteArea.row + siteArea.rows / 2) * tileSize,
      `Miejsce: ${siteDefinition.name}\n${siteDefinition.cost.wood} drewna · ${siteDefinition.cost.stone} kamienie`,
      { fontSize: '12px', color: '#fff4c4', backgroundColor: '#3b3429', align: 'center', padding: { x: 4, y: 3 } },
    ).setOrigin(0.5).setDepth(1)
    this.reportResources()

    renderTerrain(graphics, kingdomMap.terrain, tileSize)
    this.gridGraphics = this.add.graphics().setDepth(1)
    this.gridGraphics.lineStyle(1, 0xffffff, 0.18)
    for (let column = 0; column <= columns; column++) {
      this.gridGraphics.lineBetween(column * tileSize, 0, column * tileSize, rows * tileSize)
    }
    for (let row = 0; row <= rows; row++) {
      this.gridGraphics.lineBetween(0, row * tileSize, columns * tileSize, row * tileSize)
    }

    for (const kind of Object.keys(naturalResourceDefinitions) as HarvestableResourceKind[]) {
      for (const node of this.resources[naturalResourceDefinitions[kind].nodes]) {
        const graphic = this.add.graphics()
        if (kind === 'wood') this.drawTree(graphic, node)
        else this.drawStone(graphic, node)
        this.resourceGraphics.set(`${kind}:${node.column},${node.row}`, graphic)
      }
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
      () => this.gatherWorkerResource('wood'),
      direction => this.turnWorkerFacing(direction),
      () => this.workerState,
      direction => getWorkerDestination(this.worldMap(), this.workerState, direction) !== null,
      () => getResourceAhead(this.resources, this.workerState, 'wood') !== undefined,
      () => getSurroundings(this.worldMap(), this.workerState),
      () => this.depositWorkerResource('wood'),
      () => getInventory(this.resources),
      {
        mine: () => this.gatherWorkerResource('stone'),
        deposit: () => this.depositWorkerResource('stone'),
        ahead: () => getResourceAhead(this.resources, this.workerState, 'stone') !== undefined,
      },
      () => this.buildWorkerSawmill(),
      {
        deposit: () => this.runProduction(depositToSawmill),
        process: () => this.runProduction(processWood),
        collect: () => this.runProduction(collectPlanks),
        depositPlanks: () => this.depositWorkerResource('planks'),
        inventory: () => {
          try { return getSawmillInventory(this.buildings) }
          catch (error) {
            this.reportStatus(error instanceof Error ? error.message : String(error))
            throw error
          }
        },
      },
    )
    this.onCommandsReady?.(this.commands)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.commands?.dispose()
      this.commands = undefined
      this.workerGraphics = undefined
      this.cameraState = undefined
      this.gridGraphics = undefined
      this.selectionGraphics = undefined
      this.siteGraphics = undefined
      this.siteLabel = undefined
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
    return getSelectableObjects(this.workerState, kingdomMap.castle, this.resources.trees, this.resources.stones, this.buildings)
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

    const destination = getWorkerDestination(this.worldMap(), this.workerState, direction)
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

  private worldMap() {
    return { ...kingdomMap, trees: this.resources.trees, stones: this.resources.stones, buildings: this.buildings }
  }

  private reportResources() {
    const inventory = this.buildings.some(building => building.kind === 'sawmill')
      ? getSawmillInventory(this.buildings) : null
    this.onResourcesChanged?.(getResourceStatus(this.resources, inventory))
  }

  private async runProduction(operation: (state: ProductionState, worker: TilePosition) => ProductionResult): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const result = operation({ resources: this.resources, buildings: this.buildings }, this.workerState)
    this.reportStatus(result.message)
    if (!result.ok) return false
    this.resources = result.state.resources
    this.buildings = result.state.buildings
    this.reportResources()
    return true
  }

  private async buildWorkerSawmill(): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const result = buildSawmill({ resources: this.resources, buildings: this.buildings }, this.worldMap(), this.workerState)
    this.reportStatus(result.message)
    if (!result.ok) return false
    this.resources = result.state.resources
    this.buildings = result.state.buildings
    this.siteGraphics?.destroy()
    this.siteLabel?.destroy()
    this.siteGraphics = undefined
    this.siteLabel = undefined
    const building = this.buildings.find(item => item.id === sawmillSite.id)!
    drawBuilding(this.add.graphics(), building, kingdomMap.tileSize)
    this.reportResources()
    this.updateSelectionView()
    return true
  }

  private async gatherWorkerResource(kind: HarvestableResourceKind): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const next = gatherResource(this.resources, this.workerState, kind)
    if (next === this.resources) {
      this.reportStatus(inventorySize(this.resources) >= INVENTORY_CAPACITY
        ? 'Ekwipunek jest pełny. Dostarcz surowce do zamku.'
        : kind === 'wood' ? 'Przed robotnikiem nie ma drzewa.' : 'Przed robotnikiem nie ma złoża kamienia.')
      return false
    }
    const key = naturalResourceDefinitions[kind].nodes
    for (const node of this.resources[key]) {
      if (!next[key].some(remaining => remaining.column === node.column && remaining.row === node.row)) {
        const id = `${kind}:${node.column},${node.row}`
        this.resourceGraphics.get(id)?.destroy()
        this.resourceGraphics.delete(id)
      }
    }
    this.resources = next
    this.reportResources()
    this.reportStatus(kind === 'wood' ? 'Zebrano 1 drewno.' : 'Wydobyto 1 kamień.')
    return true
  }

  private async depositWorkerResource(kind: ResourceKind): Promise<boolean> {
    if (this.pendingMove) await this.pendingMove
    if (!this.workerGraphics) return false
    const next = depositResource(this.resources, this.workerState, kingdomMap.castle, kind)
    if (next === this.resources) {
      this.reportStatus(this.resources.worker[kind] === 0
        ? 'Brak tego surowca w ekwipunku.' : 'Stań na polu obok zamku, aby dostarczyć surowce.')
      return false
    }
    this.resources = next
    this.reportResources()
    this.reportStatus(kind === 'wood' ? 'Drewno dostarczono do zamku.' : kind === 'stone' ? 'Kamień dostarczono do zamku.' : 'Deski dostarczono do zamku.')
    return true
  }

  private drawStone(graphics: Phaser.GameObjects.Graphics, position: TilePosition) {
    const { x, y } = this.tileCenter(position)
    graphics.fillStyle(0x526575)
    graphics.fillTriangle(x - 25, y + 20, x - 16, y - 15, x + 19, y + 20)
    graphics.fillStyle(0x94a8b8)
    graphics.fillTriangle(x - 11, y + 21, x + 8, y - 23, x + 27, y + 21)
    graphics.fillStyle(0xc7d4df)
    graphics.fillTriangle(x - 3, y - 2, x + 8, y - 23, x + 15, y - 3)
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
