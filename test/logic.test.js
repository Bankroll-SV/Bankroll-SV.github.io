"use strict";

const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "..", "js", "format.js"));
require(path.join(__dirname, "..", "js", "calc.js"));
require(path.join(__dirname, "..", "js", "io.js"));
require(path.join(__dirname, "..", "js", "demo.js"));

const calc = global.BT.calc;
const format = global.BT.format;
const io = global.BT.io;
const demo = global.BT.demo;

function bet(partial) {
  return Object.assign(
    {
      id: "t",
      date: "2026-08-01",
      sport: "Fútbol",
      competition: "LaLiga",
      event: "A – B",
      betType: "1X2",
      odds: 2,
      stake: 10,
      result: "won",
      cashoutAmount: null,
      bookmaker: "Bet365",
      notes: "",
      createdAt: "2026-08-01T12:00:00.000Z",
    },
    partial
  );
}

function approx(actual, expected, digits) {
  const factor = Math.pow(10, digits == null ? 2 : digits);
  assert.strictEqual(Math.round(actual * factor) / factor, Math.round(expected * factor) / factor);
}

assert.strictEqual(calc.parseNumber("1.000,50"), 1000.5);
assert.strictEqual(calc.parseNumber("1,85"), 1.85);
assert.strictEqual(calc.parseNumber("1,234.56"), 1234.56);
assert.strictEqual(calc.parseNumber("10.5"), 10.5);
assert.strictEqual(calc.toCents("10,10"), 1010);
assert.strictEqual(calc.parseDate("02/11/2026"), "2026-11-02");
assert.strictEqual(calc.parseDate("2026-11-02"), "2026-11-02");
assert.strictEqual(calc.parseDate("31/02/2026"), null);

assert.strictEqual(calc.profit(bet({ result: "won", odds: 2.5, stake: 10 })), 15);
assert.strictEqual(calc.profit(bet({ result: "lost", stake: 10 })), -10);
assert.strictEqual(calc.profit(bet({ result: "void", stake: 10 })), 0);
assert.strictEqual(calc.profit(bet({ result: "cashout", stake: 20, cashoutAmount: 12 })), -8);
assert.strictEqual(calc.profit(bet({ result: "cashout", stake: 20, cashoutAmount: 30 })), 10);

const prepared = calc.prepareBet({
  date: "4/8/2026",
  sport: " Tenis ",
  event: "Alcaraz – Sinner",
  betType: "Ganador",
  odds: "1,91",
  stake: "10",
  result: "Ganada",
  bookmaker: "Pinnacle",
});
assert.deepStrictEqual(prepared.errors, {});
assert.strictEqual(prepared.bet.date, "2026-08-04");
assert.strictEqual(prepared.bet.odds, 1.91);
assert.strictEqual(calc.profit(prepared.bet), 9.1);

const bad = calc.prepareBet({ date: "2026-01-01", sport: "Fútbol", event: "A", betType: "1X2", odds: 1, stake: 0, result: "", bookmaker: "" });
assert.ok(bad.errors.odds);
assert.ok(bad.errors.stake);
assert.ok(bad.errors.result);
assert.ok(bad.errors.bookmaker);

const sample = [
  bet({ id: "1", date: "2026-08-01", result: "won", odds: 2, stake: 50, createdAt: "2026-08-01T12:00:00.000Z" }),
  bet({ id: "2", date: "2026-08-02", result: "lost", odds: 1.5, stake: 80, createdAt: "2026-08-02T12:00:00.000Z" }),
  bet({ id: "3", date: "2026-08-03", result: "won", odds: 2, stake: 10, createdAt: "2026-08-03T12:00:00.000Z" }),
  bet({ id: "4", date: "2026-08-04", result: "void", odds: 2, stake: 100, createdAt: "2026-08-04T12:00:00.000Z" }),
];
const summary = calc.summarize(sample, 100);
approx(summary.profit, -20);
approx(summary.staked, 240);
approx(summary.yield, -20 / 240, 6);
approx(summary.roi, -0.2, 6);
approx(summary.winRate, 2 / 3, 6);
approx(summary.bankroll, 80);
approx(summary.maxDrawdown, 80);
approx(summary.maxDrawdownPct, 80 / 150, 6);
approx(summary.avgOddsWeighted, (2 * 50 + 1.5 * 80 + 2 * 10 + 2 * 100) / 240, 6);
assert.strictEqual(summary.results.void, 1);
assert.strictEqual(summary.wins, 2);
assert.strictEqual(summary.losses, 1);

const curve = calc.equityCurve(sample, 100, "bankroll");
assert.strictEqual(curve[0].equity, 100);
assert.strictEqual(curve[curve.length - 1].equity, summary.bankroll);
assert.strictEqual(curve[2].equity, 70);

const selection = calc.equityCurve(sample, 100, "selection");
assert.strictEqual(selection[0].equity, 0);
assert.strictEqual(selection[selection.length - 1].equity, summary.profit);

const streakBets = [
  bet({ id: "a", date: "2026-08-01", result: "won" }),
  bet({ id: "b", date: "2026-08-02", result: "won" }),
  bet({ id: "c", date: "2026-08-03", result: "void" }),
  bet({ id: "d", date: "2026-08-04", result: "lost" }),
  bet({ id: "e", date: "2026-08-05", result: "lost" }),
  bet({ id: "f", date: "2026-08-06", result: "lost" }),
  bet({ id: "g", date: "2026-08-07", result: "won" }),
  bet({ id: "h", date: "2026-08-08", result: "cashout", stake: 10, odds: 2, cashoutAmount: 15 }),
];
const streaks = calc.streaks(streakBets);
assert.strictEqual(streaks.longestWin.count, 2);
assert.strictEqual(streaks.longestLoss.count, 3);
assert.strictEqual(streaks.current.type, "win");
assert.strictEqual(streaks.current.count, 2);
assert.strictEqual(streaks.recent.some(function (item) { return item.result === "void"; }), false);

