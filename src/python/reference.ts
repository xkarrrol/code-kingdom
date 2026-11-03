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
    description: `Sprawdza, czy można wejść na sąsiednie pole ${label}. Uwzględnia granice, drzewa, złoża, budynki, wodę i góry. Nie porusza robotnika.`,
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
    returns: 'dict z kluczami up, down, left, right. Wartości str: empty, tree, stone, water, mountain, castle, building lub boundary.',
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
    description: 'Odczytuje drewno, kamień i deski robotnika. Wspólna pojemność to 5 jednostek wszystkich surowców łącznie. Zmiana słownika w Pythonie nie zmienia zasobów gry.',
    returns: 'dict: {"wood": ilość drewna, "stone": ilość kamienia, "planks": ilość desek, "capacity": 5}. Wartości to int.',
    example: 'inventory = get_inventory()\nused = inventory["wood"] + inventory["stone"] + inventory["planks"]\nif used < inventory["capacity"]:\n    chop_wood()',
  },
  {
    name: 'mine_stone', syntax: 'mine_stone()', category: 'Resources & Inventory',
    description: 'Wydobywa 1 kamień ze złoża bezpośrednio przed robotnikiem. Złoże ma początkowo 5 kamieni i znika po wyczerpaniu. Pełny ekwipunek lub brak złoża oznacza brak zmian.',
    returns: 'None.', example: 'if stone_ahead():\n    mine_stone()',
  },
  {
    name: 'stone_ahead', syntax: 'stone_ahead()', category: 'World & Detection',
    description: 'Sprawdza sąsiednie pole zgodnie z kierunkiem patrzenia. Wykrywa złoże kamienia, a nie nieprzekraczalny teren górski.',
    returns: 'bool: True, jeśli przed robotnikiem jest niewyczerpane złoże; inaczej False.',
    example: 'if stone_ahead():\n    mine_stone()',
  },
  {
    name: 'deposit_stone', syntax: 'deposit_stone()', category: 'Resources & Inventory',
    description: 'Dostarcza cały kamień do królestwa z pola przy boku zamku, niezależnie od kierunku patrzenia. Drewno pozostaje w ekwipunku. Dostawa kamienia nie zwiększa postępu misji dotyczącej drewna.',
    returns: 'None.', example: '# Stań na polu sąsiadującym bokiem z zamkiem.\ndeposit_stone()',
  },
  {
    name: 'build_sawmill', syntax: 'build_sawmill()', category: 'Resources & Inventory',
    description: 'Buduje tartak 2×2 na oznaczonym obszarze X=7–8, Y=5–6 (współrzędne od zera). Robotnik musi stać przy jego boku, a wszystkie pola muszą być wolne i dostępne. Koszt: 3 drewna i 2 kamienie z zasobów królestwa. Nieudana lub ponowna budowa nie zużywa zasobów. Tartak blokuje ruch i produkuje deski wyłącznie przez process_wood().',
    returns: 'None. Komunikat nad mapą informuje o powodzeniu lub przyczynie odmowy.',
    example: '# Najpierw dostarcz 3 drewna i 2 kamienie do zamku.\n# Stań np. na polu X=7, Y=4, obok oznaczonego miejsca.\nbuild_sawmill()',
  },
  {
    name: 'deposit_to_sawmill', syntax: 'deposit_to_sawmill()', category: 'Resources & Inventory',
    description: 'Przy boku tartaku przenosi drewno z ekwipunku do jego magazynu, maksymalnie do 10 drewna. Nadmiar pozostaje u robotnika; pozostałe surowce nie są przenoszone. Brak tartaku, drewna, sąsiedztwa lub miejsca daje komunikat bez zmian.',
    returns: 'None.', example: '# Stań obok tartaku z drewnem w ekwipunku.\ndeposit_to_sawmill()',
  },
  {
    name: 'process_wood', syntax: 'process_wood()', category: 'Resources & Inventory',
    description: 'Przy boku tartaku przetwarza dokładnie 2 drewna z jego magazynu na 1 deskę. Wymaga miejsca w magazynie desek (maksymalnie 10). Brak surowców, miejsca, tartaku lub sąsiedztwa daje komunikat bez zmian. Produkcja nie działa automatycznie.',
    returns: 'None.', example: '# Najpierw oddaj drewno do tartaku.\nprocess_wood()',
  },
  {
    name: 'collect_planks', syntax: 'collect_planks()', category: 'Resources & Inventory',
    description: 'Przy boku tartaku odbiera tyle dostępnych desek, ile mieści ekwipunek. Drewno, kamień i deski zajmują łącznie do 5 miejsc. Nadmiar desek pozostaje w tartaku. Brak tartaku, sąsiedztwa, desek lub wolnego miejsca daje komunikat bez zmian.',
    returns: 'None.', example: '# Stań obok tartaku i odbierz gotowe deski.\ncollect_planks()',
  },
  {
    name: 'get_sawmill_inventory', syntax: 'get_sawmill_inventory()', category: 'Resources & Inventory',
    description: 'Odczytuje aktualny magazyn tartaku: do 10 drewna i niezależnie do 10 desek. Nie wymaga sąsiedztwa. Jeden odczyt; słownik jest kopią. Jeśli tartak nie istnieje, zgłasza błąd.',
    returns: 'dict: {"wood": ilość drewna, "planks": ilość desek}. Wartości to int.',
    example: 'storage = get_sawmill_inventory()\nwood = storage["wood"]',
  },
  {
    name: 'deposit_planks', syntax: 'deposit_planks()', category: 'Resources & Inventory',
    description: 'Przy boku zamku dostarcza wszystkie deski z ekwipunku do zasobów królestwa. Drewno i kamień pozostają u robotnika. Nie zwiększa postępu misji dostarczania drewna. Brak desek lub sąsiedztwa daje komunikat bez zmian.',
    returns: 'None.', example: '# Stań na polu sąsiadującym bokiem z zamkiem.\ndeposit_planks()',
  },
]

export function searchPythonFunctions(query: string): readonly PythonFunctionDoc[] {
  const terms = query.trim().toLocaleLowerCase('pl').split(/\s+/).filter(Boolean)
  return pythonFunctions.filter(doc => {
    const text = [doc.name, doc.syntax, doc.category, doc.description, doc.returns, doc.example].join(' ').toLocaleLowerCase('pl')
    return terms.every(term => text.includes(term))
  })
}
