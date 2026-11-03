import assert from 'node:assert/strict'
import test from 'node:test'
import { createMission, updateMission } from '../src/game/mission.ts'
import { chopWood, createResources, depositWood } from '../src/game/resources.ts'
import { kingdomMap } from '../src/game/map.ts'

test('nowa misja zaczyna się od 0/3', () => {
  assert.deepEqual(createMission(), { progress: 0, completed: false })
})

test('postęp rośnie po dostawach drewna i osiąga ukończenie przy 3', () => {
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

test('ścinanie nie zwiększa postępu; częściowe dostawy kończą misję tylko raz', () => {
  let resources = createResources([{ column: 2, row: 1 }])
  let mission = createMission()
  resources = chopWood(resources, { column: 2, row: 2, facing: 'down' })
  mission = updateMission(mission, resources.kingdomWood)
  assert.deepEqual(mission, { progress: 0, completed: false })
  for (let i = 1; i <= 3; i++) {
    resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
    mission = updateMission(mission, resources.kingdomWood)
    assert.equal(mission.progress, i === 3 ? 2 : 0)
    assert.equal(mission.completed, false)
    if (i === 2) {
      resources = depositWood(resources, { column: 5, row: 3 }, kingdomMap.castle)
      mission = updateMission(mission, resources.kingdomWood)
      assert.deepEqual(mission, { progress: 2, completed: false })
    }
  }
  resources = depositWood(resources, { column: 5, row: 4 }, kingdomMap.castle)
  mission = updateMission(mission, resources.kingdomWood)
  assert.deepEqual(mission, { progress: 3, completed: true })
  const completed = mission
  resources = chopWood(resources, { column: 2, row: 2, facing: 'up' })
  assert.equal(updateMission(mission, resources.kingdomWood), completed)
})

test('utworzenie nowej sesji nie zachowuje ukończenia poprzedniej', () => {
  const previous = updateMission(createMission(), 3)
  const fresh = createMission()
  assert.equal(previous.completed, true)
  assert.deepEqual(fresh, { progress: 0, completed: false })
})
