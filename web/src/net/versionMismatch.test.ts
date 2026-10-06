import { describe, expect, it } from 'vitest'
import { versionMismatchOf } from './versionMismatch'

const DETAIL = 'mage.remote.MageVersionException: Wrong client version.<br/>Your version: 1.4.61-V1 (build: 2026-10-01 16:14)'
  + '<br/>Server version: 1.4.62-V1 (build: 2026-10-03 20:33)<br/>App download: http://xmage.today'

describe('versionMismatchOf', () => {
  it('reads both releases from the server refusal', () => {
    expect(versionMismatchOf({ errorCode: 'VERSION_MISMATCH', error: DETAIL })).toEqual({ proxy: '1.4.61-V1', server: '1.4.62-V1' })
  })

  it('recognises the refusal from an older proxy that sends no code', () => {
    expect(versionMismatchOf({ errorCode: 'FAILED', error: `Remote task error: ${DETAIL}` })).toEqual({ proxy: '1.4.61-V1', server: '1.4.62-V1' })
  })

  it('keeps the code when the detail has no versions', () => {
    expect(versionMismatchOf({ errorCode: 'VERSION_MISMATCH', error: 'FAILED' })).toEqual({ proxy: null, server: null })
  })

  it('ignores every other login failure', () => {
    expect(versionMismatchOf({ errorCode: 'FAILED', error: 'User name may not be longer than 14 characters' })).toBeNull()
    expect(versionMismatchOf({})).toBeNull()
  })
})
