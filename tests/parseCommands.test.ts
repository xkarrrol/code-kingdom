import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCommands } from '../src/game/parseCommands.ts'
import { WorkerCommands } from '../src/game/commands.ts'

test('rozpoznaje wyłącznie cztery komendy i zachowuje kolejność oraz powtórzenia', () => {
  assert.deepEqual(parseCommands('move_up()\nmove_down()\nmove_left()\nmove_right()\nmove_up()'), {
    ok: true,
    commands: ['move_up', 'move_down', 'move_left', 'move_right', 'move_up'],
  })
})

test('ignoruje puste linie i białe znaki na brzegach instrukcji', () => {
  assert.deepEqual(parseCommands('\n  move_up()  \n\t\n\tmove_right()\n'), {
    ok: true, commands: ['move_up', 'move_right'],
  })
  assert.deepEqual(parseCommands(' \t\n\r\n'), { ok: true, commands: [] })
  assert.deepEqual(parseCommands(''), { ok: true, commands: [] })
})

test('obsługuje zakończenia linii LF, CRLF i CR', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    assert.deepEqual(parseCommands(`move_up()${newline}move_down()`), {
      ok: true, commands: ['move_up', 'move_down'],
    })
  }
})

test('błąd podaje numer linii z uwzględnieniem pustych linii i nie zwraca częściowej listy', () => {
  const result = parseCommands('move_up()\n\nunknown()\nmove_down()')
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('Oczekiwano błędu parsera')
  assert.equal(result.error.line, 3)
  assert.match(result.error.message, /Linia 3/)
  assert.match(result.error.message, /unknown\(\)/)
  assert.equal('commands' in result, false)
})

test('odrzuca wiele instrukcji w jednej linii oraz nieobsługiwaną składnię', () => {
  for (const code of [
    'move_up(); move_down()', 'move_up() move_right()', 'move_up();',
    'move_up(1)', 'move_up', 'MOVE_UP()', 'move_up ()', 'move_up( )',
    '# komentarz', 'move_up() # komentarz', 'x = 1',
    'for i in range(3):\n  move_up()', 'if True:\n  move_up()',
    'print("hello")', 'eval("move_up()")', 'new Function("alert(1)")',
    'toString()', '__proto__', 'constructor()',
  ]) {
    assert.equal(parseCommands(code).ok, false, code)
  }
})

test('błędny kod nie uruchamia żadnego ruchu; poprawny korzysta z wykonawcy komend', async () => {
  const moves: string[] = []
  const runner = new WorkerCommands(async direction => {
    moves.push(direction)
    return true
  })
  const invalid = parseCommands('move_up()\nmove_right()\nunknown()')
  if (invalid.ok) await runner.runCommands(invalid.commands)
  assert.deepEqual(moves, [])

  const valid = parseCommands('move_up()\n\nmove_right()\nmove_down()')
  assert.equal(valid.ok, true)
  if (valid.ok) await runner.runCommands(valid.commands)
  assert.deepEqual(moves, ['up', 'right', 'down'])
})
