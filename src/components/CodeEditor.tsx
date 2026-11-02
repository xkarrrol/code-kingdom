import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { editIndentation } from './indentation'

const defaultCode = 'move_right()\nmove_right()'

interface CodeEditorProps {
  onRunCode: (code: string) => Promise<boolean>
  disabled: boolean
}

export default function CodeEditor({ onRunCode, disabled }: CodeEditorProps) {
  const [code, setCode] = useState(defaultCode)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{
    start: number
    end: number
    direction: 'forward' | 'backward' | 'none'
  } | null>(null)

  useLayoutEffect(() => {
    const selection = pendingSelection.current
    if (selection) {
      editorRef.current?.setSelectionRange(selection.start, selection.end, selection.direction)
      pendingSelection.current = null
    }
  }, [code])

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
    if (event.key !== 'Tab' && event.key !== 'Enter') return
    event.preventDefault()

    const editor = event.currentTarget
    const edit = editIndentation(editor.value, editor.selectionStart, editor.selectionEnd, event.key, event.shiftKey)
    const direction = edit.start === edit.end ? 'none' : editor.selectionDirection
    setError(null)
    if (edit.text === code) {
      // React nie odświeży komponentu, gdy tekst pozostaje taki sam.
      editor.setSelectionRange(edit.start, edit.end, direction)
    } else {
      pendingSelection.current = { start: edit.start, end: edit.end, direction }
      setCode(edit.text)
    }
  }

  async function runCode() {
    if (disabled) return
    setError(null)
    try {
      const completed = await onRunCode(code)
      if (!completed) setError('Nie można teraz uruchomić komend. Spróbuj ponownie po zakończeniu ruchu.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nie udało się wykonać programu.')
    }
  }

  return (
    <section className="code-editor" aria-labelledby="code-editor-title">
      <h2 id="code-editor-title">Twój kod Python</h2>
      <label htmlFor="player-code">Kod robotnika</label>
      <textarea
        ref={editorRef}
        id="player-code"
        value={code}
        onKeyDown={handleEditorKeyDown}
        onChange={event => {
          setCode(event.target.value)
          setError(null)
        }}
        aria-invalid={error !== null}
        aria-describedby={error ? 'code-editor-note code-editor-error' : 'code-editor-note'}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
      />
      <button type="button" onClick={() => void runCode()} disabled={disabled}>
        Run Code
      </button>
      <p id="code-editor-note">
        Dostępne: move_up(), move_down(), move_left(), move_right(), chop_wood().
        Możesz używać pętli, zmiennych i funkcji. Limit: 100 komend i 2 sekundy obliczeń.
      </p>
      {error && <p id="code-editor-error" className="code-error" role="alert">{error}</p>}
    </section>
  )
}
