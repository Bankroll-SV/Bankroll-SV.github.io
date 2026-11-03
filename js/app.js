"use strict";

(function () {
  const PAGE = 15;
  const SPORTS = ["Fútbol", "Baloncesto", "Tenis", "Béisbol", "Fútbol americano", "Hockey", "MMA", "Boxeo", "eSports", "Motor", "Ciclismo", "Rugby"];
  const TYPES = ["1X2", "Ganador", "Más/menos", "Hándicap", "Ambos marcan", "Doble oportunidad", "Draw no bet", "Marcador exacto", "Parlay", "Prop", "Especial"];
  const BOOKS = ["Bet365", "Betfair", "Pinnacle", "Winamax", "Codere", "Sportium", "Betano", "William Hill", "PokerStars"];

  const COPY = {
    dashboard: ["Panel", "Resultado, riesgo y curva de capital"],
    apuestas: ["Apuestas", "Registro del historial"],
    analisis: ["Análisis", "Segmentos, rachas y períodos"],
    datos: ["Datos", "Cuenta, copia e importación"],
  };

  const state = {
    bets: [],
    settings: { startingBankroll: 0, currency: "EUR" },
    filters: blankFilters(),
    compare: null,
    view: "dashboard",
    sort: { key: "date", dir: "desc" },
    page: 1,
    editingId: null,
    preview: false,
    stash: null,
    returnFocus: null,
  };

  let confirmResolve = null;
  let toastTimer = 0;

  function blankFilters() {
    return { from: "", to: "", sport: "", betType: "", bookmaker: "", result: "", q: "" };
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return "bb_" + crypto.randomUUID();
    return "bb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function viewFromHash() {
    const hash = location.hash.replace("#", "");
    if (hash === "apuestas" || hash === "analisis" || hash === "datos") return hash;
    return "dashboard";
  }

  function defaultCompare() {
    const today = BT.format.todayISO();
    return {
      aFrom: BT.format.addDays(today, -29),
      aTo: today,
      bFrom: BT.format.addDays(today, -59),
      bTo: BT.format.addDays(today, -30),
    };
  }

  function currency() {
    return state.settings.currency || "EUR";
  }

  function findBet(id) {
    for (let i = 0; i < state.bets.length; i += 1) {
      if (state.bets[i].id === id) return state.bets[i];
    }
    return null;
  }

  function uniques(key) {
    const seen = {};
    const values = [];
    state.bets.forEach(function (bet) {
      const value = bet[key];
      if (!value || seen[value]) return;
      seen[value] = true;
      values.push(value);
    });
    values.sort(function (a, b) {
      return a.localeCompare(b, "es");
    });
    return values;
  }

  function sanitizeLoaded(bets) {
    const clean = [];
    (bets || []).forEach(function (raw) {
      if (!raw || typeof raw !== "object") return;
      const prepared = BT.calc.prepareBet(raw);
      if (Object.keys(prepared.errors).length) return;
      prepared.bet.id = raw.id || uid();
      prepared.bet.createdAt = raw.createdAt || prepared.bet.date + "T12:00:00.000Z";
      clean.push(prepared.bet);
    });
    return clean;
  }

  function sanitizeFilters() {
    [
      ["sport", "sport"],
      ["betType", "betType"],
      ["bookmaker", "bookmaker"],
    ].forEach(function (pair) {
      const values = uniques(pair[1]);
      if (state.filters[pair[0]] && values.indexOf(state.filters[pair[0]]) === -1) state.filters[pair[0]] = "";
    });
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, 2600);
  }

  function commit() {
    state.preview = false;
    state.stash = null;
    try {
      BT.storage.save({
        version: 1,
        settings: {
          startingBankroll: state.settings.startingBankroll,
          currency: state.settings.currency,
        },
        bets: state.bets,
      });
      return true;
    } catch (err) {
      toast("No se pudo guardar. El almacenamiento del navegador está lleno o bloqueado.");
      return false;
    }
  }

  function confirmDialog(options) {
    document.getElementById("confirm-title").textContent = options.title;
    document.getElementById("confirm-body").textContent = options.body;
    const yes = document.getElementById("confirm-yes");
    yes.textContent = options.confirmLabel || "Confirmar";
    yes.classList.toggle("btn-primary", !options.danger);
    yes.classList.toggle("btn-danger", !!options.danger);
    document.getElementById("confirm").hidden = false;
    lockScroll();
    yes.focus();
    return new Promise(function (resolve) {
      confirmResolve = resolve;
    });
  }

  function settleConfirm(value) {
    document.getElementById("confirm").hidden = true;
    lockScroll();
    if (!confirmResolve) return;
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(value);
  }

  function lockScroll() {
    const modalOpen = !document.getElementById("modal").hidden;
    const confirmOpen = !document.getElementById("confirm").hidden;
    document.body.classList.toggle("modal-open", modalOpen || confirmOpen);
  }

  async function confirmPreviewOverwrite() {
    if (!state.preview) return true;
    if (!state.stash || !state.stash.bets.length) return true;
    return confirmDialog({
      title: "Guardar la vista previa",
      body: "Esto sustituye el historial guardado en este navegador por los datos que estás viendo.",
      confirmLabel: "Sustituir y guardar",
      danger: true,
    });
  }

  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("scrim").hidden = false;
  }

  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").hidden = true;
  }

  function render() {
    sanitizeFilters();
    state.view = viewFromHash();
    const filtered = BT.calc.filtersActive(state.filters);
    const scopedBets = BT.calc.filterBets(state.bets, state.filters);
    const global = BT.calc.summarize(state.bets, state.settings.startingBankroll);
    const scoped = BT.calc.summarize(scopedBets, state.settings.startingBankroll, { relativeDrawdown: filtered });

    renderChrome(global, scopedBets, filtered);
    const empty = state.bets.length === 0;
    document.getElementById("dashboard-empty").hidden = !empty;
    document.getElementById("dashboard-body").hidden = empty;

    if (state.view === "dashboard" && !empty) {
      renderKpis(global, scoped, filtered);
      renderPerf(document.getElementById("table-sports"), BT.calc.groupBy(scopedBets, function (b) { return b.sport; }, state.settings.startingBankroll), "Deporte", scoped, false);
      renderPerf(document.getElementById("table-types"), BT.calc.groupBy(scopedBets, function (b) { return b.betType; }, state.settings.startingBankroll), "Tipo", scoped, false);
      renderRecent(scopedBets);
      renderLegend(scoped);
      document.getElementById("equity-note").textContent = filtered
        ? "Curva de la selección, desde cero"
        : "Desde el bankroll inicial";
    }
    if (state.view === "apuestas") renderBets(scopedBets);
    if (state.view === "analisis") {
      renderStreaks(scopedBets);
      renderPerf(document.getElementById("table-books"), BT.calc.groupBy(scopedBets, function (b) { return b.bookmaker; }, state.settings.startingBankroll), "Casa", scoped, false);
      renderPerf(document.getElementById("table-odds"), BT.calc.oddsBuckets(scopedBets, state.settings.startingBankroll), "Rango", scoped, true);
    }
    renderCharts(scopedBets, filtered, empty);
    syncFilters();
    syncCompare();
    syncSettings();
    document.getElementById("preview-banner").hidden = !state.preview;
  }

  function renderChrome(global, scopedBets, filtered) {
    const copy = COPY[state.view];
    document.getElementById("view-title").textContent = copy[0];
    document.getElementById("view-sub").textContent = copy[1];
    document.querySelectorAll(".nav a").forEach(function (link) {
      if (link.dataset.view === state.view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelectorAll(".view").forEach(function (section) {
      section.hidden = section.id !== "view-" + state.view;
    });
    const hideFilters = state.view === "datos";
    document.getElementById("filterbar").hidden = hideFilters;
    document.getElementById("scope-line").hidden = hideFilters;

    const cur = currency();
    document.getElementById("header-bankroll").textContent = BT.format.money(global.bankroll, cur);
    const pl = document.getElementById("header-pl");
    pl.textContent = BT.format.signedMoney(global.profit, cur);
    pl.className = BT.format.tone(global.profit);

    const total = state.bets.length;
    const noun = total === 1 ? "apuesta" : "apuestas";
    document.getElementById("sidebar-count").textContent = total + " " + noun + (state.preview ? " · vista previa" : "");

    const scope = document.getElementById("scope-line");
    if (!total) {
      scope.textContent = "Sin apuestas guardadas.";
    } else if (!filtered) {
      scope.textContent = total + " " + noun + " · historial completo";
    } else {
      scope.textContent = scopedBets.length + " de " + total + " " + noun + " con los filtros actuales. El bankroll de arriba es el de la cuenta.";
    }
  }

  function renderKpis(global, scoped, filtered) {
    const cur = currency();
    const start = state.settings.startingBankroll;
    const items = [
      {
        label: "Bankroll",
        title: "Bankroll inicial más el beneficio de todas las apuestas. No cambia al filtrar.",
        value: BT.format.money(global.bankroll, cur),
        tone: BT.format.tone(global.profit),
        note: "inicial " + BT.format.money(start, cur),
      },
      {
        label: "Beneficio",
        title: "Suma del resultado neto de las apuestas visibles.",
        value: BT.format.signedMoney(scoped.profit, cur),
        tone: BT.format.tone(scoped.profit),
        note: filtered ? "de la selección" : "historial completo",
      },
      {
        label: "ROI",
        title: "Beneficio de las apuestas visibles dividido por el bankroll inicial.",
        value: BT.format.signedPercent(scoped.roi, 2),
        tone: scoped.roi == null ? "flat" : BT.format.tone(scoped.roi),
        note: start > 0 ? "sobre el bank inicial" : "define el bankroll en Datos",
      },
      {
        label: "Yield",
        title: "Beneficio neto dividido por la suma de stakes, nulas incluidas.",
        value: BT.format.signedPercent(scoped.yield, 2),
        tone: scoped.yield == null ? "flat" : BT.format.tone(scoped.yield),
        note: scoped.staked > 0 ? "sobre " + BT.format.money(scoped.staked, cur) : "sin stakes",
      },
      {
        label: "Win rate",
        title: "Aciertos dividido por ganadas más perdidas. Una nula no entra. Un cashout entra según el signo del beneficio.",
        value: BT.format.percent(scoped.winRate, 1),
        tone: "flat",
        note: scoped.wins + " ganadas · " + scoped.losses + " perdidas",
      },
      {
        label: "Cuota media",
        title: "Media ponderada por stake. La nota muestra la media simple.",
        value: BT.format.odds(scoped.avgOddsWeighted),
        tone: "flat",
        note: scoped.avgOdds == null ? "sin cuotas" : "simple " + BT.format.odds(scoped.avgOdds),
      },
      {
        label: "Drawdown",
        title: filtered
          ? "Mayor caída de la curva de la selección, que parte de cero."
          : "Mayor caída desde un pico del bankroll hasta el valle posterior.",
        value: scoped.maxDrawdown > 0 ? BT.format.signedMoney(-scoped.maxDrawdown, cur) : BT.format.money(0, cur),
        tone: scoped.maxDrawdown > 0 ? "neg" : "flat",
        note: scoped.maxDrawdownPct != null ? BT.format.percent(scoped.maxDrawdownPct, 1) + " del pico" : "sin caída",
      },
      {
        label: "Apuestas",
        title: "Número de apuestas en la selección.",
        value: String(scoped.count),
        tone: "flat",
        note: scoped.results.void + " nulas · " + scoped.results.cashout + " cashout",
      },
    ];

    document.getElementById("kpi-rail").innerHTML = items
      .map(function (item) {
        return (
          '<article class="kpi"><span class="k" title="' +
          BT.format.esc(item.title) +
          '">' +
          BT.format.esc(item.label) +
          '</span><strong class="' +
          item.tone +
          '">' +
          item.value +
          "</strong><em>" +
          BT.format.esc(item.note) +
          "</em></article>"
        );
      })
      .join("");
  }

  function renderPerf(el, rows, nameHeader, summary, keepZeros) {
    if (!el) return;
    const visible = (rows || []).filter(function (row) {
      return keepZeros || row.count > 0;
    });
    if (!visible.some(function (row) { return row.count > 0; })) {
      el.innerHTML = '<p class="empty">No hay apuestas en esta selección.</p>';
      return;
    }
    const max = visible.reduce(function (peak, row) {
      return Math.max(peak, Math.abs(row.profit));
    }, 0);
    const body = visible
      .map(function (row) {
        const width = max ? Math.round((Math.abs(row.profit) / max) * 100) : 0;
        const muted = row.count ? "" : " is-zero";
        return (
          "<tr class=\"" + muted.trim() + "\">" +
          "<td>" + BT.format.esc(row.name) + "</td>" +
          '<td class="num">' + row.count + "</td>" +
          '<td class="num">' + BT.format.money(row.staked, currency()) + "</td>" +
          '<td class="num ' + BT.format.tone(row.profit) + '">' + BT.format.signedMoney(row.profit, currency()) + "</td>" +
          '<td class="num ' + (row.yield == null ? "flat" : BT.format.tone(row.yield)) + '">' + BT.format.signedPercent(row.yield, 2) + "</td>" +
          '<td class="num">' + BT.format.percent(row.winRate, 1) + "</td>" +
          '<td class="num col-tight">' + BT.format.odds(row.avgOddsWeighted) + "</td>" +
          '<td class="col-meter"><span class="meter ' + BT.format.tone(row.profit) + '"><span style="width:' + width + '%"></span></span></td>' +
          "</tr>"
        );
      })
      .join("");
    const foot = summary
      ? "<tfoot><tr><td>Total</td><td class=\"num\">" +
        summary.count +
        "</td><td class=\"num\">" +
        BT.format.money(summary.staked, currency()) +
        "</td><td class=\"num " +
        BT.format.tone(summary.profit) +
        "\">" +
        BT.format.signedMoney(summary.profit, currency()) +
        "</td><td class=\"num " +
        (summary.yield == null ? "flat" : BT.format.tone(summary.yield)) +
        "\">" +
        BT.format.signedPercent(summary.yield, 2) +
        "</td><td class=\"num\">" +
        BT.format.percent(summary.winRate, 1) +
        "</td><td class=\"num col-tight\">" +
        BT.format.odds(summary.avgOddsWeighted) +
        '</td><td class="col-meter"></td></tr></tfoot>'
      : "";
    el.innerHTML =
      '<div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>" + BT.format.esc(nameHeader) + "</th>" +
      '<th class="num">Apuestas</th><th class="num">Apostado</th><th class="num">Beneficio</th><th class="num">Yield</th><th class="num">Win rate</th><th class="num col-tight">Cuota</th><th class="col-meter" aria-label="Magnitud"></th>' +
      "</tr></thead><tbody>" +
      body +
      "</tbody>" +
      foot +
      "</table></div>";
  }

  function renderRecent(bets) {
    const rows = BT.calc.sortBets(bets).reverse().slice(0, 8);
    const el = document.getElementById("recent-bets");
    if (!rows.length) {
      el.innerHTML = '<p class="empty">Ninguna apuesta coincide con los filtros.</p>';
      return;
    }
    el.innerHTML =
      '<div class="table-wrap"><table class="data"><thead><tr>' +
      "<th>Fecha</th><th>Evento</th><th class=\"num\">Cuota</th><th class=\"num\">Stake</th><th>Resultado</th><th class=\"num\">Beneficio</th>" +
      "</tr></thead><tbody>" +
      rows.map(function (bet) { return betRow(bet, false); }).join("") +
      "</tbody></table></div>";
  }

  function betRow(bet, withExtra) {
    const profit = BT.calc.profit(bet);
    const sub = [bet.competition, withExtra ? bet.sport : ""].filter(Boolean).join(" · ");
    return (
      '<tr data-id="' + BT.format.esc(bet.id) + '">' +
      "<td>" + BT.format.esc(BT.format.date(bet.date)) + "</td>" +
      "<td><span class=\"event\"" + (bet.notes ? ' title="' + BT.format.esc(bet.notes) + '"' : "") + ">" + BT.format.esc(bet.event) + "</span>" +
      (sub ? '<span class="event-sub">' + BT.format.esc(sub) + "</span>" : "") +
      "</td>" +
      (withExtra ? '<td class="col-opt">' + BT.format.esc(bet.sport) + "</td><td class=\"col-opt\">" + BT.format.esc(bet.betType) + "</td>" : "") +
      '<td class="num">' + BT.format.odds(bet.odds) + "</td>" +
      '<td class="num">' + BT.format.money(bet.stake, currency()) + "</td>" +
      "<td>" + resultHtml(bet.result) + "</td>" +
      '<td class="num ' + BT.format.tone(profit) + '">' + BT.format.signedMoney(profit, currency()) + "</td>" +
      (withExtra ? '<td class="col-opt">' + BT.format.esc(bet.bookmaker) + "</td>" : "") +
      (withExtra
        ? '<td class="actions"><button type="button" data-action="edit" data-id="' +
          BT.format.esc(bet.id) +
          '">Editar</button><button type="button" class="danger" data-action="delete" data-id="' +
          BT.format.esc(bet.id) +
          '">Borrar</button></td>'
        : "") +
      "</tr>"
    );
  }

  function resultHtml(result) {
    return '<span class="result result-' + result + '"><span class="dot" aria-hidden="true"></span>' + BT.format.resultLabel(result) + "</span>";
  }

  function renderLegend(summary) {
    const total = summary.count || 0;
    document.getElementById("dist-legend").innerHTML = BT.charts.DIST.map(function (item) {
      const count = summary.results[item.key] || 0;
      const pct = total ? count / total : 0;
      return (
        "<li><span class=\"swatch\" style=\"background:" + item.color + "\"></span><span>" +
        item.label + "</span><strong>" + count + "</strong><em>" + BT.format.percent(pct, 1) + "</em></li>"
      );
    }).join("");
  }

  function renderBets(bets) {
    const el = document.getElementById("bets-wrap");
    const sorted = bets.slice().sort(function (a, b) {
      return compareBets(a, b, state.sort.key, state.sort.dir);
    });
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * PAGE;
    const slice = sorted.slice(start, start + PAGE);
    document.getElementById("bets-count").textContent = sorted.length
      ? start + 1 + "–" + (start + slice.length) + " de " + sorted.length
      : "0 apuestas";
    if (!sorted.length) {
      el.innerHTML = state.bets.length
        ? '<p class="empty">Ninguna apuesta coincide con los filtros.</p>'
        : '<div class="empty-state compact"><span class="empty-mark"></span><h2>El historial está vacío</h2><p>Registra la primera apuesta o revisa una demostración.</p><div class="btn-row center"><button type="button" class="btn btn-primary" data-action="new">Nueva apuesta</button><button type="button" class="btn btn-ghost" data-action="preview-demo">Ver demostración</button></div></div>';
      return;
    }
    const headers = [
      ["date", "Fecha"],
      ["event", "Evento"],
      ["sport", "Deporte", "col-opt"],
      ["betType", "Tipo", "col-opt"],
      ["odds", "Cuota", "num"],
      ["stake", "Stake", "num"],
      ["result", "Resultado"],
      ["profit", "Beneficio", "num"],
      ["bookmaker", "Casa", "col-opt"],
    ];
    el.innerHTML =
      '<div class="table-wrap"><table class="data bets"><thead><tr>' +
      headers
        .map(function (header) {
          const cls = [header[2] || "", state.sort.key === header[0] ? "sorted" : ""].filter(Boolean).join(" ");
          const arrow = state.sort.key === header[0] ? (state.sort.dir === "asc" ? " ↑" : " ↓") : "";
          return (
            "<th class=\"" + cls + "\"><button type=\"button\" data-action=\"sort\" data-sort=\"" +
            header[0] + "\">" + header[1] + arrow + "</button></th>"
          );
        })
        .join("") +
      '<th class="actions" aria-label="Acciones"></th></tr></thead><tbody>' +
      slice.map(function (bet) { return betRow(bet, true); }).join("") +
      "</tbody></table></div>" +
      '<div class="pager"><span>Página ' + state.page + " de " + pages + "</span><div>" +
      '<button type="button" class="btn btn-ghost" data-action="page" data-page="prev"' + (state.page <= 1 ? " disabled" : "") + ">Anterior</button>" +
      '<button type="button" class="btn btn-ghost" data-action="page" data-page="next"' + (state.page >= pages ? " disabled" : "") + ">Siguiente</button>" +
      "</div></div>";
  }

  function compareBets(a, b, key, dir) {
    const sign = dir === "asc" ? 1 : -1;
    let va;
    let vb;
    if (key === "profit") {
      va = BT.calc.profitCents(a);
      vb = BT.calc.profitCents(b);
    } else if (key === "odds" || key === "stake") {
      va = Number(a[key]);
      vb = Number(b[key]);
    } else if (key === "date") {
      va = a.date + (a.createdAt || "");
      vb = b.date + (b.createdAt || "");
    } else {
      va = String(a[key] || "").toLocaleLowerCase("es");
      vb = String(b[key] || "").toLocaleLowerCase("es");
    }
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return String(a.id).localeCompare(String(b.id));
  }

  function renderStreaks(bets) {
    const info = BT.calc.streaks(bets);
    const el = document.getElementById("streaks");
    el.innerHTML =
      '<header class="card-head"><div><h2>Rachas</h2><p>Las nulas no cortan la racha y no aparecen en la tira.</p></div></header>' +
      '<div class="streak-grid">' +
      streakStat("Actual", info.current) +
      streakStat("Mejor ganadora", info.longestWin) +
      streakStat("Peor perdedora", info.longestLoss) +
      "</div>" +
      (info.recent.length
        ? '<div class="pip-row" aria-hidden="true">' +
          info.recent
            .map(function (item) {
              const title = BT.format.date(item.date) + " · " + item.event + " · " + BT.format.signedMoney(item.profit, currency());
              return '<span class="pip ' + item.outcome + '" title="' + BT.format.esc(title) + '"></span>';
            })
            .join("") +
          "</div>"
        : '<p class="empty">Todavía no hay resultados decisivos.</p>');
  }

  function streakStat(label, run) {
    if (!run) {
      return '<div><span class="k">' + label + '</span><strong class="flat">—</strong><em>sin datos</em></div>';
    }
    const word = run.type === "win" ? (run.count === 1 ? "ganada" : "ganadas") : run.count === 1 ? "perdida" : "perdidas";
    const when = run.from === run.to ? BT.format.date(run.from) : BT.format.date(run.from) + " – " + BT.format.date(run.to);
    return (
      "<div><span class=\"k\">" + label + '</span><strong class="' + (run.type === "loss" ? "neg" : "pos") + '">' +
      run.count + " " + word + "</strong><em>" + BT.format.esc(when) + "</em></div>"
    );
  }

  function renderCompare() {
    const el = document.getElementById("compare-table");
    const c = state.compare;
    if ((c.aFrom && c.aTo && c.aFrom > c.aTo) || (c.bFrom && c.bTo && c.bFrom > c.bTo)) {
      el.innerHTML = '<p class="empty">Revisa los rangos: la fecha inicial es posterior a la final.</p>';
      return;
    }
    const filters = Object.assign({}, state.filters, { from: "", to: "" });
    const base = BT.calc.filterBets(state.bets, filters);
    const aBets = base.filter(function (bet) { return BT.calc.inRange(bet, c.aFrom, c.aTo); });
    const bBets = base.filter(function (bet) { return BT.calc.inRange(bet, c.bFrom, c.bTo); });
    const A = BT.calc.summarize(aBets, state.settings.startingBankroll, { relativeDrawdown: true, keepEmpty: true });
    const B = BT.calc.summarize(bBets, state.settings.startingBankroll, { relativeDrawdown: true, keepEmpty: true });
    const rows = [
      ["Apuestas", String(A.count), String(B.count), signedInt(B.count - A.count), "flat"],
      ["Apostado", BT.format.money(A.staked, currency()), BT.format.money(B.staked, currency()), BT.format.signedMoney(B.staked - A.staked, currency()), BT.format.tone(B.staked - A.staked)],
      ["Beneficio", BT.format.signedMoney(A.profit, currency()), BT.format.signedMoney(B.profit, currency()), BT.format.signedMoney(B.profit - A.profit, currency()), BT.format.tone(B.profit - A.profit)],
      ["Yield", BT.format.signedPercent(A.yield, 2), BT.format.signedPercent(B.yield, 2), BT.format.points(diff(B.yield, A.yield), 2), toneOrFlat(diff(B.yield, A.yield))],
      ["ROI", BT.format.signedPercent(A.roi, 2), BT.format.signedPercent(B.roi, 2), BT.format.points(diff(B.roi, A.roi), 2), toneOrFlat(diff(B.roi, A.roi))],
      ["Win rate", BT.format.percent(A.winRate, 1), BT.format.percent(B.winRate, 1), BT.format.points(diff(B.winRate, A.winRate), 1), toneOrFlat(diff(B.winRate, A.winRate))],
      ["Cuota media", BT.format.odds(A.avgOddsWeighted), BT.format.odds(B.avgOddsWeighted), signedOdds(diff(B.avgOddsWeighted, A.avgOddsWeighted)), "flat"],
      ["Drawdown", BT.format.money(A.maxDrawdown, currency()), BT.format.money(B.maxDrawdown, currency()), BT.format.signedMoney(B.maxDrawdown - A.maxDrawdown, currency()), "flat"],
    ];
    el.innerHTML =
      '<div class="table-wrap"><table class="data"><thead><tr><th>Métrica</th><th class="num">Período A</th><th class="num">Período B</th><th class="num">B − A</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          return "<tr><td>" + row[0] + '</td><td class="num">' + row[1] + '</td><td class="num">' + row[2] + '</td><td class="num ' + row[4] + '">' + row[3] + "</td></tr>";
        })
        .join("") +
      "</tbody></table></div>";
  }

  function diff(a, b) {
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    return a - b;
  }

  function toneOrFlat(n) {
    return n == null ? "flat" : BT.format.tone(n);
  }

  function signedInt(n) {
    if (n > 0) return "+" + n;
    if (n < 0) return "−" + Math.abs(n);
    return "0";
  }

  function signedOdds(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    const body = BT.format.odds(Math.abs(n));
    if (n > 0.0001) return "+" + body;
    if (n < -0.0001) return "−" + body;
    return body;
  }

  function renderCharts(scopedBets, filtered, empty) {
    BT.charts.destroyAll();
    if (state.view === "dashboard" && !empty) {
      const showEquity = scopedBets.length > 0;
      document.getElementById("equity-box").hidden = !showEquity;
      document.getElementById("equity-empty").hidden = showEquity;
      if (showEquity) {
        const mode = filtered ? "selection" : "bankroll";
        const points = BT.calc.equityCurve(scopedBets, state.settings.startingBankroll, mode);
        void document.getElementById("equity-box").offsetWidth;
        BT.charts.equity(document.getElementById("chart-equity"), points, { mode: mode, currency: currency() });
      }
      const summary = BT.calc.summarize(scopedBets, state.settings.startingBankroll, { relativeDrawdown: filtered });
      const showDist = summary.count > 0;
      document.getElementById("dist-box").hidden = !showDist;
      document.getElementById("dist-empty").hidden = showDist;
      if (showDist) {
        void document.getElementById("dist-box").offsetWidth;
        BT.charts.distribution(document.getElementById("chart-dist"), summary.results);
      }
    }
    if (state.view === "analisis") {
      const rows = BT.calc.monthly(scopedBets, state.settings.startingBankroll);
      const show = rows.length > 0;
      document.getElementById("monthly-box").hidden = !show;
      document.getElementById("monthly-empty").hidden = show;
      if (show) {
        void document.getElementById("monthly-box").offsetWidth;
        BT.charts.monthly(document.getElementById("chart-monthly"), rows, currency());
      }
      renderCompare();
    }
  }

  function syncFilters() {
    fillFilter("f-sport", uniques("sport"), "sport");
    fillFilter("f-type", uniques("betType"), "betType");
    fillFilter("f-book", uniques("bookmaker"), "bookmaker");
    [
      ["f-from", "from"],
      ["f-to", "to"],
      ["f-result", "result"],
      ["f-q", "q"],
    ].forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (document.activeElement === el) return;
      if (el.value !== state.filters[pair[1]]) el.value = state.filters[pair[1]];
    });
  }

  function fillFilter(id, values, key) {
    const el = document.getElementById(id);
    const current = state.filters[key];
    el.innerHTML =
      '<option value="">Todos</option>' +
      values
        .map(function (value) {
          return '<option value="' + BT.format.esc(value) + '">' + BT.format.esc(value) + "</option>";
        })
        .join("");
    if (document.activeElement !== el) el.value = current && values.indexOf(current) !== -1 ? current : "";
  }

  function syncCompare() {
    [
      ["cmp-a-from", "aFrom"],
      ["cmp-a-to", "aTo"],
      ["cmp-b-from", "bFrom"],
      ["cmp-b-to", "bTo"],
    ].forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (!el || document.activeElement === el) return;
      if (el.value !== state.compare[pair[1]]) el.value = state.compare[pair[1]];
    });
  }

  function syncSettings() {
    const bank = document.getElementById("set-bankroll");
    const select = document.getElementById("set-currency");
    if (document.activeElement !== bank) bank.value = BT.format.plainNumber(state.settings.startingBankroll, 2);
    if (document.activeElement !== select) select.value = state.settings.currency;
  }

  function fillDatalists() {
    fillDataList("list-sports", SPORTS.concat(uniques("sport")));
    fillDataList("list-types", TYPES.concat(uniques("betType")));
    fillDataList("list-books", BOOKS.concat(uniques("bookmaker")));
  }

  function fillDataList(id, values) {
    const seen = {};
    const unique = [];
    values.forEach(function (value) {
      if (!value || seen[value]) return;
      seen[value] = true;
      unique.push(value);
    });
    unique.sort(function (a, b) { return a.localeCompare(b, "es"); });
    document.getElementById(id).innerHTML = unique
      .map(function (value) {
        return '<option value="' + BT.format.esc(value) + '"></option>';
      })
      .join("");
  }

  function readForm() {
    return {
      date: document.getElementById("bet-date").value,
      sport: document.getElementById("bet-sport").value,
      competition: document.getElementById("bet-competition").value,
      event: document.getElementById("bet-event").value,
      betType: document.getElementById("bet-type").value,
      bookmaker: document.getElementById("bet-book").value,
      odds: document.getElementById("bet-odds").value,
      stake: document.getElementById("bet-stake").value,
      result: document.getElementById("bet-result").value,
      cashoutAmount: document.getElementById("bet-cashout").value,
      notes: document.getElementById("bet-notes").value,
    };
  }

  function showErrors(errors) {
    document.querySelectorAll("[data-error-for]").forEach(function (el) {
      el.textContent = errors[el.dataset.errorFor] || "";
    });
    document.querySelectorAll("[data-field]").forEach(function (el) {
      el.classList.toggle("invalid", Boolean(errors[el.dataset.field]));
    });
  }

  function updatePreview() {
    const prepared = BT.calc.prepareBet(readForm());
    const el = document.getElementById("profit-preview");
    const blocked = prepared.errors.odds || prepared.errors.stake || prepared.errors.result || prepared.errors.cashoutAmount;
    if (blocked) {
      el.textContent = "—";
      el.className = "preview-value flat";
      return;
    }
    const value = BT.calc.profit(prepared.bet);
    el.textContent = BT.format.signedMoney(value, currency());
    el.className = "preview-value " + BT.format.tone(value);
  }

  function syncCashout() {
    document.getElementById("field-cashout").hidden = document.getElementById("bet-result").value !== "cashout";
  }

  function openModal(bet) {
    state.returnFocus = document.activeElement;
    state.editingId = bet ? bet.id : null;
    document.getElementById("bet-form").reset();
    showErrors({});
    fillDatalists();
    document.getElementById("modal-title").textContent = bet ? "Editar apuesta" : "Nueva apuesta";
    document.getElementById("btn-delete-bet").hidden = !bet;
    document.getElementById("bet-date").value = bet ? bet.date : BT.format.todayISO();
    if (bet) {
      document.getElementById("bet-sport").value = bet.sport;
      document.getElementById("bet-competition").value = bet.competition || "";
      document.getElementById("bet-event").value = bet.event;
      document.getElementById("bet-type").value = bet.betType;
      document.getElementById("bet-book").value = bet.bookmaker;
      document.getElementById("bet-odds").value = oddsInput(bet.odds);
      document.getElementById("bet-stake").value = BT.format.plainNumber(bet.stake, 2);
      document.getElementById("bet-result").value = bet.result;
      document.getElementById("bet-cashout").value = bet.cashoutAmount == null ? "" : BT.format.plainNumber(bet.cashoutAmount, 2);
      document.getElementById("bet-notes").value = bet.notes || "";
    }
    syncCashout();
    updatePreview();
    document.getElementById("modal").hidden = false;
    lockScroll();
    document.getElementById("bet-date").focus();
  }

  function oddsInput(n) {
    const digits = Math.abs(n * 100 - Math.round(n * 100)) > 0.001 ? 3 : 2;
    return BT.format.plainNumber(n, digits);
  }

  function closeModal() {
    document.getElementById("modal").hidden = true;
    lockScroll();
    if (state.returnFocus && state.returnFocus.focus) state.returnFocus.focus();
  }

  async function saveForm() {
    const input = readForm();
    if (state.editingId) {
      const existing = findBet(state.editingId);
      input.id = state.editingId;
      input.createdAt = existing ? existing.createdAt : null;
    }
    const prepared = BT.calc.prepareBet(input);
    showErrors(prepared.errors);
    const keys = Object.keys(prepared.errors);
    if (keys.length) {
      const field = document.querySelector('[data-field="' + keys[0] + '"]');
      if (field) field.focus();
      return;
    }
    if (!(await confirmPreviewOverwrite())) return;
    const bet = prepared.bet;
    if (!bet.id) {
      bet.id = uid();
      bet.createdAt = new Date().toISOString();
    }
    const index = state.bets.findIndex(function (item) { return item.id === bet.id; });
    if (index === -1) state.bets.push(bet);
    else state.bets[index] = bet;
    closeModal();
    if (commit()) toast("Apuesta guardada");
    render();
  }

  async function deleteBet(id) {
    const bet = findBet(id);
    if (!bet) return;
    const ok = await confirmDialog({
      title: "Borrar apuesta",
      body: "Se eliminará «" + bet.event + "» del " + BT.format.date(bet.date) + ". Esta acción no se puede deshacer.",
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!ok) return;
    if (!(await confirmPreviewOverwrite())) return;
    state.bets = state.bets.filter(function (item) { return item.id !== id; });
    closeModal();
    if (commit()) toast("Apuesta eliminada");
    render();
  }

  function enterPreview() {
    if (state.preview) {
      toast("Ya estás viendo la demostración.");
      return;
    }
    state.stash = {
      bets: state.bets.slice(),
      settings: { startingBankroll: state.settings.startingBankroll, currency: state.settings.currency },
    };
    state.preview = true;
    state.bets = BT.demo.build();
    if (!(state.settings.startingBankroll > 0)) state.settings.startingBankroll = BT.demo.BANKROLL;
    if (location.hash !== "#panel" && location.hash !== "") location.hash = "#panel";
    render();
  }

  function exitPreview() {
    if (!state.preview || !state.stash) return;
    state.bets = state.stash.bets;
    state.settings = state.stash.settings;
    state.preview = false;
    state.stash = null;
    render();
  }

  async function savePreview() {
    if (!state.preview) return;
    if (!(await confirmPreviewOverwrite())) return;
    if (!(state.settings.startingBankroll > 0)) state.settings.startingBankroll = BT.demo.BANKROLL;
    if (commit()) toast("Demostración guardada");
    render();
  }

  async function loadDemo() {
    if (state.preview) {
      toast("Sal de la vista previa antes de añadir otra copia.");
      return;
    }
    if (state.bets.length) {
      const ok = await confirmDialog({
        title: "Añadir demostración",
        body: "Se añadirán 36 apuestas de ejemplo al historial actual.",
        confirmLabel: "Añadir",
        danger: false,
      });
      if (!ok) return;
    }
    const ids = {};
    state.bets.forEach(function (bet) { ids[bet.id] = true; });
    const extra = BT.demo.build().map(function (bet) {
      const copy = Object.assign({}, bet);
      if (ids[copy.id]) copy.id = uid();
      ids[copy.id] = true;
      return copy;
    });
    state.bets = state.bets.concat(extra);
    if (!(state.settings.startingBankroll > 0)) state.settings.startingBankroll = BT.demo.BANKROLL;
    if (commit()) toast("Demostración añadida");
    render();
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportSelection() {
    return BT.calc.filterBets(state.bets, state.filters);
  }

  async function importText(text, kind) {
    if (state.preview) {
      toast("Sal de la vista previa antes de importar.");
      return;
    }
    const parsed = kind === "json" ? BT.io.parseBackup(text) : BT.io.parseCsv(text);
    if (!parsed.bets.length) {
      renderReport(parsed, 0);
      return;
    }
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    if (mode === "replace") {
      const ok = await confirmDialog({
        title: "Reemplazar historial",
        body: "Se sustituirán las " + state.bets.length + " apuestas guardadas por " + parsed.bets.length + " del archivo.",
        confirmLabel: "Reemplazar",
        danger: true,
      });
      if (!ok) return;
    }
    const ids = {};
    if (mode !== "replace") state.bets.forEach(function (bet) { ids[bet.id] = true; });
    const incoming = parsed.bets.map(function (bet) {
      if (!bet.id || ids[bet.id]) bet.id = uid();
      ids[bet.id] = true;
      if (!bet.createdAt) bet.createdAt = bet.date + "T12:00:00.000Z";
      return bet;
    });
    if (mode === "replace") {
      state.bets = incoming;
      if (parsed.settings) {
        const bank = BT.calc.parseNumber(parsed.settings.startingBankroll);
        if (Number.isFinite(bank) && bank >= 0) state.settings.startingBankroll = Math.round(bank * 100) / 100;
        if (BT.format.CURRENCIES.indexOf(parsed.settings.currency) !== -1) state.settings.currency = parsed.settings.currency;
      }
    } else {
      state.bets = state.bets.concat(incoming);
    }
    if (commit()) toast(incoming.length + (incoming.length === 1 ? " apuesta importada" : " apuestas importadas"));
    render();
    renderReport(parsed, incoming.length);
  }

  function renderReport(parsed, imported) {
    const errors = parsed.errors || [];
    let html = "<p>" + imported + " importadas.";
    if (errors.length) html += " " + errors.length + (errors.length === 1 ? " fila omitida." : " filas omitidas.");
    html += "</p>";
    if (errors.length) {
      html += "<ul>" + errors.slice(0, 8).map(function (error) {
        return "<li>Fila " + error.line + ": " + BT.format.esc(error.message) + "</li>";
      }).join("") + "</ul>";
      if (errors.length > 8) html += "<p>Y " + (errors.length - 8) + " más.</p>";
    }
    document.getElementById("import-report").innerHTML = html;
  }

  function readImport(file) {
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || "");
      const name = String(file.name || "").toLowerCase();
      const trimmed = text.trim();
      const json = name.endsWith(".json") || trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[";
      importText(text, json ? "json" : "csv");
    };
    reader.readAsText(file, "UTF-8");
  }

  function applyBankroll() {
    const el = document.getElementById("set-bankroll");
    const n = BT.calc.parseNumber(el.value);
    if (!Number.isFinite(n) || n < 0) {
      el.value = BT.format.plainNumber(state.settings.startingBankroll, 2);
      return;
    }
    state.settings.startingBankroll = Math.round(n * 100) / 100;
    if (!state.preview) commit();
    render();
  }

  function readFiltersFromDom() {
    state.filters = {
      from: document.getElementById("f-from").value,
      to: document.getElementById("f-to").value,
      sport: document.getElementById("f-sport").value,
      betType: document.getElementById("f-type").value,
      bookmaker: document.getElementById("f-book").value,
      result: document.getElementById("f-result").value,
      q: document.getElementById("f-q").value,
    };
    state.page = 1;
    render();
  }

  function readCompareFromDom() {
    state.compare.aFrom = document.getElementById("cmp-a-from").value;
    state.compare.aTo = document.getElementById("cmp-a-to").value;
    state.compare.bFrom = document.getElementById("cmp-b-from").value;
    state.compare.bTo = document.getElementById("cmp-b-to").value;
    render();
  }

  async function clearBets() {
    if (state.preview) {
      toast("Sal de la vista previa antes de borrar.");
      return;
    }
    if (!state.bets.length) {
      toast("No hay apuestas.");
      return;
    }
    const ok = await confirmDialog({
      title: "Borrar historial",
      body: "Se eliminarán todas las apuestas de este navegador. El bankroll inicial y la moneda se conservan. Exporta un JSON antes si quieres una copia.",
      confirmLabel: "Borrar historial",
      danger: true,
    });
    if (!ok) return;
    state.bets = [];
    if (commit()) toast("Historial borrado");
    render();
  }

  function handleAction(el) {
    const action = el.dataset.action;
    if (el.disabled) return;
    if (action === "new") openModal(null);
    else if (action === "close-modal") closeModal();
    else if (action === "edit") openModal(findBet(el.dataset.id));
    else if (action === "delete") deleteBet(el.dataset.id);
    else if (action === "delete-current" && state.editingId) deleteBet(state.editingId);
    else if (action === "sort") {
      const key = el.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else state.sort = { key: key, dir: key === "event" || key === "sport" || key === "betType" || key === "bookmaker" || key === "result" ? "asc" : "desc" };
      render();
    } else if (action === "page") {
      state.page += el.dataset.page === "next" ? 1 : -1;
      render();
    } else if (action === "clear-filters") {
      state.filters = blankFilters();
      state.page = 1;
      render();
    } else if (action === "preview-demo") enterPreview();
    else if (action === "load-demo") loadDemo();
    else if (action === "save-preview") savePreview();
    else if (action === "exit-preview") exitPreview();
    else if (action === "confirm-yes") settleConfirm(true);
    else if (action === "confirm-no") settleConfirm(false);
    else if (action === "export-csv-all") download("blackbook-apuestas.csv", BT.io.toCsv(state.bets), "text/csv;charset=utf-8");
    else if (action === "export-csv-selection") download("blackbook-seleccion.csv", BT.io.toCsv(exportSelection()), "text/csv;charset=utf-8");
    else if (action === "export-json") download("blackbook-copia.json", BT.io.toBackup({ settings: state.settings, bets: state.bets }), "application/json;charset=utf-8");
    else if (action === "export-template") download("plantilla-blackbook.csv", BT.io.template(), "text/csv;charset=utf-8");
    else if (action === "clear-bets") clearBets();
    else if (action === "close-sidebar") closeSidebar();
  }

  function bind() {
    document.addEventListener("click", function (event) {
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        handleAction(actionEl);
        return;
      }
      const row = event.target.closest("tr[data-id]");
      if (row) openModal(findBet(row.dataset.id));
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!document.getElementById("confirm").hidden) {
        settleConfirm(false);
        return;
      }
      if (!document.getElementById("modal").hidden) closeModal();
      else closeSidebar();
    });
    document.getElementById("bet-form").addEventListener("submit", function (event) {
      event.preventDefault();
      saveForm();
    });
    document.getElementById("bet-form").addEventListener("input", function () {
      syncCashout();
      updatePreview();
    });
    ["f-from", "f-to", "f-sport", "f-type", "f-book", "f-result"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readFiltersFromDom);
    });
    document.getElementById("f-q").addEventListener("input", readFiltersFromDom);
    ["cmp-a-from", "cmp-a-to", "cmp-b-from", "cmp-b-to"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readCompareFromDom);
    });
    document.getElementById("set-bankroll").addEventListener("change", applyBankroll);
    document.getElementById("set-currency").addEventListener("change", function (event) {
      state.settings.currency = event.target.value;
      if (!state.preview) commit();
      render();
    });
    document.getElementById("nav-toggle").addEventListener("click", function () {
      if (document.getElementById("sidebar").classList.contains("open")) closeSidebar();
      else openSidebar();
    });
    document.getElementById("scrim").addEventListener("click", closeSidebar);
    document.querySelectorAll(".nav a").forEach(function (link) {
      link.addEventListener("click", closeSidebar);
    });
    window.addEventListener("hashchange", function () {
      closeSidebar();
      render();
    });
    const file = document.getElementById("import-file");
    file.addEventListener("change", function () {
      if (file.files && file.files[0]) readImport(file.files[0]);
      file.value = "";
    });
    const zone = document.getElementById("dropzone");
    zone.addEventListener("dragover", function (event) {
      event.preventDefault();
      zone.classList.add("drag");
    });
    zone.addEventListener("dragleave", function () { zone.classList.remove("drag"); });
    zone.addEventListener("drop", function (event) {
      event.preventDefault();
      zone.classList.remove("drag");
      const dropped = event.dataTransfer.files && event.dataTransfer.files[0];
      if (dropped) readImport(dropped);
    });
  }

  function fillCurrency() {
    document.getElementById("set-currency").innerHTML = BT.format.CURRENCIES.map(function (code) {
      return '<option value="' + code + '">' + code + "</option>";
    }).join("");
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const data = BT.storage.load();
    state.settings = data.settings;
    state.bets = sanitizeLoaded(data.bets);
    state.compare = defaultCompare();
    state.view = viewFromHash();
    fillCurrency();
    bind();
    if (params.get("preview") === "1") enterPreview();
    else render();
  }

  init();
})();
