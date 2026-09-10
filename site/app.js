(function () {
  "use strict";

  var STATUS_LABEL = { pass: "PASS", fail: "FAIL", pending: "PENDING", running: "RUNNING", done: "DONE" };
  var NEXUS_CLASS = { yes: "tag-yes", no: "tag-no", partial: "tag-partial" };
  var NEXUS_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };
  var OFFICIAL_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };

  var ICONS = {
    users:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    board:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    target:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
    deck:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="13" height="16" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/></svg>',
    trophy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/></svg>',
    palette:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="8" r="1.2"/><circle cx="16" cy="10" r="1.2"/><circle cx="15" cy="15" r="1.2"/><path d="M12 21a9 9 0 0 0 0-18"/></svg>',
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

  function renderFeaturesSection(t) {
    setText("features-title", t.featuresTitle);
    setText("features-sub", t.featuresSubtitle);
    var grid = document.getElementById("feature-grid");
    if (!grid) return;
    grid.innerHTML = "";
    (t.features || []).forEach(function (f) {
      var card = el("div", "feature-card");
      card.appendChild(el("div", "feature-icon", ICONS[f.icon] || ICONS.board));
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

  function renderDownloads(d, t) {
    setText("download-title", t.downloadTitle);
    setText("download-sub", t.downloadSubtitle);
    var grid = document.getElementById("download-grid");
    if (!grid) return;
    grid.innerHTML = "";
    var rel = d.release || {};
    var os = detectOS();
    (rel.downloads || []).forEach(function (dl) {
      var a = el("a", "download-card");
      a.href = dl.url || rel.releasesUrl || "#";
      a.target = "_blank";
      a.rel = "noopener";
      var current = os && dl.os === os;
      if (current) a.className += " is-current";
      a.appendChild(el("span", "dl-os", esc(dl.label || dl.os || "Download")));
      a.appendChild(el("span", "dl-arch muted", esc(dl.arch || "")));
      if (current) a.appendChild(el("span", "dl-badge", esc(t.recommended || "Recommended")));
      grid.appendChild(a);
    });
    if (rel.releasesUrl) {
      var all = el("a", "download-card secondary");
      all.href = rel.releasesUrl;
      all.target = "_blank";
      all.rel = "noopener";
      all.appendChild(el("span", "dl-os", esc(t.downloadAll || "All versions →")));
      all.appendChild(el("span", "dl-arch muted", esc(t.downloadAllSub || "GitHub Releases")));
      grid.appendChild(all);
    }
  }

  function renderRoadmap(d, t) {
    setText("roadmap-title", t.roadmapTitle);
    var ol = document.getElementById("timeline");
    if (!ol) return;
    ol.innerHTML = "";
    (d.phases || []).forEach(function (ph) {
      var li = el("li", "tl-item " + (ph.status === "done" ? "done" : "pending"));
      li.appendChild(el("span", "tl-marker"));
      var body = el("div", "tl-body");
      body.appendChild(el("div", "tl-title", "Phase " + ph.id + ": " + esc(ph.name)));
      if (ph.desc) body.appendChild(el("p", "muted tl-desc", esc(ph.desc)));
      if (ph.date) body.appendChild(el("span", "tl-date muted", esc(ph.date)));
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
    var layers = d.layers || [];
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
    setText("nav-features", t.nav && t.nav.features);
    setText("nav-formats", t.nav && t.nav.formats);
    setText("nav-download", t.nav && t.nav.download);
    setText("nav-roadmap", t.nav && t.nav.roadmap);
    setText("nav-status", t.nav && t.nav.status);
    setText("nav-cta", t.nav && t.nav.cta);
    setText("lang-toggle", toggleLabel());

    renderHero(d, t);
    renderFeaturesSection(t);
    renderFormatsSection(t);
    renderDownloads(d, t);
    renderRoadmap(d, t);
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
