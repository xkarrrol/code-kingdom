export interface TextEdit {
  text: string
  start: number
  end: number
}

const INDENT = '    '

export function editIndentation(
  text: string,
  start: number,
  end: number,
  key: 'Tab' | 'Enter',
  shift = false,
): TextEdit {
  const lineStart = text.slice(0, start).lastIndexOf('\n') + 1

  if (key === 'Enter') {
    const prefix = text.slice(lineStart, start)
    const indentation = prefix.match(/^[ \t]*/)?.[0] ?? ''
    const extra = prefix.trimEnd().endsWith(':') ? INDENT : ''
    const insertion = '\n' + indentation + extra
    const cursor = start + insertion.length
    return { text: text.slice(0, start) + insertion + text.slice(end), start: cursor, end: cursor }
  }

  const multiline = text.slice(start, end).includes('\n')
  if (!shift && !multiline) {
    const cursor = start + INDENT.length
    return { text: text.slice(0, start) + INDENT + text.slice(end), start: cursor, end: cursor }
  }

  // Koniec zaznaczenia na początku następnej linii nie obejmuje tej linii.
  const lastSelected = end > start && text[end - 1] === '\n' ? end - 1 : end
  const edits: { position: number; removed: number; inserted: string }[] = []
  for (let position = lineStart; position <= lastSelected;) {
    const leading = text.slice(position).match(/^( {1,4}|\t)/)?.[0] ?? ''
    edits.push({ position, removed: shift ? leading.length : 0, inserted: shift ? '' : INDENT })
    const next = text.indexOf('\n', position)
    if (next < 0) break
    position = next + 1
  }

  function adjustCursor(cursor: number) {
    let offset = 0
    for (const edit of edits) {
      if (cursor < edit.position) break
      if (cursor <= edit.position + edit.removed) {
        return edit.position + offset + edit.inserted.length
      }
      offset += edit.inserted.length - edit.removed
    }
    return cursor + offset
  }

  let updated = text
  for (const edit of [...edits].reverse()) {
    updated = updated.slice(0, edit.position) + edit.inserted + updated.slice(edit.position + edit.removed)
  }
  return { text: updated, start: adjustCursor(start), end: adjustCursor(end) }
}
