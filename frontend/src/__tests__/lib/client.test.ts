import { describe, it, expect } from 'vitest'
import { MEAL_TYPE_LABELS } from '../../app/_lib/api/client'
import type { MealType } from '../../app/_lib/api/client'

describe('MEAL_TYPE_LABELS', () => {
  it('1は朝食', () => {
    expect(MEAL_TYPE_LABELS[1 as MealType]).toBe('朝食')
  })

  it('2は昼食', () => {
    expect(MEAL_TYPE_LABELS[2 as MealType]).toBe('昼食')
  })

  it('3は夕食', () => {
    expect(MEAL_TYPE_LABELS[3 as MealType]).toBe('夕食')
  })

  it('4は弁当', () => {
    expect(MEAL_TYPE_LABELS[4 as MealType]).toBe('弁当')
  })

  it('4つのラベルが存在する', () => {
    expect(Object.keys(MEAL_TYPE_LABELS)).toHaveLength(4)
  })
})
