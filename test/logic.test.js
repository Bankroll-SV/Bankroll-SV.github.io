"use strict";

const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "..", "js", "format.js"));
require(path.join(__dirname, "..", "js", "calc.js"));
require(path.join(__dirname, "..", "js", "io.js"));
require(path.join(__dirname, "..", "js", "storage.js"));
require(path.join(__dirname, "..", "js", "demo.js"));

const calc = global.BT.calc;
const format = global.BT.format;
const io = global.BT.io;
const storage = global.BT.storage;
const demo = global.BT.demo;

function bet(partial) {
  return Object.assign(
    {
      id: "t",
      date: "2026-10-01",
      title: "Cash game",
      kind: "poker",
      buyIn: 100,
      cashOut: 150,
      notes: "",
      createdAt: "2026-10-01T12:00:00.000Z",
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

assert.strictEqual(calc.profit(bet({ buyIn: 100, cashOut: 150 })), 50);
assert.strictEqual(calc.profit(bet({ buyIn: 80, cashOut: 20 })), -60);
assert.strictEqual(calc.profit(bet({ buyIn: 40, cashOut: 40 })), 0);
assert.strictEqual(calc.outcomeKey(bet({ buyIn: 100, cashOut: 150 })), "profit");
assert.strictEqual(calc.outcomeKey(bet({ buyIn: 80, cashOut: 20 })), "loss");
assert.strictEqual(calc.outcomeKey(bet({ buyIn: 40, cashOut: 40 })), "even");
assert.strictEqual(calc.decisiveOutcome(bet({ buyIn: 40, cashOut: 40 })), null);

const prepared = calc.prepareBet({
  date: "4/10/2026",
  title: " Ruleta ",
  kind: "Póker",
  buyIn: "100,50",
  cashOut: "80",
  notes: "mesa lenta",
});
assert.deepStrictEqual(prepared.errors, {});
assert.strictEqual(prepared.bet.date, "2026-10-04");
assert.strictEqual(prepared.bet.title, "Ruleta");
assert.strictEqual(prepared.bet.kind, "poker");
assert.strictEqual(prepared.bet.buyIn, 100.5);
assert.strictEqual(calc.profit(prepared.bet), -20.5);

const bad = calc.prepareBet({ date: "2026-01-01", title: "", kind: "deportes", buyIn: -1, cashOut: -1 });
assert.ok(bad.errors.title);
assert.ok(bad.errors.kind);
assert.ok(bad.errors.buyIn);
assert.ok(bad.errors.cashOut);

const freeroll = calc.prepareBet({ date: "2026-11-04", title: "Freeroll", kind: "poker", buyIn: 0, cashOut: 25 });
assert.deepStrictEqual(freeroll.errors, {});
assert.strictEqual(freeroll.bet.buyIn, 0);
assert.strictEqual(calc.profit(freeroll.bet), 25);
assert.strictEqual(calc.outcomeKey(freeroll.bet), "profit");
const bubble = calc.prepareBet({ date: "2026-11-04", title: "Freeroll", kind: "poker", buyIn: "0", cashOut: "0" });
assert.deepStrictEqual(bubble.errors, {});
assert.strictEqual(calc.outcomeKey(bubble.bet), "even");
approx(calc.available([freeroll.bet], 100, "2026-11").now, 125);

const sample = [
  bet({ id: "1", date: "2026-10-01", buyIn: 50, cashOut: 100, createdAt: "2026-10-01T12:00:00.000Z" }),
  bet({ id: "2", date: "2026-10-02", buyIn: 80, cashOut: 0, createdAt: "2026-10-02T12:00:00.000Z" }),
  bet({ id: "3", date: "2026-10-03", buyIn: 10, cashOut: 20, createdAt: "2026-10-03T12:00:00.000Z" }),
  bet({ id: "4", date: "2026-10-04", buyIn: 100, cashOut: 100, createdAt: "2026-10-04T12:00:00.000Z" }),
];
const summary = calc.summarize(sample, 100);
approx(summary.profit, -20);
approx(summary.staked, 240);
approx(summary.yield, -20 / 240, 6);
approx(summary.roi, -0.2, 6);
approx(summary.winRate, 2 / 3, 6);
approx(summary.bankroll, 80);
approx(summary.maxDrawdown, 80);
approx(summary.avgBuyIn, 60);
assert.strictEqual(summary.results.even, 1);
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
  bet({ id: "a", date: "2026-10-01", buyIn: 10, cashOut: 20 }),
  bet({ id: "b", date: "2026-10-02", buyIn: 10, cashOut: 20 }),
  bet({ id: "c", date: "2026-10-03", buyIn: 10, cashOut: 10 }),
  bet({ id: "d", date: "2026-10-04", buyIn: 10, cashOut: 0 }),
  bet({ id: "e", date: "2026-10-05", buyIn: 10, cashOut: 0 }),
  bet({ id: "f", date: "2026-10-06", buyIn: 10, cashOut: 0 }),
  bet({ id: "g", date: "2026-10-07", buyIn: 10, cashOut: 30 }),
  bet({ id: "h", date: "2026-10-08", buyIn: 10, cashOut: 15 }),
];
const streaks = calc.streaks(streakBets);
assert.strictEqual(streaks.longestWin.count, 2);
assert.strictEqual(streaks.longestLoss.count, 3);
assert.strictEqual(streaks.current.type, "win");
assert.strictEqual(streaks.current.count, 2);
assert.strictEqual(streaks.recent.some(function (item) { return item.result === "even"; }), false);

const filtered = calc.filterBets(sample, { from: "2026-10-02", to: "2026-10-03", kind: "poker", q: "cash" });
assert.strictEqual(filtered.length, 2);
assert.strictEqual(calc.filterBets(sample, { kind: "casino" }).length, 0);

const csv = io.toCsv([
  bet({
    notes: 'Nota; "importante"\nsegunda',
    buyIn: 20,
    cashOut: 12,
    kind: "casino",
    title: "Ruleta",
  }),
]);
assert.ok(csv.charCodeAt(0) === 0xfeff);
const parsed = io.parseCsv(csv);
assert.strictEqual(parsed.errors.length, 0);
assert.strictEqual(parsed.bets.length, 1);
assert.strictEqual(parsed.bets[0].notes, 'Nota; "importante"\nsegunda');
assert.strictEqual(parsed.bets[0].kind, "casino");
assert.strictEqual(calc.profit(parsed.bets[0]), -8);

const english = io.parseCsv("date,title,kind,buy_in,cash_out\n2026-09-01,Roulette,casino,50,80\n");
assert.strictEqual(english.errors.length, 0);
assert.strictEqual(english.bets[0].title, "Roulette");
assert.strictEqual(calc.profit(english.bets[0]), 30);

const sep = io.parseCsv("sep=;\nfecha;titulo;modalidad;buy_in;retiro\n01/09/2026;Cash game;poker;100;40\n");
assert.strictEqual(sep.errors.length, 0);
assert.strictEqual(sep.bets[0].date, "2026-09-01");
assert.strictEqual(calc.profit(sep.bets[0]), -60);

const missing = io.parseCsv("fecha;titulo\n2026-01-01;Solo\n");
assert.strictEqual(missing.bets.length, 0);
assert.ok(/Faltan columnas/.test(missing.errors[0].message));

const skipped = io.parseCsv("fecha;titulo;modalidad;buy_in;retiro\n2026-01-01;Freeroll;poker;0;10\n2026-01-02;Mesa;poker;10;20\n2026-01-03;Mesa;poker;-1;10\n");
assert.strictEqual(skipped.bets.length, 2);
assert.strictEqual(skipped.errors.length, 1);
assert.strictEqual(skipped.bets[0].buyIn, 0);
assert.strictEqual(calc.profit(skipped.bets[0]), 10);

const backup = io.parseBackup(io.toBackup({
  settings: { startingBankroll: 500, currency: "USD" },
  bets: [bet({ id: "keep", buyIn: 20, cashOut: 30 })],
}));
assert.strictEqual(backup.errors.length, 0);
assert.strictEqual(backup.settings.currency, "USD");
assert.strictEqual(backup.bets[0].id, "keep");
assert.strictEqual(calc.profit(backup.bets[0]), 10);

const demoBets = demo.build();
assert.strictEqual(demoBets.length, 12);
demoBets.forEach(function (item) {
  const result = calc.prepareBet(item);
  assert.deepStrictEqual(result.errors, {}, JSON.stringify(result.errors) + " " + item.id);
  assert.ok(item.kind === "casino" || item.kind === "poker");
});
const demoSummary = calc.summarize(demoBets, demo.BANKROLL);
assert.strictEqual(demoSummary.results.even, 1);
assert.strictEqual(demoSummary.wins, 5);
assert.strictEqual(demoSummary.losses, 6);
approx(demoSummary.profit, 80);
assert.strictEqual(calc.equityCurve(demoBets, demo.BANKROLL, "bankroll").at(-1).equity, demoSummary.bankroll);

const november = [
  bet({ id: "n1", date: "2026-11-02", buyIn: 40, cashOut: 70 }),
  bet({ id: "n2", date: "2026-11-03", buyIn: 40, cashOut: 0 }),
  bet({ id: "old", date: "2026-10-02", buyIn: 100, cashOut: 0 }),
];
const pocket = calc.available(november, 100, "2026-11");
approx(pocket.profit, -10);
approx(pocket.now, 90);
approx(pocket.budget, 100);
assert.strictEqual(pocket.count, 2);
approx(calc.available([bet({ date: "2026-11-02", buyIn: 40, cashOut: 70 })], 100, "2026-11").now, 130);
approx(calc.available([bet({ date: "2026-11-02", buyIn: 40, cashOut: 0 })], 100, "2026-11").now, 60);
approx(calc.available([bet({ date: "2026-11-02", buyIn: 150, cashOut: 0 })], 100, "2026-11").now, -50);
approx(calc.available([bet({ date: "2026-10-02", buyIn: 40, cashOut: 0 })], 100, "2026-11").now, 100);

const migrated = storage.settingsFrom({ settings: { startingBankroll: 0, currency: "EUR" } });
assert.strictEqual(migrated.currency, "PEN");
assert.strictEqual(migrated.monthlyBudget, 100);
const kept = storage.settingsFrom({ settings: { startingBankroll: 20, currency: "USD", monthlyBudget: 80 } });
assert.strictEqual(kept.currency, "USD");
assert.strictEqual(kept.monthlyBudget, 80);
assert.strictEqual(storage.empty().settings.currency, "PEN");
assert.strictEqual(storage.empty().settings.monthlyBudget, 100);

const pen = format.money(100, "PEN");
assert.ok(pen.indexOf("S/") !== -1, pen);
const money = format.money(1234.5, "EUR");
assert.ok(/1234,50|1\.234,50/.test(money), money);
assert.ok(money.indexOf("€") !== -1);
assert.ok(format.signedMoney(10, "EUR").indexOf("+") === 0);
assert.ok(format.signedMoney(-10, "EUR").indexOf("−") === 0);
assert.strictEqual(format.percent(0.124, 1).replace(/\s/g, " "), "12,4 %");
assert.strictEqual(format.kindLabel("poker"), "Poker");
assert.strictEqual(format.resultLabel("loss"), "Loss");

const months = calc.monthly(demoBets, demo.BANKROLL);
assert.ok(months.length >= 1);

console.log("OK");
console.log(JSON.stringify({
  profit: demoSummary.profit,
  yield: Math.round(demoSummary.yield * 1000) / 10,
  bankroll: demoSummary.bankroll,
  bets: demoSummary.count,
}, null, 2));
