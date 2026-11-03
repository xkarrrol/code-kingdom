import { sandboxTerrain } from './terrain.ts'

export interface TilePosition {
  column: number
  row: number
}

// Dane mapy nie zależą od Reacta ani Phasera.
export const kingdomMap = {
  columns: 30,
  rows: 20,
  tileSize: 64,
  terrain: sandboxTerrain,
  castle: { column: 3, row: 3, columns: 2, rows: 2 },
  trees: [
    { column: 1, row: 1 },
    { column: 5, row: 1 },
    { column: 6, row: 2 },
    { column: 1, row: 5 },
    { column: 2, row: 6 },
    { column: 6, row: 6 },
  ] satisfies TilePosition[],
  worker: { column: 5, row: 4 } satisfies TilePosition,
}
