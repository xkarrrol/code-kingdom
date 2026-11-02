import type { PyodideInterface } from 'pyodide'
import type { WorkerCommand } from '../game/commands'
import { isWorkerCommand, MAX_COMMANDS } from './messages.ts'

// Ten moduł jest wykonywany wyłącznie w Workerze. Nie otrzymuje silnika gry.
export async function executePython(pyodide: PyodideInterface, code: string): Promise<WorkerCommand[]> {
  const commands: WorkerCommand[] = []
  let exceeded = false
  const record = (command: unknown) => {
    if (!isWorkerCommand(command)) throw new Error('Nieznana komenda robotnika.')
    if (commands.length >= MAX_COMMANDS) {
      exceeded = true
      throw new Error(`Przekroczono limit ${MAX_COMMANDS} komend.`)
    }
    commands.push(command)
  }
  const globals = pyodide.toPy({ __record_command: record })

  try {
    pyodide.runPython(`
def _make_move(record, command):
    def move():
        record(command)
    return move

move_up = _make_move(__record_command, "move_up")
move_down = _make_move(__record_command, "move_down")
move_left = _make_move(__record_command, "move_left")
move_right = _make_move(__record_command, "move_right")
chop_wood = _make_move(__record_command, "chop_wood")
del _make_move, __record_command
`, { globals })

    const result = await pyodide.runPythonAsync(code, { globals, filename: 'player.py' })
    // Python może zakończyć program wyrażeniem zwracającym obiekt.
    if (result instanceof pyodide.ffi.PyProxy) result.destroy()
    // Przechwycenie wyjątku w kodzie gracza nie znosi limitu.
    if (exceeded) throw new Error(`Przekroczono limit ${MAX_COMMANDS} komend.`)
    return commands
  } finally {
    globals.destroy()
  }
}
