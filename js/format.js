"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  const CURRENCIES = ["EUR", "USD", "GBP", "MXN", "ARS", "CLP", "COP", "PEN", "BRL"];

  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function todayISO(date) {
    const d = date || new Date();
    const z = function (n) {
      return String(n).padStart(2, "0");
    };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  function addDays(iso, days) {
    const parts = String(iso).split("-").map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() + days);
    return todayISO(dt);
  }

  function money(n, currency) {
    const value = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function signedMoney(n, currency) {
    if (!Number.isFinite(n)) return "—";
    const body = money(Math.abs(n), currency);
    if (n > 0.004) return "+" + body;
    if (n < -0.004) return "−" + body;
    return money(0, currency);
  }

  function percent(ratio, digits) {
    if (ratio == null || !Number.isFinite(ratio)) return "—";
    return new Intl.NumberFormat("es-ES", {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(ratio);
  }

  function signedPercent(ratio, digits) {
    if (ratio == null || !Number.isFinite(ratio)) return "—";
    const body = percent(Math.abs(ratio), digits);
    if (ratio > 0.0000001) return "+" + body;
    if (ratio < -0.0000001) return "−" + body;
    return body;
  }

  function points(ratio, digits) {
    if (ratio == null || !Number.isFinite(ratio)) return "—";
    const body = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Math.abs(ratio * 100));
    if (ratio > 0.0000001) return "+" + body + " pp";
    if (ratio < -0.0000001) return "−" + body + " pp";
    return body + " pp";
  }

  function odds(n) {
    if (!Number.isFinite(n)) return "—";
    const digits = Math.abs(n * 100 - Math.round(n * 100)) > 0.001 ? 3 : 2;
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    }).format(n);
  }

  function plainNumber(n, digits) {
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  }

  function date(iso) {
    if (!iso) return "—";
    const parts = String(iso).split("-");
    if (parts.length < 3) return iso;
    return Number(parts[2]) + " " + MONTHS[Number(parts[1]) - 1] + " " + parts[0];
  }

  function monthLabel(ym) {
    const parts = String(ym || "").split("-");
    if (parts.length < 2) return ym || "—";
    return MONTHS[Number(parts[1]) - 1] + " " + parts[0].slice(2);
  }

  function tone(n) {
    if (!Number.isFinite(n) || Math.abs(n) < 0.004) return "flat";
    return n > 0 ? "pos" : "neg";
  }

  function resultLabel(result) {
    if (result === "won") return "Ganada";
    if (result === "lost") return "Perdida";
    if (result === "void") return "Nula";
    if (result === "cashout") return "Cashout";
    return "—";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  BT.format = {
    CURRENCIES: CURRENCIES,
    todayISO: todayISO,
    addDays: addDays,
    money: money,
    signedMoney: signedMoney,
    percent: percent,
    signedPercent: signedPercent,
    points: points,
    odds: odds,
    plainNumber: plainNumber,
    date: date,
    monthLabel: monthLabel,
    tone: tone,
    resultLabel: resultLabel,
    esc: esc,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.format;
})(typeof globalThis !== "undefined" ? globalThis : this);
