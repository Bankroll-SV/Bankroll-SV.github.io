"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  const RESULTS = ["won", "lost", "void", "cashout"];

  const RESULT_WORDS = {
    ganada: "won",
    ganado: "won",
    ganadora: "won",
    win: "won",
    won: "won",
    w: "won",
    perdida: "lost",
    perdido: "lost",
    perdedora: "lost",
    lost: "lost",
    lose: "lost",
    loss: "lost",
    l: "lost",
    nula: "void",
    nulo: "void",
    anulada: "void",
    anulado: "void",
    void: "void",
    push: "void",
    cashout: "cashout",
    cash: "cashout",
    cierre: "cashout",
    cobro: "cashout",
    cobrada: "cashout",
  };

  const BUCKETS = [
    { label: "≤ 1,50", test: (o) => o <= 1.5 },
    { label: "1,51 – 1,80", test: (o) => o > 1.5 && o <= 1.8 },
    { label: "1,81 – 2,20", test: (o) => o > 1.8 && o <= 2.2 },
    { label: "2,21 – 3,00", test: (o) => o > 2.2 && o <= 3 },
    { label: "3,01 – 5,00", test: (o) => o > 3 && o <= 5 },
    { label: "≥ 5,01", test: (o) => o > 5 },
  ];

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

  function canonicalResult(value) {
    if (RESULTS.indexOf(value) !== -1) return value;
    const key = String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
    return RESULT_WORDS[key] || "";
  }

  function profitCents(bet) {
    const stake = toCents(bet && bet.stake);
    if (!Number.isFinite(stake)) return 0;
    if (bet.result === "won") {
      const odds = parseNumber(bet.odds);
      if (!Number.isFinite(odds)) return 0;
      return toCents((stake / 100) * (odds - 1));
    }
    if (bet.result === "lost") return -stake;
    if (bet.result === "void") return 0;
    if (bet.result === "cashout") {
      const back = toCents(bet.cashoutAmount);
      if (!Number.isFinite(back)) return 0;
      return back - stake;
    }
    return 0;
  }

  function profit(bet) {
    return fromCents(profitCents(bet));
  }

  function decisiveOutcome(bet) {
    if (!bet) return null;
    if (bet.result === "won") return "win";
    if (bet.result === "lost") return "loss";
    if (bet.result === "void") return null;
    if (bet.result === "cashout") {
      const p = profitCents(bet);
      if (p > 0) return "win";
      if (p < 0) return "loss";
      return null;
    }
    return null;
  }

  function validateBet(bet) {
    const errors = {};
    if (!bet.date || !parseDate(bet.date)) errors.date = "Indica una fecha válida.";
    if (!String(bet.sport || "").trim()) errors.sport = "Indica el deporte.";
    if (!String(bet.event || "").trim()) errors.event = "Indica el evento.";
    if (!String(bet.betType || "").trim()) errors.betType = "Indica el tipo de apuesta.";
    const odds = parseNumber(bet.odds);
    if (!Number.isFinite(odds) || odds <= 1) errors.odds = "La cuota decimal debe ser mayor que 1.";
    const stake = parseNumber(bet.stake);
    if (!Number.isFinite(stake) || stake <= 0) errors.stake = "El stake debe ser mayor que 0.";
    if (RESULTS.indexOf(bet.result) === -1) errors.result = "Elige un resultado.";
    if (bet.result === "cashout") {
      const back = parseNumber(bet.cashoutAmount);
      if (!Number.isFinite(back) || back < 0) errors.cashoutAmount = "Indica el importe cobrado, cero o más.";
    }
    if (!String(bet.bookmaker || "").trim()) errors.bookmaker = "Indica la casa de apuestas.";
    return errors;
  }

  function prepareBet(input) {
    const src = input || {};
    const result = canonicalResult(src.result);
    const date = parseDate(src.date) || "";
    const bet = {
      id: src.id || null,
      date: date,
      sport: String(src.sport || "").trim(),
      competition: String(src.competition || "").trim(),
      event: String(src.event || "").trim(),
      betType: String(src.betType || "").trim(),
      odds: parseNumber(src.odds),
      stake: parseNumber(src.stake),
      result: result,
      cashoutAmount: result === "cashout" ? parseNumber(src.cashoutAmount) : null,
      bookmaker: String(src.bookmaker || "").trim(),
      notes: String(src.notes || "").trim(),
      createdAt: src.createdAt || null,
    };
    const errors = validateBet(bet);
    if (!errors.odds) bet.odds = Math.round(bet.odds * 1000) / 1000;
    if (!errors.stake) bet.stake = fromCents(toCents(bet.stake));
    if (bet.result === "cashout" && !errors.cashoutAmount) {
      bet.cashoutAmount = fromCents(toCents(bet.cashoutAmount));
    }
    if (bet.date) bet.date = parseDate(bet.date);
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
        filters.sport ||
        filters.betType ||
        filters.bookmaker ||
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
      if (f.sport && b.sport !== f.sport) return false;
      if (f.betType && b.betType !== f.betType) return false;
      if (f.bookmaker && b.bookmaker !== f.bookmaker) return false;
      if (f.result && b.result !== f.result) return false;
      if (q) {
        const blob = fold([b.event, b.competition, b.notes, b.sport, b.betType, b.bookmaker].join(" "));
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function emptySummary() {
    return {
      count: 0,
      results: { won: 0, lost: 0, void: 0, cashout: 0 },
      wins: 0,
      losses: 0,
      staked: 0,
      profit: 0,
      yield: null,
      roi: null,
      winRate: null,
      avgOdds: null,
      avgOddsWeighted: null,
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
    const results = { won: 0, lost: 0, void: 0, cashout: 0 };
    let wins = 0;
    let losses = 0;
    let oddsSum = 0;
    let oddsCount = 0;
    let weighted = 0;
    let weightStake = 0;

    const startCents = opts.relativeDrawdown ? 0 : toCents(startingBankroll || 0) || 0;
    const roiBase = toCents(startingBankroll || 0) || 0;
    let equity = startCents;
    let peak = equity;
    let maxDd = 0;
    let maxDdPct = null;

    ordered.forEach(function (b) {
      const stake = toCents(b.stake);
      const safeStake = Number.isFinite(stake) ? stake : 0;
      const p = profitCents(b);
      staked += safeStake;
      profitC += p;
      if (results[b.result] != null) results[b.result] += 1;
      const outcome = decisiveOutcome(b);
      if (outcome === "win") wins += 1;
      else if (outcome === "loss") losses += 1;
      const odds = parseNumber(b.odds);
      if (Number.isFinite(odds) && odds > 1 && safeStake > 0) {
        oddsSum += odds;
        oddsCount += 1;
        weighted += odds * safeStake;
        weightStake += safeStake;
      }
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
      avgOdds: oddsCount ? oddsSum / oddsCount : null,
      avgOddsWeighted: weightStake ? weighted / weightStake : null,
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
        event: b.event || "Apuesta",
        result: b.result,
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

  function oddsBuckets(bets, startingBankroll) {
    const groups = BUCKETS.map(function (bucket) {
      return { name: bucket.label, bets: [] };
    });
    (bets || []).forEach(function (b) {
      const odds = parseNumber(b.odds);
      if (!Number.isFinite(odds)) return;
      for (let i = 0; i < BUCKETS.length; i += 1) {
        if (BUCKETS[i].test(odds)) {
          groups[i].bets.push(b);
          break;
        }
      }
    });
    return groups.map(function (group) {
      return Object.assign({ name: group.name }, summarize(group.bets, startingBankroll, { keepEmpty: true, relativeDrawdown: true }));
    });
  }

  function bucketLabel(odds) {
    const o = parseNumber(odds);
    if (!Number.isFinite(o)) return null;
    for (let i = 0; i < BUCKETS.length; i += 1) {
      if (BUCKETS[i].test(o)) return BUCKETS[i].label;
    }
    return null;
  }

  function streaks(bets) {
    const decisive = [];
    sortBets(bets || []).forEach(function (b) {
      const outcome = decisiveOutcome(b);
      if (!outcome) return;
      decisive.push({
        outcome: outcome,
        date: b.date,
        event: b.event,
        result: b.result,
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
    RESULTS: RESULTS,
    parseNumber: parseNumber,
    toCents: toCents,
    fromCents: fromCents,
    parseDate: parseDate,
    canonicalResult: canonicalResult,
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
    oddsBuckets: oddsBuckets,
    bucketLabel: bucketLabel,
    streaks: streaks,
    inRange: inRange,
    monthly: monthly,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.calc;
})(typeof globalThis !== "undefined" ? globalThis : this);
