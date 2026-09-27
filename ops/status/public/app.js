const DICT = {
  en: {
    subtitle: 'Server status',
    'tab.now': 'Now',
    'tab.stats': 'Statistics',
    'tab.players': 'Players',
    'tab.logs': 'Logs',
    'tab.system': 'System',
    'pill.proxy': 'Proxy',
    'pill.tunnel': 'Tunnel',
    'pill.xmage': 'XMage server',
    'pill.web': 'Web',
    updated: 'Updated {ago}',
    offline: 'Cannot reach the status service. Retrying…',
    catchingUp: 'Indexing the log history… figures will settle in a moment.',
    onlineNow: 'Players online now',
    heroSub: '{grace} reconnecting · {conns} open connections',
    heroPeak: 'Peak 24 h: {peak} · all-time: {all}',
    'tile.users24': 'Players in the last 24 h',
    'tile.games24': 'Games in the last 24 h',
    'tile.visitors24': 'Public visitors (24 h)',
    'tile.visitorsSub': 'Unique IPs through the playit tunnel',
    'tile.problems24': 'Problems (24 h)',
    'tile.problemsSub': '{e} errors · {w} warnings',
    'tile.uptime': 'Proxy uptime',
    'tile.uptimeSub': 'Running since {when}',
    connected: 'Connected players',
    connectedSub: 'Live sessions on the proxy',
    services: 'Services',
    host: 'Host',
    recent: 'Recent activity',
    problems: 'Recent problems',
    noOne: 'Nobody is connected right now.',
    noProblems: 'No problems recorded. All quiet.',
    noData: 'No data for this period.',
    'col.player': 'Player',
    'col.status': 'Status',
    'col.connected': 'Connected',
    'col.windows': 'Windows',
    'col.last': 'Last action',
    'col.first': 'First seen',
    'col.seen': 'Last seen',
    'col.sessions': 'Sessions',
    'col.playtime': 'Playtime',
    'col.games': 'Games',
    'col.tables': 'Tables',
    'col.watched': 'Watched',
    'col.fails': 'Failed logins',
    'col.time': 'Time',
    'col.event': 'Event',
    'col.detail': 'Detail',
    'col.count': 'Count',
    'col.source': 'Source',
    'col.message': 'Message',
    'place.playing': 'Playing',
    'place.table': 'At a table',
    'place.watching': 'Watching',
    'place.lobby': 'In lobby',
    'place.away': 'Reconnecting',
    'svc.proxy': 'Nexus proxy',
    'svc.proxySub': 'Web client + WebSocket gateway',
    'svc.playit': 'playit tunnel',
    'svc.playitSub': 'Public access for players',
    'svc.xmage': 'XMage server',
    'svc.web': 'Local web client',
    'svc.down': 'no response',
    'svc.restarts': '{n} restarts',
    cpu: 'CPU',
    memory: 'Memory',
    disk: 'Disk',
    load: 'Load',
    'range.24h': '24 h',
    'range.7d': '7 days',
    'range.30d': '30 days',
    'range.90d': '90 days',
    'range.all': 'All',
    'kpi.users': 'Unique players',
    'kpi.newUsers': 'New players',
    'kpi.games': 'Games played',
    'kpi.tables': 'Tables created',
    'kpi.playtime': 'Total playtime',
    'kpi.median': 'Median session {d}',
    'kpi.peak': 'Peak concurrent',
    'kpi.loginRate': 'Login success',
    'kpi.loginRateSub': '{ok} ok · {fail} failed',
    'kpi.visitors': 'Public visitors',
    vsPrev: 'vs previous period',
    new: 'new',
    'chart.active': 'Active players',
    'chart.activeSub': 'Distinct players with activity',
    'chart.peak': 'Peak concurrent players',
    'chart.peakSub': 'Highest number online at once',
    'chart.games': 'Games played',
    'chart.gamesSub': 'Distinct games joined through the proxy',
    'chart.logins': 'Logins',
    'chart.loginsSub': 'Successful vs failed attempts',
    'chart.newUsers': 'New players',
    'chart.newUsersSub': 'First successful login',
    'chart.visitors': 'Public visitors',
    'chart.visitorsSub': 'Unique IPs reaching the playit tunnel',
    'chart.heat': 'When people play',
    'chart.heatSub': 'Players active per weekday and hour (local time)',
    'chart.gameTypes': 'Game types',
    'chart.gameTypesSub': 'Tables created by type',
    'chart.fails': 'Why logins fail',
    'chart.failsSub': 'Grouped server replies',
    'chart.actions': 'Most used actions',
    'chart.actionsSub': 'Lobby and game commands',
    'chart.ends': 'How sessions end',
    'chart.endsSub': 'Session close reasons',
    'series.ok': 'Successful',
    'series.fail': 'Failed',
    'series.xmage': 'XMage server',
    'series.web': 'Local web',
    less: 'Less',
    more: 'More',
    table: 'Table',
    chart: 'Chart',
    searchPlayers: 'Search players…',
    playersCount: '{n} players',
    onlineBadge: 'online',
    'logs.proxy': 'Proxy',
    'logs.playit': 'playit',
    'logs.clean': 'Clean',
    'logs.all': 'Everything',
    'logs.activity': 'Activity',
    'logs.problems': 'Problems',
    'logs.search': 'Search logs…',
    'logs.follow': 'Live',
    'logs.bottom': 'Jump to latest',
    'logs.count': '{n} lines',
    'logs.stack': 'Stack trace ({n} lines)',
    'logs.paused': 'Paused',
    'logs.following': 'Following live',
    'sys.cpu': 'Host CPU',
    'sys.cpuSub': 'All cores, %',
    'sys.mem': 'Host memory',
    'sys.memSub': 'Used memory',
    'sys.rss': 'Proxy memory',
    'sys.rssSub': 'Java process resident memory',
    'sys.pcpu': 'Proxy CPU',
    'sys.pcpuSub': '% of one core',
    'sys.latency': 'Response time',
    'sys.latencySub': 'Connect time, ms',
    'sys.online': 'Players online',
    'sys.onlineSub': 'Sampled every 30 s',
    'sys.history': 'Service history',
    'sys.historySub': 'Proxy starts, stops and crashes',
    'sys.problemGroups': 'Top problems',
    'sys.problemGroupsSub': 'Grouped by message in this period',
    'sys.storage': 'Status service',
    'sys.dbSize': 'Database',
    'sys.events': 'Events indexed',
    'sys.since': 'History since',
    'sys.samples': 'Samples',
    'sys.allow': 'Allowed networks',
    'sys.hostUptime': 'Host uptime',
    'sys.loadSub': '1 / 5 / 15 min · {n} cores',
    'life.boot': 'Proxy started',
    'life.stopped': 'Stopped',
    'life.exited': 'Process exited',
    'life.failed': 'Failed',
    'life.restart': 'Automatic restart',
    'life.consumed': 'Resources used',
    privacy: 'Local network only · not published through playit · data since {since}',
    'ev.login_ok': 'signed in',
    'ev.login_fail': 'failed to sign in',
    'ev.session_end': 'left',
    'ev.ws_rejected': 'Connection rejected',
    'act.createTable': 'created a table',
    'act.createTournamentTable': 'created a tournament',
    'act.joinTable': 'joined a table',
    'act.joinTournamentTable': 'joined a tournament',
    'act.joinTournament': 'entered a tournament',
    'act.joinGame': 'started playing',
    'act.joinDraft': 'joined a draft',
    'act.watchGame': 'is watching a game',
    'act.watchTable': 'is watching a table',
    'act.watchTournamentTable': 'is watching a tournament',
    'act.stopWatching': 'stopped watching',
    'act.quitMatch': 'conceded / left a match',
    'act.startMatch': 'started a match',
    'act.leaveTable': 'left a table',
    'act.removeTable': 'removed a table',
    'act.sendChatMessage': 'sent a chat message',
    'act.fetchOnlineDeck': 'imported a deck',
    'act.submitDeck': 'submitted a deck',
    'act.validateDeck': 'validated a deck',
    'act.updatePreferences': 'updated preferences',
    'reason.grace_expired': 'Did not come back (grace expired)',
    'reason.disconnect': 'Signed out',
    after: 'after {d}',
  },
  es: {
    subtitle: 'Estado del servidor',
    'tab.now': 'Ahora',
    'tab.stats': 'Estadísticas',
    'tab.players': 'Jugadores',
    'tab.logs': 'Registros',
    'tab.system': 'Sistema',
    'pill.proxy': 'Proxy',
    'pill.tunnel': 'Túnel',
    'pill.xmage': 'Servidor XMage',
    'pill.web': 'Web',
    updated: 'Actualizado {ago}',
    offline: 'No hay conexión con el servicio de estado. Reintentando…',
    catchingUp: 'Indexando el historial de registros… las cifras se asentarán enseguida.',
    onlineNow: 'Jugadores conectados ahora',
    heroSub: '{grace} reconectando · {conns} conexiones abiertas',
    heroPeak: 'Pico 24 h: {peak} · histórico: {all}',
    'tile.users24': 'Jugadores en las últimas 24 h',
    'tile.games24': 'Partidas en las últimas 24 h',
    'tile.visitors24': 'Visitantes públicos (24 h)',
    'tile.visitorsSub': 'IPs únicas por el túnel de playit',
    'tile.problems24': 'Problemas (24 h)',
    'tile.problemsSub': '{e} errores · {w} avisos',
    'tile.uptime': 'Proxy en marcha',
    'tile.uptimeSub': 'Desde {when}',
    connected: 'Jugadores conectados',
    connectedSub: 'Sesiones en vivo en el proxy',
    services: 'Servicios',
    host: 'Máquina',
    recent: 'Actividad reciente',
    problems: 'Problemas recientes',
    noOne: 'No hay nadie conectado ahora mismo.',
    noProblems: 'Sin problemas registrados. Todo tranquilo.',
    noData: 'Sin datos en este periodo.',
    'col.player': 'Jugador',
    'col.status': 'Estado',
    'col.connected': 'Conectado',
    'col.windows': 'Ventanas',
    'col.last': 'Última acción',
    'col.first': 'Primera vez',
    'col.seen': 'Última vez',
    'col.sessions': 'Sesiones',
    'col.playtime': 'Tiempo de juego',
    'col.games': 'Partidas',
    'col.tables': 'Mesas',
    'col.watched': 'Espectador',
    'col.fails': 'Logins fallidos',
    'col.time': 'Hora',
    'col.event': 'Evento',
    'col.detail': 'Detalle',
    'col.count': 'Veces',
    'col.source': 'Origen',
    'col.message': 'Mensaje',
    'place.playing': 'Jugando',
    'place.table': 'En una mesa',
    'place.watching': 'Mirando',
    'place.lobby': 'En el lobby',
    'place.away': 'Reconectando',
    'svc.proxy': 'Proxy Nexus',
    'svc.proxySub': 'Cliente web + pasarela WebSocket',
    'svc.playit': 'Túnel playit',
    'svc.playitSub': 'Acceso público de los jugadores',
    'svc.xmage': 'Servidor XMage',
    'svc.web': 'Cliente web local',
    'svc.down': 'sin respuesta',
    'svc.restarts': '{n} reinicios',
    cpu: 'CPU',
    memory: 'Memoria',
    disk: 'Disco',
    load: 'Carga',
    'range.24h': '24 h',
    'range.7d': '7 días',
    'range.30d': '30 días',
    'range.90d': '90 días',
    'range.all': 'Todo',
    'kpi.users': 'Jugadores únicos',
    'kpi.newUsers': 'Jugadores nuevos',
    'kpi.games': 'Partidas jugadas',
    'kpi.tables': 'Mesas creadas',
    'kpi.playtime': 'Tiempo total de juego',
    'kpi.median': 'Sesión mediana {d}',
    'kpi.peak': 'Pico simultáneo',
    'kpi.loginRate': 'Logins correctos',
    'kpi.loginRateSub': '{ok} correctos · {fail} fallidos',
    'kpi.visitors': 'Visitantes públicos',
    vsPrev: 'vs periodo anterior',
    new: 'nuevo',
    'chart.active': 'Jugadores activos',
    'chart.activeSub': 'Jugadores distintos con actividad',
    'chart.peak': 'Pico de jugadores simultáneos',
    'chart.peakSub': 'Máximo conectados a la vez',
    'chart.games': 'Partidas jugadas',
    'chart.gamesSub': 'Partidas distintas a través del proxy',
    'chart.logins': 'Inicios de sesión',
    'chart.loginsSub': 'Correctos frente a fallidos',
    'chart.newUsers': 'Jugadores nuevos',
    'chart.newUsersSub': 'Primer login correcto',
    'chart.visitors': 'Visitantes públicos',
    'chart.visitorsSub': 'IPs únicas que llegan por el túnel de playit',
    'chart.heat': 'Cuándo se juega',
    'chart.heatSub': 'Jugadores activos por día de la semana y hora (hora local)',
    'chart.gameTypes': 'Tipos de partida',
    'chart.gameTypesSub': 'Mesas creadas por tipo',
    'chart.fails': 'Por qué fallan los logins',
    'chart.failsSub': 'Respuestas del servidor agrupadas',
    'chart.actions': 'Acciones más usadas',
    'chart.actionsSub': 'Comandos de lobby y partida',
    'chart.ends': 'Cómo terminan las sesiones',
    'chart.endsSub': 'Motivos de cierre de sesión',
    'series.ok': 'Correctos',
    'series.fail': 'Fallidos',
    'series.xmage': 'Servidor XMage',
    'series.web': 'Web local',
    less: 'Menos',
    more: 'Más',
    table: 'Tabla',
    chart: 'Gráfico',
    searchPlayers: 'Buscar jugadores…',
    playersCount: '{n} jugadores',
    onlineBadge: 'conectado',
    'logs.proxy': 'Proxy',
    'logs.playit': 'playit',
    'logs.clean': 'Limpio',
    'logs.all': 'Todo',
    'logs.activity': 'Actividad',
    'logs.problems': 'Problemas',
    'logs.search': 'Buscar en los registros…',
    'logs.follow': 'En directo',
    'logs.bottom': 'Ir al final',
    'logs.count': '{n} líneas',
    'logs.stack': 'Traza ({n} líneas)',
    'logs.paused': 'En pausa',
    'logs.following': 'Siguiendo en directo',
    'sys.cpu': 'CPU de la máquina',
    'sys.cpuSub': 'Todos los núcleos, %',
    'sys.mem': 'Memoria de la máquina',
    'sys.memSub': 'Memoria usada',
    'sys.rss': 'Memoria del proxy',
    'sys.rssSub': 'Memoria residente del proceso Java',
    'sys.pcpu': 'CPU del proxy',
    'sys.pcpuSub': '% de un núcleo',
    'sys.latency': 'Tiempo de respuesta',
    'sys.latencySub': 'Tiempo de conexión, ms',
    'sys.online': 'Jugadores conectados',
    'sys.onlineSub': 'Muestreado cada 30 s',
    'sys.history': 'Historial del servicio',
    'sys.historySub': 'Arranques, paradas y caídas del proxy',
    'sys.problemGroups': 'Problemas más frecuentes',
    'sys.problemGroupsSub': 'Agrupados por mensaje en este periodo',
    'sys.storage': 'Servicio de estado',
    'sys.dbSize': 'Base de datos',
    'sys.events': 'Eventos indexados',
    'sys.since': 'Historial desde',
    'sys.samples': 'Muestras',
    'sys.allow': 'Redes permitidas',
    'sys.hostUptime': 'Máquina encendida',
    'sys.loadSub': '1 / 5 / 15 min · {n} núcleos',
    'life.boot': 'Proxy arrancado',
    'life.stopped': 'Detenido',
    'life.exited': 'Proceso terminado',
    'life.failed': 'Fallo',
    'life.restart': 'Reinicio automático',
    'life.consumed': 'Recursos usados',
    privacy: 'Solo red local · no publicado por playit · datos desde {since}',
    'ev.login_ok': 'entró',
    'ev.login_fail': 'no pudo entrar',
    'ev.session_end': 'salió',
    'ev.ws_rejected': 'Conexión rechazada',
    'act.createTable': 'creó una mesa',
    'act.createTournamentTable': 'creó un torneo',
    'act.joinTable': 'se unió a una mesa',
    'act.joinTournamentTable': 'se unió a un torneo',
    'act.joinTournament': 'entró en un torneo',
    'act.joinGame': 'empezó a jugar',
    'act.joinDraft': 'entró en un draft',
    'act.watchGame': 'está mirando una partida',
    'act.watchTable': 'está mirando una mesa',
    'act.watchTournamentTable': 'está mirando un torneo',
    'act.stopWatching': 'dejó de mirar',
    'act.quitMatch': 'abandonó una partida',
    'act.startMatch': 'empezó una partida',
    'act.leaveTable': 'dejó una mesa',
    'act.removeTable': 'eliminó una mesa',
    'act.sendChatMessage': 'escribió en el chat',
    'act.fetchOnlineDeck': 'importó un mazo',
    'act.submitDeck': 'envió un mazo',
    'act.validateDeck': 'validó un mazo',
    'act.updatePreferences': 'cambió sus preferencias',
    'reason.grace_expired': 'No volvió (expiró la gracia)',
    'reason.disconnect': 'Cerró sesión',
    after: 'tras {d}',
  },
};

