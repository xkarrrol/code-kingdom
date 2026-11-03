import type { WorkerCommand } from '../game/commands'
import type { Direction } from '../game/movement'
import type { PythonMessage, BridgeResponse, WorkerPosition, WorldQuery, WorldValue } from './messages'
import type { Surroundings } from '../game/surroundings'
import { isSurroundings, isWorkerPosition, MAX_COMMANDS, MAX_QUERIES } from './messages.ts'

export function supportsJSPI(api: unknown): boolean {
  return !!api && typeof api === 'object'
    && 'Suspending' in api && typeof api.Suspending === 'function'
    && 'promising' in api && typeof api.promising === 'function'
}

export class WorkerBridge {
  private nextId = 0
  private queries = 0
  private commands = 0
  private closed = false
  private limitError?: Error
  private pending = new Map<number, {
    resultType: 'position' | 'surroundings' | 'boolean'
    resolve: (value: WorldValue) => void
    reject: (error: Error) => void
  }>()
  private readonly runId: string
  private readonly send: (message: PythonMessage) => void

  constructor(runId: string, send: (message: PythonMessage) => void) {
    this.runId = runId
    this.send = send
  }

  async getWorkerPosition(): Promise<WorkerPosition> {
    return await this.query({ operation: 'get_worker_position' }) as WorkerPosition
  }

  async canMove(direction: Direction): Promise<boolean> {
    return await this.query({ operation: 'can_move', direction }) as boolean
  }

  async treeAhead(): Promise<boolean> {
    return await this.query({ operation: 'tree_ahead' }) as boolean
  }

  async getSurroundings(): Promise<Surroundings> {
    return await this.query({ operation: 'get_surroundings' }) as Surroundings
  }

  private query(query: WorldQuery): Promise<WorldValue> {
    if (++this.queries > MAX_QUERIES) this.limitError = new Error('Przekroczono limit 100 zapytań.')
    return this.request('query', undefined, query)
  }

  async executeCommand(command: WorkerCommand): Promise<boolean> {
    if (++this.commands > MAX_COMMANDS) this.limitError = new Error('Przekroczono limit 100 komend.')
    return await this.request('command', command) as boolean
  }

  // Przechwycenie wyjątku w Pythonie nie usuwa przekroczenia limitu.
  checkLimits() {
    if (this.limitError) throw this.limitError
  }

  private request(kind: 'query' | 'command', command?: WorkerCommand, query?: WorldQuery): Promise<WorldValue> {
    if (this.closed) return Promise.reject(new Error('Most komunikacyjny został zamknięty.'))
    if (this.limitError) return Promise.reject(this.limitError)
    const requestId = ++this.nextId
    return new Promise((resolve, reject) => {
      const resultType = query?.operation === 'get_worker_position' ? 'position'
        : query?.operation === 'get_surroundings' ? 'surroundings' : 'boolean'
      this.pending.set(requestId, { resultType, resolve, reject })
      try {
        this.send(kind === 'query'
          ? { type: 'query', runId: this.runId, requestId, ...query! }
          : { type: 'command', runId: this.runId, requestId, command: command! })
      } catch (error) {
        this.pending.delete(requestId)
        reject(error)
      }
    })
  }

  receive(message: BridgeResponse) {
    if (message.runId !== this.runId) return
    const request = this.pending.get(message.requestId)
    if (!request) return
    this.pending.delete(message.requestId)
    if (!message.ok) request.reject(new Error(message.error))
    else if (request.resultType === 'position' ? !isWorkerPosition(message.value)
      : request.resultType === 'surroundings' ? !isSurroundings(message.value) : typeof message.value !== 'boolean') {
      request.reject(new Error('Nieprawidłowa odpowiedź silnika gry.'))
    } else request.resolve(message.value)
  }

  dispose() {
    this.closed = true
    for (const request of this.pending.values()) request.reject(new Error('Most komunikacyjny został zamknięty.'))
    this.pending.clear()
  }
}
