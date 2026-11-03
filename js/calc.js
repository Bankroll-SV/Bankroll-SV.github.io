"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  const KINDS = ["casino", "poker"];

  const KIND_WORDS = {
    casino: "casino",
    poker: "poker",
    pokerroom: "poker",
  };

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (value == null) return NaN;
    let s = String(value).trim();
    if (!s) return NaN;
    s = s.replace(/\s/g, "").replace(/[€$£]/g, "").replace(/EUR|USD|GBP|MXN/gi, "");
    if (s.includes(",") && s.includes(".")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function toCents(value) {
    const n = typeof value === "number" && Number.isFinite(value) ? value : parseNumber(value);
    if (!Number.isFinite(n)) return NaN;
    const fixed = n.toFixed(2);
    const neg = fixed.startsWith("-");
    const parts = fixed.replace("-", "").split(".");
    const cents = Number(parts[0]) * 100 + Number(parts[1] || 0);
    return neg ? -cents : cents;
  }

  function fromCents(cents) {
    return cents / 100;
  }

  function parseDate(value) {
    const s = String(value || "").trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return validYMD(m[1], m[2], m[3]);
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s);
    if (m) return validYMD(m[3], m[2], m[1]);
    return null;
  }

  function validYMD(y, mo, d) {
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
    return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

  function canonicalKind(value) {
    const key = String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
    return KIND_WORDS[key] || "";
  }

  function profitCents(bet) {
    const buyIn = toCents(bet && bet.buyIn);
    const cashOut = toCents(bet && bet.cashOut);
    if (!Number.isFinite(buyIn) || !Number.isFinite(cashOut)) return 0;
    return cashOut - buyIn;
  }

  function profit(bet) {
    return fromCents(profitCents(bet));
  }

  function outcomeKey(bet) {
    const p = profitCents(bet);
    if (p > 0) return "profit";
    if (p < 0) return "loss";
    return "even";
  }

  function decisiveOutcome(bet) {
    const key = outcomeKey(bet);
    if (key === "profit") return "win";
    if (key === "loss") return "loss";
    return null;
  }

  function validateBet(bet) {
    const errors = {};
    if (!bet.date || !parseDate(bet.date)) errors.date = "Indica una fecha válida.";
    if (!String(bet.title || "").trim()) errors.title = "Indica un título.";
    if (KINDS.indexOf(bet.kind) === -1) errors.kind = "Elige casino o poker.";
    if (!Number.isFinite(bet.buyIn) || bet.buyIn <= 0) errors.buyIn = "El buy in debe ser mayor que 0.";
    if (!Number.isFinite(bet.cashOut) || bet.cashOut < 0) errors.cashOut = "El retiro debe ser cero o más.";
    return errors;
  }

  function prepareBet(input) {
    const src = input || {};
    const bet = {
      id: src.id || null,
      date: parseDate(src.date) || "",
      title: String(src.title || "").trim(),
      kind: canonicalKind(src.kind),
      buyIn: parseNumber(src.buyIn),
      cashOut: parseNumber(src.cashOut),
      notes: String(src.notes || "").trim(),
      createdAt: src.createdAt || null,
    };
    const errors = validateBet(bet);
    if (!errors.buyIn) bet.buyIn = fromCents(toCents(bet.buyIn));
    if (!errors.cashOut) bet.cashOut = fromCents(toCents(bet.cashOut));
    return { bet: bet, errors: errors };
  }

  function sortBets(bets) {
    return bets.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ca = a.createdAt || "";
      const cb = b.createdAt || "";
      if (ca !== cb) return ca < cb ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function filtersActive(filters) {
    if (!filters) return false;
    return Boolean(
      filters.from ||
        filters.to ||
        filters.kind ||
        filters.result ||
        String(filters.q || "").trim()
    );
  }

  function fold(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function filterBets(bets, filters) {
    const f = filters || {};
    const q = fold(String(f.q || "").trim());
    return bets.filter(function (b) {
      if (f.from && b.date < f.from) return false;
      if (f.to && b.date > f.to) return false;
      if (f.kind && b.kind !== f.kind) return false;
      if (f.result && outcomeKey(b) !== f.result) return false;
      if (q) {
        const blob = fold([b.title, b.notes, b.kind].join(" "));
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function emptySummary() {
    return {
      count: 0,
      results: { profit: 0, loss: 0, even: 0 },
      wins: 0,
      losses: 0,
      staked: 0,
      profit: 0,
      yield: null,
      roi: null,
      winRate: null,
      avgBuyIn: null,
      maxDrawdown: 0,
      maxDrawdownPct: null,
      bankroll: 0,
      peak: 0,
    };
  }

  function summarize(bets, startingBankroll, options) {
    const opts = options || {};
    const ordered = sortBets(bets || []);
    if (!ordered.length && !opts.keepEmpty) {
      const base = opts.relativeDrawdown ? 0 : fromCents(toCents(startingBankroll || 0) || 0);
      const summary = emptySummary();
      summary.bankroll = base;
      summary.peak = base;
      return summary;
    }

    let staked = 0;
    let profitC = 0;
    const results = { profit: 0, loss: 0, even: 0 };
    let wins = 0;
    let losses = 0;

    const startCents = opts.relativeDrawdown ? 0 : toCents(startingBankroll || 0) || 0;
    const roiBase = toCents(startingBankroll || 0) || 0;
    let equity = startCents;
    let peak = equity;
    let maxDd = 0;
    let maxDdPct = null;

    ordered.forEach(function (b) {
      const buyIn = toCents(b.buyIn);
      const safeBuyIn = Number.isFinite(buyIn) ? buyIn : 0;
      const p = profitCents(b);
      staked += safeBuyIn;
      profitC += p;
      const key = outcomeKey(b);
      if (results[key] != null) results[key] += 1;
      if (key === "profit") wins += 1;
      else if (key === "loss") losses += 1;
      equity += p;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDd) {
        maxDd = dd;
        maxDdPct = peak > 0 ? dd / peak : null;
      }
    });

    const decided = wins + losses;
    return {
      count: ordered.length,
      results: results,
      wins: wins,
      losses: losses,
      staked: fromCents(staked),
      profit: fromCents(profitC),
      yield: staked > 0 ? profitC / staked : null,
      roi: roiBase > 0 ? profitC / roiBase : null,
      winRate: decided > 0 ? wins / decided : null,
      avgBuyIn: ordered.length ? fromCents(Math.round(staked / ordered.length)) : null,
      maxDrawdown: fromCents(maxDd),
      maxDrawdownPct: maxDdPct,
      bankroll: fromCents(startCents + profitC),
      peak: fromCents(peak),
    };
  }

  function equityCurve(bets, startingBankroll, mode) {
    const ordered = sortBets(bets || []);
    const start = mode === "selection" ? 0 : toCents(startingBankroll || 0) || 0;
    let equity = start;
    const points = [
      {
        date: null,
        label: "Inicio",
        equity: fromCents(start),
        delta: 0,
        event: mode === "selection" ? "Selección" : "Bankroll inicial",
      },
    ];
    ordered.forEach(function (b) {
      const delta = profitCents(b);
      equity += delta;
      points.push({
        date: b.date,
        label: b.date,
        equity: fromCents(equity),
        delta: fromCents(delta),
        event: b.title || "Apuesta",
        result: outcomeKey(b),
      });
    });
    return points;
  }

  function groupBy(bets, keyFn, startingBankroll) {
    const map = new Map();
    sortBets(bets || []).forEach(function (b) {
      const key = String(keyFn(b) || "").trim() || "Sin especificar";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    });
    const rows = [];
    map.forEach(function (list, name) {
      rows.push(Object.assign({ name: name }, summarize(list, startingBankroll, { relativeDrawdown: true })));
    });
    rows.sort(function (a, b) {
      if (b.profit !== a.profit) return b.profit - a.profit;
      return a.name.localeCompare(b.name, "es");
    });
    return rows;
  }

  function streaks(bets) {
    const decisive = [];
    sortBets(bets || []).forEach(function (b) {
      const outcome = decisiveOutcome(b);
      if (!outcome) return;
      decisive.push({
        outcome: outcome,
        date: b.date,
        event: b.title,
        result: outcomeKey(b),
        profit: profit(b),
      });
    });

    let longestWin = null;
    let longestLoss = null;
    let i = 0;
    while (i < decisive.length) {
      let j = i;
      while (j < decisive.length && decisive[j].outcome === decisive[i].outcome) j += 1;
      const run = {
        type: decisive[i].outcome,
        count: j - i,
        from: decisive[i].date,
        to: decisive[j - 1].date,
      };
      if (run.type === "win" && (!longestWin || run.count > longestWin.count)) longestWin = run;
      if (run.type === "loss" && (!longestLoss || run.count > longestLoss.count)) longestLoss = run;
      i = j;
    }

    let current = null;
    if (decisive.length) {
      const last = decisive[decisive.length - 1].outcome;
      let count = 0;
      for (let k = decisive.length - 1; k >= 0 && decisive[k].outcome === last; k -= 1) count += 1;
      const slice = decisive.slice(decisive.length - count);
      current = { type: last, count: count, from: slice[0].date, to: slice[slice.length - 1].date };
    }

    return {
      current: current,
      longestWin: longestWin,
      longestLoss: longestLoss,
      recent: decisive.slice(-48),
    };
  }

  function inRange(bet, from, to) {
    if (from && bet.date < from) return false;
    if (to && bet.date > to) return false;
    return true;
  }

  function monthKey(date) {
    return String(date || "").slice(0, 7);
  }

  function monthly(bets, startingBankroll) {
    const map = new Map();
    sortBets(bets || []).forEach(function (b) {
      const key = monthKey(b.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    });
    const rows = [];
    map.forEach(function (list, month) {
      rows.push(Object.assign({ month: month }, summarize(list, startingBankroll, { relativeDrawdown: true })));
    });
    rows.sort(function (a, b) {
      return a.month < b.month ? -1 : 1;
    });
    return rows;
  }

  BT.calc = {
    KINDS: KINDS,
    parseNumber: parseNumber,
    toCents: toCents,
    fromCents: fromCents,
    parseDate: parseDate,
    canonicalKind: canonicalKind,
    outcomeKey: outcomeKey,
    profitCents: profitCents,
    profit: profit,
    decisiveOutcome: decisiveOutcome,
    validateBet: validateBet,
    prepareBet: prepareBet,
    sortBets: sortBets,
    filtersActive: filtersActive,
    filterBets: filterBets,
    summarize: summarize,
    equityCurve: equityCurve,
    groupBy: groupBy,
    streaks: streaks,
    inRange: inRange,
    monthly: monthly,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.calc;
})(typeof globalThis !== "undefined" ? globalThis : this);
