import { test } from '../fixtures'

export const TIMING_RETRIES_IN_CI = 2

export function retryTimingSpecInCi(): void {
  test.describe.configure({ retries: process.env.CI ? TIMING_RETRIES_IN_CI : 0 })
}
