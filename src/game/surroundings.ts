import type { TilePosition } from './map'
import type { Direction, MovementMap, TileType } from './movement'
import { getAdjacentTile, getTileType } from './movement.ts'

export type Surroundings = Record<Direction, TileType>

// Odczyt wyłącznie czterech bezpośrednich sąsiadów, bez zmiany świata.
export function getSurroundings(map: MovementMap, position: TilePosition): Surroundings {
  return {
    up: getTileType(map, getAdjacentTile(position, 'up')),
    down: getTileType(map, getAdjacentTile(position, 'down')),
    left: getTileType(map, getAdjacentTile(position, 'left')),
    right: getTileType(map, getAdjacentTile(position, 'right')),
  }
}
