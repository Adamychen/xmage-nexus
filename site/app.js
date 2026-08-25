(function () {
  "use strict";

  var STATUS_LABEL = { pass: "PASS", fail: "FAIL", pending: "PENDING", running: "RUNNING" };
  var NEXUS_CLASS = { yes: "tag-yes", no: "tag-no", partial: "tag-partial" };
  var NEXUS_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };
  var OFFICIAL_LABEL = { yes: "✅ Yes", no: "❌ No", partial: "🟡 Partial" };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function dot(status) {
    return '<span class="dot ' + (status || "pending") + '"></span>';
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderHeader(d) {
    var p = d.project || {};
    document.getElementById("proj-name").textContent = p.name || "Project";
    document.getElementById("proj-tagline").textContent = p.tagline || "";
    document.getElementById("stack").textContent = p.stack || "";

    document.getElementById("generated").textContent =
      "updated " + new Date(d.generatedAt || Date.now()).toLocaleString();

    var commit = document.getElementById("commit");
    if (d.commit) {
      commit.textContent = "commit " + String(d.commit).slice(0, 7);
      commit.href = "https://github.com/" + (p.repo || "") + "/commit/" + d.commit;
    } else {
      commit.style.display = "none";
    }
    var repo = document.getElementById("repo");
    repo.href = "https://github.com/" + (p.repo || "");
  }

  function card(title, status, sub, statHtml) {
    var c = el("div", "card");
    var head = el("div", "title");
    head.innerHTML = dot(status) + "<span>" + esc(title) + "</span>" +
      '<span class="pill ' + (status || "pending") + '">' + (STATUS_LABEL[status] || "PENDING") + "</span>";
    c.appendChild(head);
    if (sub) c.appendChild(el("div", "sub", esc(sub)));
    if (statHtml) c.appendChild(el("div", "stat", statHtml));
    return c;
  }

  function renderLayers(layers) {
    var wrap = document.getElementById("layers");
    wrap.innerHTML = "";
    (layers || []).forEach(function (l) {
      var stat = "";
      if (l.total != null) {
        stat = "<b>" + (l.passed || 0) + "</b> passed · <b>" + (l.failed || 0) + "</b> failed · " +
          (l.total || 0) + " total";
        if (l.durationMs) stat += " · " + (l.durationMs / 1000).toFixed(1) + "s";
      } else if (l.durationMs) {
        stat = "ran in " + (l.durationMs / 1000).toFixed(1) + "s";
      }
      wrap.appendChild(card(l.label || l.name, l.status, l.note, stat));
    });
  }

  function renderCoverage(cov, thresholds) {
    var wrap = document.getElementById("coverage");
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
    wrap.innerHTML = "";
    (phases || []).forEach(function (ph) {
      var sub = (ph.desc || "") + (ph.date ? "  ·  " + ph.date : "");
      wrap.appendChild(card("Phase " + ph.id + ": " + ph.name, ph.status, sub));
    });
  }

  function renderGuards(guards) {
    var wrap = document.getElementById("guards");
    wrap.innerHTML = "";
    (guards || []).forEach(function (g) {
      wrap.appendChild(card(g.name, g.status, (g.desc || "") + (g.note ? "  ·  " + g.note : "")));
    });
  }

  function renderEngineGaps(g) {
    if (!g) return;
    document.getElementById("gaps-total").textContent =
      "(" + (g.totalMissing || 0) + " campos del motor no expuestos por el server)";
    var tbody = document.querySelector("#gaps tbody");
    tbody.innerHTML = "";
    (g.entries || []).forEach(function (e) {
      var tr = el("tr");
      tr.appendChild(el("td", null, esc(e.mechanic)));
      tr.appendChild(el("td", null, esc(e.field)));
      tr.appendChild(el("td", "center", esc(e.view)));
      var statusText, cls;
      if (e.shown) { statusText = "✅ Mostrado"; cls = "tag-yes"; }
      else if (e.exposed) { statusText = "⚠️ Expuesto upstream"; cls = "tag-partial"; }
      else { statusText = "❌ Gap (no emitido)"; cls = "tag-no"; }
      tr.appendChild(el("td", "center " + cls, statusText));
      tr.appendChild(el("td", null, esc(e.via)));
      tbody.appendChild(tr);
    });
  }

  function renderReverse(d) {
    if (!d) return;
    document.getElementById("rev-total").textContent =
      "(" + d.totalModeled + "/" + d.totalEmitted + " campos del server modelados" +
      (d.totalUnmodeled ? ", " + d.totalUnmodeled + " sin modelar" : "") + ")";
    var wrap = document.getElementById("reverse");
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

  function renderFeatures(features) {
    var tbody = document.querySelector("#features tbody");
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

  function main() {
    fetch("./status.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        renderHeader(d);
        renderLayers(d.layers);
        renderCoverage(d.coverage, d.coverageThresholds);
        renderPhases(d.phases);
        renderGuards(d.guards);
        renderEngineGaps(d.engineGaps);
        renderReverse(d.reverseCoverage);
        renderFeatures(d.features);
      })
      .catch(function (e) {
        document.getElementById("layers").innerHTML =
          '<div class="card"><div class="title">' + dot("fail") +
          "Failed to load status.json</div>" +
          '<div class="sub">' + esc(e.message) + "</div></div>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
