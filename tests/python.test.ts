import assert from 'node:assert/strict'
import test from 'node:test'
import { Worker } from 'node:worker_threads'
import { PythonRunner } from '../src/python/PythonRunner.ts'
import type { PythonWorker, GameBridge } from '../src/python/PythonRunner.ts'
import type { PythonRequest } from '../src/python/messages.ts'
import { WorkerCommands } from '../src/game/commands.ts'
import type { WorkerCommand } from '../src/game/commands.ts'
import { chopWood, createResources, depositWood, depositStone, depositPlanks, mineStone, getInventory, getTreeAhead, getStoneAhead } from '../src/game/resources.ts'
import { createMission, updateMission } from '../src/game/mission.ts'
import { kingdomMap } from '../src/game/map.ts'
import { getWorkerDestination } from '../src/game/movement.ts'
import { getSurroundings } from '../src/game/surroundings.ts'
import { completeWorkerMove, createWorkerState, turnWorker } from '../src/game/workerState.ts'
import { buildSawmill } from '../src/game/construction.ts'
import type { PlacedBuilding } from '../src/game/buildingData.ts'
import { collectPlanks, depositToSawmill, getSawmillInventory, processWood } from '../src/game/production.ts'
import type { ProductionState, ProductionResult } from '../src/game/production.ts'

function createRealWorker(jspi?: boolean): PythonWorker {
  const worker = new Worker(new URL('./helpers/python-worker.mjs', import.meta.url), { workerData: { jspi } })
  const adapter: PythonWorker = {
    onmessage: null,
    onerror: null,
    postMessage: message => worker.postMessage(message),
    terminate: () => { void worker.terminate() },
  }
  worker.on('message', data => adapter.onmessage?.(new MessageEvent('message', { data })))
  worker.on('error', error => adapter.onerror?.({ message: error.message } as ErrorEvent))
  return adapter
}

