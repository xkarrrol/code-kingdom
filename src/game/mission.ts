export const woodMission = {
  name: 'Zapasy dla królestwa',
  description: 'Dostarcz 3 jednostki drewna do zamku, aby przygotować zapasy dla królestwa.',
  goal: 3,
}

export interface MissionState {
  progress: number
  completed: boolean
}

export function createMission(): MissionState {
  return { progress: 0, completed: false }
}

// Otrzymuje drewno dostarczone do zamku, bez zawartości ekwipunku robotnika.
export function updateMission(state: MissionState, kingdomWood: number): MissionState {
  if (state.completed) return state
  const progress = Math.min(woodMission.goal, Math.max(state.progress, kingdomWood))
  if (progress === state.progress) return state
  return { progress, completed: progress === woodMission.goal }
}
