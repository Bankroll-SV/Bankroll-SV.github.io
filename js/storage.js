"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});
  const KEY = "blackbook.v1";

  function empty() {
    return {
      version: 1,
      settings: { startingBankroll: 0, currency: "EUR" },
      bets: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.bets)) return empty();
      const settings = Object.assign(empty().settings, data.settings || {});
      if (!Number.isFinite(Number(settings.startingBankroll)) || Number(settings.startingBankroll) < 0) {
        settings.startingBankroll = 0;
      }
      settings.startingBankroll = Math.round(Number(settings.startingBankroll) * 100) / 100;
      if (BT.format && BT.format.CURRENCIES.indexOf(settings.currency) === -1) settings.currency = "EUR";
      return { version: 1, settings: settings, bets: data.bets.filter(Boolean) };
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
