import type { kingdomMap, TilePosition } from './map'

export type Direction = 'up' | 'down' | 'left' | 'right'
type MovementMap = Pick<typeof kingdomMap, 'columns' | 'rows' | 'trees' | 'castle'>

const steps: Record<Direction, TilePosition> = {
  up: { column: 0, row: -1 },
  down: { column: 0, row: 1 },
  left: { column: -1, row: 0 },
  right: { column: 1, row: 0 },
}

export function getAdjacentTile(position: TilePosition, direction: Direction): TilePosition {
  const step = steps[direction]
  return { column: position.column + step.column, row: position.row + step.row }
}

// Wspólne reguły dla klawiatury i przyszłych poleceń z Pythona.
// null oznacza zablokowany ruch. Funkcja nie zmienia mapy ani pozycji wejściowej.
export function getWorkerDestination(
  map: MovementMap,
  position: TilePosition,
  direction: Direction,
): TilePosition | null {
  const destination = getAdjacentTile(position, direction)
  const { column, row } = destination

  if (column < 0 || column >= map.columns || row < 0 || row >= map.rows) {
    return null
  }

  if (map.trees.some(tree => tree.column === column && tree.row === row)) {
    return null
  }

  const castle = map.castle
  if (
    column >= castle.column && column < castle.column + castle.columns &&
    row >= castle.row && row < castle.row + castle.rows
  ) {
    return null
  }

  return destination
}
