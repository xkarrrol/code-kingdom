import { useEffect, useRef, useState } from 'react'
import KingdomGame from './components/KingdomGame'
import CodeEditor from './components/CodeEditor'
import type { WorkerCommands, WorkerCommand } from './game/commands'
import { PythonRunner } from './python/PythonRunner'

export default function App() {
  const [python] = useState(() => new PythonRunner())
  const runLock = useRef(false)
  useEffect(() => () => python.dispose(), [python])
  const [commands, setCommands] = useState<WorkerCommands | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  async function runProgram(input: string | readonly WorkerCommand[]): Promise<boolean> {
    if (runLock.current || !commands || commands.isRunning) return false
    runLock.current = true
    commands.manualInputEnabled = false
    setIsRunning(true)
    try {
      const sequence = typeof input === 'string' ? await python.run(input) : input
      return await commands.runCommands(sequence)
    } finally {
      commands.manualInputEnabled = true
      runLock.current = false
      setIsRunning(false)
    }
  }

  return (
    <main>
      <h1>Code Kingdom</h1>
      <p>Build your kingdom. Learn Python. Conquer the world.</p>
      <div className="game-layout">
        <section className="game-panel" aria-label="Mapa królestwa">
          <KingdomGame
            onCommandsReady={setCommands}
            onRunCommands={runProgram}
            canRunCommands={commands !== null && !isRunning}
          />
        </section>
        <CodeEditor onRunCode={runProgram} disabled={commands === null || isRunning} />
      </div>
    </main>
  )
}
