import type { SelectableObject } from '../game/selection'

const typeLabels = { unit: 'Jednostka', building: 'Budynek', resource: 'Zasób' }

export default function ObjectInfoPanel({ object }: { object: SelectableObject }) {
  return (
    <section className="object-info" aria-labelledby="object-info-title" aria-live="polite">
      <h3 id="object-info-title">{object.name}</h3>
      <p>Typ: {typeLabels[object.kind]}</p>
      <p>Pole: X = {object.column}, Y = {object.row}</p>
      {object.wood !== undefined && <p>Drewno: {object.wood}</p>}
      {object.stone !== undefined && <p>Kamień: {object.stone}</p>}
      <small>Esc: zamknij informacje</small>
    </section>
  )
}
