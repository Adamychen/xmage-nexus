import React from 'react'
import {
  ArrowLeftRight, Armchair, AtSign, Award, Ban, Bell, BookOpen, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp,
  Circle, CircleAlert, Castle, Clock, Clipboard, ChartColumn, Copy, Download, Dices, Eye, EyeOff, Flame, Funnel,
  Gamepad2, Gauge, Gem, File, Folder, Globe, Hand, Hourglass, House, Inbox, Info, Key, Keyboard, Landmark, Layers, LayoutGrid, List, Lock, LockOpen, LogOut, Map, Maximize, Medal, MessageCircle,
  Minus, MapPin, Package, Palette, Pause, Pencil, Play, Plus, RefreshCw, RotateCcw, Save, Scale, ScrollText, Search, Send, Settings,
  Star, Smile, Square, Tag, Hash, Trash, TriangleAlert, TreePine, Trophy, Undo2, Upload, UserCheck, Users, UserX, VolumeX, Wand, Wind, X, Zap,
  type LucideIcon,
} from 'lucide-react'

export type IconName =
  | 'sun'
  | 'moon'
  | 'swords'
  | 'dna'
  | 'shield'
  | 'skull'
  | 'portal'
  | 'book'
  | 'bolt'
  | 'heart'
  | 'crown'
  | 'target'
  | 'warning'
  | 'user'
  | 'bot'
  | 'flag'
  | 'door'
  | 'grid'
  | 'check'
  | 'timer'
  | 'sparkles'
  | 'drop'
  | 'wings'
  | 'trample'
  | 'trophy'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eyeOff'
  | 'star'
  | 'gamepad'
  | 'scrollText'
  | 'users'
  | 'chat'
  | 'bell'
  | 'ban'
  | 'mute'
  | 'medal'
  | 'award'
  | 'history'
  | 'logout'
  | 'chevronUp'
  | 'chevronDown'
  | 'chevronsUp'
  | 'chevronsDown'
  | 'play'
  | 'swap'
  | 'dice'
  | 'hourglass'
  | 'filter'
  | 'reset'
  | 'info'
  | 'alert'
  | 'error'
  | 'clock'
  | 'refresh'
  | 'plus'
  | 'minus'
  | 'copy'
  | 'download'
  | 'upload'
  | 'pencil'
  | 'trash'
  | 'bookOpen'
  | 'layers'
  | 'send'
  | 'atSign'
  | 'userX'
  | 'userCheck'
  | 'settings'
  | 'search'
  | 'palette'
  | 'flame'
  | 'gem'
  | 'package'
  | 'globe'
  | 'zap'
  | 'circle'
  | 'x'
  | 'chair'
  | 'key'
  | 'clipboard'
  | 'map'
  | 'save'
  | 'square'
  | 'file'
  | 'chart'
  | 'pause'
  | 'tag'
  | 'hash'
  | 'scale'
  | 'wind'
  | 'tree'
  | 'gauge'
  | 'landmark'
  | 'smile'
  | 'castle'
  | 'hand'
  | 'list'
  | 'layoutGrid'
  | 'folder'
  | 'wand'
  | 'maximize'
  | 'undo'
  | 'keyboard'
  | 'pin'
  | 'home'
  | 'inbox'

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  lock: Lock,
  unlock: LockOpen,
  eye: Eye,
  eyeOff: EyeOff,
  star: Star,
  gamepad: Gamepad2,
  scrollText: ScrollText,
  users: Users,
  chat: MessageCircle,
  bell: Bell,
  ban: Ban,
  mute: VolumeX,
  medal: Medal,
  award: Award,
  history: ScrollText,
  logout: LogOut,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronsUp: ChevronsUp,
  chevronsDown: ChevronsDown,
  play: Play,
  swap: ArrowLeftRight,
  dice: Dices,
  hourglass: Hourglass,
  filter: Funnel,
  reset: RotateCcw,
  info: Info,
  alert: TriangleAlert,
  error: CircleAlert,
  clock: Clock,
  refresh: RefreshCw,
  plus: Plus,
  minus: Minus,
  copy: Copy,
  download: Download,
  upload: Upload,
  pencil: Pencil,
  trash: Trash,
  bookOpen: BookOpen,
  layers: Layers,
  send: Send,
  atSign: AtSign,
  userX: UserX,
  userCheck: UserCheck,
  settings: Settings,
  search: Search,
  palette: Palette,
  flame: Flame,
  gem: Gem,
  package: Package,
  globe: Globe,
  zap: Zap,
  circle: Circle,
  x: X,
  chair: Armchair,
  key: Key,
  clipboard: Clipboard,
  map: Map,
  save: Save,
  square: Square,
  file: File,
  chart: ChartColumn,
  pause: Pause,
  tag: Tag,
  hash: Hash,
  scale: Scale,
  wind: Wind,
  tree: TreePine,
  gauge: Gauge,
  landmark: Landmark,
  smile: Smile,
  castle: Castle,
  hand: Hand,
  list: List,
  layoutGrid: LayoutGrid,
  folder: Folder,
  wand: Wand,
  maximize: Maximize,
  undo: Undo2,
  keyboard: Keyboard,
  pin: MapPin,
  home: House,
  inbox: Inbox,
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName
  size?: number | string
  className?: string
}