function gameFixture(animationMs = 0, start = kingdomMap.worker) {
  let resources = createResources(kingdomMap.trees, kingdomMap.stones)
  let worker = createWorkerState(start)
  let mission = createMission()
  let buildings: readonly PlacedBuilding[] = []
  const buildMessages: string[] = []
  const productionMessages: string[] = []
  const applyProduction = (operation: (state: ProductionState, worker: typeof kingdomMap.worker) => ProductionResult) => {
    const result = operation({ resources, buildings }, worker)
    resources = result.state.resources
    buildings = result.state.buildings
    productionMessages.push(result.message)
    return result.ok
  }
  const executed: WorkerCommand[] = []
  const game = new WorkerCommands(async direction => {
    const destination = getWorkerDestination({ ...kingdomMap, trees: resources.trees, stones: resources.stones, buildings }, worker, direction)
    if (animationMs) await new Promise(resolve => setTimeout(resolve, animationMs))
    worker = completeWorkerMove(worker, destination, direction)
    return destination !== null
  }, async () => {
    const next = chopWood(resources, worker)
    const changed = next !== resources
    resources = next
    mission = updateMission(mission, resources.kingdom.wood)
    return changed
  }, async direction => {
    worker = turnWorker(worker, direction)
    return true
  }, () => worker, direction => getWorkerDestination({ ...kingdomMap, trees: resources.trees, stones: resources.stones, buildings }, worker, direction) !== null,
  () => getTreeAhead(resources, worker) !== undefined,
  () => getSurroundings({ ...kingdomMap, trees: resources.trees, stones: resources.stones, buildings }, worker),
  async () => {
    const next = depositWood(resources, worker, kingdomMap.castle)
    const changed = next !== resources
    resources = next
    mission = updateMission(mission, resources.kingdom.wood)
    return changed
  }, () => getInventory(resources), {
    mine: async () => {
      const next = mineStone(resources, worker)
      const changed = next !== resources
      resources = next
      return changed
    },
    deposit: async () => {
      const next = depositStone(resources, worker, kingdomMap.castle)
      const changed = next !== resources
      resources = next
      mission = updateMission(mission, resources.kingdom.wood)
      return changed
    },
    ahead: () => getStoneAhead(resources, worker) !== undefined,
  }, async () => {
    const result = buildSawmill({ resources, buildings }, { ...kingdomMap, trees: resources.trees, stones: resources.stones }, worker)
    buildMessages.push(result.message)
    resources = result.state.resources
    buildings = result.state.buildings
    mission = updateMission(mission, resources.kingdom.wood)
    return result.ok
  }, {
    deposit: async () => applyProduction(depositToSawmill),
    process: async () => applyProduction(processWood),
    collect: async () => applyProduction(collectPlanks),
    depositPlanks: async () => {
      const next = depositPlanks(resources, worker, kingdomMap.castle)
      const changed = next !== resources
      resources = next
      mission = updateMission(mission, resources.kingdom.wood)
      return changed
    },
    inventory: () => getSawmillInventory(buildings),
  })
  const bridge: GameBridge = {
    canMove: direction => game.canMove(direction),
    treeAhead: () => game.treeAhead(),
    stoneAhead: () => game.stoneAhead(),
    getSurroundings: () => game.getSurroundings(),
    getInventory: () => game.getInventory(),
    getSawmillInventory: () => game.getSawmillInventory(),
    getWorkerPosition: () => {
      const position = game.getWorkerPosition()
      return { x: position.column, y: position.row }
    },
    executeCommand: async command => {
      executed.push(command)
      return game.runCommands([command])
    },
  }
  return { game, bridge, executed, state: () => ({ worker, resources, mission, buildings, buildMessages, productionMessages }) }
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

class FakeWorker implements PythonWorker {
  onmessage: PythonWorker['onmessage'] = null
  onerror: PythonWorker['onerror'] = null
  requests: PythonRequest[] = []
  terminated = false
  postMessage(message: PythonRequest) { this.requests.push(message) }
  terminate() { this.terminated = true }
  send(data: object) {
    const runId = this.requests[0].runId
    this.onmessage?.(new MessageEvent('message', { data: { runId, ...data } }))
  }
}

test('prawdziwy Python czeka na animację i odczytuje nową pozycję w pętli i funkcji', async () => {
  const runner = new PythonRunner(createRealWorker)
  const game = gameFixture(30)
  await runner.run(`
start = get_worker_position()
assert type(start) is dict and type(start["x"]) is int
assert start == {"x": 5, "y": 4}
def walk(steps):
    for i in range(steps):
        move_right()
        assert get_worker_position() == {"x": 6 + i, "y": 4}
walk(2)
move_left()
move_down()
move_up()
`, game.bridge)
  assert.deepEqual(game.executed, ['move_right', 'move_right', 'move_left', 'move_down', 'move_up'])
  assert.deepEqual(game.bridge.getWorkerPosition(), { x: 6, y: 4 })
  const copy = game.game.getWorkerPosition()
  copy.column = 29
  assert.equal(game.game.getWorkerPosition().column, 6)
})

test('prawdziwy Python produkuje deski ręcznie, odbiera je do wspólnego ekwipunku i dostarcza do zamku', async () => {
  const game = gameFixture(10)
  const runner = new PythonRunner(createRealWorker)
  await runner.run(`
move_up()
move_up()
for i in range(3):
    chop_wood()
move_down()
move_right()
move_right()
for i in range(2):
    mine_stone()
move_left()
move_left()
deposit_wood()
deposit_stone()
move_right()
move_down()
move_right()
build_sawmill()
storage = get_sawmill_inventory()
assert type(storage) is dict
assert storage == {"wood": 0, "planks": 0}
assert all(type(value) is int for value in storage.values())
storage["wood"] = 999
assert get_sawmill_inventory()["wood"] == 0
process_wood() # brak drewna: program nadal działa
move_left()
move_up()
turn_up()
for i in range(3):
    chop_wood()
move_down()
move_down()
chop_wood()
assert get_inventory()["wood"] == 4
deposit_to_sawmill()
assert get_inventory()["wood"] == 0
assert get_sawmill_inventory() == {"wood": 4, "planks": 0}
assert get_sawmill_inventory() == {"wood": 4, "planks": 0} # odczyt nie uruchamia produkcji
process_wood()
assert get_sawmill_inventory() == {"wood": 2, "planks": 1}
process_wood()
assert get_sawmill_inventory() == {"wood": 0, "planks": 2}
move_up()
move_up()
move_right()
for i in range(3):
    mine_stone()
move_left()
move_down()
move_down()
collect_planks()
assert get_inventory() == {"wood": 0, "stone": 3, "planks": 2, "capacity": 5}
assert get_sawmill_inventory()["planks"] == 0
deposit_planks() # nie jest jeszcze obok zamku
assert get_inventory()["planks"] == 2
move_up()
move_left()
deposit_planks()
assert get_inventory() == {"wood": 0, "stone": 3, "planks": 0, "capacity": 5}
`, game.bridge)
  assert.equal(game.state().resources.kingdom.planks, 2)
  assert.deepEqual(game.state().mission, { progress: 3, completed: true })
  await runner.run('for i in range(100):\n    assert get_sawmill_inventory() == {"wood": 0, "planks": 0}', game.bridge)
  await assert.rejects(runner.run('for i in range(100):\n    get_sawmill_inventory()\nget_inventory()', game.bridge), /100 zapytań/)
})

test('brak tartaku daje komunikaty komend i błąd zapytania magazynu przez most', async () => {
  const game = gameFixture()
  await assert.rejects(new PythonRunner(createRealWorker).run(`
deposit_to_sawmill()
process_wood()
collect_planks()
get_sawmill_inventory()
`, game.bridge), /Tartak jeszcze nie istnieje/)
  assert.equal(game.state().productionMessages.length, 3)
  assert(game.state().productionMessages.every(message => message.includes('Tartak jeszcze nie istnieje')))
  assert.deepEqual(game.state().resources.worker, { wood: 0, stone: 0, planks: 0 })
})

test('prawdziwy Python dostarcza koszt i buduje tartak przez most; ponowna budowa i ruch na budynek są blokowane', async () => {
  const game = gameFixture(20)
  await new PythonRunner(createRealWorker).run(`
move_right()
move_right()
build_sawmill() # brak zapasów, program trwa dalej
assert can_move_down() is True
move_left()
move_left()
move_up()
move_up()
for i in range(3):
    chop_wood()
move_down()
move_right()
move_right()
for i in range(2):
    mine_stone()
move_left()
move_left()
deposit_wood()
deposit_stone()
move_right()
move_down()
move_right()
build_sawmill()
assert can_move_down() is False
assert get_surroundings()["down"] == "building"
move_down() # zablokowane przez tartak
assert get_worker_position() == {"x": 7, "y": 4}
assert get_inventory() == {"wood": 0, "stone": 0, "planks": 0, "capacity": 5}
build_sawmill() # już istnieje, bez drugiego kosztu
`, game.bridge)
  assert.equal(game.state().buildings.length, 1)
  assert.deepEqual(game.state().resources.kingdom, { wood: 0, stone: 0, planks: 0 })
  assert.deepEqual(game.state().mission, { progress: 3, completed: true })
  assert.match(game.state().buildMessages[0], /Brak zasobów/)
  assert.equal(game.state().buildMessages[1], 'Zbudowano tartak.')
  assert.match(game.state().buildMessages[2], /już istnieje/)
})

test('prawdziwy Python wydobywa kamień, zachowuje kolejność i oddziela dostawy oraz misję drewna', async () => {
  const game = gameFixture(20)
  const runner = new PythonRunner(createRealWorker)
  await runner.run(`
assert type(stone_ahead()) is bool
assert stone_ahead() is False
move_up()
move_up()
for i in range(3):
    chop_wood()
move_down()
move_right()
move_right()
assert stone_ahead() is True
assert get_surroundings()["right"] == "stone"
assert can_move_right() is False
turn_up()
assert stone_ahead() is False
turn_right()
for i in range(2):
    mine_stone()
assert get_inventory() == {"wood": 3, "stone": 2, "planks": 0, "capacity": 5}
mine_stone() # brak miejsca
deposit_stone() # zbyt daleko od zamku
assert get_inventory()["stone"] == 2
`, game.bridge)
  assert.equal(game.state().resources.stones[0].amount, 3)
  assert.deepEqual(game.state().resources.kingdom, { wood: 0, stone: 0, planks: 0 })
  await runner.run(`
move_left()
move_left()
deposit_stone()
assert get_inventory() == {"wood": 3, "stone": 0, "planks": 0, "capacity": 5}
`, game.bridge)
  assert.deepEqual(game.state().resources.kingdom, { wood: 0, stone: 2, planks: 0 })
  assert.deepEqual(game.state().mission, { progress: 0, completed: false })
  await runner.run(`
deposit_wood()
move_right()
move_right()
for i in range(3):
    mine_stone()
assert stone_ahead() is False
assert get_surroundings()["right"] == "empty"
assert can_move_right() is True
move_right()
assert get_worker_position() == {"x": 8, "y": 3}
move_left()
move_left()
move_left()
deposit_stone()
assert get_inventory() == {"wood": 0, "stone": 0, "planks": 0, "capacity": 5}
`, game.bridge)
  assert.deepEqual(game.state().resources.kingdom, { wood: 3, stone: 5, planks: 0 })
  assert.deepEqual(game.state().mission, { progress: 3, completed: true })
})

test('Python zbiera do pełna, nie uszkadza drzewa przy pełnym ekwipunku i dostarcza zapasy do zamku', async () => {
  const game = gameFixture(30)
  const runner = new PythonRunner(createRealWorker)
  await runner.run(`
inventory = get_inventory()
assert type(inventory) is dict
assert inventory == {"wood": 0, "stone": 0, "planks": 0, "capacity": 5}
assert type(inventory["wood"]) is int
inventory["wood"] = 999
assert get_inventory()["wood"] == 0
deposit_wood() # pusty ekwipunek
move_up()
move_up()
for i in range(3):
    chop_wood()
turn_right()
for i in range(2):
    chop_wood()
assert get_inventory() == {"wood": 5, "stone": 0, "planks": 0, "capacity": 5}
chop_wood() # pełny ekwipunek
assert tree_ahead() is True
assert get_inventory()["wood"] == 5
deposit_wood() # po skosie od zamku: nic nie dostarcza
assert get_inventory()["wood"] == 5
`, game.bridge)
  assert.equal(game.state().resources.kingdom.wood, 0)
  assert.equal(game.state().resources.trees.find(tree => tree.column === 6 && tree.row === 2)?.amount, 1)
  assert.deepEqual(game.state().mission, { progress: 0, completed: false })
  await runner.run(`
move_down()
turn_right() # patrzy w stronę przeciwną do zamku
deposit_wood()
assert get_inventory() == {"wood": 0, "stone": 0, "planks": 0, "capacity": 5}
`, game.bridge)
  assert.equal(game.state().resources.kingdom.wood, 5)
  const completed = game.state().mission
  assert.deepEqual(completed, { progress: 3, completed: true })
  await runner.run(`
move_up()
turn_right()
chop_wood()
assert tree_ahead() is False
move_down()
deposit_wood()
deposit_wood()
assert get_inventory()["wood"] == 0
`, game.bridge)
  assert.equal(game.state().resources.kingdom.wood, 6)
  assert.equal(game.state().mission, completed)
})

test('get_inventory współdzieli limit 100 odczytów, bez przekazywania stanu zasobów do Pythona', async () => {
  const game = gameFixture()
  const runner = new PythonRunner(createRealWorker)
  await runner.run('for i in range(100):\n    assert get_inventory() == {"wood": 0, "stone": 0, "planks": 0, "capacity": 5}', game.bridge)
  await assert.rejects(runner.run('for i in range(100):\n    get_inventory()\nget_worker_position()', game.bridge), /100 zapytań/)
})

test('get_surroundings zwraca prawdziwy słownik Python z aktualnymi sąsiadami po ruchu i ścinaniu', async () => {
  const game = gameFixture(30)
  await new PythonRunner(createRealWorker).run(`
before = get_surroundings()
assert type(before) is dict
assert set(before) == {"up", "down", "left", "right"}
assert all(type(value) is str for value in before.values())
assert before == {"up": "empty", "down": "empty", "left": "castle", "right": "empty"}
before["up"] = "castle" # lokalny słownik nie zmienia świata
assert get_surroundings()["up"] == "empty"
move_right()
move_up()
at_tree = get_surroundings()
assert at_tree == {"up": "tree", "down": "empty", "left": "empty", "right": "empty"}
for i in range(3):
    assert get_surroundings()["up"] == "tree"
    chop_wood()
assert get_surroundings()["up"] == "empty"
assert at_tree["up"] == "tree" # wcześniejszy odczyt jest kopią
`, game.bridge)
  assert.equal(game.state().resources.worker.wood, 3)
})

test('100 wywołań get_surroundings to 100 odczytów, a nie 400', async () => {
  const runner = new PythonRunner(createRealWorker)
  const game = gameFixture()
  let reads = 0
  const bridge: GameBridge = { ...game.bridge, getSurroundings: () => { reads++; return game.bridge.getSurroundings() } }
  await runner.run('for i in range(100):\n    assert len(get_surroundings()) == 4', bridge)
  assert.equal(reads, 100)
  await assert.rejects(runner.run('for i in range(101):\n    get_surroundings()', bridge), /100 zapytań/)
  assert.equal(reads, 200)
})

test('tree_ahead jest zarejestrowane w prawdziwym Pythonie i odczytuje drzewo przed robotnikiem', async () => {
  const game = gameFixture(30)
  const runner = new PythonRunner(createRealWorker)
  await runner.run(`
assert tree_ahead() in (True, False)
assert type(tree_ahead()) is bool
assert tree_ahead() is False
move_right()
move_up()
assert tree_ahead() is True
turn_right()
assert tree_ahead() is False
turn_up()
for i in range(3):
    assert tree_ahead() is True
    chop_wood()
assert tree_ahead() is False
`, game.bridge)
  assert.equal(game.state().resources.worker.wood, 3)
  await assert.rejects(runner.run('for i in range(101):\n    tree_ahead()', game.bridge), /100 zapytań/)
})

test('ruch, obroty i ścinanie wykonują się kolejno; usunięte drzewo odblokowuje pole', async () => {
  const game = gameFixture()
  await new PythonRunner(createRealWorker).run(`
move_up()
move_up()
turn_right()
for i in range(3):
    chop_wood()
move_right()
assert get_worker_position() == {"x": 6, "y": 2}
turn_up()
turn_left()
turn_down()
`, game.bridge)
  assert.equal(game.state().resources.worker.wood, 3)
  assert.equal(game.state().resources.trees.some(tree => tree.column === 6 && tree.row === 2), false)
  assert.deepEqual(game.state().worker, { column: 6, row: 2, facing: 'down' })
  assert.deepEqual(game.executed, ['move_up', 'move_up', 'turn_right', 'chop_wood', 'chop_wood', 'chop_wood', 'move_right', 'turn_up', 'turn_left', 'turn_down'])
})

test('kolizja nie przerywa Pythona i nie zmienia pozycji; ścinanie bez drzewa nic nie zbiera', async () => {
  const game = gameFixture()
  await new PythonRunner(createRealWorker).run(`
move_right()
move_up()
assert get_worker_position() == {"x": 6, "y": 3}
move_up() # drzewo
assert get_worker_position() == {"x": 6, "y": 3}
turn_down()
chop_wood()
move_left()
move_left() # zamek
assert get_worker_position() == {"x": 5, "y": 3}
`, game.bridge)
  assert.equal(game.state().resources.worker.wood, 0)
})

test('błąd Pythona zachowuje ukończone ruchy i zebrane drewno, pomija dalsze działania', async () => {
  const runner = new PythonRunner(createRealWorker)
  const game = gameFixture()
  await assert.rejects(runner.run(`
move_right()
move_up()
chop_wood()
missing_function()
move_down()
`, game.bridge), /NameError/)
  assert.deepEqual(game.executed, ['move_right', 'move_up', 'chop_wood'])
  assert.equal(game.state().resources.worker.wood, 1)
  assert.deepEqual(game.bridge.getWorkerPosition(), { x: 6, y: 3 })
  await assert.rejects(runner.run('for', game.bridge), /SyntaxError/)
  assert.equal(game.executed.length, 3)
  await runner.run('move_down()', game.bridge)
  assert.deepEqual(game.bridge.getWorkerPosition(), { x: 6, y: 4 })
})

test('100 komend i 100 odczytów to osobne limity; 101. komenda nie trafia do silnika', async () => {
  const runner = new PythonRunner(createRealWorker)
  const game = gameFixture()
  await runner.run('for i in range(100):\n    turn_up()\n    get_worker_position()', game.bridge)
  assert.equal(game.executed.length, 100)
  await assert.rejects(runner.run(`
try:
    for i in range(101):
        turn_down()
except Exception:
    pass
`, game.bridge), /limit 100 komend/)
  assert.equal(game.executed.length, 200)
  await assert.rejects(runner.run(`
try:
    for i in range(101):
        if i % 2 == 0:
            get_worker_position()
        else:
            can_move_right()
except Exception:
    pass
`, game.bridge), /limit 100 zapytań/)
})

test('can_move w Pythonie zwraca bool, uwzględnia ruch i wycięcie drzewa w tym samym programie', async () => {
  const game = gameFixture(30)
  await new PythonRunner(createRealWorker).run(`
for query in [can_move_up, can_move_down, can_move_left, can_move_right]:
    assert type(query()) is bool
assert can_move_left() is False # zamek
assert can_move_up() is True
assert can_move_down() is True
assert can_move_right() is True
if can_move_right():
    move_right()
move_up()
assert get_worker_position() == {"x": 6, "y": 3}
assert can_move_up() is False # drzewo
chop_wood()
assert can_move_up() is False
chop_wood()
assert can_move_up() is False
chop_wood()
assert can_move_up() is True
while can_move_up():
    move_up()
assert get_worker_position() == {"x": 6, "y": 0}
assert can_move_up() is False # granica mapy
`, game.bridge)
  assert.equal(game.state().resources.worker.wood, 3)
  assert.equal(game.state().worker.row, 0)
})

test('sprawdzanie ruchu obejmuje wolne pola, cztery granice, drzewa, zamek, wodę i góry bez zmiany stanu', () => {
  const cases = [
    { column: 5, row: 4, expected: [true, true, false, true] }, // zamek po lewej
    { column: 6, row: 3, expected: [false, true, true, true] }, // drzewo u góry
    { column: 0, row: 0, expected: [false, true, false, true] },
    { column: 29, row: 12, expected: [true, true, true, false] },
    { column: 0, row: 19, expected: [true, false, false, true] },
    { column: 18, row: 4, expected: [true, false, true, false] }, // woda
    { column: 26, row: 0, expected: [false, false, true, false] }, // góry
  ]
  for (const { column, row, expected } of cases) {
    const game = gameFixture(0, { column, row })
    const before = structuredClone(game.state())
    assert.deepEqual((['up', 'down', 'left', 'right'] as const).map(direction => game.game.canMove(direction)), expected, `${column},${row}`)
    assert.deepEqual(game.state(), before)
    assert.deepEqual(game.executed, [])
    game.game.dispose()
    assert.throws(() => game.game.canMove('up'), /niedostępny/)
  }
})

test('animacja dłuższa niż 2 sekundy nie zużywa budżetu obliczeń', async () => {
  const game = gameFixture(2200)
  await new PythonRunner(createRealWorker).run('move_right()\nassert get_worker_position() == {"x": 6, "y": 4}', game.bridge)
  assert.equal(game.executed.length, 1)
})

test('nieskończona pętla po ruchu podlega timeoutowi, kolejny program działa', async () => {
  const game = gameFixture()
  const runner = new PythonRunner(createRealWorker)
  await assert.rejects(runner.run('move_right()\nwhile True:\n    pass', game.bridge), /2 sekund/)
  assert.deepEqual(game.bridge.getWorkerPosition(), { x: 6, y: 4 })
  await runner.run('move_left()', game.bridge)
  assert.deepEqual(game.bridge.getWorkerPosition(), { x: 5, y: 4 })
})

test('błędy silnika wracają do Pythona, a zmienne nie przechodzą do następnego uruchomienia', async () => {
  const game = gameFixture()
  const runner = new PythonRunner(createRealWorker)
  const bridge: GameBridge = { ...game.bridge, executeCommand: async () => { throw new Error('Błąd ruchu') } }
  await assert.rejects(runner.run('move_up()', bridge), /Błąd ruchu/)
  await assert.rejects(runner.run('get_worker_position()', { ...game.bridge, getWorkerPosition: () => { throw new Error('Błąd odczytu') } }), /Błąd odczytu/)
  await runner.run('x = 1', game.bridge)
  await assert.rejects(runner.run('print(x)', game.bridge), /NameError/)
})

test('brak JSPI zgłasza błąd przed wykonaniem ruchu', async () => {
  const game = gameFixture()
  await assert.rejects(new PythonRunner(() => createRealWorker(false)).run('move_right()', game.bridge), /wymaga JSPI/)
  assert.deepEqual(game.executed, [])
})

test('anulowanie podczas animacji blokuje nowy program do jej końca i ignoruje spóźnioną odpowiedź', async () => {
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const game = gameFixture()
  let complete!: (value: boolean) => void
  let calls = 0
  const bridge: GameBridge = { ...game.bridge, executeCommand: () => { calls++; return new Promise(resolve => { complete = resolve }) } }
  const result = runner.run('test', bridge)
  await assert.rejects(runner.run('other', bridge), /już działa/)
  worker.send({ type: 'ready' })
  const receiveLate = worker.onmessage!
  worker.send({ type: 'command', requestId: 1, command: 'move_right' })
  await flush()
  assert.equal(calls, 1)
  const count = worker.requests.length
  runner.dispose()
  await assert.rejects(result, /anulowano/)
  assert(worker.terminated)
  await assert.rejects(runner.run('other', bridge), /już działa/)
  complete(true)
  await flush()
  receiveLate(new MessageEvent('message', { data: { type: 'command', runId: worker.requests[0].runId, requestId: 2, command: 'move_up' } }))
  assert.equal(calls, 1)
  assert.equal(worker.requests.length, count)
  const next = runner.run('other', game.bridge)
  worker.send({ type: 'ready' }) // FakeWorker nadal używa starego runId, więc jest ignorowany.
  const runId = worker.requests.at(-1)!.runId
  worker.send({ type: 'ready', runId })
  worker.send({ type: 'result', runId })
  await next
})

test('budżet obliczeń sumuje odcinki między animacjami; brak odpowiedzi ma osobny timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const game = gameFixture()
  let complete!: (value: boolean) => void
  const bridge: GameBridge = { ...game.bridge, executeCommand: () => new Promise(resolve => { complete = resolve }) }
  const result = runner.run('test', bridge)
  worker.send({ type: 'ready' })
  now = 1200
  t.mock.timers.tick(1200)
  worker.send({ type: 'command', requestId: 1, command: 'move_right' })
  await flush()
  now = 7200
  t.mock.timers.tick(6000)
  assert.equal(worker.terminated, false)
  complete(true)
  await flush()
  now = 8001
  t.mock.timers.tick(801)
  await assert.rejects(result, /2 sekund/)

  const stuckWorker = new FakeWorker()
  const stuckRunner = new PythonRunner(() => stuckWorker)
  const stuck = stuckRunner.run('test', bridge)
  stuckWorker.send({ type: 'ready' })
  stuckWorker.send({ type: 'command', requestId: 1, command: 'move_up' })
  await flush()
  t.mock.timers.tick(10_000)
  await assert.rejects(stuck, /10 sekund/)
  complete(true)
  await flush()
})

