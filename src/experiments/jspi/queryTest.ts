import type { PyodideInterface } from 'pyodide'

// Stały program eksperymentalny. Nie otrzymuje kodu gracza ani obiektów gry.
const pythonTest = `
from pyodide.ffi import run_sync

def test_query():
    return run_sync(js_query())

answer = test_query()
assert type(answer) is bool, "Odpowiedź nie jest bool"
assert answer is True, "Oczekiwano True"
repr(answer)
`

export async function runQueryTest(pyodide: PyodideInterface, query: () => Promise<boolean>): Promise<'True'> {
  const globals = pyodide.toPy({ js_query: query })
  try {
    const result = await pyodide.runPythonAsync(pythonTest, { globals, filename: 'jspi_experiment.py' })
    if (result !== 'True') throw new Error(`Nieoczekiwany wynik Pythona: ${String(result)}`)
    return result
  } finally {
    globals.destroy()
  }
}