const pref = {
  get(k) {
    try {
      return localStorage.getItem(`xmage-status.${k}`);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`xmage-status.${k}`, v);
    } catch {
    }
  },
};

let lang = pref.get('lang') || ((navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en');
const locale = () => (lang === 'es' ? 'es-ES' : 'en-GB');

function t(key, vars) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : s;
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const fmt = {
  int: n => (n == null ? '–' : new Intl.NumberFormat(locale()).format(Math.round(n))),
  compact: n => (n == null ? '–' : new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)),
  pct: n => (n == null ? '–' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n)} %`),
  ms: n => (n == null ? '–' : `${Math.round(n)} ms`),
  bytes(n) {
    if (n == null) return '–';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: n < 10 && i > 0 ? 1 : 0 }).format(n)} ${u[i]}`;
  },
  dur(sec) {
    if (sec == null || !Number.isFinite(sec)) return '–';
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / 86400);
    const hh = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d) return `${d} d ${hh} h`;
    if (hh) return `${hh} h ${m} min`;
    if (m) return `${m} min`;
    return `${sec} s`;
  },
  ago(ts) {
    if (!ts) return '–';
    const diff = (ts - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' });
    const a = Math.abs(diff);
    if (a < 45) return rtf.format(Math.round(diff), 'second');
    if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  },
  time: ts => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(ts),
  timeSec: ts => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ts),
  day: ts => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(ts),
  dayLong: ts => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(ts),
  dateTime: ts => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ts),
  logTime: ts => {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? fmt.timeSec(ts) : `${new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit' }).format(ts)} ${fmt.time(ts)}`;
  },
};