test('brak odpowiedzi na odczyt podlega limitowi obliczeń', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const result = runner.run('test', { ...gameFixture().bridge, getWorkerPosition: () => new Promise(() => {}) })
  worker.send({ type: 'ready' })
  worker.send({ type: 'query', requestId: 1, operation: 'get_worker_position' })
  t.mock.timers.tick(2000)
  await assert.rejects(result, /2 sekund/)
})

test('zachowuje błędy inicjalizacji, limit ładowania oraz anulowanie przed gotowością', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const workers: FakeWorker[] = []
  const runner = new PythonRunner(() => {
    const worker = new FakeWorker()
    workers.push(worker)
    return worker
  })
  const game = gameFixture()
  const loadError = runner.run('test', game.bridge)
  workers[0].send({ type: 'error', message: 'Nie udało się pobrać Pyodide' })
  await assert.rejects(loadError, /pobrać Pyodide/)
  const timeout = runner.run('test', game.bridge)
  t.mock.timers.tick(60_000)
  await assert.rejects(timeout, /60 sekund/)
  const cancelled = runner.run('test', game.bridge)
  runner.dispose()
  await assert.rejects(cancelled, /anulowano/)
  assert(workers.every(worker => worker.terminated))
  assert.deepEqual(game.executed, [])
})