export default function Icon({ name, size = 16, className = '', style, ...props }: IconProps) {
  const iconStyle: React.CSSProperties = {
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0,
    ...style,
  }

  const s = size

  const Lucide = LUCIDE_ICONS[name]
  if (Lucide) {
    return <Lucide size={s} className={className} style={iconStyle} aria-hidden {...props} />
  }

  switch (name) {
    case 'sun':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )

    case 'moon':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )

    case 'swords':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" y1="19" x2="19" y2="13" />
          <line x1="16" y1="16" x2="20" y2="20" />
          <line x1="19" y1="21" x2="21" y2="19" />
          <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
          <line x1="5" y1="14" x2="9" y2="18" />
          <line x1="7" y1="17" x2="4" y2="20" />
          <line x1="3" y1="19" x2="5" y2="21" />
        </svg>
      )

    case 'dna':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M2 15c6.667-6 13.333 0 20-6" />
          <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
          <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
          <path d="M17 6l-2.5-2.5" />
          <path d="M14 8l-1-1" />
          <path d="M7 18l2.5 2.5" />
          <path d="M3.5 14.5l.5.5" />
          <path d="M20 9l.5.5" />
          <path d="M6.5 12.5l11-1" />
          <path d="M2 9c6.667 6 13.333 0 20 6" />
        </svg>
      )

    case 'shield':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )

    case 'skull':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M9 10h.01M15 10h.01" />
          <path d="M12 2a8 8 0 0 0-8 8c0 3.3 1.5 5.5 3 6.5V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3.5c1.5-1 3-3.2 3-6.5a8 8 0 0 0-8-8z" />
          <path d="M10 17v3M14 17v3" />
        </svg>
      )

    case 'portal':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
          <path d="M12 3a9 9 0 0 1 6.36 15.36L12 12" />
          <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.4" />
        </svg>
      )

    case 'book':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10M6 10h10" />
        </svg>
      )

    case 'bolt':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )

    case 'heart':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      )

    case 'crown':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
      )

    case 'target':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )

    case 'warning':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )

    case 'user':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )

    case 'bot':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <rect width="18" height="12" x="3" y="6" rx="2" />
          <path d="M9 12h.01M15 12h.01M12 2v4M2 12h1M21 12h1" />
        </svg>
      )

    case 'flag':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      )

    case 'door':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )

    case 'grid':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )

    case 'check':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )

    case 'timer':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )

    case 'sparkles':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      )

    case 'drop':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      )

    case 'wings':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M3 14c3-6 9-8 18-9-2 5-6 9-11 11" />
          <path d="M7 14c2-3 5-4 10-5" />
        </svg>
      )

    case 'trample':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={iconStyle} {...props}>
          <path d="M5 4h4l3 7-2 3-5-2V4z" />
          <path d="M15 4h4v8l-5 2-2-3 3-7z" />
          <path d="M8 18l4 3 4-3-2-2h-4l-2 2z" />
        </svg>
      )

    default:
      return null
  }
}