assert.strictEqual(calc.bucketLabel(1.5), "≤ 1,50");
assert.strictEqual(calc.bucketLabel(1.51), "1,51 – 1,80");
assert.strictEqual(calc.bucketLabel(5), "3,01 – 5,00");
assert.strictEqual(calc.bucketLabel(5.01), "≥ 5,01");

const filtered = calc.filterBets(sample, { from: "2026-08-02", to: "2026-08-03", sport: "Fútbol", q: "a – b" });
assert.strictEqual(filtered.length, 2);
assert.strictEqual(calc.filterBets(sample, { q: "liga" }).length, 4);

const csv = io.toCsv([
  bet({
    notes: 'Línea; "cerrada"\nsegunda',
    result: "cashout",
    stake: 20,
    cashoutAmount: 12,
    odds: 1.85,
  }),
]);
assert.ok(csv.charCodeAt(0) === 0xfeff);
const parsed = io.parseCsv(csv);
assert.strictEqual(parsed.errors.length, 0);
assert.strictEqual(parsed.bets.length, 1);
assert.strictEqual(parsed.bets[0].notes, 'Línea; "cerrada"\nsegunda');
assert.strictEqual(parsed.bets[0].result, "cashout");
assert.strictEqual(calc.profit(parsed.bets[0]), calc.profit(bet({ result: "cashout", stake: 20, cashoutAmount: 12 })));

const english = io.parseCsv('date,sport,event,betType,odds,stake,result,bookmaker\n2026-09-01,Tennis,A vs B,Winner,2.10,15,won,Pinnacle\n');
assert.strictEqual(english.errors.length, 0);
assert.strictEqual(english.bets[0].sport, "Tennis");
assert.strictEqual(calc.profit(english.bets[0]), 16.5);

const sep = io.parseCsv("sep=;\nfecha;deporte;evento;tipo;cuota;stake;resultado;casa\n01/09/2026;Fútbol;A – B;1X2;1,50;20;perdida;Codere\n");
assert.strictEqual(sep.errors.length, 0);
assert.strictEqual(sep.bets[0].date, "2026-09-01");
assert.strictEqual(calc.profit(sep.bets[0]), -20);

const missing = io.parseCsv("fecha;evento\n2026-01-01;Solo\n");
assert.strictEqual(missing.bets.length, 0);
assert.ok(/Faltan columnas/.test(missing.errors[0].message));

const skipped = io.parseCsv("fecha;deporte;evento;tipo;cuota;stake;resultado;casa\n2026-01-01;Fútbol;A;1X2;1,00;10;ganada;Bet365\n2026-01-02;Fútbol;B;1X2;2,00;10;ganada;Bet365\n");
assert.strictEqual(skipped.bets.length, 1);
assert.strictEqual(skipped.errors.length, 1);

const backup = io.parseBackup(io.toBackup({
  settings: { startingBankroll: 500, currency: "USD" },
  bets: [bet({ id: "keep", odds: 1.5, stake: 20, result: "won" })],
}));
assert.strictEqual(backup.errors.length, 0);
assert.strictEqual(backup.settings.currency, "USD");
assert.strictEqual(backup.bets[0].id, "keep");
assert.strictEqual(calc.profit(backup.bets[0]), 10);

const demoBets = demo.build();
assert.strictEqual(demoBets.length, 36);
demoBets.forEach(function (item) {
  const result = calc.prepareBet(item);
  assert.deepStrictEqual(result.errors, {}, JSON.stringify(result.errors) + " " + item.id);
});
const demoSummary = calc.summarize(demoBets, demo.BANKROLL);
const demoStreaks = calc.streaks(demoBets);
assert.ok(demoStreaks.longestLoss.count >= 5, "racha perdedora " + (demoStreaks.longestLoss && demoStreaks.longestLoss.count));
assert.ok(demoStreaks.longestWin.count >= 4, "racha ganadora " + (demoStreaks.longestWin && demoStreaks.longestWin.count));
assert.strictEqual(demoSummary.results.void, 2);
assert.strictEqual(demoSummary.results.cashout, 2);
assert.ok(demoSummary.maxDrawdown > 50);
assert.ok(demoSummary.yield > 0 && demoSummary.yield < 0.2, "yield " + demoSummary.yield);
assert.ok(demoBets[0].date >= "2026-08-01" && demoBets[demoBets.length - 1].date <= "2026-10-31");
assert.strictEqual(calc.equityCurve(demoBets, demo.BANKROLL, "bankroll").at(-1).equity, demoSummary.bankroll);

const money = format.money(1234.5, "EUR");
assert.ok(/1234,50|1\.234,50/.test(money), money);
assert.ok(money.indexOf("€") !== -1);
assert.ok(format.signedMoney(10, "EUR").indexOf("+") === 0);
assert.ok(format.signedMoney(-10, "EUR").indexOf("−") === 0);
assert.strictEqual(format.percent(0.124, 1).replace(/\s/g, " "), "12,4 %");

const months = calc.monthly(demoBets, demo.BANKROLL);
assert.ok(months.length >= 3);
assert.ok(months[0].month < months[months.length - 1].month);

console.log("OK");
console.log(JSON.stringify({
  profit: demoSummary.profit,
  yield: Math.round(demoSummary.yield * 1000) / 10,
  roi: Math.round(demoSummary.roi * 1000) / 10,
  bankroll: demoSummary.bankroll,
  drawdown: demoSummary.maxDrawdown,
  winRate: Math.round(demoSummary.winRate * 1000) / 10,
  bets: demoSummary.count,
}, null, 2));
