export type TerrainType = 'grass' | 'forest' | 'water' | 'mountain' | 'path'

const legend = { '.': 'grass', f: 'forest', w: 'water', m: 'mountain', p: 'path' } as const

// Jeden ręcznie zaprojektowany świat. Każda grupa ma 5 pól, każdy wiersz — 30.
// . trawa, f las (podłoże), w woda, m skały, p ścieżka.
const layout = [
  ['fffff', 'fff..', '..fff', 'fff..', '.....', '..mmm'],
  ['fffff', 'ffff.', '.ffff', 'fff..', '.....', '.mmmm'],
  ['fffff', 'ffff.', '..fff', 'ff...', '..ww.', '.mmmm'],
  ['fff..', '.ff..', '.....', '....w', 'wwwww', '..mmm'],
  ['fff..', 'ppppp', 'ppppp', '....w', 'wwwww', '...mm'],
  ['ffff.', '.ff..', '....p', '...ww', 'wwwww', '....m'],
  ['fffff', 'fff..', '....p', '....w', 'wwwww', '.....'],
  ['.ffff', 'ff...', '....p', '.....', 'wwwww', '.....'],
  ['..ff.', '.....', '....p', '.....', '.www.', '.....'],
  ['.....', '.....', '....p', '.....', '..w..', '.....'],
  ['.....', '.....', '....p', '.....', '.....', '.....'],
  ['.....', '.....', '....p', '.....', '.....', '.....'],
  ['.....', '.....', '....p', 'ppppp', 'ppppp', 'ppp..'],
  ['....w', 'ww...', '.ffff', 'ff...', '.....', '.....'],
  ['...ww', 'wwww.', 'fffff', 'fff..', '.....', '.....'],
  ['..www', 'wwww.', 'fffff', 'fff..', '.....', '...mm'],
  ['...ww', 'wwww.', '.ffff', 'ffff.', '..mmm', '..mmm'],
  ['....w', 'ww...', '..fff', 'fff..', '.mmmm', '.mmmm'],
  ['.....', '.....', '...ff', 'ff...', '..mmm', 'mmmmm'],
  ['.....', '.....', '.....', '.....', '...mm', 'mmmmm'],
]

export const sandboxTerrain: readonly (readonly TerrainType[])[] = layout.map(groups =>
  groups.join('').split('').map(symbol => {
    if (!(symbol in legend)) throw new Error(`Nieznany symbol terenu: ${symbol}`)
    return legend[symbol as keyof typeof legend]
  }),
)

export function isTerrainWalkable(terrain: TerrainType | undefined): boolean {
  return terrain === 'grass' || terrain === 'forest' || terrain === 'path'
}
