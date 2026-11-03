export const referenceCategories = ['Movement', 'Rotation', 'World & Detection', 'Resources & Inventory'] as const
export type ReferenceCategory = typeof referenceCategories[number]

export interface PythonFunctionDoc {
  name: string
  syntax: string
  category: ReferenceCategory
  description: string
  returns: string
  example: string
}

const directions = [
  { name: 'up', label: 'w górę' },
  { name: 'down', label: 'w dół' },
  { name: 'left', label: 'w lewo' },
  { name: 'right', label: 'w prawo' },
] as const

// Dane dokumentacji są niezależne od interfejsu i wykonawcy Pythona.
export const pythonFunctions: readonly PythonFunctionDoc[] = [
  ...directions.map(({ name, label }): PythonFunctionDoc => ({
    name: `move_${name}`, syntax: `move_${name}()`, category: 'Movement',
    description: `Przesuwa robotnika o jedno pole ${label}. Czeka na koniec animacji. Przeszkoda lub granica mapy blokuje ruch.`,
    returns: 'None — także gdy ruch jest zablokowany.', example: `move_${name}()`,
  })),
  ...directions.map(({ name, label }): PythonFunctionDoc => ({
    name: `turn_${name}`, syntax: `turn_${name}()`, category: 'Rotation',
    description: `Ustawia kierunek patrzenia ${label}, bez zmiany pozycji. Wpływa na ścinanie i tree_ahead().`,
    returns: 'None.', example: `turn_${name}()`,
  })),
  {
    name: 'get_worker_position', syntax: 'get_worker_position()', category: 'World & Detection',
    description: 'Odczytuje aktualną pozycję po zakończeniu wcześniejszych komend. Współrzędne pól liczymy od zera; X rośnie w prawo, Y w dół.',
    returns: 'dict: {"x": kolumna, "y": wiersz}. Obie wartości to int.',
    example: 'position = get_worker_position()\nx = position["x"]',
  },
  ...directions.map(({ name, label }): PythonFunctionDoc => ({
    name: `can_move_${name}`, syntax: `can_move_${name}()`, category: 'World & Detection',
    description: `Sprawdza, czy można wejść na sąsiednie pole ${label}. Uwzględnia granice, drzewa, zamek, wodę i góry. Nie porusza robotnika.`,
    returns: 'bool: True, jeśli ruch jest możliwy; inaczej False.',
    example: `if can_move_${name}():\n    move_${name}()`,
  })),
  {
    name: 'tree_ahead', syntax: 'tree_ahead()', category: 'World & Detection',
    description: 'Sprawdza wyłącznie pole bezpośrednio przed robotnikiem, zgodnie z kierunkiem patrzenia. Uwzględnia wycięte drzewa.',
    returns: 'bool: True, jeśli przed robotnikiem jest drzewo z drewnem; inaczej False.',
    example: 'if tree_ahead():\n    chop_wood()',
  },
  {
    name: 'get_surroundings', syntax: 'get_surroundings()', category: 'World & Detection',
    description: 'Odczytuje tylko cztery sąsiednie pola. Trawa, ścieżki i przechodni las dają empty. Cały odczyt liczy się jako jedno zapytanie.',
    returns: 'dict z kluczami up, down, left, right. Wartości str: empty, tree, water, mountain, castle lub boundary.',
    example: 'nearby = get_surroundings()\nif nearby["right"] == "empty":\n    move_right()',
  },
  {
    name: 'chop_wood', syntax: 'chop_wood()', category: 'Resources & Inventory',
    description: 'Zbiera 1 drewno z drzewa bezpośrednio przed robotnikiem. Po zebraniu 3 drewna drzewo znika. Brak drzewa lub pełny ekwipunek oznacza brak zmian.',
    returns: 'None.', example: 'if tree_ahead():\n    chop_wood()',
  },
  {
    name: 'deposit_wood', syntax: 'deposit_wood()', category: 'Resources & Inventory',
    description: 'Przenosi całe drewno z ekwipunku do królestwa. Robotnik musi stać przy boku zamku; kierunek patrzenia jest dowolny. Pusty ekwipunek lub brak sąsiedztwa oznacza brak zmian. Dostawy zwiększają postęp misji.',
    returns: 'None.', example: '# Stań na polu sąsiadującym bokiem z zamkiem.\ndeposit_wood()',
  },
  {
    name: 'get_inventory', syntax: 'get_inventory()', category: 'Resources & Inventory',
    description: 'Odczytuje ilość drewna robotnika i pojemność równą 5. Zwraca kopię: zmiana słownika w Pythonie nie zmienia zasobów gry.',
    returns: 'dict: {"wood": ilość, "capacity": 5}. Obie wartości to int.',
    example: 'inventory = get_inventory()\nif inventory["wood"] < inventory["capacity"]:\n    chop_wood()',
  },
]

export function searchPythonFunctions(query: string): readonly PythonFunctionDoc[] {
  const terms = query.trim().toLocaleLowerCase('pl').split(/\s+/).filter(Boolean)
  return pythonFunctions.filter(doc => {
    const text = [doc.name, doc.syntax, doc.category, doc.description, doc.returns, doc.example].join(' ').toLocaleLowerCase('pl')
    return terms.every(term => text.includes(term))
  })
}
