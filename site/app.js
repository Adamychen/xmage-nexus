(function () {
  "use strict";

  var STATUS_LABEL = { pass: "PASS", fail: "FAIL", pending: "PENDING", running: "RUNNING", done: "DONE" };
  var NEXUS_CLASS = { yes: "tag-yes", no: "tag-no", partial: "tag-partial" };
  var NEXUS_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };
  var OFFICIAL_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };

  var ICONS = {
    swords:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg>',
    grid:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    target:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    layers:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>',
    trophy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></svg>',
    palette:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  var DATA = null;
  var LANG = currentLang();

  function currentLang() {
    var stored = null;
    try {
      stored = localStorage.getItem("mage_site_lang");
    } catch (e) {}
    if (stored === "es" || stored === "en") return stored;
    var nav = (navigator.language || "es").toLowerCase();
    return nav.indexOf("en") === 0 ? "en" : "es";
  }

  function D() {
    return (DATA && DATA.marketing && DATA.marketing.i18n && DATA.marketing.i18n[LANG]) || {};
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function setText(id, text) {
    var e = document.getElementById(id);
    if (e && text != null) e.textContent = text;
  }

  function dot(status) {
    return '<span class="dot ' + (status || "pending") + '"></span>';
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function detectOS() {
    var ua = navigator.userAgent || "";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Macintosh|Mac OS X|iPhone|iPad/i.test(ua)) return "macOS";
    if (/Linux|X11/i.test(ua)) return "Linux";
    return "";
  }

  function toggleLabel() {
    return LANG === "en" ? "ES" : "EN";
  }

  /* ---------------------------- Landing ---------------------------- */

  function playHref(d) {
    var p = d.project || {};
    var base = p.playUrl || (d.release && d.release.playUrl) || "";
    if (!base) return "";
    var params = p.playParams || "";
    if (!params) return base;
    return base + (base.indexOf("?") === -1 ? "?" : "&") + params;
  }

  function renderHero(d, t) {
    var h = t.hero || {};
    setText("hero-eyebrow", h.eyebrow);
    setText("hero-title", h.title);
    setText("hero-sub", h.subtitle);

    var rel = d.release || {};
    var os = detectOS();
    var primary = document.getElementById("hero-primary");
    if (primary) primary.textContent = h.primaryCta ? h.primaryCta + (os ? " " + os : "") : "Download";
    var secondary = document.getElementById("hero-secondary");
    if (secondary && h.secondaryCta) secondary.textContent = h.secondaryCta;

    var playUrl = playHref(d);
    var play = document.getElementById("hero-play");
    if (play) {
      if (playUrl) {
        play.href = playUrl;
        play.textContent = h.playCta || "Play now";
      } else {
        play.style.display = "none";
      }
    }
    var playNote = document.getElementById("hero-play-note");
    if (playNote) {
      if (playUrl && h.playNote) playNote.textContent = h.playNote;
      else playNote.style.display = "none";
    }

    var ver = document.getElementById("hero-version");
    if (ver && rel.version) ver.textContent = "v" + rel.version + (rel.status ? " · " + rel.status : "");

    var trust = document.getElementById("hero-trust");
    if (trust) {
      trust.innerHTML = "";
      (h.trust || []).forEach(function (item) {
        trust.appendChild(el("li", null, esc(item)));
      });
    }
  }

  function renderDemoSection(t) {
    setText("demo-title", t.demoTitle);
    setText("demo-sub", t.demoSubtitle);
    var grid = document.getElementById("demo-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (t.demoSteps || []).forEach(function (step, i) {
      var card = el("figure", "demo-card");
      var media = el("div", "demo-media");
      if (step.clip) {
        var img = el("img");
        img.src = "./assets/demo/" + step.clip + ".webp";
        img.alt = step.alt || "";
        img.loading = "lazy";
        img.decoding = "async";
        media.appendChild(img);
      }
      card.appendChild(media);
      var cap = el("figcaption");
      var head = el("h3");
      var badge = el("span", "demo-step", String(i + 1));
      badge.setAttribute("aria-hidden", "true");
      head.appendChild(badge);
      head.appendChild(document.createTextNode(step.title || ""));
      cap.appendChild(head);
      cap.appendChild(el("p", "muted", esc(step.desc || "")));
      card.appendChild(cap);
      grid.appendChild(card);
    });
  }

  function renderWhatIs(t) {
    setText("whatis-title", t.whatIsTitle);
    setText("whatis-sub", t.whatIsSubtitle);
    var grid = document.getElementById("whatis-grid");
    if (grid) {
      grid.innerHTML = "";
      (t.whatIsCards || []).forEach(function (c) {
        var card = el("div", "whatis-card");
        card.appendChild(el("h3", null, esc(c.title)));
        card.appendChild(el("p", "muted", esc(c.desc)));
        grid.appendChild(card);
      });
    }
    var row = document.getElementById("whatis-links");
    if (row) {
      row.innerHTML = "";
      (t.whatIsLinks || []).forEach(function (l) {
        var a = el("a", "chip");
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = l.label;
        row.appendChild(a);
      });
    }
  }

  function renderDesktopBridge(t) {
    setText("bridge-title", t.desktopBridgeTitle);
    setText("bridge-desc", t.desktopBridgeDesc);
    var ul = document.getElementById("bridge-bullets");
    if (ul) {
      ul.innerHTML = "";
      (t.desktopBridgeBullets || []).forEach(function (item) {
        var li = el("li");
        li.innerHTML = ICONS.check;
        li.appendChild(document.createTextNode(item));
        ul.appendChild(li);
      });
    }
    var link = document.getElementById("bridge-link");
    if (link && t.desktopBridgeLink) link.textContent = t.desktopBridgeLink;
  }

  function renderFeaturesSection(t) {
    setText("features-title", t.featuresTitle);
    setText("features-sub", t.featuresSubtitle);
    var grid = document.getElementById("feature-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (t.features || []).forEach(function (f) {
      var card = el("div", "feature-card");
      card.appendChild(el("div", "feature-icon", ICONS[f.icon] || ICONS.grid));
      card.appendChild(el("h3", null, esc(f.title)));
      card.appendChild(el("p", "muted", esc(f.desc)));
      grid.appendChild(card);
    });
  }

  function renderFormatsSection(t) {
    setText("formats-title", t.formatsTitle);
    var row = document.getElementById("format-chips");
    if (!row) return;
    row.innerHTML = "";
    (t.formats || []).forEach(function (f) {
      row.appendChild(el("span", "chip", esc(f)));
    });
  }

  /* A release ships 27 files and 24 of them only exist to feed the launcher:
     the JRE / server / proxy tarballs, the updater signatures, latest.json. A
     visitor needs ONE, and the old panel sent every button to the page listing
     all 27. These are the files a human on each OS would click, first choice
     first; everything else stays out of the panel. */
  var OS_FILES = {
    Windows: [".exe", ".msi"],
    macOS: [".dmg"],
    Linux: [".AppImage", ".deb", ".rpm"],
  };

  function assetsForOs(assets, os) {
    var want = OS_FILES[os] || [];
    var out = [];
    for (var i = 0; i < want.length; i++) {
      for (var j = 0; j < assets.length; j++) {
        var name = assets[j].name;
        var isType = name.slice(-want[i].length) === want[i];
        if (isType && name.indexOf("nexus-") !== 0 && !/\.sig$/.test(name)) out.push(assets[j]);
      }
    }
    return out;
  }

  function mb(bytes) {
    var m = (bytes || 0) / 1048576;
    return (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10) + " MB";
  }

  /* Asset names carry the version (XMage.Nexus_0.4.5_x64-setup.exe), so the
     links are resolved at load time: a URL hand-written into content.json is
     wrong on the next release. One call per tab per 30 min (the anonymous API
     allows 60/h per IP); on any failure the static cards stay up. */
  function loadReleaseAssets(releasesUrl, cb) {
    var m = /github\.com\/([\w.-]+\/[\w.-]+)\/releases/.exec(releasesUrl || "");
    if (!m) return;
    var url = "https://api.github.com/repos/" + m[1] + "/releases/latest";
    var KEY = "mage_site_release";
    var stale = null;
    try {
      var cached = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (cached && cached.url === url && cached.assets) {
        if (Date.now() - cached.at < 30 * 60 * 1000) return cb(cached.assets);
        stale = cached.assets;
      }
    } catch (e) {
      stale = null;
    }
    function done(assets) {
      if (assets) {
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ url: url, at: Date.now(), assets: assets }));
        } catch (e) {}
      }
      cb(assets || stale);
    }
    var opts = { headers: { Accept: "application/vnd.github+json" } };
    var timer = null;
    if (typeof AbortController !== "undefined") {
      var ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () {
        ctrl.abort();
      }, 5000);
    }
    fetch(url, opts)
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var list = (j && j.assets ? j.assets : []).map(function (a) {
          return { name: a.name, url: a.browser_download_url, size: a.size };
        });
        done(list.length ? list : null);
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        done(null);
      });
  }

  function downloadCard(cls, title, sub, href, current, badge) {
    var a = el("a", "download-card" + (cls ? " " + cls : ""));
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(el("span", "dl-os", esc(title)));
    a.appendChild(el("span", "dl-arch muted dl-file", esc(sub)));
    if (current) a.className += " is-current";
    if (badge) a.appendChild(el("span", "dl-badge", esc(badge)));
    return a;
  }

  function renderDownloads(d, t) {
    setText("download-title", t.downloadTitle);
    setText("download-sub", t.downloadSubtitle);
    var grid = document.getElementById("download-grid");
    if (!grid) return;
    var rel = d.release || {};
    var os = detectOS();

    function paint(assets) {
      grid.innerHTML = "";
      var playUrl = playHref(d);
      if (playUrl) {
        var play = downloadCard("play", t.downloadPlay || "Play in your browser \u2192", t.downloadPlaySub || "Try without installing", playUrl);
        grid.appendChild(play);
      }
      if (assets && assets.length) {
        var osList = os && OS_FILES[os] ? [os] : ["Windows", "macOS", "Linux"];
        var others = [];
        osList.forEach(function (o) {
          var files = assetsForOs(assets, o);
          if (!files.length) return;
          var meta =
            (rel.downloads || []).filter(function (x) {
              return x.os === o;
            })[0] || {};
          var current = os === o;
          var first = files[0];
          grid.appendChild(
            downloadCard(
              "",
              meta.label || o,
              first.name + " \u00b7 " + mb(first.size),
              first.url,
              current,
              current ? t.recommended || "Recommended" : "",
            ),
          );
          if (current) others = files.slice(1);
        });
        if (others.length) {
          var more = el("div", "download-extra");
          more.appendChild(el("span", "", esc((t.downloadOthers || "Other formats") + ":")));
          others.forEach(function (f) {
            var b = el("a", "dl-extra-link", esc(f.name + " \u00b7 " + mb(f.size)));
            b.href = f.url;
            b.target = "_blank";
            b.rel = "noopener";
            more.appendChild(b);
          });
          grid.appendChild(more);
        }
      } else {
        (rel.downloads || []).forEach(function (dl) {
          var current = os && dl.os === os;
          grid.appendChild(
            downloadCard("", dl.label || dl.os || "Download", dl.arch || "", dl.url || rel.releasesUrl || "#", current, current ? t.recommended || "Recommended" : ""),
          );
        });
      }
      if (rel.releasesUrl) {
        grid.appendChild(downloadCard("secondary", t.downloadAll || "All versions \u2192", t.downloadAllSub || "GitHub Releases", rel.releasesUrl));
      }
      if (t.downloadFileHint) grid.appendChild(el("div", "download-extra muted", esc(t.downloadFileHint)));
    }

    paint(null);
    loadReleaseAssets(rel.releasesUrl, function (assets) {
      if (assets && assets.length) paint(assets);
    });
  }

  function renderMilestones(t) {
    setText("milestones-title", t.milestonesTitle);
    setText("milestones-sub", t.milestonesSubtitle);
    setText("milestones-link", t.milestonesSeeAll);
    var ol = document.getElementById("milestones");
    if (!ol) return;
    ol.innerHTML = "";
    (t.milestones || []).forEach(function (m) {
      var li = el("li", "milestone");
      li.appendChild(el("span", "milestone-date", esc(m.date)));
      var body = el("div", "milestone-body");
      body.appendChild(el("h3", null, esc(m.title)));
      if (m.desc) body.appendChild(el("p", "muted", esc(m.desc)));
      li.appendChild(body);
      ol.appendChild(li);
    });
  }

  function renderStatusTeaser(d, t) {
    setText("status-teaser-title", t.statusTeaserTitle);
    setText("status-teaser-desc", t.statusTeaserDesc);
    setText("status-teaser-link", t.seeStatus);
    var health = document.getElementById("health");
    if (!health) return;
    // The nightly integration layer (real stack) is not a product signal on the
    // landing; it stays visible on the status page.
    var layers = (d.layers || []).filter(function (l) {
      return l.name !== "integration";
    });
    var failed = layers.filter(function (l) {
      return l.status === "fail";
    }).length;
    var h = t.health || {};
    if (!layers.length) {
      health.textContent = "•";
      health.style.color = "var(--muted)";
    } else if (failed === 0) {
      health.textContent = h.all || "● Operational";
      health.style.color = "var(--good)";
    } else {
      health.textContent = (h.fail || "● %n failing").replace("%n", failed);
      health.style.color = "var(--bad)";
    }
  }

  function renderLanding(d) {
    DATA = d;
    LANG = currentLang();
    document.documentElement.lang = LANG;
    var t = D();

    setText("skip-link", t.skip);
    setText("nav-demo", t.nav && t.nav.demo);
    setText("nav-features", t.nav && t.nav.features);
    setText("nav-formats", t.nav && t.nav.formats);
    setText("nav-download", t.nav && t.nav.download);
    setText("nav-status", t.nav && t.nav.status);
    setText("nav-cta", t.nav && t.nav.cta);
    setText("lang-toggle", toggleLabel());

    renderHero(d, t);
    renderWhatIs(t);
    renderDemoSection(t);
    renderFeaturesSection(t);
    renderDesktopBridge(t);
    renderFormatsSection(t);
    renderDownloads(d, t);
    renderMilestones(t);
    renderStatusTeaser(d, t);
    setText("footer-note", t.footerNote);
    setText("footer-stack", (d.project || {}).stack);
  }

  /* -------------------------- Status page -------------------------- */

  function renderHeader(d, t) {
    var p = d.project || {};
    var sp = t.statusPage || {};
    setText("stack", p.stack);
    setText("generated", (sp.updated || "updated") + " " + new Date(d.generatedAt || Date.now()).toLocaleString());
    var commit = document.getElementById("commit");
    if (commit) {
      if (d.commit) {
        commit.textContent = "commit " + String(d.commit).slice(0, 7);
        commit.href = "https://github.com/" + (p.repo || "") + "/commit/" + d.commit;
      } else {
        commit.style.display = "none";
      }
    }
    var repo = document.getElementById("repo");
    if (repo) repo.href = "https://github.com/" + (p.repo || "");
  }

  function card(title, status, sub, statHtml) {
    var c = el("div", "card");
    var head = el("div", "title");
    head.innerHTML =
      dot(status) +
      "<span>" +
      esc(title) +
      "</span>" +
      '<span class="pill ' +
      (status || "pending") +
      '">' +
      (STATUS_LABEL[status] || "PENDING") +
      "</span>";
    c.appendChild(head);
    if (sub) c.appendChild(el("div", "sub", esc(sub)));
    if (statHtml) c.appendChild(el("div", "stat", statHtml));
    return c;
  }

  function renderLayers(layers) {
    var wrap = document.getElementById("layers");
    if (!wrap) return;
    wrap.innerHTML = "";
    (layers || []).forEach(function (l) {
      var stat = "";
      if (l.total != null) {
        stat =
          "<b>" + (l.passed || 0) + "</b> passed · <b>" + (l.failed || 0) + "</b> failed · " + (l.total || 0) + " total";
        if (l.durationMs) stat += " · " + (l.durationMs / 1000).toFixed(1) + "s";
      } else if (l.durationMs) {
        stat = "ran in " + (l.durationMs / 1000).toFixed(1) + "s";
      }
      wrap.appendChild(card(l.label || l.name, l.status, l.note, stat));
    });
  }

  function renderCoverage(cov, thresholds) {
    var wrap = document.getElementById("coverage");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!cov) {
      wrap.appendChild(card("Coverage", "pending", "no coverage data"));
      return;
    }
    var keys = [
      { k: "lines", label: "Lines" },
      { k: "functions", label: "Functions" },
      { k: "branches", label: "Branches" },
      { k: "statements", label: "Statements" },
    ];
    keys.forEach(function (m) {
      var pct = cov[m.k];
      if (pct == null) return;
      var th = (thresholds && thresholds[m.k]) || 0;
      var cls = pct >= th ? "good" : pct >= th * 0.8 ? "warn" : "bad";
      var c = el("div", "card");
      c.appendChild(el("div", "title", esc(m.label)));
      var bar = el("div", "bar " + cls);
      bar.appendChild(el("span")).style.width = Math.max(0, Math.min(100, pct)) + "%";
      c.appendChild(bar);
      c.appendChild(el("div", "stat", "<b>" + pct.toFixed(1) + "%</b> (gate ≥ " + th + "%)"));
      wrap.appendChild(c);
    });
  }

  function renderPhases(phases) {
    var wrap = document.getElementById("phases");
    if (!wrap) return;
    wrap.innerHTML = "";
    (phases || []).forEach(function (ph) {
      var sub = (ph.desc || "") + (ph.date ? "  ·  " + ph.date : "");
      wrap.appendChild(card("Phase " + ph.id + ": " + ph.name, ph.status, sub));
    });
  }

  function renderGuards(guards) {
    var wrap = document.getElementById("guards");
    if (!wrap) return;
    wrap.innerHTML = "";
    (guards || []).forEach(function (g) {
      wrap.appendChild(card(g.name, g.status, (g.desc || "") + (g.note ? "  ·  " + g.note : "")));
    });
  }

  function renderEngineGaps(g) {
    if (!g) return;
    setText("gaps-total", "(" + (g.totalMissing || 0) + " campos del motor no expuestos por el server)");
    var tbody = document.querySelector("#gaps tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    (g.entries || []).forEach(function (e) {
      var tr = el("tr");
      tr.appendChild(el("td", null, esc(e.mechanic)));
      tr.appendChild(el("td", null, esc(e.field)));
      tr.appendChild(el("td", "center", esc(e.view)));
      var statusText, cls;
      if (e.shown) {
        statusText = "✅ Mostrado";
        cls = "tag-yes";
      } else if (e.exposed) {
        statusText = "⚠️ Expuesto upstream";
        cls = "tag-partial";
      } else {
        statusText = "❌ Gap (no emitido)";
        cls = "tag-no";
      }
      tr.appendChild(el("td", "center " + cls, statusText));
      tr.appendChild(el("td", null, esc(e.via)));
      tbody.appendChild(tr);
    });
  }

  function renderReverse(d) {
    if (!d) return;
    setText(
      "rev-total",
      "(" +
        d.totalModeled +
        "/" +
        d.totalEmitted +
        " campos del server modelados" +
        (d.totalUnmodeled ? ", " + d.totalUnmodeled + " sin modelar" : "") +
        ")",
    );
    var wrap = document.getElementById("reverse");
    if (!wrap) return;
    wrap.innerHTML = "";
    (d.groups || []).forEach(function (g) {
      var cls = g.unmodeled.length ? "fail" : "pass";
      var stat = "<b>" + g.modeled + "/" + g.emitted + "</b> modelados";
      if (g.unmodeled.length) {
        stat += "<br><span class='tag-no'>sin modelar: " + esc(g.unmodeled.join(", ")) + "</span>";
      }
      wrap.appendChild(card(g.label, cls, stat));
    });
  }

  function renderFeaturesMatrix(features) {
    var tbody = document.querySelector("#features tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    (features || []).forEach(function (f) {
      var tr = el("tr");
      tr.appendChild(el("td", null, esc(f.category)));
      tr.appendChild(el("td", null, esc(f.feature)));
      tr.appendChild(el("td", "center", OFFICIAL_LABEL[f.official] || esc(f.official)));
      tr.appendChild(el("td", "center " + (NEXUS_CLASS[f.nexus] || ""), NEXUS_LABEL[f.nexus] || esc(f.nexus)));
      tr.appendChild(el("td", "center", esc(f.phase)));
      tbody.appendChild(tr);
    });
  }

  function renderStatusPage(d) {
    DATA = d;
    LANG = currentLang();
    document.documentElement.lang = LANG;
    var t = D();
    var sp = t.statusPage || {};
    var heads = sp.headings || {};

    setText("lang-toggle", toggleLabel());
    setText("page-title", sp.pageTitle);
    setText("back-link", sp.backLabel);
    setText("h2-layers", heads.layers);
    setText("h2-coverage", heads.coverage);
    setText("h2-phases", heads.phases);
    setText("h2-guards", heads.guards);
    setText("h2-gaps", heads.gaps);
    setText("h2-reverse", heads.reverse);
    setText("h2-features", heads.features);

    renderHeader(d, t);
    renderLayers(d.layers);
    renderCoverage(d.coverage, d.coverageThresholds);
    renderPhases(d.phases);
    renderGuards(d.guards);
    renderEngineGaps(d.engineGaps);
    renderReverse(d.reverseCoverage);
    renderFeaturesMatrix(d.features);
  }

  /* ------------------------------ Boot ------------------------------ */

  function rerender() {
    if (!DATA) return;
    if (document.getElementById("feature-grid")) renderLanding(DATA);
    else if (document.getElementById("layers")) renderStatusPage(DATA);
  }

  function wireToggle() {
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      LANG = LANG === "en" ? "es" : "en";
      try {
        localStorage.setItem("mage_site_lang", LANG);
      } catch (e) {}
      rerender();
    });
  }

  function main() {
    fetch("./status.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (document.getElementById("feature-grid")) renderLanding(d);
        else if (document.getElementById("layers")) renderStatusPage(d);
        wireToggle();
      })
      .catch(function (e) {
        var target = document.getElementById("feature-grid") || document.getElementById("layers");
        if (target) {
          target.innerHTML =
            '<div class="card"><div class="title">' +
            dot("fail") +
            "No se pudo cargar status.json</div>" +
            '<div class="sub">' +
            esc(e.message) +
            "</div></div>";
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
