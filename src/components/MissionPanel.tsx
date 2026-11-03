import { woodMission } from '../game/mission'
import type { MissionState } from '../game/mission'

export default function MissionPanel({ mission }: { mission: MissionState }) {
  return (
    <section className="mission-panel" aria-labelledby="mission-title">
      <h2 id="mission-title">{woodMission.name}</h2>
      <p>{woodMission.description}</p>
      <progress value={mission.progress} max={woodMission.goal} aria-label="Postęp misji" />
      <div aria-live="polite">
        <p>Postęp: {mission.progress}/{woodMission.goal}</p>
        {mission.completed && <p className="mission-completed">Misja ukończona!</p>}
      </div>
    </section>
  )
}
