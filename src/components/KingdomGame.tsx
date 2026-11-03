import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Phaser from 'phaser'
import { KingdomScene } from '../game/KingdomScene'
import { gameViewport } from '../game/camera'
import { bindCameraControls } from '../game/cameraControls'
import { exampleCommands } from '../game/commands'
import type { WorkerCommands, WorkerCommand } from '../game/commands'
import type { WorkerStatus } from '../game/workerState'
import type { TilePosition } from '../game/map'
import type { ControlState } from '../game/controlModes'

const facingLabels = { up: 'góra ↑', down: 'dół ↓', left: 'lewo ←', right: 'prawo →' }

interface KingdomGameProps {
  onCommandsReady: (commands: WorkerCommands | null) => void
  onRunCommands: (commands: readonly WorkerCommand[]) => Promise<boolean>
  canRunCommands: boolean
  wood: number
  onWoodChanged: (wood: number) => void
  mapRef: RefObject<HTMLDivElement | null>
  controls: ControlState
}

export default function KingdomGame({ onCommandsReady, onRunCommands, canRunCommands, wood, onWoodChanged, mapRef, controls }: KingdomGameProps) {
  const containerRef = mapRef
  const sceneRef = useRef<KingdomScene | null>(null)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ facing: 'down', message: '' })
  const [hoveredTile, setHoveredTile] = useState<TilePosition | null>(null)
  const controlsRef = useRef(controls)
  controlsRef.current = controls

  useEffect(() => {
    sceneRef.current?.setExploreView(controls.mode === 'EXPLORE', controls.gridVisible)
  }, [controls])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    const removeCameraControls = bindCameraControls(container, {
      pan: (x, y) => sceneRef.current?.panView(x, y),
      zoom: (delta, x, y) => sceneRef.current?.zoomView(delta, x, y),
      follow: () => sceneRef.current?.followWorkerView(),
      hover: (x, y) => sceneRef.current?.hoverView(x, y),
      leave: () => sceneRef.current?.hoverView(),
    })
    // StrictMode sprawdza efekt dwa razy. Timer pozwala anulować pierwszy start.
    const startTimer = window.setTimeout(() => {
      const scene = new KingdomScene(onCommandsReady, onWoodChanged, setWorkerStatus, setHoveredTile)
      scene.setExploreView(controlsRef.current.mode === 'EXPLORE', controlsRef.current.gridVisible)
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
      sceneRef.current?.commands?.dispose()
      sceneRef.current = null
      onCommandsReady(null)
      game?.destroy(true)
    }
  }, [onCommandsReady, onWoodChanged, containerRef])

  return (
    <>
      <p aria-live="polite">Drewno: {wood}</p>
      <p>Kierunek patrzenia: {facingLabels[workerStatus.facing]}</p>
      <p role="status">{workerStatus.message}</p>
      {controls.mode === 'EXPLORE' && <p>Pole (kolumna, wiersz): {hoveredTile ? `${hoveredTile.column}, ${hoveredTile.row}` : '—'} · G: siatka {controls.gridVisible ? 'włączona' : 'wyłączona'}</p>}
      <button type="button" onClick={() => void onRunCommands(exampleCommands)} disabled={!canRunCommands}>
        Test commands
      </button>
      <p id="map-controls">Strzałki: ruch robotnika po wybraniu mapy. Przeciąganie prawym przyciskiem: kamera. Scroll: zoom. Podwójne kliknięcie: powrót do robotnika i śledzenie.</p>
      <div className="map-scroll">
        <div
          ref={containerRef}
          className="kingdom-game"
          style={{ width: gameViewport.width, height: gameViewport.height }}
          role="group"
          tabIndex={0}
          aria-describedby="map-controls"
          aria-label="Widok świata królestwa: 30 na 20 pól trawy, zamek, drzewa i jeden robotnik."
        />
      </div>
    </>
  )
}
