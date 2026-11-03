import { useCallback, useEffect, useRef, useState } from 'react'
import KingdomGame from './components/KingdomGame'
import CodeEditor from './components/CodeEditor'
import PythonReference from './components/PythonReference'
import type { WorkerCommands, WorkerCommand } from './game/commands'
import { PythonRunner } from './python/PythonRunner'
import MissionPanel from './components/MissionPanel'
import { createMission, updateMission } from './game/mission'
import { bindControlModes } from './game/controlModes'
import type { ControlState } from './game/controlModes'
import { WOOD_CAPACITY } from './game/resources'
import type { WoodStatus } from './game/resources'

export default function App() {
  const appRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [controls, setControls] = useState<ControlState>({ mode: 'CODE' })
  useEffect(() => {
    if (!appRef.current || !editorRef.current || !mapRef.current) return
    return bindControlModes(appRef.current, editorRef.current, mapRef.current, setControls)
  }, [])
  const [python] = useState(() => new PythonRunner())
  const runLock = useRef(false)
  useEffect(() => () => python.dispose(), [python])
  const [commands, setCommands] = useState<WorkerCommands | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [wood, setWood] = useState<WoodStatus>({ inventory: { wood: 0, capacity: WOOD_CAPACITY }, kingdomWood: 0 })
  const [mission, setMission] = useState(createMission)

  // Stabilna funkcja nie powoduje ponownego tworzenia sceny przy aktualizacji misji.
  const handleWoodChanged = useCallback((status: WoodStatus) => {
    setWood(status)
    setMission(current => updateMission(current, status.kingdomWood))
  }, [])

  async function runProgram(input: string | readonly WorkerCommand[]): Promise<boolean> {
    if (runLock.current || !commands || commands.isRunning) return false
    runLock.current = true
    commands.manualInputEnabled = false
    setIsRunning(true)
    try {
      if (typeof input !== 'string') return await commands.runCommands(input)
      await python.run(input, {
        getWorkerPosition: () => {
          const position = commands.getWorkerPosition()
          return { x: position.column, y: position.row }
        },
        executeCommand: command => commands.runCommands([command]),
        canMove: direction => commands.canMove(direction),
        treeAhead: () => commands.treeAhead(),
        getSurroundings: () => commands.getSurroundings(),
        getInventory: () => commands.getInventory(),
      })
      return true
    } finally {
      commands.manualInputEnabled = true
      runLock.current = false
      setIsRunning(false)
    }
  }

  return (
    <main ref={appRef}>
      <h1>Code Kingdom</h1>
      <p>Build your kingdom. Learn Python. Conquer the world.</p>
      <p className="mode-indicator" role="status">Tryb: <strong>{controls.mode}</strong> · Esc: mapa · I: edytor</p>
      <div className="game-layout">
        <section className="game-panel" aria-label="Mapa królestwa">
          <KingdomGame
            onCommandsReady={setCommands}
            onRunCommands={runProgram}
            canRunCommands={commands !== null && !isRunning}
            wood={wood}
            onWoodChanged={handleWoodChanged}
            mapRef={mapRef}
            controls={controls}
          />
        </section>
        <div className="editor-column">
          <MissionPanel mission={mission} />
          <div className="editor-tools">
            <CodeEditor editorRef={editorRef} onRunCode={runProgram} disabled={commands === null || isRunning} />
            <PythonReference />
          </div>
        </div>
      </div>
    </main>
  )
}
