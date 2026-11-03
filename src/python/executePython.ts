import type { PyodideInterface } from 'pyodide'
import type { WorkerBridge } from './WorkerBridge'
import { supportsJSPI } from './WorkerBridge.ts'

// Ten moduł jest wykonywany wyłącznie w Workerze. Nie otrzymuje silnika gry.
export async function executePython(
  pyodide: PyodideInterface, code: string, bridge: WorkerBridge,
  jspi = supportsJSPI(WebAssembly),
): Promise<void> {
  const requireJSPI = () => {
    if (!jspi) throw new Error('Komunikacja z grą wymaga JSPI. Ta przeglądarka nie udostępnia wymaganej obsługi.')
  }
  const globals = pyodide.toPy({
    __execute_command: (command: Parameters<WorkerBridge['executeCommand']>[0]) => {
      requireJSPI()
      return bridge.executeCommand(command)
    },
    __get_worker_position: () => {
      requireJSPI()
      return bridge.getWorkerPosition()
    },
    __can_move: (direction: Parameters<WorkerBridge['canMove']>[0]) => {
      requireJSPI()
      return bridge.canMove(direction)
    },
    __tree_ahead: () => {
      requireJSPI()
      return bridge.treeAhead()
    },
    __get_surroundings: () => {
      requireJSPI()
      return bridge.getSurroundings()
    },
    __get_inventory: () => {
      requireJSPI()
      return bridge.getInventory()
    },
  })

  try {
    pyodide.runPython(`
def _make_command(execute, command):
    from pyodide.ffi import run_sync
    def action():
        run_sync(execute(command))
    return action

move_up = _make_command(__execute_command, "move_up")
move_down = _make_command(__execute_command, "move_down")
move_left = _make_command(__execute_command, "move_left")
move_right = _make_command(__execute_command, "move_right")
chop_wood = _make_command(__execute_command, "chop_wood")
deposit_wood = _make_command(__execute_command, "deposit_wood")
turn_up = _make_command(__execute_command, "turn_up")
turn_down = _make_command(__execute_command, "turn_down")
turn_left = _make_command(__execute_command, "turn_left")
turn_right = _make_command(__execute_command, "turn_right")
del _make_command, __execute_command

def _make_position_query(query):
    from pyodide.ffi import run_sync
    def get_worker_position():
        position = run_sync(query())
        return {"x": int(position.x), "y": int(position.y)}
    return get_worker_position

get_worker_position = _make_position_query(__get_worker_position)
del _make_position_query, __get_worker_position

def _make_can_move(query, direction):
    from pyodide.ffi import run_sync
    def can_move():
        return bool(run_sync(query(direction)))
    return can_move

can_move_up = _make_can_move(__can_move, "up")
can_move_down = _make_can_move(__can_move, "down")
can_move_left = _make_can_move(__can_move, "left")
can_move_right = _make_can_move(__can_move, "right")
del _make_can_move, __can_move

def _make_tree_ahead(query):
    from pyodide.ffi import run_sync
    def tree_ahead():
        return bool(run_sync(query()))
    return tree_ahead

tree_ahead = _make_tree_ahead(__tree_ahead)
del _make_tree_ahead, __tree_ahead

def _make_surroundings_query(query):
    from pyodide.ffi import run_sync
    def get_surroundings():
        nearby = run_sync(query())
        return {"up": str(nearby.up), "down": str(nearby.down),
                "left": str(nearby.left), "right": str(nearby.right)}
    return get_surroundings

get_surroundings = _make_surroundings_query(__get_surroundings)
del _make_surroundings_query, __get_surroundings

def _make_inventory_query(query):
    from pyodide.ffi import run_sync
    def get_inventory():
        inventory = run_sync(query())
        return {"wood": int(inventory.wood), "capacity": int(inventory.capacity)}
    return get_inventory

get_inventory = _make_inventory_query(__get_inventory)
del _make_inventory_query, __get_inventory
`, { globals })

    const result = await pyodide.runPythonAsync(code, { globals, filename: 'player.py' })
    if (result instanceof pyodide.ffi.PyProxy) result.destroy()
    bridge.checkLimits()
  } finally {
    globals.destroy()
  }
}
