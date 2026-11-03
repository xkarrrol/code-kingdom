import { useState } from 'react'
import { referenceCategories, searchPythonFunctions } from '../python/reference'
import { copyReferenceText } from './referenceClipboard'

export default function PythonReference() {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const results = searchPythonFunctions(query)

  async function copy(text: string) {
    setMessage(await copyReferenceText(text, navigator.clipboard))
  }

  return (
    <details className="python-reference" data-python-reference>
      <summary>Python Reference</summary>
      <div className="reference-content">
        <p>Funkcje gry dostępne w Pythonie. Kliknij składnię, aby ją skopiować, lub skopiuj cały przykład.</p>
        <label htmlFor="reference-search">Szukaj funkcji</label>
        <input id="reference-search" type="search" value={query} placeholder="Nazwa lub opis…"
          onChange={event => { setQuery(event.target.value); setMessage('') }} />
        <p role="status" aria-live="polite">{message || `Znaleziono: ${results.length}`}</p>
        <div className="reference-results">
          {results.length === 0 && <p>Brak pasujących funkcji. Spróbuj innej nazwy lub opisu.</p>}
          {referenceCategories.map(category => {
            const entries = results.filter(doc => doc.category === category)
            return entries.length > 0 && (
              <section key={category} aria-label={category}>
                <h3>{category}</h3>
                {entries.map(doc => (
                  <article key={doc.name} className="reference-entry">
                    <h4><button type="button" onClick={() => void copy(doc.syntax)} aria-label={`Kopiuj ${doc.syntax}`}>
                      <code>{doc.syntax}</code>
                    </button></h4>
                    <p>{doc.description}</p>
                    <p><strong>Zwraca:</strong> {doc.returns}</p>
                    <pre><code>{doc.example}</code></pre>
                    <button type="button" onClick={() => void copy(doc.example)} aria-label={`Kopiuj przykład ${doc.name}`}>
                      Kopiuj przykład
                    </button>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
        <p className="reference-limits">Limit programu: 100 komend i 100 odczytów świata oraz 2 sekundy obliczeń (bez animacji). Komendy czekają na zakończenie poprzedniej. Błąd nie cofa wykonanych działań. Komunikacja z grą wymaga JSPI.</p>
      </div>
    </details>
  )
}
