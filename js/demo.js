"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  const FIXTURES = [
    ["Fútbol", "LaLiga", "Real Madrid – Barcelona"],
    ["Fútbol", "Premier League", "Arsenal – Liverpool"],
    ["Fútbol", "Serie A", "Inter – Juventus"],
    ["Fútbol", "Champions League", "Bayern – PSG"],
    ["Baloncesto", "NBA", "Celtics – Lakers"],
    ["Baloncesto", "ACB", "Real Madrid – Baskonia"],
    ["Baloncesto", "Euroliga", "Olympiacos – Fenerbahçe"],
    ["Tenis", "ATP", "Alcaraz – Sinner"],
    ["Tenis", "WTA", "Swiatek – Sabalenka"],
    ["Tenis", "Grand Slam", "Djokovic – Medvedev"],
    ["MMA", "UFC", "Adesanya – Pereira"],
    ["Fútbol", "Bundesliga", "Dortmund – Leipzig"],
  ];

  const BOOKS = ["Bet365", "Pinnacle", "Betfair", "Winamax", "Codere", "Betano"];

  // Resultado, cuota, stake y, si es cashout, importe cobrado.
  const SCRIPT = [
    ["won", 1.7, 40],
    ["won", 1.85, 30],
    ["lost", 2.05, 25],
    ["lost", 1.9, 30],
    ["lost", 2.2, 20],
    ["lost", 1.65, 40],
    ["lost", 3.1, 20],
    ["won", 2.4, 25],
    ["won", 1.55, 50],
    ["won", 1.8, 30],
    ["won", 2.1, 20],
    ["lost", 1.95, 25],
    ["void", 1.75, 30],
    ["won", 1.67, 30],
    ["cashout", 2.0, 40, 28],
    ["won", 1.72, 40],
    ["lost", 2.5, 20],
    ["won", 1.6, 50],
    ["lost", 2.8, 15],
    ["lost", 1.85, 30],
    ["won", 4.5, 10],
    ["lost", 2.15, 25],
    ["won", 1.48, 50],
    ["cashout", 1.95, 30, 48],
    ["lost", 3.4, 15],
    ["won", 2.05, 25],
    ["won", 1.75, 40],
    ["lost", 1.88, 25],
    ["void", 2.0, 20],
    ["won", 1.62, 40],
    ["lost", 2.3, 20],
    ["won", 1.95, 30],
    ["lost", 2.6, 15],
    ["lost", 1.7, 35],
    ["won", 1.8, 25],
    ["won", 2.0, 20],
  ];

  const NOTES = {
    5: "Stake contenido después de dos pérdidas.",
    12: "Apuesta anulada por el operador.",
    14: "Cashout al descanso.",
    20: "Parlay de tres selecciones.",
    23: "Cierre con el partido controlado.",
    28: "Mercado suspendido.",
  };

  function dateAt(index, total) {
    const start = Date.UTC(2026, 7, 4);
    const end = Date.UTC(2026, 9, 30);
    const t = total === 1 ? start : start + Math.round(((end - start) * index) / (total - 1));
    return new Date(t).toISOString().slice(0, 10);
  }

  function typeFor(sport, index, odds) {
    if (odds >= 4) return "Parlay";
    if (sport === "Tenis") return index % 2 ? "Ganador" : "Hándicap";
    if (sport === "Baloncesto") return index % 2 ? "Hándicap" : "Más/menos";
    if (sport === "MMA") return "Ganador";
    return ["1X2", "Más/menos", "Ambos marcan", "Hándicap"][index % 4];
  }

  function build() {
    return SCRIPT.map(function (row, index) {
      const fixture = FIXTURES[index % FIXTURES.length];
      const date = dateAt(index, SCRIPT.length);
      return {
        id: "demo_" + String(index + 1).padStart(2, "0"),
        date: date,
        sport: fixture[0],
        competition: fixture[1],
        event: fixture[2],
        betType: typeFor(fixture[0], index, row[1]),
        odds: row[1],
        stake: row[2],
        result: row[0],
        cashoutAmount: row[0] === "cashout" ? row[3] : null,
        bookmaker: BOOKS[index % BOOKS.length],
        notes: NOTES[index] || "",
        createdAt: date + "T12:00:" + String(index).padStart(2, "0") + ".000Z",
      };
    });
  }

  BT.demo = { BANKROLL: 1000, build: build };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.demo;
})(typeof globalThis !== "undefined" ? globalThis : this);
