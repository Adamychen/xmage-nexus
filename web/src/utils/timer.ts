import { useState, useEffect } from 'react'

/**
 * El servidor envía Integer.MAX_VALUE (2^31-1) como "sin límite de tiempo"
 * (partidas sin reloj). Mostrarlo como cuenta atrás daría "596523:14:07".
 */
export const UNLIMITED_TIME = 2147483647

export function isUnlimitedTime(seconds: number | undefined | null): boolean {
  return (seconds ?? 0) >= UNLIMITED_TIME
}

/**
 * Formatea segundos en formato de reloj:
 * - Si es >= 1 hora: H:MM:SS (ej. 1:55:08)
 * - Si es < 1 hora: MM:SS (ej. 15:42 o 00:05)
 */
export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0))
  if (total <= 0) return '00:00'

  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Hook para cuenta regresiva en tiempo real (Chess Clock / Priority Timer).
 * Desciende 1 segundo cada 1000ms mientras isTicking sea true,
 * y se resincroniza automáticamente cada vez que el servidor envía un nuevo valor.
 */
export function useTickingTimer(serverSeconds: number | undefined | null, isTicking: boolean): number {
  const unlimited = isUnlimitedTime(serverSeconds)
  const [secondsLeft, setSecondsLeft] = useState<number>(() => (unlimited ? 0 : (serverSeconds ?? 0)))

  // Resincronizar con el valor autoritativo del servidor cuando llegue un nuevo frame
  useEffect(() => {
    setSecondsLeft(unlimited ? 0 : (serverSeconds ?? 0))
  }, [serverSeconds, unlimited])

  // Descontar segundo a segundo localmente mientras el jugador tenga la prioridad activa
  useEffect(() => {
    if (unlimited || !isTicking || (serverSeconds ?? 0) <= 0) return

    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [isTicking, serverSeconds])

  return secondsLeft
}
