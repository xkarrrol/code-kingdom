import type Phaser from 'phaser'
import { buildingDefinitions, getBuildingArea } from './buildingData'
import type { BuildingSite, PlacedBuilding } from './buildingData'

export function drawBuildingSite(graphics: Phaser.GameObjects.Graphics, site: BuildingSite, tileSize: number) {
  const area = getBuildingArea(site)
  const x = area.column * tileSize
  const y = area.row * tileSize
  const width = area.columns * tileSize
  const height = area.rows * tileSize
  graphics.fillStyle(0xffdf75, 0.14)
  graphics.fillRect(x, y, width, height)
  graphics.lineStyle(3, 0xffdf75, 0.85)
  graphics.strokeRect(x + 4, y + 4, width - 8, height - 8)
  graphics.lineBetween(x + 8, y + 8, x + width - 8, y + height - 8)
  graphics.lineBetween(x + width - 8, y + 8, x + 8, y + height - 8)
}

export function drawBuilding(graphics: Phaser.GameObjects.Graphics, building: PlacedBuilding, tileSize: number) {
  // Pierwszy typ budynku: prosta bryła tartaku, bez produkcji.
  const x = building.column * tileSize
  const y = building.row * tileSize
  const width = building.columns * tileSize
  const height = building.rows * tileSize
  const definition = buildingDefinitions[building.kind]
  if (definition === buildingDefinitions.sawmill) {
    graphics.fillStyle(0x7a4d30)
    graphics.fillRect(x + 12, y + 42, width - 24, height - 54)
    graphics.fillStyle(0xc18a54)
    graphics.fillRect(x + 20, y + 50, width - 40, height - 70)
    graphics.fillStyle(0x9e4538)
    graphics.fillTriangle(x + 3, y + 46, x + width / 2, y + 8, x + width - 3, y + 46)
    graphics.fillStyle(0x352a26)
    graphics.fillRect(x + 30, y + 73, 29, 43)
    graphics.fillStyle(0xd3c7aa)
    graphics.fillCircle(x + width - 38, y + 79, 18)
    graphics.lineStyle(2, 0x78654b)
    graphics.strokeCircle(x + width - 38, y + 79, 10)
  }
}
