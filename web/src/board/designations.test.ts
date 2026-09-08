import { describe, expect, it } from 'vitest'
import { cardDesignations, classLevelOf, pairedPartnerName, substituteCardRefs } from './designations'

describe('cardDesignations', () => {
  it('detecta monstrous desde la hint en vivo del motor', () => {
    expect(cardDesignations(['Flying', 'ICON_GOOD{this} is monstrous'])).toEqual(['monstrous'])
  })

  it('detecta renowned', () => {
    expect(cardDesignations(['<br/><hintstart/>', 'ICON_GOOD{this} is renowned'])).toEqual(['renowned'])
  })

  it('la rama negativa no da badge', () => {
    expect(cardDesignations(["ICON_BAD{this} isn't monstrous"])).toEqual([])
    expect(cardDesignations(["ICON_BAD{this} isn't renowned"])).toEqual([])
  })

  it('el texto recordatorio estático no da badge', () => {
    expect(cardDesignations([
      '{X}{X}{G}: Monstrosity X. <i>(If this creature isn\'t monstrous, put X +1/+1 counters on it and it becomes monstrous.)</i>',
    ])).toEqual([])
  })

  it('detecta suspected desde la línea info del motor (con tags)', () => {
    expect(cardDesignations(["<font color = 'blue'>Suspected (has menace and can't block)</font>"]))
      .toEqual(['suspected'])
  })

  it('conviven varias designaciones sin duplicados', () => {
    expect(cardDesignations(['ICON_GOOD{this} is monstrous', "Suspected (has menace and can't block)", 'ICON_GOOD{this} is monstrous']))
      .toEqual(['monstrous', 'suspected'])
  })

  it('detecta pareja soulbond y extrae el nombre sin tags ni hash', () => {
    const line = "Paired with <font color='#B0C4DE'>Consul's Lieutenant [d4e]</font>"
    expect(cardDesignations(['Flying', line])).toEqual(['paired'])
    expect(pairedPartnerName(['Flying', line])).toBe("Consul's Lieutenant")
    expect(pairedPartnerName(['Flying'])).toBeNull()
  })

  it('el reminder estático de soulbond no da badge', () => {
    expect(cardDesignations(['Soulbond (You may pair this creature with another unpaired creature when either enters.)']))
      .toEqual([])
  })

  it('detecta nivel de clase y lo extrae', () => {
    expect(cardDesignations(['Level 1 — ability one.', 'Level 2 — ability two.', 'Class level: 2']))
      .toEqual(['classlevel'])
    expect(classLevelOf(['Class level: 2'])).toBe(2)
    expect(classLevelOf(['Level 2 — ability two.'])).toBeNull()
    expect(classLevelOf([])).toBeNull()
  })

  it('sin rules no hay designaciones', () => {
    expect(cardDesignations(undefined)).toEqual([])
    expect(cardDesignations([])).toEqual([])
  })
})

describe('substituteCardRefs', () => {
  it('sustituye {this} por el nombre y los marcadores ICON por ✓/✗', () => {
    expect(substituteCardRefs('ICON_GOOD{this} is monstrous', 'Polukranos, World Eater'))
      .toBe('✓Polukranos, World Eater is monstrous')
    expect(substituteCardRefs("ICON_BAD{this} isn't renowned", 'Consul\'s Lieutenant'))
      .toBe("✗Consul's Lieutenant isn't renowned")
  })

  it('sustituye todas las ocurrencias', () => {
    expect(substituteCardRefs('{this} deals damage. {this} attacks.', 'Bear'))
      .toBe('Bear deals damage. Bear attacks.')
  })
})
