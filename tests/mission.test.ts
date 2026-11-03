import assert from 'node:assert/strict'
import test from 'node:test'
import { createMission, updateMission } from '../src/game/mission.ts'
import { chopWood, createResources } from '../src/game/resources.ts'

test('nowa misja zaczyna się od 0/3', () => {
  assert.deepEqual(createMission(), { progress: 0, completed: false })
})

test('postęp rośnie po każdym zebranym drewnie i osiąga ukończenie przy 3', () => {
  let mission = createMission()
  mission = updateMission(mission, 1)
  assert.deepEqual(mission, { progress: 1, completed: false })
  mission = updateMission(mission, 2)
  assert.deepEqual(mission, { progress: 2, completed: false })
  mission = updateMission(mission, 3)
  assert.deepEqual(mission, { progress: 3, completed: true })
})

test('ukończona misja nie kończy się ponownie i postęp nie przekracza 3', () => {
  const completed = updateMission(createMission(), 3)
  for (const wood of [3, 4, 6, 0]) assert.equal(updateMission(completed, wood), completed)
  assert.deepEqual(updateMission(createMission(), 10), { progress: 3, completed: true })
})

test('powtórzone aktualizacje nie zwiększają postępu, stan wejściowy pozostaje niezmieniony', () => {
  const initial = createMission()
  const next = updateMission(initial, 1)
  assert.equal(updateMission(next, 1), next)
  assert.deepEqual(initial, { progress: 0, completed: false })
})

test('misja reaguje na skuteczne ścinanie, a próby bez drzewa nie dają postępu', () => {
  let resources = createResources([{ column: 2, row: 1 }])
  let mission = createMission()
  resources = chopWood(resources, { column: 2, row: 2, facing: 'down' })
  mission = updateMission(mission, resources.collectedWood)
  assert.deepEqual(mission, { progress: 0, completed: false })
  for (let i = 1; i <= 3; i++) {
    resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
    mission = updateMission(mission, resources.collectedWood)
    assert.equal(mission.progress, i)
    assert.equal(mission.completed, i === 3)
  }
  const completed = mission
  resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
  assert.equal(updateMission(mission, resources.collectedWood), completed)
})

test('utworzenie nowej sesji nie zachowuje ukończenia poprzedniej', () => {
  const previous = updateMission(createMission(), 3)
  const fresh = createMission()
  assert.equal(previous.completed, true)
  assert.deepEqual(fresh, { progress: 0, completed: false })
})
