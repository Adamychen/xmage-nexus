import { t as tStatic } from '../../i18n'
import type { FeedbackTextFn } from './types'

/** Display strings for the feedback parser, backed by the static translator.
 *  This is the ONLY module in feedback/ allowed to import i18n: detection
 *  (detect.ts) and extraction (record.ts) are pure and take display strings
 *  (or a whole FeedbackTextFn) as parameters instead. */
export function defaultFeedbackText(
  ns: 'game' | 'dialogs' | 'common',
  key: string,
  params?: Record<string, string | number>,
): string {
  return tStatic(`${ns}.${key}`, params)
}

export const defaultText: FeedbackTextFn = defaultFeedbackText