const tip = document.getElementById('tip');

function showTip(ev, content) {
  tip.replaceChildren(...content);
  tip.hidden = false;
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

function hideTip() {
  tip.hidden = true;
}

function tipRows(title, rows) {
  return [
    h('div', { class: 'tip-title' }, title),
    ...rows.map(r => h('div', { class: 'tip-row' },
      r.color ? h('span', { class: 'key-line', style: `background:${r.color}` }) : null,
      h('b', null, r.value),
      r.label ? h('span', null, r.label) : null)),
  ];
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function niceStep(raw, integer) {
  if (integer && raw <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * exp >= raw) return m * exp;
  return 10 * exp;
}

function niceScale(v, integer = true) {
  const top = Math.max(v, integer ? 1 : Number.EPSILON);
  const step = niceStep(top / 4, integer);
  const max = Math.ceil(top / step) * step;
  const ticks = [];
  for (let x = 0; x <= max + step / 2; x += step) ticks.push(x);
  return { max, ticks };
}

function roundTopBar(x, y, w, hgt, r) {
  r = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

const observers = new Map();

function observe(view, el, draw) {
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(el.clientWidth);
    if (w && w !== lastW) {
      lastW = w;
      draw(w);
    }
  });
  ro.observe(el);
  if (!observers.has(view)) observers.set(view, []);
  observers.get(view).push(ro);
}

function disposeView(view) {
  for (const ro of observers.get(view) || []) ro.disconnect();
  observers.set(view, []);
}

function columnChart(view, el, { ts, hourly, series, format = fmt.int }) {
  observe(view, el, W => {
    const H = 190;
    const m = { l: 38, r: 6, t: 10, b: 24 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = ts.length;
    const totals = ts.map((_, i) => series.reduce((a, sr) => a + (sr.values[i] || 0), 0));
    const { max, ticks: yt } = niceScale(Math.max(...totals, 0));
    const band = iw / Math.max(1, n);
    const bw = Math.max(1, Math.min(24, band - 2));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img' });
    for (const tv of yt) {
      const y = m.t + ih - (tv / max) * ih;
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: tv === 0 ? cssVar('--axis') : cssVar('--grid'), 'stroke-width': 1 }));
      svg.append(s('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, format(tv)));
    }
    const every = Math.max(1, Math.ceil(64 / band));
    for (let i = 0; i < n; i++) {
      const x = m.l + i * band + (band - bw) / 2;
      let base = m.t + ih;
      const visible = series.map(sr => sr.values[i] || 0);
      const topIdx = visible.reduce((acc, v, j) => (v > 0 ? j : acc), -1);
      series.forEach((sr, j) => {
        const v = visible[j];
        if (!v) return;
        const hgt = (v / max) * ih;
        const gap = j < topIdx ? 2 : 0;
        const y = base - hgt;
        const drawH = Math.max(1, hgt - gap);
        const shape = j === topIdx
          ? s('path', { d: roundTopBar(x, y, bw, drawH, 4), fill: sr.color })
          : s('rect', { x, y: y + gap, width: bw, height: drawH, fill: sr.color });
        svg.append(shape);
        base = y;
      });
      if (i % every === 0) {
        svg.append(s('text', { x: m.l + i * band + band / 2, y: H - 6, 'text-anchor': 'middle' }, hourly ? fmt.time(ts[i]) : fmt.day(ts[i])));
      }
      const hit = s('rect', { x: m.l + i * band, y: m.t, width: band, height: ih, fill: 'transparent' });
      hit.addEventListener('pointermove', ev => {
        hit.setAttribute('fill', 'color-mix(in srgb, currentColor 6%, transparent)');
        const title = hourly ? `${fmt.dayLong(ts[i])} · ${fmt.time(ts[i])}` : fmt.dayLong(ts[i]);
        showTip(ev, tipRows(title, series.map(sr => ({ color: sr.color, value: format(sr.values[i] || 0), label: series.length > 1 ? sr.name : '' }))));
      });
      hit.addEventListener('pointerleave', () => {
        hit.setAttribute('fill', 'transparent');
        hideTip();
      });
      svg.append(hit);
    }
    el.replaceChildren(svg);
  });
}

function lineChart(view, el, { series, from, to, step = false, height = 190, format = fmt.int, yMax, compact = false, area = true, integer = true, unit = 1 }) {
  observe(view, el, W => {
    const H = height;
    const m = compact ? { l: 2, r: 2, t: 4, b: 2 } : { l: 44, r: 8, t: 10, b: 24 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const vals = series.flatMap(sr => sr.points.map(p => p[1]).filter(v => v != null));
    const base = niceScale(Math.max(0, yMax ?? 0, ...vals) / unit, integer && unit === 1);
    const scale = { max: yMax ?? base.max * unit, ticks: base.ticks.map(x => x * unit).filter(x => yMax == null || x <= yMax + 1e-9) };
    const max = scale.max;
    const X = tt => m.l + ((tt - from) / Math.max(1, to - from)) * iw;
    const Y = v => m.t + ih - (Math.min(v, max) / max) * ih;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img' });
    if (!compact) {
      for (const tv of scale.ticks) {
        const y = Y(tv);
        svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: tv === 0 ? cssVar('--axis') : cssVar('--grid'), 'stroke-width': 1 }));
        svg.append(s('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, format(tv)));
      }
      const span = to - from;
      const count = Math.max(2, Math.floor(iw / 90));
      for (let i = 0; i <= count; i++) {
        const tt = from + (span / count) * i;
        const label = span <= 2 * 86400000 ? fmt.time(tt) : fmt.day(tt);
        svg.append(s('text', { x: X(tt), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === count ? 'end' : 'middle' }, label));
      }
    }
    for (const sr of series) {
      const segs = [];
      let cur = [];
      for (const p of sr.points) {
        if (p[1] == null) {
          if (cur.length) segs.push(cur);
          cur = [];
        } else cur.push(p);
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        let d = '';
        seg.forEach((p, i) => {
          const x = X(p[0]);
          const y = Y(p[1]);
          if (i === 0) d += `M${x},${y}`;
          else if (step) d += `H${x}V${y}`;
          else d += `L${x},${y}`;
        });
        if (area && series.length === 1) {
          svg.append(s('path', { d: `${d}V${m.t + ih}H${X(seg[0][0])}Z`, fill: sr.color, 'fill-opacity': 0.1 }));
        }
        svg.append(s('path', { d, fill: 'none', stroke: sr.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
      const lastSeg = segs[segs.length - 1];
      if (!compact && lastSeg) {
        const p = lastSeg[lastSeg.length - 1];
        svg.append(s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: sr.color, stroke: cssVar('--surface'), 'stroke-width': 2 }));
      }
    }
    const cross = s('line', { y1: m.t, y2: m.t + ih, stroke: cssVar('--axis'), 'stroke-width': 1, visibility: 'hidden' });
    const dots = series.map(sr => s('circle', { r: 4, fill: sr.color, stroke: cssVar('--surface'), 'stroke-width': 2, visibility: 'hidden' }));
    svg.append(cross, ...dots);
    const hit = s('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' });
    hit.addEventListener('pointermove', ev => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      const tt = from + ((px - m.l) / iw) * (to - from);
      const rows = [];
      let snapT = tt;
      series.forEach((sr, j) => {
        let best = null;
        if (step) {
          for (const p of sr.points) if (p[0] <= tt) best = p;
        } else {
          let bd = Infinity;
          for (const p of sr.points) {
            const d = Math.abs(p[0] - tt);
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          if (best && j === 0) snapT = best[0];
        }
        if (best && best[1] != null) {
          dots[j].setAttribute('cx', X(step ? tt : best[0]));
          dots[j].setAttribute('cy', Y(best[1]));
          dots[j].setAttribute('visibility', 'visible');
        } else dots[j].setAttribute('visibility', 'hidden');
        rows.push({ color: sr.color, value: best && best[1] != null ? format(best[1]) : '–', label: series.length > 1 ? sr.name : '' });
      });
      const cx = X(step ? tt : snapT);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      showTip(ev, tipRows(fmt.dateTime(step ? tt : snapT), rows));
    });
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach(d => d.setAttribute('visibility', 'hidden'));
      hideTip();
    });
    svg.append(hit);
    el.replaceChildren(svg);
  });
}

