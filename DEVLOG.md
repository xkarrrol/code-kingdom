# Code Kingdom — Development Log

## Milestone 01 — Fundamenty gry

**Data:** 02.11.2026  
**Status:** Ukończony  
**Projekt:** Code Kingdom  
**Repozytorium:** `code-kingdom`

---

## 1. Wizja projektu

Code Kingdom to przeglądarkowa gra strategiczno-edukacyjna, w której gracz rozwija średniowieczne królestwo, programując swoje jednostki w języku Python.

**Główna mechanika:**

Napisz kod → Uruchom program → Obserwuj jednostki → Zbieraj zasoby → Rozwijaj królestwo.

W przyszłości planujemy:
- Rozbudowę królestwa i budowanie nowych obiektów.
- Ekonomię i zarządzanie zasobami.
- Więcej jednostek i automatyzację pracy.
- System misji uczących programowania.
- Armie, bitwy i przeciwników.
- Multiplayer i rywalizację między graczami.

### Filozofia rozwoju

Projekt ma dwa równorzędne cele:

1. Stworzyć interesującą grę edukacyjną.
2. Rozwijać moje umiejętności programistyczne.

Codex pomaga implementować funkcjonalności, ale każdą zmianę powinienem rozumieć. Pracujemy małymi etapami i regularnie testujemy efekty.

---

## 2. Technologie

| Technologia | Zastosowanie |
|---|---|
| React | Interfejs użytkownika |
| TypeScript | Logika aplikacji i typowanie |
| Vite | Środowisko developerskie |
| Phaser | Silnik gry 2D |
| Python | Programowanie jednostek przez gracza |
| Pyodide | Uruchamianie Pythona w przeglądarce |
| Web Worker | Uruchamianie Pythona poza głównym wątkiem |
| Git | Kontrola wersji |
| GitHub | Repozytorium projektu |
| Codex | Pomoc w implementacji i nauce |

**Planowane na przyszłość:** FastAPI, PostgreSQL i WebSocket.

---

## 3. Co udało się stworzyć?

### Mapa i jednostki
- [x] Plansza 8 × 8 pól.
- [x] Pola o rozmiarze 64 × 64 px.
- [x] Zamek na środku.
- [x] Drzewa rozmieszczone na mapie.
- [x] Jeden robotnik.
- [x] Płynne animacje ruchu.
- [x] Kolizje z drzewami, zamkiem i granicami planszy.

### System programowania
- [x] Edytor kodu Python.
- [x] Automatyczne wcięcia po dwukropku.
- [x] Obsługa Tab i Shift+Tab.
- [x] Wykonywanie prawdziwego Pythona przez Pyodide.
- [x] Obsługa pętli, zmiennych i funkcji.
- [x] Wyświetlanie błędów.
- [x] Kolejkowanie poleceń i wykonywanie ich w odpowiedniej kolejności.

### System zasobów
- [x] Drzewa zawierają po 3 jednostki drewna.
- [x] Robotnik może ścinać sąsiadujące drzewa.
- [x] Jedno `chop_wood()` zbiera jedną jednostkę.
- [x] Wyczerpane drzewa znikają.
- [x] Licznik zgromadzonego drewna.

**Rezultat:** gracz może już napisać kod w Pythonie, poruszać robotnikiem i zbierać drewno.

---

## 4. Architektura projektu

Najważniejsze pliki:

| Plik | Odpowiedzialność |
|---|---|
| `src/App.tsx` | Główny interfejs React |
| `src/components/KingdomGame.tsx` | Integracja Phasera z Reactem |
| `src/components/CodeEditor.tsx` | Edytor kodu gracza |
| `src/game/map.ts` | Dane mapy i położenie obiektów |
| `src/game/KingdomScene.ts` | Wyświetlanie mapy i animacje |
| `src/game/movement.ts` | Reguły przemieszczania jednostek |
| `src/game/commands.ts` | Wykonywanie sekwencji komend |
| `src/python/python.worker.ts` | Web Worker dla Pythona |
| `src/python/executePython.ts` | Zbieranie komend z programu Python |
| `src/python/PythonRunner.ts` | Zarządzanie wykonaniem i limitami |
| `AGENTS.md` | Zasady pracy Codexa |

