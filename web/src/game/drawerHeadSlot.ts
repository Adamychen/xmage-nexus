import { createContext } from 'react'

/** Hueco de la cabecera del drawer (entre el título y la X) donde el contenido de una pestaña puede colgar sus acciones. */
export const DrawerHeadSlotContext = createContext<HTMLElement | null>(null)
