# Eksperyment Pyodide + JSPI

1. Uruchom `npm.cmd run dev`.
2. W Firefoxie otwórz `/experiments/jspi.html` pod adresem serwera Vite.
3. Kliknij **Uruchom test JSPI**. Samo otwarcie gry ani strony testowej nie uruchamia Pythona.

Wynik i wersja przeglądarki pojawią się na stronie oraz w konsoli. Worker zgłasza wersję Pyodide i obecność `WebAssembly.Suspending` oraz `WebAssembly.promising` we własnym środowisku.

Zwykłe `def test_query()` korzysta z `pyodide.ffi.run_sync()`. Program wchodzi do Pythona przez `runPythonAsync()`. Żądanie i odpowiedź mają zgodny `requestId`; główny wątek odpowiada dopiero po 100 ms. Sukces wymaga, aby Python otrzymał dokładnie `bool True`.

**Brak wsparcia** jest osobnym wynikiem, a nie zaliczonym testem. Obecność funkcji JSPI to kontrola wstępna; dopiero faktyczne wykonanie potwierdza współpracę Pyodide z przeglądarką. Błąd środowiska lub `run_sync()` jest wyświetlany bez zastępowania mechanizmu przez `await`, SharedArrayBuffer czy zmianę ustawień przeglądarki. Po 60 sekundach bez zakończenia Worker jest zatrzymywany.

Pliki eksperymentu nie importują silnika gry, edytora ani produkcyjnego wykonawcy komend. Osobna strona jest uwzględniona również w `npm.cmd run build`.

Testy automatyczne używają rzeczywistego Pyodide w Workerach Node, co nie zastępuje testu w Firefoxie. W środowisku bez JSPI testy sukcesu są jawnie pomijane; test wykrywania braku wsparcia nadal działa.