function hbars(rows, { format = fmt.int, label = r => r.label } = {}) {
  if (!rows.length) return h('div', { class: 'empty' }, t('noData'));
  const max = Math.max(...rows.map(r => r.v), 1);
  return h('div', { class: 'hbars' }, rows.map(r => {
    const text = label(r);
    const row = h('div', { class: 'hbar' },
      h('div', { class: 'hbar-label', title: text }, text),
      h('div', { class: 'hbar-track' }, h('div', { class: 'hbar-fill', style: `width:${(r.v / max) * 100}%` })),
      h('div', { class: 'hbar-val' }, format(r.v)));
    row.addEventListener('pointermove', ev => showTip(ev, tipRows(text, [{ color: cssVar('--s1'), value: format(r.v) }])));
    row.addEventListener('pointerleave', hideTip);
    return row;
  }));
}

function weekdayNames() {
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(new Date(base.getTime() + i * 86400000)));
}

function heatmap(matrix) {
  const max = Math.max(1, ...matrix.flat());
  const days = weekdayNames();
  const grid = h('div', { class: 'heat' }, h('div'));
  for (let hr = 0; hr < 24; hr++) grid.append(h('div', { class: 'hh' }, hr % 3 === 0 ? String(hr).padStart(2, '0') : ''));
  matrix.forEach((row, d) => {
    grid.append(h('div', { class: 'hl' }, days[d]));
    row.forEach((v, hr) => {
      const pct = v ? Math.round(14 + (v / max) * 86) : 0;
      const cell = h('div', { class: 'cell', style: v ? `background:color-mix(in oklab, var(--s1) ${pct}%, var(--surface))` : '' });
      cell.addEventListener('pointermove', ev => showTip(ev, tipRows(`${days[d]} · ${String(hr).padStart(2, '0')}:00–${String((hr + 1) % 24).padStart(2, '0')}:00`,
        [{ color: cssVar('--s1'), value: fmt.int(v), label: t('chart.active').toLowerCase() }])));
      cell.addEventListener('pointerleave', hideTip);
      grid.append(cell);
    });
  });
  return h('div', null, grid, h('div', { class: 'heat-legend' }, t('less'), h('span', { class: 'ramp' }), t('more')));
}

function dataTable(cols, rows) {
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.r ? 'r' : null }, c.label)))),
    h('tbody', null, rows.map(r => h('tr', null, cols.map(c => h('td', { class: c.r ? 'r' : null }, c.get(r))))))));
}

function card({ title, sub, legend, body, table, cls = '' }) {
  const bodyEl = h('div', { class: 'chart-body' }, body);
  const tableEl = h('div', { class: 'chart-table', hidden: true });
  let btn = null;
  if (table) {
    btn = h('button', { class: 'ghost', type: 'button' }, t('table'));
    btn.addEventListener('click', () => {
      const showTable = tableEl.hidden;
      tableEl.hidden = !showTable;
      bodyEl.hidden = showTable;
      if (legend) legendEl.hidden = showTable;
      btn.textContent = showTable ? t('chart') : t('table');
      if (showTable) tableEl.replaceChildren(table());
    });
  }
  const legendEl = legend ? h('div', { class: 'legend' }, legend.map(l => h('span', null,
    h('span', { class: l.line ? 'key-line' : 'key-rect', style: `background:${l.color}` }), l.name))) : null;
  return {
    el: h('section', { class: `card ${cls}` },
      h('header', { class: 'card-head' }, h('div', null, h('h3', null, title), sub ? h('p', { class: 'muted' }, sub) : null), btn),
      legendEl, bodyEl, tableEl),
    body: bodyEl,
  };
}

function tile({ label, value, sub, delta, icon }) {
  return h('section', { class: 'card tile' },
    h('div', { class: 'tile-label' }, icon, label),
    h('div', { class: 'tile-value' }, value),
    delta || sub ? h('div', { class: 'tile-sub' }, delta, delta && sub ? ' · ' : null, sub) : null);
}

function statusIcon(level) {
  const color = level === 'critical' ? 'var(--critical)' : level === 'warning' ? 'var(--warning)' : 'var(--good)';
  const path = level === 'good' ? 'M5 10.5l3 3 7-7' : level === 'warning' ? 'M10 5v6M10 14.5v.5' : 'M6.5 6.5l7 7M13.5 6.5l-7 7';
  return s('svg', { viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true' },
    s('circle', { cx: 10, cy: 10, r: 9, fill: color }),
    s('path', { d: path, stroke: level === 'warning' ? '#1a1a19' : '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none' }));
}

const AVATAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#008300', '#4a3aa7', '#e34948'];

function avatar(name) {
  let hsh = 0;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return h('span', { class: 'avatar', style: `background:${AVATAR_COLORS[hsh % AVATAR_COLORS.length]}`, 'aria-hidden': 'true' }, name.slice(0, 2).toUpperCase());
}

function placeBadge(u) {
  const key = u.windows > 0 ? u.place : 'away';
  const cls = key === 'playing' ? 'good' : key === 'away' ? 'warning' : '';
  return h('span', { class: 'badge' }, h('span', { class: `dot ${cls}` }), t(`place.${key}`));
}

function actionText(a) {
  const k = `act.${a}`;
  const txt = t(k);
  return txt === k ? a : txt;
}

const state = {
  tab: 'now',
  range: pref.get('range') || '30d',
  sysRange: pref.get('sysRange') || '24h',
  live: null,
  liveAt: 0,
  liveError: false,
  stats: null,
  players: null,
  system: null,
  playerSort: { key: 'seconds', dir: -1 },
  playerQ: '',
  logs: { source: 'proxy', view: 'clean', q: '', follow: true, records: [], cursor: null, busy: false },
};

async function api(p) {
  const r = await fetch(p, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function applyTheme() {
  const th = pref.get('theme');
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
}

function applyStaticI18n() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  document.getElementById('lang-btn').textContent = lang === 'es' ? 'EN' : 'ES';
}

function renderPills() {
  const L = state.live;
  const box = document.getElementById('pills');
  if (!L) return box.replaceChildren();
  const svcLevel = st => (st === 'active' ? 'good' : st === 'activating' || st === 'reloading' ? 'warning' : st === 'unknown' ? '' : 'critical');
  const proxyUp = L.proxy?.state === 'active' || (L.proxy?.state === 'unknown' && L.proxy?.running);
  const pills = [
    { label: t('pill.proxy'), level: proxyUp ? 'good' : svcLevel(L.proxy?.state), val: proxyUp ? fmt.dur((Date.now() - (L.proxy.since || L.proxy.bootTs)) / 1000) : L.proxy?.state },
    { label: t('pill.tunnel'), level: svcLevel(L.playit?.state), val: L.playit?.state === 'active' ? '' : L.playit?.state },
    { label: t('pill.xmage'), level: L.xmage.ms == null ? 'critical' : L.xmage.ms > 400 ? 'warning' : 'good', val: L.xmage.ms == null ? t('svc.down') : fmt.ms(L.xmage.ms) },
    { label: t('pill.web'), level: L.web.ms == null ? 'critical' : 'good', val: L.web.ms == null ? t('svc.down') : fmt.ms(L.web.ms) },
  ];
  box.replaceChildren(...pills.map(p => h('span', { class: 'pill' },
    h('span', { class: `dot ${p.level} ${p.level === 'good' ? 'pulse' : ''}` }), h('b', null, p.label), p.val ? h('span', { class: 'val' }, p.val) : null)));
}

function renderUpdated() {
  const el = document.getElementById('updated');
  el.textContent = state.liveAt ? t('updated', { ago: fmt.ago(state.liveAt) }) : '';
}

function renderBanner() {
  const b = document.getElementById('banner');
  b.classList.toggle('info', !state.liveError);
  if (state.liveError) {
    b.textContent = t('offline');
    b.hidden = false;
  } else if (state.live?.ingest?.catchingUp) {
    b.textContent = t('catchingUp');
    b.hidden = false;
  } else b.hidden = true;
}

function renderFoot() {
  const since = state.system?.storage?.since || null;
  const foot = document.getElementById('foot');
  foot.replaceChildren(
    s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }), s('path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' })),
    t('privacy', { since: since ? fmt.day(since) : '…' }));
}