### Przepływ działania kodu

1. Gracz wpisuje Python w edytorze React.
2. Kod jest przekazywany do Web Workera.
3. Pyodide wykonuje program.
4. Funkcje gry zbierają polecenia w listę.
5. Po poprawnym zakończeniu wykonywania lista trafia do silnika gry.
6. Phaser animuje robotnika i aktualizuje mapę.

**Kluczowa zasada:** logika gry jest oddzielona od jej wyświetlania.

---

## 5. Czego się nauczyłem?

### Git i GitHub

Poznałem podstawowe polecenia:

```bash
git add .
git commit -m "Opis zmian"
git push origin main
```

- `add` — przygotowuje zmiany.
- `commit` — zapisuje wersję projektu.
- `push` — wysyła zmiany do GitHuba.

### React

Poznałem:
- Komponenty, np. `App.tsx`.
- `useState` do przechowywania stanu.
- `onChange` do obsługi zmian tekstu.
- Podstawową strukturę aplikacji React.

### TypeScript i Phaser

Nauczyłem się:
- Reprezentować obiekty współrzędnymi.
- Korzystać z siatki wierszy i kolumn.
- Zmieniać parametry animacji.
- Rozdzielać zasady ruchu od grafiki.

### Python

Przećwiczyłem:
- Pętle `for`.
- Funkcje definiowane za pomocą `def`.
- Wcięcia i bloki kodu.
- Wielokrotne wykonywanie instrukcji.

Przykładowy działający program:

```python
def collect_wood():
    for i in range(3):
        chop_wood()

collect_wood()
```

### Asynchroniczność

Poznałem podstawowe pojęcia:

- `Promise` — reprezentuje wynik operacji, która zakończy się w przyszłości.
- `await` — pozwala poczekać na zakończenie operacji.
- `Web Worker` — wykonuje kod poza głównym wątkiem strony.
- `postMessage` — umożliwia wymianę wiadomości z Workerem.

Dzięki temu robotnik wykonuje kolejne ruchy dopiero po zakończeniu poprzednich animacji.

---

## 6. Ograniczenia i bezpieczeństwo

Aktualna wersja to lokalny prototyp.

Zastosowane ograniczenia wykonywania kodu:
- Maksymalnie 100 komend gry.
- Maksymalnie 2 sekundy obliczeń Pythona.
- Przerwanie Workera po przekroczeniu limitu czasu.
- Brak bezpośredniego dostępu Pythona do obiektów Phasera.
- Odrzucanie listy komend, jeśli program zakończy się błędem.

**Ważne:** Web Worker nie gwarantuje pełnej izolacji niezaufanego kodu. Przed publicznym udostępnieniem gry konieczne będą dodatkowe zabezpieczenia.

---

## 7. Przydatne polecenia

Uruchomienie projektu:

```bash
npm run dev
```

Zbudowanie aplikacji:

```bash
npm run build
```

Instalacja zależności:

```bash
npm install
```

Sprawdzenie zmian w Git:

```bash
git status
```

Katalog projektu na komputerze:

`C:\Dev\code-kingdom`

---

## 8. Następny etap — Milestone 02

**Cel: pierwsza misja edukacyjna.**

Planujemy:
- System zadań.
- Pierwszą misję polegającą na zdobyciu drewna.
- Wyświetlanie celu misji.
- Sprawdzanie warunków ukończenia.
- Komunikat o sukcesie.
- Prosty system postępów.

Gra powinna zacząć uczyć programowania poprzez konkretne wyzwania.

---

## 9. Najważniejszy wniosek

W pierwszym etapie przeszliśmy od pustego repozytorium do działającej gry przeglądarkowej, w której Python steruje robotnikiem i pozwala pozyskiwać zasoby.

Najważniejszym osiągnięciem nie jest sama mapa, lecz połączenie trzech elementów:

**Kod Pythona → logika gry → widoczny efekt na mapie.**

To fundament, na którym będziemy rozwijać całe Code Kingdom.

---

*Milestone 01 — zakończony. Następny: Milestone 02 — First Mission.*