import assert from 'node:assert/strict'
import test from 'node:test'
import { WorkerCommands } from '../src/game/commands.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { kingdomMap } from '../src/game/map.ts'
import type { Direction } from '../src/game/movement.ts'

// Stałe dane testowe niezależne od przykładu edytowanego podczas ćwiczeń.
const testCommands = ['move_up', 'move_right', 'move_down'] as const

test('blokada klawiatury podczas obliczeń nie blokuje późniejszej sekwencji', async () => {
  const directions: Direction[] = []
  const runner = new WorkerCommands(async direction => { directions.push(direction); return true })
  runner.manualInputEnabled = false
  assert.equal(await runner.executeCommand('move_left'), false)
  assert.equal(await runner.runCommands(['move_up']), true)
  runner.manualInputEnabled = true
  assert.equal(await runner.executeCommand('move_right'), true)
  assert.deepEqual(directions, ['up', 'right'])
})

test('cztery komendy wywołują odpowiednie kierunki', async () => {
  const directions: Direction[] = []
  const runner = new WorkerCommands(async direction => {
    directions.push(direction)
    return true
  })
  for (const command of ['move_up', 'move_down', 'move_left', 'move_right'] as const) {
    assert.equal(await runner.executeCommand(command), true)
  }
  assert.deepEqual(directions, ['up', 'down', 'left', 'right'])
})

test('następny ruch czeka na zakończenie poprzedniego, również ostatniego', async () => {
  const directions: Direction[] = []
  const finish: ((moved: boolean) => void)[] = []
  const runner = new WorkerCommands(direction => {
    directions.push(direction)
    return new Promise(resolve => finish.push(resolve))
  })
  const sequence = runner.runCommands(testCommands)
  assert.deepEqual(directions, ['up'])
  assert.equal(runner.isRunning, true)
  finish[0](true)
  await Promise.resolve()
  assert.deepEqual(directions, ['up', 'right'])
  finish[1](true)
  await Promise.resolve()
  assert.deepEqual(directions, ['up', 'right', 'down'])
  assert.equal(runner.isRunning, true)
  finish[2](true)
  assert.equal(await sequence, true)
  assert.equal(runner.isRunning, false)
})

test('druga sekwencja i pojedyncze komendy nie przerywają trwającej sekwencji', async () => {
  let finish!: (moved: boolean) => void
  let moves = 0
  const runner = new WorkerCommands(() => {
    moves++
    return new Promise(resolve => { finish = resolve })
  })
  const first = runner.runCommands(['move_up'])
  assert.equal(await runner.runCommands(['move_down']), false)
  assert.equal(await runner.executeCommand('move_left'), false)
  assert.equal(moves, 1)
  finish(true)
  await first
  const next = runner.runCommands(['move_right'])
  assert.equal(moves, 2)
  finish(true)
  assert.equal(await next, true)
})

test('sekwencja korzysta z reguł mapy i wykonuje trzy dozwolone kroki', async () => {
  let position = { ...kingdomMap.worker }
  const visited = []
  const runner = new WorkerCommands(async direction => {
    const destination = getWorkerDestination(kingdomMap, position, direction)
    if (!destination) return false
    position = destination
    visited.push(position)
    return true
  })
  await runner.runCommands(testCommands)
  assert.deepEqual(visited, [
    { column: 5, row: 3 },
    { column: 6, row: 3 },
    { column: 6, row: 4 },
  ])
})

test('zablokowany krok nie zatrzymuje następnych komend', async () => {
  let position = { ...kingdomMap.worker }
  const runner = new WorkerCommands(async direction => {
    const destination = getWorkerDestination(kingdomMap, position, direction)
    if (!destination) return false
    position = destination
    return true
  })
  await runner.runCommands(['move_left', 'move_up'])
  assert.deepEqual(position, { column: 5, row: 3 })
})

test('błąd zwalnia blokadę sekwencji', async () => {
  const runner = new WorkerCommands(async () => { throw new Error('animation failed') })
  await assert.rejects(runner.runCommands(testCommands), /animation failed/)
  assert.equal(runner.isRunning, false)
})

test('zamknięcie wykonawcy zapobiega kolejnym krokom po zakończeniu animacji', async () => {
  let finish!: (moved: boolean) => void
  let moves = 0
  const runner = new WorkerCommands(() => {
    moves++
    return new Promise(resolve => { finish = resolve })
  })
  const sequence = runner.runCommands(testCommands)
  runner.dispose()
  finish(false)
  assert.equal(await sequence, false)
  assert.equal(moves, 1)
  assert.equal(runner.isRunning, false)
  assert.equal(await runner.runCommands(testCommands), false)
  assert.equal(await runner.executeCommand('move_up'), false)
})