function renderNow() {
  const L = state.live;
  const view = document.getElementById('view-now');
  if (!L) return;
  nowSig = liveSignature(L);
  nowAt = Date.now();
  disposeView('now');
  const c = L.counts;
  const heroSpark = h('div', { class: 'hero-spark chart-body' });
  const hero = h('section', { class: 'card hero' },
    h('div', { class: 'hero-label' }, t('onlineNow')),
    h('div', { class: 'hero-value num' }, fmt.int(c.online)),
    h('div', { class: 'hero-sub' }, t('heroSub', { grace: fmt.int(c.grace), conns: fmt.int(c.conns) })),
    heroSpark,
    h('div', { class: 'tile-sub' }, t('heroPeak', { peak: fmt.int(L.day.peak), all: fmt.int(L.peakAll) })));
  lineChart('now', heroSpark, { series: [{ name: t('onlineNow'), color: cssVar('--s1'), points: L.onlineSeries }], from: L.now - 86400000, to: L.now, step: true, height: 72, compact: true, yMax: Math.max(2, L.day.peak || 0) });

  const probLevel = L.day.errors > 0 ? 'critical' : L.day.warnings > 0 ? 'warning' : 'good';
  const upSince = L.proxy.since || L.proxy.bootTs;
  const tiles = h('div', { class: 'grid-2 tiles' },
    tile({ label: t('tile.users24'), value: fmt.int(L.day.users) }),
    tile({ label: t('tile.games24'), value: fmt.int(L.day.games) }),
    tile({ label: t('tile.visitors24'), value: fmt.int(L.day.visitors), sub: t('tile.visitorsSub') }),
    tile({ label: t('tile.problems24'), icon: statusIcon(probLevel), value: fmt.int(L.day.errors + L.day.warnings), sub: t('tile.problemsSub', { e: fmt.int(L.day.errors), w: fmt.int(L.day.warnings) }) }));

  const usersBody = L.users.length ? dataTable([
    { label: t('col.player'), get: u => h('div', { class: 'user-cell' }, avatar(u.user), u.user) },
    { label: t('col.status'), get: u => placeBadge(u) },
    { label: t('col.connected'), get: u => h('span', { class: 'num', title: fmt.dateTime(u.since) }, fmt.dur((L.now - u.since) / 1000)) },
    { label: t('col.windows'), r: true, get: u => fmt.int(u.windows) },
    { label: t('col.last'), get: u => u.lastAction ? h('span', null, actionText(u.lastAction), ' ', h('span', { class: 'muted' }, fmt.ago(u.lastActionTs))) : h('span', { class: 'muted' }, '–') },
  ], L.users) : h('div', { class: 'empty' }, t('noOne'));
  const usersCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('div', null, h('h3', null, t('connected')), h('p', { class: 'muted' }, t('connectedSub')))),
    usersBody);

  const H = L.host || {};
  const meter = (label, used, total, text) => {
    const pct = total ? Math.min(100, (used / total) * 100) : used ?? 0;
    const cls = pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : '';
    return h('div', { class: 'meter' },
      h('div', { class: 'meter-top' }, h('span', null, label), h('span', null, text)),
      h('div', { class: 'meter-track' }, h('div', { class: `meter-fill ${cls}`, style: `width:${pct}%` })));
  };
  const svcRow = (level, name, sub, val) => h('div', { class: 'svc-row' }, h('span', { class: `dot ${level}` }), h('div', null, h('div', { class: 'svc-name' }, name), h('div', { class: 'svc-sub' }, sub)), h('div', { class: 'svc-val' }, val));
  const proxyUp = L.proxy.state === 'active' || (L.proxy.state === 'unknown' && L.proxy.running);
  const svcCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', null, t('services'))),
    h('div', { class: 'svc' },
      svcRow(proxyUp ? 'good' : 'critical', t('svc.proxy'), t('svc.proxySub'), h('span', null, proxyUp ? fmt.dur((L.now - upSince) / 1000) : L.proxy.state, h('br'), h('span', { class: 'muted' }, t('svc.restarts', { n: fmt.int(L.proxy.restarts || 0) })))),
      svcRow(L.playit?.state === 'active' ? 'good' : 'critical', t('svc.playit'), t('svc.playitSub'), L.playit?.since ? fmt.dur((L.now - L.playit.since) / 1000) : L.playit?.state || '–'),
      svcRow(L.xmage.ms == null ? 'critical' : 'good', t('svc.xmage'), `${L.xmage.host}:${L.xmage.port}`, L.xmage.ms == null ? t('svc.down') : fmt.ms(L.xmage.ms)),
      svcRow(L.web.ms == null ? 'critical' : 'good', t('svc.web'), L.web.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), L.web.ms == null ? t('svc.down') : fmt.ms(L.web.ms))),
    h('header', { class: 'card-head', style: 'margin-top:14px' }, h('h3', null, t('host'))),
    meter(t('cpu'), H.cpu, 100, fmt.pct(H.cpu)),
    meter(t('memory'), H.memUsed, H.memTotal, `${fmt.bytes(H.memUsed)} / ${fmt.bytes(H.memTotal)}`),
    meter(t('disk'), H.diskUsed, H.diskTotal, `${fmt.bytes(H.diskUsed)} / ${fmt.bytes(H.diskTotal)}`));

  const feed = L.recent.length ? h('ul', { class: 'feed scroll' }, L.recent.slice(0, 40).map(e => {
    let icon = '•';
    let txt;
    if (e.type === 'login_ok') {
      icon = '→';
      txt = [h('b', null, e.user), ' ', t('ev.login_ok')];
    } else if (e.type === 'login_fail') {
      icon = '✕';
      txt = [h('b', null, e.user || '?'), ' ', t('ev.login_fail'), h('div', { class: 'extra' }, (e.kv.reason || '').replace(/^Error while connecting to server\s*/i, ''))];
    } else if (e.type === 'session_end') {
      icon = '←';
      txt = [h('b', null, e.user || '?'), ' ', t('ev.session_end'), e.kv.duration_s ? h('span', { class: 'muted' }, ' ', t('after', { d: fmt.dur(Number(e.kv.duration_s)) })) : null];
    } else if (e.type === 'ws_rejected') {
      icon = '⛔';
      txt = [t('ev.ws_rejected'), h('div', { class: 'extra' }, e.kv.origin || '')];
    } else {
      icon = e.action === 'joinGame' ? '⚔' : e.action === 'sendChatMessage' ? '💬' : e.action?.startsWith('watch') ? '👁' : '·';
      const detail = e.kv.gameType || e.kv.deckName || '';
      txt = [h('b', null, e.user || '?'), ' ', actionText(e.action), detail ? h('span', { class: 'muted' }, ` · ${detail}`) : null];
    }
    return h('li', null, h('time', { title: fmt.dateTime(e.ts) }, fmt.time(e.ts)), h('span', { class: 'ic', 'aria-hidden': 'true' }, icon), h('div', { class: 'txt' }, txt));
  })) : h('div', { class: 'empty' }, t('noData'));

  const probs = L.problems.length ? h('div', { class: 'scroll' }, L.problems.map(p => h('div', { class: 'problem' },
    h('div', { class: 'problem-top' }, h('span', { class: `status-chip ${p.level}` }, p.level), h('span', null, fmt.ago(p.ts)), h('span', { class: 'mono' }, `${p.source}${p.origin ? ` · ${p.origin}` : ''}`)),
    h('div', { class: 'problem-msg' }, p.message),
    p.detail ? h('div', { class: 'problem-detail' }, p.detail) : null))) : h('div', { class: 'empty' }, t('noProblems'));

  view.replaceChildren(
    h('div', { class: 'row-hero' }, hero, tiles),
    h('div', { class: 'row-main' },
      h('div', { class: 'stack' }, usersCard,
        h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h3', null, t('recent'))), feed)),
      h('div', { class: 'stack' }, svcCard,
        h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h3', null, t('problems'))), probs))));
}

function rangeFilter(current, options, onPick) {
  return h('div', { class: 'seg', role: 'group' }, options.map(r => {
    const b = h('button', { type: 'button', 'aria-pressed': String(r === current) }, t(`range.${r}`));
    b.addEventListener('click', () => onPick(r));
    return b;
  }));
}

function deltaEl(cur, prev, upIsGood = true) {
  if (prev == null) return null;
  if (!prev) return cur ? h('span', { class: 'delta flat' }, t('new')) : null;
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return h('span', { class: 'delta flat' }, '= ', t('vsPrev'));
  const up = pct > 0;
  const good = up === upIsGood;
  return h('span', { class: `delta ${good ? 'up' : 'down'}`, title: t('vsPrev') }, `${up ? '▲' : '▼'} ${fmt.int(Math.abs(pct))} %`);
}

function renderStats() {
  const view = document.getElementById('view-stats');
  const S = state.stats;
  disposeView('stats');
  const filters = h('div', { class: 'filters' }, rangeFilter(state.range, ['24h', '7d', '30d', '90d', 'all'], pickRange));
  if (!S) return view.replaceChildren(filters);
  const k = S.kpis;
  const p = S.prev;
  const tiles = h('div', { class: 'grid-4' },
    tile({ label: t('kpi.users'), value: fmt.int(k.users), delta: deltaEl(k.users, p?.users) }),
    tile({ label: t('kpi.newUsers'), value: fmt.int(k.newUsers), delta: deltaEl(k.newUsers, p?.newUsers) }),
    tile({ label: t('kpi.games'), value: fmt.int(k.games), delta: deltaEl(k.games, p?.games) }),
    tile({ label: t('kpi.tables'), value: fmt.int(k.tables), delta: deltaEl(k.tables, p?.tables) }),
    tile({ label: t('kpi.playtime'), value: fmt.dur(k.playSeconds), delta: deltaEl(k.playSeconds, p?.playSeconds), sub: t('kpi.median', { d: fmt.dur(k.medianSession) }) }),
    tile({ label: t('kpi.peak'), value: fmt.int(k.peak), delta: deltaEl(k.peak, p?.peak) }),
    tile({ label: t('kpi.loginRate'), value: fmt.pct(k.loginRate), sub: t('kpi.loginRateSub', { ok: fmt.int(k.logins), fail: fmt.int(k.fails) }) }),
    tile({ label: t('kpi.visitors'), value: fmt.int(k.visitors), delta: deltaEl(k.visitors, p?.visitors) }));

  const s1 = cssVar('--s1');
  const s2 = cssVar('--s2');
  const bucketLabel = ts => (S.range.hourly ? `${fmt.dayLong(ts)} ${fmt.time(ts)}` : fmt.dayLong(ts));
  const seriesCard = (title, sub, list) => {
    const cd = card({
      title, sub,
      legend: list.length > 1 ? list.map(x => ({ name: x.name, color: x.color })) : null,
      table: () => dataTable([{ label: t('col.time'), get: i => bucketLabel(S.buckets[i]) }, ...list.map(x => ({ label: x.name, r: true, get: i => fmt.int(x.values[i]) }))],
        S.buckets.map((_, i) => i).reverse()),
    });
    columnChart('stats', cd.body, { ts: S.buckets, hourly: S.range.hourly, series: list });
    return cd.el;
  };
  const listCard = (title, sub, rows, labelFn) => card({
    title, sub, body: hbars(rows, { label: labelFn }),
    table: () => dataTable([{ label: t('col.detail'), get: r => labelFn ? labelFn(r) : r.label }, { label: t('col.count'), r: true, get: r => fmt.int(r.v) }], rows),
  }).el;

  const heatCard = card({
    title: t('chart.heat'), sub: t('chart.heatSub'), body: heatmap(S.heatmap), cls: 'span-2',
    table: () => {
      const days = weekdayNames();
      return dataTable([{ label: '', get: d => days[d] }, ...Array.from({ length: 24 }, (_, hr) => ({ label: String(hr).padStart(2, '0'), r: true, get: d => S.heatmap[d][hr] || '' }))], [0, 1, 2, 3, 4, 5, 6]);
    },
  });

  view.replaceChildren(
    filters,
    tiles,
    h('div', { class: 'grid-2' },
      seriesCard(t('chart.active'), t('chart.activeSub'), [{ name: t('chart.active'), color: s1, values: S.series.active }]),
      seriesCard(t('chart.games'), t('chart.gamesSub'), [{ name: t('chart.games'), color: s1, values: S.series.games }]),
      seriesCard(t('chart.logins'), t('chart.loginsSub'), [{ name: t('series.ok'), color: s1, values: S.series.loginsOk }, { name: t('series.fail'), color: s2, values: S.series.loginsFail }]),
      seriesCard(t('chart.peak'), t('chart.peakSub'), [{ name: t('chart.peak'), color: s1, values: S.series.peak }]),
      heatCard.el,
      seriesCard(t('chart.newUsers'), t('chart.newUsersSub'), [{ name: t('chart.newUsers'), color: s1, values: S.series.newUsers }]),
      seriesCard(t('chart.visitors'), t('chart.visitorsSub'), [{ name: t('chart.visitors'), color: s1, values: S.series.visitors }]),
      listCard(t('chart.gameTypes'), t('chart.gameTypesSub'), S.gameTypes),
      listCard(t('chart.actions'), t('chart.actionsSub'), S.actions, r => actionText(r.label).replace(/^./, ch => ch.toUpperCase())),
      listCard(t('chart.fails'), t('chart.failsSub'), S.failReasons),
      listCard(t('chart.ends'), t('chart.endsSub'), S.endReasons, r => {
        const key = `reason.${r.label}`;
        return t(key) === key ? r.label : t(key);
      })));
}

function renderPlayers() {
  const view = document.getElementById('view-players');
  const P = state.players;
  const search = h('input', { class: 'search', type: 'search', placeholder: t('searchPlayers'), value: state.playerQ });
  const filters = h('div', { class: 'filters' }, rangeFilter(state.range, ['24h', '7d', '30d', '90d', 'all'], pickRange), search);
  const holder = h('section', { class: 'card' });
  const draw = () => {
    if (!P) return holder.replaceChildren(h('div', { class: 'empty' }, '…'));
    const qq = state.playerQ.trim().toLowerCase();
    const { key, dir } = state.playerSort;
    const rows = P.players.filter(p => !qq || p.user.toLowerCase().includes(qq))
      .sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (typeof va === 'string') return dir * va.localeCompare(vb);
        return dir * ((va ?? 0) - (vb ?? 0));
      });
    const cols = [
      { key: 'user', label: t('col.player'), get: p => h('div', { class: 'user-cell' }, avatar(p.user), p.user, p.online ? h('span', { class: 'badge' }, h('span', { class: 'dot good' }), t('onlineBadge')) : null) },
      { key: 'seconds', label: t('col.playtime'), r: true, get: p => fmt.dur(p.seconds) },
      { key: 'sessions', label: t('col.sessions'), r: true, get: p => fmt.int(p.sessions) },
      { key: 'games', label: t('col.games'), r: true, get: p => fmt.int(p.games) },
      { key: 'tables', label: t('col.tables'), r: true, get: p => fmt.int(p.tables) },
      { key: 'watched', label: t('col.watched'), r: true, get: p => fmt.int(p.watched) },
      { key: 'fails', label: t('col.fails'), r: true, get: p => (p.fails ? h('span', { style: 'color:var(--bad-text)' }, fmt.int(p.fails)) : '0') },
      { key: 'firstSeen', label: t('col.first'), r: true, get: p => (p.firstSeen ? fmt.day(p.firstSeen) : '–') },
      { key: 'lastSeen', label: t('col.seen'), r: true, get: p => h('span', { title: fmt.dateTime(p.lastSeen) }, fmt.ago(p.lastSeen)) },
    ];
    const head = h('tr', null, cols.map(c => {
      const sorted = state.playerSort.key === c.key;
      const th = h('th', { class: `sortable ${c.r ? 'r' : ''} ${sorted ? 'sorted' : ''}`, 'aria-sort': sorted ? (dir < 0 ? 'descending' : 'ascending') : null }, c.label, sorted ? (dir < 0 ? ' ↓' : ' ↑') : '');
      th.addEventListener('click', () => {
        state.playerSort = { key: c.key, dir: sorted ? -dir : c.key === 'user' ? 1 : -1 };
        draw();
      });
      return th;
    }));
    holder.replaceChildren(
      h('header', { class: 'card-head' }, h('h3', null, t('playersCount', { n: fmt.int(rows.length) }))),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, head),
        h('tbody', null, rows.map(p => h('tr', null, cols.map(c => h('td', { class: c.r ? 'r' : null }, c.get(p)))))))) : h('div', { class: 'empty' }, t('noData')));
  };
  search.addEventListener('input', () => {
    state.playerQ = search.value;
    draw();
  });
  draw();
  view.replaceChildren(filters, holder);
}

