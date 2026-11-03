"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});
  const KEY = "blackbook.v2";
  const LEGACY = "blackbook.v1";

  function empty() {
    return {
      version: 2,
      settings: { startingBankroll: 0, currency: "EUR" },
      bets: [],
    };
  }

  function settingsFrom(raw) {
    const settings = Object.assign(empty().settings, (raw && raw.settings) || {});
    if (!Number.isFinite(Number(settings.startingBankroll)) || Number(settings.startingBankroll) < 0) {
      settings.startingBankroll = 0;
    }
    settings.startingBankroll = Math.round(Number(settings.startingBankroll) * 100) / 100;
    if (BT.format && BT.format.CURRENCIES.indexOf(settings.currency) === -1) settings.currency = "EUR";
    return settings;
  }

  function read(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  }

  function load() {
    try {
      const current = read(KEY);
      if (current && Array.isArray(current.bets)) {
        return { version: 2, settings: settingsFrom(current), bets: current.bets.filter(Boolean) };
      }
      const legacy = read(LEGACY);
      if (legacy) return { version: 2, settings: settingsFrom(legacy), bets: [] };
      return empty();
    } catch (err) {
      return empty();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  BT.storage = { KEY: KEY, empty: empty, load: load, save: save };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.storage;
})(typeof globalThis !== "undefined" ? globalThis : this);
