import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { KingdomScene } from '../game/KingdomScene'
import { kingdomMap } from '../game/map'
import { exampleCommands } from '../game/commands'
import type { WorkerCommands, WorkerCommand } from '../game/commands'

interface KingdomGameProps {
  onCommandsReady: (commands: WorkerCommands | null) => void
  onRunCommands: (commands: readonly WorkerCommand[]) => Promise<boolean>
  canRunCommands: boolean
}

export default function KingdomGame({ onCommandsReady, onRunCommands, canRunCommands }: KingdomGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<KingdomScene | null>(null)
  const [wood, setWood] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    // StrictMode sprawdza efekt dwa razy. Timer pozwala anulować pierwszy start.
    const startTimer = window.setTimeout(() => {
      const scene = new KingdomScene(onCommandsReady, setWood)
      sceneRef.current = scene
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: kingdomMap.columns * kingdomMap.tileSize,
        height: kingdomMap.rows * kingdomMap.tileSize,
        backgroundColor: '#79ad57',
        scene,
        audio: { noAudio: true },
        input: { keyboard: { target: container } },
      })
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
      sceneRef.current?.commands?.dispose()
      sceneRef.current = null
      onCommandsReady(null)
      game?.destroy(true)
    }
  }, [onCommandsReady])

  return (
    <>
      <p aria-live="polite">Drewno: {wood}</p>
      <button type="button" onClick={() => void onRunCommands(exampleCommands)} disabled={!canRunCommands}>
        Test commands
      </button>
      <p id="map-controls">Kliknij mapę lub wybierz ją klawiszem Tab. Strzałki: jeden krok na naciśnięcie.</p>
      <div className="map-scroll">
        <div
          ref={containerRef}
          className="kingdom-game"
          role="group"
          tabIndex={0}
          onPointerDown={() => containerRef.current?.focus()}
          aria-describedby="map-controls"
          aria-label="Mapa królestwa: 8 na 8 zielonych pól, zamek na środku, drzewa i jeden robotnik."
        />
      </div>
    </>
  )
}
