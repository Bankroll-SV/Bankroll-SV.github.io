"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  // fecha, modalidad, título, buy in, retiro, descripción
  const ROWS = [
    ["2026-10-02", "poker", "Cash game viernes", 100, 40, "Mesa pasiva, me fui temprano"],
    ["2026-10-03", "casino", "Ruleta", 50, 0, ""],
    ["2026-10-05", "poker", "Torneo turbo", 40, 0, "Fuera en la burbuja"],
    ["2026-10-07", "casino", "Blackjack", 80, 20, ""],
    ["2026-10-09", "poker", "Cash game", 100, 60, ""],
    ["2026-10-12", "casino", "Ruleta", 40, 90, "Una docena se quedó"],
    ["2026-10-14", "poker", "Cash game noche", 150, 280, "Buena mesa, salí en el pico"],
    ["2026-10-16", "poker", "Torneo", 55, 120, ""],
    ["2026-10-18", "casino", "Blackjack", 60, 60, "Me fui en tablas"],
    ["2026-10-21", "poker", "Cash game", 80, 130, ""],
    ["2026-10-24", "casino", "Ruleta", 70, 30, ""],
    ["2026-10-28", "poker", "Cash game domingo", 100, 175, "Sesión corta"],
  ];

  function build() {
    return ROWS.map(function (row, index) {
      const day = row[0];
      return {
        id: "demo-" + String(index + 1).padStart(2, "0"),
        date: day,
        kind: row[1],
        title: row[2],
        buyIn: row[3],
        cashOut: row[4],
        notes: row[5],
        createdAt: day + "T" + String(12 + (index % 8)).padStart(2, "0") + ":00:00.000Z",
      };
    });
  }

  BT.demo = {
    BANKROLL: 1000,
    build: build,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.demo;
})(typeof globalThis !== "undefined" ? globalThis : this);