test('protokół ignoruje stary runId i zwraca wynik lub błąd z właściwym requestId', async () => {
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const game = gameFixture()
  const result = runner.run('test', game.bridge)
  const runId = worker.requests[0].runId
  worker.send({ type: 'ready' })
  worker.send({ type: 'command', runId: 'old', requestId: 1, command: 'move_right' })
  assert.deepEqual(game.executed, [])
  worker.send({ type: 'command', requestId: 1, command: 'move_right' })
  await flush()
  assert.deepEqual(worker.requests.at(-1), { type: 'response', runId, requestId: 1, ok: true, value: true })
  worker.send({ type: 'query', requestId: 2, operation: 'get_worker_position' })
  await flush()
  assert.deepEqual(worker.requests.at(-1), { type: 'response', runId, requestId: 2, ok: true, value: { x: 6, y: 4 } })
  worker.send({ type: 'command', requestId: 3, command: 'jump' })
  await flush()
  assert.deepEqual(worker.requests.at(-1), { type: 'response', runId, requestId: 3, ok: false, error: 'Nieznana komenda robotnika.' })
  worker.send({ type: 'query', requestId: 4, operation: 'unknown' })
  await flush()
  assert.equal(worker.requests.at(-1)!.type, 'response')
  worker.send({ type: 'query', requestId: 5, operation: 'can_move', direction: 'up' })
  await flush()
  assert.deepEqual(worker.requests.at(-1), { type: 'response', runId, requestId: 5, ok: true, value: true })
  worker.send({ type: 'query', requestId: 6, operation: 'can_move', direction: 'diagonal' })
  await flush()
  assert.deepEqual(worker.requests.at(-1), { type: 'response', runId, requestId: 6, ok: false, error: 'Nieprawidłowy kierunek zapytania.' })
  worker.send({ type: 'query', requestId: 7, operation: 'get_surroundings', column: 29, row: 19 })
  await flush()
  assert.deepEqual(worker.requests.at(-1), {
    type: 'response', runId, requestId: 7, ok: true,
    value: { up: 'empty', down: 'empty', left: 'empty', right: 'empty' },
  })
  assert.deepEqual(game.executed, ['move_right'])
  worker.send({ type: 'result' })
  await result
})

