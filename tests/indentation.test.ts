import assert from 'node:assert/strict'
import test from 'node:test'
import { editIndentation } from '../src/components/indentation.ts'

test('Tab wstawia cztery spacje w miejscu kursora', () => {
  assert.deepEqual(editIndentation('move_up()', 0, 0, 'Tab'), {
    text: '    move_up()', start: 4, end: 4,
  })
  assert.deepEqual(editIndentation('abcd', 2, 2, 'Tab'), {
    text: 'ab    cd', start: 6, end: 6,
  })
  assert.deepEqual(editIndentation('', 0, 0, 'Tab'), { text: '    ', start: 4, end: 4 })
})

test('Tab zastępuje zaznaczony fragment jednej linii i zwija zaznaczenie', () => {
  assert.deepEqual(editIndentation('abcd', 1, 3, 'Tab'), {
    text: 'a    d', start: 5, end: 5,
  })
  assert.deepEqual(editIndentation('    ', 0, 4, 'Tab'), {
    text: '    ', start: 4, end: 4,
  })
})

test('Tab zwiększa wcięcie zaznaczonych linii i zachowuje zaznaczony tekst', () => {
  assert.deepEqual(editIndentation('a\nb\nc', 0, 3, 'Tab'), {
    text: '    a\n    b\nc', start: 4, end: 11,
  })
})

test('Shift+Tab usuwa do czterech spacji ze wszystkich zaznaczonych linii', () => {
  const text = '    a\n  b\n        c'
  assert.deepEqual(editIndentation(text, 0, text.length, 'Tab', true), {
    text: 'a\nb\n    c', start: 0, end: 9,
  })
})

test('Shift+Tab bez zaznaczenia cofa wcięcie bieżącej linii i przesuwa kursor', () => {
  assert.deepEqual(editIndentation('    move()', 8, 8, 'Tab', true), {
    text: 'move()', start: 4, end: 4,
  })
  assert.deepEqual(editIndentation('    move()', 2, 2, 'Tab', true), {
    text: 'move()', start: 0, end: 0,
  })
  assert.deepEqual(editIndentation('move()', 3, 3, 'Tab', true), {
    text: 'move()', start: 3, end: 3,
  })
})

test('koniec zaznaczenia na początku kolejnej linii nie zmienia jej wcięcia', () => {
  assert.deepEqual(editIndentation('    a\n    b', 0, 6, 'Tab', true), {
    text: 'a\n    b', start: 0, end: 2,
  })
  assert.deepEqual(editIndentation('a\nb', 0, 2, 'Tab'), {
    text: '    a\nb', start: 4, end: 6,
  })
})

test('Shift+Tab usuwa wklejony tabulator i obsługuje puste linie', () => {
  assert.deepEqual(editIndentation('\ta\n\n  b', 0, 7, 'Tab', true), {
    text: 'a\n\nb', start: 0, end: 4,
  })
  assert.deepEqual(editIndentation('\na', 0, 0, 'Tab', true), {
    text: '\na', start: 0, end: 0,
  })
})

test('Enter po dwukropku dodaje poziom wcięcia i zachowuje poprzedni', () => {
  const text = '    for i in range(2):'
  assert.deepEqual(editIndentation(text, text.length, text.length, 'Enter'), {
    text: text + '\n        ', start: text.length + 9, end: text.length + 9,
  })
  assert.deepEqual(editIndentation('if True:  ', 10, 10, 'Enter'), {
    text: 'if True:  \n    ', start: 15, end: 15,
  })
})

test('Enter bez dwukropka zachowuje wcięcie i ustawia kursor przed resztą tekstu', () => {
  assert.deepEqual(editIndentation('    move_up()', 8, 8, 'Enter'), {
    text: '    move\n    _up()', start: 13, end: 13,
  })
  assert.deepEqual(editIndentation('abc', 3, 3, 'Enter'), { text: 'abc\n', start: 4, end: 4 })
  assert.deepEqual(editIndentation('    ', 4, 4, 'Enter'), {
    text: '    \n    ', start: 9, end: 9,
  })
})

test('Enter zastępuje zaznaczenie i poprawnie działa na początku dokumentu', () => {
  assert.deepEqual(editIndentation('    abc\ndef', 4, 9, 'Enter'), {
    text: '    \n    ef', start: 9, end: 9,
  })
  assert.deepEqual(editIndentation('\nx', 0, 0, 'Enter'), { text: '\n\nx', start: 1, end: 1 })
  assert.deepEqual(editIndentation('', 0, 0, 'Enter'), { text: '\n', start: 1, end: 1 })
})
