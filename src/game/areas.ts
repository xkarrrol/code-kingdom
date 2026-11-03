import type { TilePosition } from './map'

export interface TileArea extends TilePosition { columns: number; rows: number }

export function containsTile(area: TileArea, tile: TilePosition): boolean {
  return tile.column >= area.column && tile.column < area.column + area.columns
    && tile.row >= area.row && tile.row < area.row + area.rows
}

export function isBesideArea(tile: TilePosition, area: TileArea): boolean {
  return (tile.row >= area.row && tile.row < area.row + area.rows
    && (tile.column === area.column - 1 || tile.column === area.column + area.columns))
    || (tile.column >= area.column && tile.column < area.column + area.columns
      && (tile.row === area.row - 1 || tile.row === area.row + area.rows))
}
