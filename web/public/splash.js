(function () {
  var I18N = window.__SPLASH_I18N || {};
  var pickLang = window.__SPLASH_PICK_LANG || function () { return 'en'; };
  var lang = pickLang(navigator.language);
  var T = I18N[lang] || I18N.en;
  document.documentElement.lang = lang === 'zhs' ? 'zh-CN' : lang;
  var statusEl = document.getElementById('status');
  var barEl = document.getElementById('bar');
  var fillEl = document.getElementById('fill');
  var pctEl = document.getElementById('pct');
  var errorEl = document.getElementById('error');
  var actionsEl = document.getElementById('actions');
  var updateActionsEl = document.getElementById('update-actions');
  document.getElementById('retry').textContent = T.retry;
  document.getElementById('quit').textContent = T.quit;
  document.getElementById('update').textContent = T.update_btn;
  document.getElementById('continue').textContent = T.continue_btn;

  var DOWNLOAD_START = 6;
  var DOWNLOAD_END = 74;
  var DOWNLOAD_SLOTS = 4;
  var WARM_BASE = 90;
  var phases = {
    'checking-update': 2,
    'checking': 6,
    'starting-server': 78,
    'starting-proxy': 86
  };
  var progress = 0;
  var components = [];
  var stateComponent = '';
  var warmStarted = 0;
  var warmClock = null;

  function fill(tpl, params) {
    var out = tpl;
    for (var k in params) out = out.split('{' + k + '}').join(params[k]);
    return out;
  }
  function setBar(p, working) {
    progress = Math.max(0, Math.min(100, p));
    fillEl.style.width = progress + '%';
    barEl.classList.toggle('working', !!working);
  }
  function stopClock() {
    if (warmClock) { clearInterval(warmClock); warmClock = null; }
  }
  function componentSlot(name) {
    var i = components.indexOf(name);
    if (i < 0) { components.push(name); i = components.length - 1; }
    return Math.min(i, DOWNLOAD_SLOTS - 1);
  }
  function downloadProgress(name, frac) {
    var span = (DOWNLOAD_END - DOWNLOAD_START) / DOWNLOAD_SLOTS;
    var start = DOWNLOAD_START + componentSlot(name) * span;
    return start + Math.max(0, Math.min(1, frac)) * span * 0.8;
  }
  function fmtElapsed(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }
  function setProgress(done, total) {
    if (!total) { pctEl.textContent = fmtBytes(done); return; }
    pctEl.textContent = fmtBytes(done) + ' / ' + fmtBytes(total);
    if (stateComponent) setBar(Math.max(progress, downloadProgress(stateComponent, done / total)), true);
  }
  function fmtBytes(n) {
    if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    actionsEl.classList.add('show');
  }
  function hideError() {
    errorEl.style.display = 'none';
    actionsEl.classList.remove('show');
  }
  function translateError(raw) {
    var msg = String(raw || 'error');
    if (msg.indexOf('ERR_') !== 0) return msg;
    var parts = msg.split('|');
    var key = parts[0].toLowerCase();
    if (typeof T[key] !== 'string') return msg;
    return fill(T[key], { detail: parts.slice(1).join('|') });
  }
  function onState(s) {
    hideError();
    updateActionsEl.classList.remove('show');
    if (s.state === 'checking-update' && s.component !== 'app') {
      stopClock();
      components = [];
      stateComponent = '';
      fillEl.classList.remove('failed');
      setBar(0, false);
    }
    if (s.state === 'ready') {
      stopClock();
      statusEl.textContent = T.ready;
      pctEl.textContent = '';
      setBar(100, false);
      return;
    }
    if (s.state === 'error') {
      stopClock();
      statusEl.textContent = '';
      fillEl.classList.add('failed');
      barEl.classList.remove('working');
      showError(translateError(s.message));
      return;
    }
    if (s.state === 'update-available') {
      var ver = String(s.message || '').split('|')[0];
      statusEl.textContent = T.update_available + (ver ? ' (v' + ver + ')' : '');
      updateActionsEl.classList.add('show');
      return;
    }
    if (s.state === 'update-downloading') {
      statusEl.textContent = T.updating;
      setBar(progress, true);
      return;
    }
    if (s.state === 'warming') {
      statusEl.textContent = T.warming;
      setBar(Math.max(progress, WARM_BASE), true);
      if (!warmClock) {
        warmStarted = Date.now();
        warmClock = setInterval(function () {
          var secs = Math.floor((Date.now() - warmStarted) / 1000);
          pctEl.textContent = fmtElapsed(secs);
          setBar(WARM_BASE + Math.min(9, secs / 10), true);
        }, 1000);
      }
      return;
    }
    stopClock();
    if (s.state === 'downloading') {
      stateComponent = s.component || '';
      statusEl.textContent = fill(T.downloading, { component: stateComponent });
      setBar(Math.max(progress, downloadProgress(stateComponent, 0)), true);
      return;
    }
    if (s.state === 'verifying' || s.state === 'extracting') {
      stateComponent = s.component || '';
      statusEl.textContent = s.state === 'verifying' ? fill(T.verifying, { component: stateComponent })
        : fill(T.extracting, { component: stateComponent });
      var end = downloadProgress(stateComponent, s.state === 'verifying' ? 0.9 : 1);
      pctEl.textContent = '';
      setBar(Math.max(progress, end - 1), true);
      return;
    }
    if (typeof phases[s.state] === 'number') {
      stateComponent = '';
      statusEl.textContent = s.state === 'checking-update' ? T.checking_update
        : s.state === 'checking' ? T.checking
        : s.state === 'starting-server' ? T.starting_server
        : T.starting_proxy;
      pctEl.textContent = '';
      setBar(phases[s.state], true);
      return;
    }
    statusEl.textContent = s.state;
    setBar(progress, true);
  }
  function invoke(cmd) {
    if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__.core.invoke(cmd);
    return Promise.reject(new Error('no tauri'));
  }
  document.getElementById('retry').addEventListener('click', function () { invoke('retry_bootstrap'); });
  document.getElementById('quit').addEventListener('click', function () { invoke('quit_app'); });
  document.getElementById('update').addEventListener('click', function () { updateActionsEl.classList.remove('show'); invoke('apply_update'); });
  document.getElementById('continue').addEventListener('click', function () { updateActionsEl.classList.remove('show'); invoke('skip_update'); });

  function hook() {
    if (!(window.__TAURI__ && window.__TAURI__.event)) { setTimeout(hook, 100); return; }
    bridgeFound = true;
    var listen = window.__TAURI__.event.listen;
    listen('bootstrap://state', function (e) { onState(e.payload); });
    listen('bootstrap://progress', function (e) { setProgress(e.payload.done, e.payload.total); });
    invoke('splash_ready');
    var lastSig = '';
    setInterval(function () {
      invoke('bootstrap_status').then(function (s) {
        if (!s || typeof s.state !== 'string') return;
        var sig = s.state + '|' + (s.component || '') + '|' + (s.message || '');
        if (sig !== lastSig) { lastSig = sig; onState(s); }
      }, function () {});
    }, 1000);
  }
  onState({ state: 'checking-update' });
  var bridgeFound = false;
  setTimeout(function () {
    if (!bridgeFound) {
      stopClock();
      statusEl.textContent = '';
      fillEl.classList.add('failed');
      barEl.classList.remove('working');
      showError(T.bridge_missing);
    }
  }, window.__SPLASH_BRIDGE_TIMEOUT_MS || 15000);
  hook();
})();