const logsUi = { list: null, status: null, built: false };

function buildLogs() {
  const view = document.getElementById('view-logs');
  const L = state.logs;
  const seg = (items, cur, onPick) => h('div', { class: 'seg', role: 'group' }, items.map(([v, label]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === cur) }, label);
    b.addEventListener('click', () => onPick(v));
    return b;
  }));
  const search = h('input', { class: 'search', type: 'search', placeholder: t('logs.search'), value: L.q });
  let debounce = null;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      L.q = search.value;
      reloadLogs();
    }, 350);
  });
  const follow = h('input', { type: 'checkbox' });
  follow.checked = L.follow;
  follow.addEventListener('change', () => {
    L.follow = follow.checked;
    renderLogStatus();
    if (L.follow) pollLogs();
  });
  const bottom = h('button', { class: 'ghost', type: 'button' }, t('logs.bottom'));
  bottom.addEventListener('click', () => {
    logsUi.list.scrollTop = logsUi.list.scrollHeight;
  });
  const views = [['clean', t('logs.clean')], ['activity', t('logs.activity')], ['problems', t('logs.problems')], ['all', t('logs.all')]];
  const toolbar = h('div', { class: 'logs-toolbar' },
    seg([['proxy', t('logs.proxy')], ['playit', t('logs.playit')]], L.source, v => {
      L.source = v;
      if (v === 'playit' && (L.view === 'activity' || L.view === 'clean')) L.view = 'all';
      buildLogs();
      reloadLogs();
    }),
    seg(L.source === 'playit' ? [['all', t('logs.all')], ['problems', t('logs.problems')]] : views, L.view, v => {
      L.view = v;
      buildLogs();
      reloadLogs();
    }),
    search,
    h('label', { class: 'toggle' }, follow, t('logs.follow')),
    bottom);
  logsUi.list = h('div', { class: 'log-list', role: 'log' }, h('div', { class: 'empty' }, '…'));
  logsUi.status = h('div', { class: 'log-status' });
  view.replaceChildren(toolbar, h('section', { class: 'card logs-card' }, logsUi.list, logsUi.status));
  logsUi.built = true;
  paintLogs(L.records, true);
}

