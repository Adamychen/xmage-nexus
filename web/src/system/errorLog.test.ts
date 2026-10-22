import { beforeEach, describe, expect, it } from 'vitest'
import { clearErrors, recentErrors, recordError } from './errorLog'

describe('error buffer', () => {
  beforeEach(() => {
    clearErrors()
  })

  it('folds consecutive repeats of one error into a single record with a count', () => {
    for (let i = 0; i < 60; i++) recordError('app', 'TypeError: cannot read property of undefined')
    const errors = recentErrors()
    expect(errors).toHaveLength(1)
    expect(errors[0].count).toBe(60)
  })

  it('keeps a different error between two repeats as its own record', () => {
    recordError('app', 'first')
    recordError('app', 'second')
    recordError('app', 'first')
    expect(recentErrors().map((e) => [e.text, e.count ?? 1])).toEqual([['first', 1], ['second', 1], ['first', 1]])
  })

  it('does not fold the same text recorded from another source', () => {
    recordError('window', 'boom')
    recordError('rejection', 'boom')
    expect(recentErrors()).toHaveLength(2)
  })

  it('keeps the latest distinct errors once the buffer is full', () => {
    for (let i = 0; i < 60; i++) recordError('app', `error ${i}`)
    const errors = recentErrors()
    expect(errors).toHaveLength(50)
    expect(errors[0].text).toBe('error 10')
    expect(errors[49].text).toBe('error 59')
  })
})
