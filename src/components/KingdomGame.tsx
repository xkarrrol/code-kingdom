import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Phaser from 'phaser'
import { KingdomScene } from '../game/KingdomScene'
import { gameViewport } from '../game/camera'
import { bindCameraControls } from '../game/cameraControls'
import { exampleCommands } from '../game/commands'
import type { WorkerCommands, WorkerCommand } from '../game/commands'
import type { WorkerStatus } from '../game/workerState'
import type { ResourceStatus } from '../game/resources'
import { SAWMILL_CAPACITY } from '../game/productionData'
import type { TilePosition } from '../game/map'
import type { ControlState } from '../game/controlModes'
import type { SelectionAction, SelectionView } from '../game/selection'
import ObjectInfoPanel from './ObjectInfoPanel'
import type { CameraKeyboardAction } from '../game/cameraKeyboard'

const facingLabels = { up: 'góra ↑', down: 'dół ↓', left: 'lewo ←', right: 'prawo →' }

interface KingdomGameProps {
  onCommandsReady: (commands: WorkerCommands | null) => void
  onRunCommands: (commands: readonly WorkerCommand[]) => Promise<boolean>
  canRunCommands: boolean
  resources: ResourceStatus
  onResourcesChanged: (resources: ResourceStatus) => void
  mapRef: RefObject<HTMLDivElement | null>
  controls: ControlState
}

export default function KingdomGame({ onCommandsReady, onRunCommands, canRunCommands, resources, onResourcesChanged, mapRef, controls }: KingdomGameProps) {
  const containerRef = mapRef
  const sceneRef = useRef<KingdomScene | null>(null)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ facing: 'down', message: '' })
  const [hoveredTile, setHoveredTile] = useState<TilePosition | null>(null)
  const [selectionView, setSelectionView] = useState<SelectionView>({ object: null, infoOpen: false })
  const controlsRef = useRef(controls)
  controlsRef.current = controls

  useEffect(() => {
    sceneRef.current?.setExploreView(controls.mode === 'EXPLORE')
  }, [controls])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    const onSelectionKey = (event: Event) => sceneRef.current?.selectObject((event as CustomEvent<SelectionAction>).detail)
    container.addEventListener('explore-selection', onSelectionKey)
    const onCameraKey = (event: Event) => sceneRef.current?.cameraKeyboardAction((event as CustomEvent<CameraKeyboardAction>).detail)
    container.addEventListener('explore-camera', onCameraKey)
    const removeCameraControls = bindCameraControls(container, {
      pan: (x, y) => sceneRef.current?.panView(x, y),
      zoom: (delta, x, y) => sceneRef.current?.zoomView(delta, x, y),
      follow: () => sceneRef.current?.followWorkerView(),
      hover: (x, y) => sceneRef.current?.hoverView(x, y),
      leave: () => sceneRef.current?.hoverView(),
    })
    // StrictMode sprawdza efekt dwa razy. Timer pozwala anulować pierwszy start.
    const startTimer = window.setTimeout(() => {
      const scene = new KingdomScene(onCommandsReady, onResourcesChanged, setWorkerStatus, setHoveredTile, setSelectionView)
      scene.setExploreView(controlsRef.current.mode === 'EXPLORE')
      sceneRef.current = scene
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: gameViewport.width,
        height: gameViewport.height,
        backgroundColor: '#79ad57',
        scene,
        audio: { noAudio: true },
        input: { keyboard: { target: container } },
      })
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
      removeCameraControls()
      container.removeEventListener('explore-selection', onSelectionKey)
      container.removeEventListener('explore-camera', onCameraKey)
      sceneRef.current?.commands?.dispose()
      sceneRef.current = null
      onCommandsReady(null)
      game?.destroy(true)
    }
  }, [onCommandsReady, onResourcesChanged, containerRef])

  return (
    <>
      <p aria-live="polite">Ekwipunek: drewno {resources.inventory.wood}, kamień {resources.inventory.stone}, deski {resources.inventory.planks} · Zajęte {resources.inventory.wood + resources.inventory.stone + resources.inventory.planks}/{resources.inventory.capacity}</p>
      <p aria-live="polite">Zasoby królestwa: drewno {resources.kingdom.wood}, kamień {resources.kingdom.stone}, deski {resources.kingdom.planks}</p>
      {resources.sawmill && <p aria-live="polite">Magazyn tartaku: drewno {resources.sawmill.wood}/{SAWMILL_CAPACITY.wood}, deski {resources.sawmill.planks}/{SAWMILL_CAPACITY.planks}</p>}
      <p>Kierunek patrzenia: {facingLabels[workerStatus.facing]}</p>
      <p role="status">{workerStatus.message}</p>
      {controls.mode === 'EXPLORE' && <p>Pole (kolumna, wiersz): {hoveredTile ? `${hoveredTile.column}, ${hoveredTile.row}` : '—'}</p>}
      {controls.mode === 'EXPLORE' && selectionView.object && <p>Zaznaczono: {selectionView.object.name}</p>}
      {controls.mode === 'EXPLORE' && selectionView.infoOpen && selectionView.object && <ObjectInfoPanel object={selectionView.object} />}
      <button type="button" onClick={() => void onRunCommands(exampleCommands)} disabled={!canRunCommands}>
        Test commands
      </button>
      <p id="map-controls">EXPLORE: H/J/K/L — kamera lewo/dół/góra/prawo; F — powrót do robotnika; I — edytor. Tab / Shift+Tab — wybór obiektu; Enter — informacje; Esc — zamknij panel. Strzałki: ruch robotnika. Prawy przycisk: kamera. Scroll: zoom. Podwójne kliknięcie: śledzenie robotnika.</p>
      <div className="map-scroll">
        <div
          ref={containerRef}
          className="kingdom-game"
          style={{ width: gameViewport.width, height: gameViewport.height }}
          role="group"
          tabIndex={0}
          aria-describedby="map-controls"
          aria-label="Świat królestwa: 30 na 20 pól trawy, lasu, wody, skał i ścieżek; zamek, drzewa, złoża kamienia i robotnik."
        />
      </div>
    </>
  )
}