function logRow(r) {
  const extra = r.extra?.length ? h('details', null, h('summary', null, t('logs.stack', { n: r.extra.length })), h('pre', null, r.extra.join('\n'))) : null;
  return h('div', { class: `log-row ${r.level === 'error' || r.level === 'warn' ? r.level : ''}` },
    h('time', { title: new Date(r.ts).toLocaleString(locale()) }, fmt.logTime(r.ts)),
    h('span', { class: 'log-level' }, h('span', { class: `status-chip ${r.level}` }, r.level)),
    h('span', { class: 'log-origin', title: r.origin }, r.origin),
    h('div', { class: 'log-text' }, r.text, extra));
}

function paintLogs(records, replace) {
  const list = logsUi.list;
  if (!list) return;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  if (replace) list.replaceChildren(...(records.length ? records.map(logRow) : [h('div', { class: 'empty' }, t('noData'))]));
  else {
    list.querySelector(':scope > .empty')?.remove();
    list.append(...records.map(logRow));
  }
  while (list.childElementCount > 2000) list.firstElementChild.remove();
  if (replace || nearBottom) list.scrollTop = list.scrollHeight;
  renderLogStatus();
}

function renderLogStatus() {
  if (!logsUi.status) return;
  const L = state.logs;
  logsUi.status.replaceChildren(
    h('span', null, t('logs.count', { n: fmt.int(logsUi.list.querySelectorAll('.log-row').length) })),
    h('span', null, h('span', { class: `dot ${L.follow ? 'good pulse' : ''}`, style: 'display:inline-block;margin-right:6px' }), L.follow ? t('logs.following') : t('logs.paused')));
}

function logsQuery(after) {
  const L = state.logs;
  const p = new URLSearchParams({ source: L.source, view: L.view });
  if (L.q) p.set('q', L.q);
  if (after) p.set('after', after);
  return `/api/logs?${p}`;
}

let logsSeq = 0;

async function reloadLogs() {
  const L = state.logs;
  const seq = ++logsSeq;
  logsUi.list?.classList.add('loading');
  try {
    const r = await api(logsQuery(null));
    if (seq !== logsSeq) return;
    L.records = r.records;
    L.cursor = r.cursor;
    paintLogs(L.records, true);
  } catch {
  } finally {
    if (seq === logsSeq) logsUi.list?.classList.remove('loading');
  }
}

async function pollLogs() {
  const L = state.logs;
  if (state.tab !== 'logs' || !L.follow || L.busy) return;
  if (L.source === 'playit') return reloadLogs();
  if (!L.cursor) return;
  L.busy = true;
  const seq = logsSeq;
  try {
    const r = await api(logsQuery(L.cursor));
    if (seq !== logsSeq) return;
    if (r.cursor) L.cursor = r.cursor;
    if (r.records.length) {
      L.records = L.records.concat(r.records).slice(-2000);
      paintLogs(r.records, false);
    }
  } catch {
  } finally {
    L.busy = false;
  }
}

