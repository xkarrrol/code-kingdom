import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { pythonFunctions, referenceCategories, searchPythonFunctions } from '../src/python/reference.ts'
import { copyReferenceText } from '../src/components/referenceClipboard.ts'

test('dokumentacja obejmuje dokładnie wszystkie funkcje gry rejestrowane w Pyodide', async () => {
  const source = await readFile(new URL('../src/python/executePython.ts', import.meta.url), 'utf8')
  const registered = Array.from(source.matchAll(/^([a-z][a-z_]+) = _make_\w+\(/gm), match => match[1]).sort()
  assert(registered.length > 0)
  const documented = pythonFunctions.map(doc => doc.name).sort()
  assert.deepEqual(documented, registered)
  assert.equal(new Set(documented).size, documented.length)
  assert.deepEqual(new Set(pythonFunctions.map(doc => doc.category)), new Set(referenceCategories))
  for (const doc of pythonFunctions) {
    assert.equal(doc.syntax, `${doc.name}()`)
    assert(doc.description.trim())
    assert(doc.returns.trim())
    assert(doc.example.includes(doc.syntax), doc.name)
  }
})

test('wyszukiwanie działa po nazwie, opisie, wartości zwracanej i kategorii', () => {
  assert.deepEqual(searchPythonFunctions('  GET_INVENTORY  ').map(doc => doc.name), ['get_inventory'])
  assert.deepEqual(searchPythonFunctions('move_right()').map(doc => doc.name), ['move_right', 'can_move_right', 'get_surroundings'])
  assert(searchPythonFunctions('sąsiednie pole').some(doc => doc.name === 'can_move_up'))
  assert(searchPythonFunctions('boundary').some(doc => doc.name === 'get_surroundings'))
  assert.equal(searchPythonFunctions('Rotation').length, 4)
  assert.deepEqual(searchPythonFunctions('nieistniejąca_funkcja'), [])
  assert.deepEqual(searchPythonFunctions('   '), pythonFunctions)
})

test('kopiowanie zapisuje dokładną składnię lub przykład, bez wykonywania komend', async () => {
  const written: string[] = []
  const clipboard = { writeText: async (text: string) => { written.push(text) } }
  const doc = pythonFunctions.find(doc => doc.name === 'can_move_right')!
  assert.equal(await copyReferenceText(doc.syntax, clipboard), 'Skopiowano do schowka.')
  await copyReferenceText(doc.example, clipboard)
  assert.deepEqual(written, [doc.syntax, doc.example])
})

test('brak schowka i odmowa dostępu zwracają komunikat zamiast nieobsłużonego błędu', async () => {
  assert.match(await copyReferenceText('move_up()'), /Schowek jest niedostępny/)
  assert.match(await copyReferenceText('move_up()', { writeText: async () => { throw new Error('denied') } }), /Nie udało się skopiować/)
})