test('główny wątek pilnuje obu limitów i odrzuca powtórzone lub równoległe żądania', async () => {
  for (const type of ['command', 'query'] as const) {
    const worker = new FakeWorker()
    const runner = new PythonRunner(() => worker)
    const result = runner.run('test', gameFixture().bridge)
    const rejected = assert.rejects(result, /limit 100/)
    worker.send({ type: 'ready' })
    for (let requestId = 1; requestId <= 101; requestId++) {
      worker.send({ type, requestId, command: 'turn_up', operation: 'get_worker_position' })
      await flush()
    }
    await rejected
  }
  const worker = new FakeWorker()
  const runner = new PythonRunner(() => worker)
  const result = runner.run('test', gameFixture().bridge)
  worker.send({ type: 'ready' })
  worker.send({ type: 'query', requestId: 1, operation: 'get_worker_position' })
  await flush()
  worker.send({ type: 'query', requestId: 1, operation: 'get_worker_position' })
  await assert.rejects(result, /requestId/)

  const parallelWorker = new FakeWorker()
  const parallelRunner = new PythonRunner(() => parallelWorker)
  const parallel = parallelRunner.run('test', { ...gameFixture().bridge, getWorkerPosition: () => new Promise(() => {}) })
  parallelWorker.send({ type: 'ready' })
  parallelWorker.send({ type: 'query', requestId: 1, operation: 'get_worker_position' })
  parallelWorker.send({ type: 'command', requestId: 2, command: 'move_up' })
  await assert.rejects(parallel, /kolejność/)
})