function renderSystem() {
  const view = document.getElementById('view-system');
  const S = state.system;
  const L = state.live;
  disposeView('system');
  const filters = h('div', { class: 'filters' }, rangeFilter(state.sysRange, ['24h', '7d', '30d', '90d'], r => {
    state.sysRange = r;
    pref.set('sysRange', r);
    loadSystem();
  }));
  if (!S || !L) return view.replaceChildren(filters);
  const H = L.host || {};
  const tiles = h('div', { class: 'grid-4' },
    tile({ label: t('cpu'), value: fmt.pct(H.cpu), sub: t('sys.loadSub', { n: L.cpus }) + ` · ${[H.load1, H.load5, H.load15].map(v => (v == null ? '–' : v.toFixed(2))).join(' / ')}` }),
    tile({ label: t('memory'), value: fmt.bytes(H.memUsed), sub: `/ ${fmt.bytes(H.memTotal)}` }),
    tile({ label: t('sys.rss'), value: fmt.bytes(H.proxyRss), sub: H.proxyCpu == null ? null : `${t('sys.pcpu')}: ${fmt.pct(H.proxyCpu)}` }),
    tile({ label: t('sys.hostUptime'), value: fmt.dur(H.uptime), sub: `${t('disk')}: ${fmt.bytes(H.diskUsed)} / ${fmt.bytes(H.diskTotal)}` }));

  const from = S.range.from;
  const to = S.range.to;
  const pts = key => S.samples.map(x => [x.t, x[key] == null ? null : x[key]]);
  const s1 = cssVar('--s1');
  const s2 = cssVar('--s2');
  const lc = (title, sub, series, opts = {}) => {
    const cd = card({
      title, sub,
      legend: series.length > 1 ? series.map(x => ({ name: x.name, color: x.color, line: true })) : null,
      table: () => dataTable([{ label: t('col.time'), get: i => fmt.dateTime(S.samples[i].t) }, ...series.map(x => ({ label: x.name, r: true, get: i => (x.points[i][1] == null ? '–' : (opts.format || fmt.int)(x.points[i][1])) }))],
        S.samples.map((_, i) => i).reverse()),
    });
    if (S.samples.length) lineChart('system', cd.body, { series, from, to, ...opts });
    else cd.body.replaceChildren(h('div', { class: 'empty' }, t('noData')));
    return cd.el;
  };

  const lifeRows = S.lifecycle;
  const lifeCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('div', null, h('h3', null, t('sys.history')), h('p', { class: 'muted' }, t('sys.historySub')))),
    lifeRows.length ? h('div', { class: 'scroll' }, dataTable([
      { label: t('col.time'), get: x => h('span', { class: 'num' }, fmt.dateTime(x.ts)) },
      { label: t('col.event'), get: x => h('span', { class: `status-chip ${x.kind === 'boot' ? 'activity' : x.kind === 'failed' || x.kind === 'exited' ? 'error' : 'info'}` }, t(`life.${x.kind}`)) },
      { label: t('col.detail'), get: x => h('span', { class: 'ink2' }, x.kind === 'boot' ? '' : x.message) },
    ], lifeRows)) : h('div', { class: 'empty' }, t('noData')));

  const probCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('div', null, h('h3', null, t('sys.problemGroups')), h('p', { class: 'muted' }, t('sys.problemGroupsSub')))),
    S.problemsByKey.length ? h('div', { class: 'scroll' }, dataTable([
      { label: t('col.count'), r: true, get: x => fmt.int(x.n) },
      { label: t('col.source'), get: x => h('span', null, h('span', { class: `status-chip ${x.level}` }, x.level), ' ', h('span', { class: 'mono' }, `${x.source}${x.origin ? ` · ${x.origin}` : ''}`)) },
      { label: t('col.message'), get: x => h('span', { title: x.message }, x.message.length > 140 ? `${x.message.slice(0, 140)}…` : x.message) },
      { label: t('col.seen'), get: x => fmt.ago(x.last) },
    ], S.problemsByKey)) : h('div', { class: 'empty' }, t('noProblems')));

  const st = S.storage;
  const storeCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', null, t('sys.storage'))),
    h('dl', { class: 'kv' },
      h('dt', null, t('sys.dbSize')), h('dd', null, fmt.bytes(st.dbSize)),
      h('dt', null, t('sys.events')), h('dd', null, fmt.int(st.events)),
      h('dt', null, t('sys.since')), h('dd', null, st.since ? fmt.dateTime(st.since) : '–'),
      h('dt', null, t('sys.samples')), h('dd', null, fmt.int(st.samples)),
      h('dt', null, t('sys.allow')), h('dd', { class: 'mono' }, S.allow.join(', '))));

  view.replaceChildren(
    filters,
    tiles,
    h('div', { class: 'grid-2' },
      lc(t('sys.cpu'), t('sys.cpuSub'), [{ name: t('cpu'), color: s1, points: pts('cpu') }], { format: v => `${Math.round(v)} %`, yMax: 100 }),
      lc(t('sys.mem'), t('sys.memSub'), [{ name: t('memory'), color: s1, points: pts('mem') }], { format: fmt.bytes, unit: 1024 ** 3, integer: false, yMax: S.samples.reduce((a, x) => Math.max(a, x.memTotal || 0), 0) || undefined }),
      lc(t('sys.rss'), t('sys.rssSub'), [{ name: t('sys.rss'), color: s1, points: pts('rss') }], { format: fmt.bytes, unit: 1024 ** 3, integer: false }),
      lc(t('sys.pcpu'), t('sys.pcpuSub'), [{ name: t('sys.pcpu'), color: s1, points: pts('pcpu') }], { format: v => `${Math.round(v)} %` }),
      lc(t('sys.latency'), t('sys.latencySub'), [{ name: t('series.xmage'), color: s1, points: pts('xms') }, { name: t('series.web'), color: s2, points: pts('wms') }], { format: v => `${Math.round(v)}` }),
      lc(t('sys.online'), t('sys.onlineSub'), [{ name: t('sys.online'), color: s1, points: pts('online') }], { step: true }),
      lifeCard,
      probCard),
    storeCard);
}

function pickRange(r) {
  state.range = r;
  pref.set('range', r);
  if (state.tab === 'players') loadPlayers();
  else loadStats();
  if (state.tab === 'stats') renderStats();
  else renderPlayers();
}

let nowSig = '';
let nowAt = 0;

function liveSignature(L) {
  return JSON.stringify([L.counts, L.users, L.recent[0]?.ts, L.problems[0]?.id, L.day, L.host?.ts, L.proxy?.state, L.playit?.state, lang]);
}

async function loadLive() {
  try {
    state.live = await api('/api/live');
    state.liveAt = Date.now();
    state.liveError = false;
  } catch {
    state.liveError = true;
  }
  renderPills();
  renderUpdated();
  renderBanner();
  if (state.tab === 'now' && state.live) {
    const sig = liveSignature(state.live);
    if (sig !== nowSig || Date.now() - nowAt > 60000) renderNow();
  }
}

async function loadStats() {
  const view = document.getElementById('view-stats');
  view.classList.add('loading');
  try {
    state.stats = await api(`/api/stats?range=${state.range}`);
  } catch {
  }
  view.classList.remove('loading');
  if (state.tab === 'stats') renderStats();
}

async function loadPlayers() {
  const view = document.getElementById('view-players');
  view.classList.add('loading');
  try {
    state.players = await api(`/api/players?range=${state.range}`);
  } catch {
  }
  view.classList.remove('loading');
  if (state.tab === 'players') renderPlayers();
}

async function loadSystem() {
  const view = document.getElementById('view-system');
  view.classList.add('loading');
  try {
    state.system = await api(`/api/system?range=${state.sysRange}`);
  } catch {
  }
  view.classList.remove('loading');
  renderFoot();
  if (state.tab === 'system') renderSystem();
}

function setTab(tab) {
  if (!['now', 'stats', 'players', 'logs', 'system'].includes(tab)) tab = 'now';
  state.tab = tab;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${tab}`;
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  hideTip();
  if (tab === 'now') renderNow();
  if (tab === 'stats') {
    renderStats();
    loadStats();
  }
  if (tab === 'players') {
    renderPlayers();
    loadPlayers();
  }
  if (tab === 'logs') {
    if (!logsUi.built) {
      buildLogs();
      reloadLogs();
    }
  }
  if (tab === 'system') {
    renderSystem();
    loadSystem();
  }
}

function rerenderAll() {
  applyStaticI18n();
  renderPills();
  renderUpdated();
  renderBanner();
  renderFoot();
  logsUi.built = false;
  setTab(state.tab);
}

document.getElementById('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-tab]');
  if (b) setTab(b.dataset.tab);
});
window.addEventListener('hashchange', () => setTab(location.hash.slice(1)));
document.getElementById('lang-btn').addEventListener('click', () => {
  lang = lang === 'es' ? 'en' : 'es';
  pref.set('lang', lang);
  rerenderAll();
});
document.getElementById('theme-btn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  pref.set('theme', dark ? 'light' : 'dark');
  applyTheme();
  rerenderAll();
});
window.addEventListener('scroll', hideTip, { passive: true });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) rerenderAll();
});

applyTheme();
applyStaticI18n();
setTab(location.hash.slice(1) || 'now');
loadLive();
loadSystem();
setInterval(loadLive, 5000);
setInterval(renderUpdated, 1000);
setInterval(() => {
  if (state.tab === 'stats') loadStats();
  if (state.tab === 'players') loadPlayers();
}, 60000);
setInterval(() => {
  if (state.tab === 'system') loadSystem();
}, 30000);
setInterval(pollLogs, 3000);
