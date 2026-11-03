export const woodMission = {
  name: 'Zapasy dla królestwa',
  description: 'Zbierz 3 jednostki drewna, aby przygotować zapasy dla królestwa.',
  goal: 3,
}

export interface MissionState {
  progress: number
  completed: boolean
}

export function createMission(): MissionState {
  return { progress: 0, completed: false }
}

// Otrzymuje faktycznie zebrane drewno, a nie liczbę prób ścinania.
export function updateMission(state: MissionState, collectedWood: number): MissionState {
  if (state.completed) return state
  const progress = Math.min(woodMission.goal, Math.max(state.progress, collectedWood))
  if (progress === state.progress) return state
  return { progress, completed: progress === woodMission.goal }
}
