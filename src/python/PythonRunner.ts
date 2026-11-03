import type { WorkerCommand } from '../game/commands'
import type { BridgeResponse, PythonRequest, WorkerPosition, WorldValue } from './messages'
import type { Direction } from '../game/movement'
import type { Surroundings } from '../game/surroundings'
import { COMPUTE_TIMEOUT_MS, isDirection, isSurroundings, isWorkerCommand, isWorkerPosition, MAX_COMMANDS, MAX_QUERIES, RESPONSE_TIMEOUT_MS } from './messages.ts'

let nextRunId = 0

export interface PythonWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: PythonRequest): void
  terminate(): void
}

export interface GameBridge {
  getWorkerPosition: () => WorkerPosition | Promise<WorkerPosition>
  canMove: (direction: Direction) => boolean | Promise<boolean>
  treeAhead: () => boolean | Promise<boolean>
  getSurroundings: () => Surroundings | Promise<Surroundings>
  executeCommand: (command: WorkerCommand) => Promise<boolean>
}

export class PythonRunner {
  private cancel?: () => void
  // Anulowanie nie cofa już rozpoczętej animacji. Nowy program musi na nią poczekać.
  private activeAction?: Promise<boolean>
  private readonly createWorker: () => PythonWorker

  constructor(createWorker: () => PythonWorker = () =>
    new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })) {
    this.createWorker = createWorker
  }

  run(code: string, game: GameBridge): Promise<void> {
    if (this.cancel || this.activeAction) return Promise.reject(new Error('Program Python lub jego ostatnia animacja już działa.'))
    return new Promise((resolve, reject) => {
      const worker = this.createWorker()
      const runId = `python-${++nextRunId}`
      let nextRequestId = 1
      let queries = 0
      let commands = 0
      let computing = false
      let pending = false
      let remaining = COMPUTE_TIMEOUT_MS
      let startedAt = 0
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      const timeout = () => finish(new Error('Przekroczono limit 2 sekund obliczeń.'))
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        this.cancel = undefined
        if (error) reject(error)
        else resolve()
      }
      const resumeComputation = () => {
        clearTimeout(timer)
        startedAt = performance.now()
        timer = setTimeout(timeout, remaining)
      }
      const computeExpired = () => performance.now() - startedAt >= remaining
      const send = (message: PythonRequest) => {
        try { worker.postMessage(message) }
        catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
      }
      this.cancel = () => finish(new Error('Uruchomienie anulowano.'))
      timer = setTimeout(() => finish(new Error('Nie udało się załadować Pyodide w ciągu 60 sekund.')), 60_000)
      worker.onerror = event => finish(new Error(`Błąd Workera: ${event.message}`))
      worker.onmessage = async event => {
        if (settled) return
        const data = event.data
        if (!data || typeof data !== 'object' || !('type' in data) || !('runId' in data)) {
          finish(new Error('Nieprawidłowa odpowiedź Workera.'))
          return
        }
        if (data.runId !== runId) return
        if (data.type === 'ready' && !computing) {
          computing = true
          resumeComputation()
          send({ type: 'run', runId, code })
          return
        }
        if (data.type === 'error' && 'message' in data && typeof data.message === 'string') {
          finish(new Error(data.message))
          return
        }
        // Zwykłe funkcje Pythona czekają na odpowiedź: nie ma żądań równoległych.
        if (!computing || pending) { finish(new Error('Nieprawidłowa kolejność wiadomości Workera.')); return }
        if (computeExpired()) { timeout(); return }
        if (data.type === 'query' || data.type === 'command') {
          if (!('requestId' in data) || data.requestId !== nextRequestId) {
            finish(new Error('Nieprawidłowy requestId.'))
            return
          }
          const requestId = nextRequestId++
          const isCommand = data.type === 'command'
          if (isCommand ? ++commands > MAX_COMMANDS : ++queries > MAX_QUERIES) {
            finish(new Error(isCommand ? 'Przekroczono limit 100 komend.' : 'Przekroczono limit 100 zapytań.'))
            return
          }
          pending = true
          // Tylko oczekiwanie na komendę silnika jest wyłączone z budżetu obliczeń.
          if (isCommand) {
            remaining -= performance.now() - startedAt
            clearTimeout(timer)
            timer = setTimeout(() => finish(new Error('Silnik gry nie odpowiedział na komendę w ciągu 10 sekund.')), RESPONSE_TIMEOUT_MS)
          }
          let response: BridgeResponse
          try {
            let value: WorldValue
            if (isCommand) {
              if (!('command' in data) || !isWorkerCommand(data.command)) throw new Error('Nieznana komenda robotnika.')
              const command = data.command
              const action = Promise.resolve().then(() => settled ? false : game.executeCommand(command))
              this.activeAction = action
              try { value = await action }
              finally { if (this.activeAction === action) this.activeAction = undefined }
              if (typeof value !== 'boolean') throw new Error('Nieprawidłowy wynik komendy.')
            } else {
              if (!('operation' in data)) throw new Error('Nieobsługiwane zapytanie.')
              if (data.operation === 'get_worker_position') {
                const position = await game.getWorkerPosition()
                if (!isWorkerPosition(position)) throw new Error('Nieprawidłowa pozycja robotnika.')
                value = { x: position.x, y: position.y }
              } else if (data.operation === 'can_move') {
                if (!('direction' in data) || !isDirection(data.direction)) throw new Error('Nieprawidłowy kierunek zapytania.')
                value = await game.canMove(data.direction)
                if (typeof value !== 'boolean') throw new Error('Nieprawidłowy wynik sprawdzania ruchu.')
              } else if (data.operation === 'tree_ahead') {
                value = await game.treeAhead()
                if (typeof value !== 'boolean') throw new Error('Nieprawidłowy wynik sprawdzania drzewa.')
              } else if (data.operation === 'get_surroundings') {
                const nearby = await game.getSurroundings()
                if (!isSurroundings(nearby)) throw new Error('Nieprawidłowy opis otoczenia.')
                value = { up: nearby.up, down: nearby.down, left: nearby.left, right: nearby.right }
              } else throw new Error('Nieobsługiwane zapytanie.')
            }
            response = { type: 'response', runId, requestId, ok: true, value }
          } catch (error) {
            response = { type: 'response', runId, requestId, ok: false, error: error instanceof Error ? error.message : String(error) }
          }
          if (settled) return
          if (isCommand) resumeComputation()
          else if (computeExpired()) { timeout(); return }
          pending = false
          send(response)
        } else if (data.type === 'result') {
          finish()
        } else {
          finish(new Error('Nieprawidłowa odpowiedź Workera.'))
        }
      }
      send({ type: 'init', runId })
    })
  }

  dispose() {
    this.cancel?.()
  }
}
