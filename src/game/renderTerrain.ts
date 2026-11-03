import type Phaser from 'phaser'
import type { TerrainType } from './terrain'

const colors: Record<TerrainType, number> = {
  grass: 0x79ad57,
  forest: 0x4e8147,
  water: 0x458fbd,
  mountain: 0x7d8589,
  path: 0xc7ad7c,
}

export function renderTerrain(graphics: Phaser.GameObjects.Graphics, terrain: readonly (readonly TerrainType[])[], size: number) {
  for (const [row, tiles] of terrain.entries()) {
    for (const [column, tile] of tiles.entries()) {
      const x = column * size
      const y = row * size
      graphics.fillStyle(colors[tile])
      graphics.fillRect(x, y, size, size)
      if (tile === 'water') {
        graphics.lineStyle(2, 0x8fc5df, 0.6)
        graphics.lineBetween(x + size * 0.15, y + size * 0.35, x + size * 0.55, y + size * 0.35)
        graphics.lineBetween(x + size * 0.45, y + size * 0.7, x + size * 0.85, y + size * 0.7)
      } else if (tile === 'mountain') {
        graphics.fillStyle(0x58656c)
        graphics.fillTriangle(x + size * 0.1, y + size * 0.85, x + size * 0.48, y + size * 0.15, x + size * 0.9, y + size * 0.85)
        graphics.fillStyle(0xbac2c2)
        graphics.fillTriangle(x + size * 0.36, y + size * 0.38, x + size * 0.48, y + size * 0.15, x + size * 0.61, y + size * 0.38)
      } else if (tile === 'forest') {
        // Drobne plamy runa; drzewa z drewnem są rysowane oddzielnie.
        graphics.fillStyle(0x63934f)
        graphics.fillCircle(x + size * 0.25, y + size * 0.3, size * 0.09)
        graphics.fillCircle(x + size * 0.7, y + size * 0.7, size * 0.12)
      }
    }
  }
}
