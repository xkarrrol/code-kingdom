import type { WorkerCommand } from './commands'

export type ParseResult =
  | { ok: true; commands: WorkerCommand[] }
  | { ok: false; error: { line: number; message: string } }

// Sprawdzamy cały tekst przed przekazaniem jakiejkolwiek komendy do gry.
export function parseCommands(code: string): ParseResult {
  const commands: WorkerCommand[] = []
  const lines = code.split(/\r\n|\n|\r/)

  for (const [index, source] of lines.entries()) {
    const instruction = source.trim()
    if (instruction === '') continue

    switch (instruction) {
      case 'move_up()': commands.push('move_up'); break
      case 'move_down()': commands.push('move_down'); break
      case 'move_left()': commands.push('move_left'); break
      case 'move_right()': commands.push('move_right'); break
      default:
        return {
          ok: false,
          error: {
            line: index + 1,
            message: `Linia ${index + 1}: nieznana instrukcja „${instruction}”. Wpisz jedną z czterech komend, np. move_up(), w osobnej linii.`,
          },
        }
    }
  }

  return { ok: true, commands }
}
