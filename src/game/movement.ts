import type { kingdomMap, TilePosition } from './map'
import { isTerrainWalkable } from './terrain.ts'

export type Direction = 'up' | 'down' | 'left' | 'right'
export type MovementMap = Pick<typeof kingdomMap, 'columns' | 'rows' | 'trees' | 'castle' | 'terrain'>
export type TileType = 'empty' | 'tree' | 'water' | 'mountain' | 'castle' | 'boundary'

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
  return getTileType(map, destination) === 'empty' ? destination : null
}

// Jeden opis pola dla kolizji i odczytów świata; kolejność przeszkód pozostaje ta sama.
export function getTileType(map: MovementMap, position: TilePosition): TileType {
  const { column, row } = position

  if (column < 0 || column >= map.columns || row < 0 || row >= map.rows) {
    return 'boundary'
  }

  const terrain = map.terrain[row]?.[column]
  if (!isTerrainWalkable(terrain)) {
    return terrain === 'water' || terrain === 'mountain' ? terrain : 'boundary'
  }

  if (map.trees.some(tree => tree.column === column && tree.row === row)) {
    return 'tree'
  }

  const castle = map.castle
  if (
    column >= castle.column && column < castle.column + castle.columns &&
    row >= castle.row && row < castle.row + castle.rows
  ) {
    return 'castle'
  }

  return 'empty'
}
