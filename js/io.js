"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});

  const HEADERS = {
    fecha: "date",
    date: "date",
    deporte: "sport",
    sport: "sport",
    competicion: "competition",
    competencia: "competition",
    competition: "competition",
    liga: "competition",
    evento: "event",
    event: "event",
    partido: "event",
    tipo: "betType",
    tipo_apuesta: "betType",
    tipo_de_apuesta: "betType",
    bettype: "betType",
    market: "betType",
    cuota: "odds",
    odds: "odds",
    momio: "odds",
    stake: "stake",
    importe: "stake",
    cantidad: "stake",
    resultado: "result",
    result: "result",
    importe_cashout: "cashoutAmount",
    cashout: "cashoutAmount",
    cobrado: "cashoutAmount",
    importe_cobrado: "cashoutAmount",
    casa: "bookmaker",
    bookmaker: "bookmaker",
    casa_apuestas: "bookmaker",
    casa_de_apuestas: "bookmaker",
    book: "bookmaker",
    notas: "notes",
    notes: "notes",
    nota: "notes",
    beneficio: "profit",
    profit: "profit",
  };

  const REQUIRED = ["date", "sport", "event", "betType", "odds", "stake", "result", "bookmaker"];

  const REQUIRED_LABELS = {
    date: "fecha",
    sport: "deporte",
    event: "evento",
    betType: "tipo",
    odds: "cuota",
    stake: "stake",
    result: "resultado",
    bookmaker: "casa",
  };

  function isSepRow(row) {
    const filled = row.filter(function (value) {
      return String(value).trim() !== "";
    });
    if (filled.length !== 1) return false;
    return /^sep\s*=/i.test(String(filled[0]).trim());
  }

  function normHeader(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
    const options = [";", ",", "\t"];
    let best = ";";
    let bestScore = -1;
    options.forEach(function (delimiter) {
      const rows = parseRows(sample, delimiter);
      const score = rows.length ? rows[0].length : 0;
      if (score > bestScore) {
        best = delimiter;
        bestScore = score;
      }
    });
    return best;
  }

  function parseRows(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    let line = 1;
    let rowLine = 1;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          if (c === "\n") line += 1;
          cell += c;
        }
        continue;
      }
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        row.line = rowLine;
        rows.push(row);
        row = [];
        cell = "";
        line += 1;
        rowLine = line;
      } else if (c !== "\r") {
        cell += c;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      row.line = rowLine;
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (value) {
        return String(value).trim() !== "";
      });
    });
  }

  function csvEscape(value, delimiter) {
    const s = String(value == null ? "" : value);
    if (s.indexOf('"') !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1 || s.indexOf(delimiter) !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function decimal(n) {
    if (!Number.isFinite(Number(n))) return "";
    return Number(n).toFixed(2).replace(".", ",");
  }

  function resultWord(result) {
    if (result === "won") return "ganada";
    if (result === "lost") return "perdida";
    if (result === "void") return "nula";
    if (result === "cashout") return "cashout";
    return "";
  }

  function parseCsv(text) {
    const clean = String(text || "").replace(/^\uFEFF/, "");
    if (!clean.trim()) return { bets: [], errors: [{ line: 1, message: "El archivo está vacío." }] };
    const delimiter = detectDelimiter(clean);
    let rows = parseRows(clean, delimiter);
    if (rows.length && isSepRow(rows[0])) rows = rows.slice(1);
    if (!rows.length) return { bets: [], errors: [{ line: 1, message: "No hay filas para importar." }] };

    const header = rows[0].map(normHeader);
    const fields = header.map(function (name) {
      return HEADERS[name] || null;
    });
    const present = {};
    fields.forEach(function (field) {
      if (field) present[field] = true;
    });
    const missing = REQUIRED.filter(function (field) {
      return !present[field];
    }).map(function (field) {
      return REQUIRED_LABELS[field];
    });
    if (missing.length) {
      return {
        bets: [],
        errors: [{ line: rows[0].line || 1, message: "Faltan columnas: " + missing.join(", ") + "." }],
      };
    }

    const bets = [];
    const errors = [];
    rows.slice(1).forEach(function (row) {
      const input = {};
      fields.forEach(function (field, index) {
        if (!field || field === "profit") return;
        input[field] = row[index] != null ? String(row[index]).trim() : "";
      });
      const prepared = BT.calc.prepareBet(input);
      const keys = Object.keys(prepared.errors);
      if (keys.length) {
        errors.push({ line: row.line || 0, message: prepared.errors[keys[0]] });
        return;
      }
      bets.push(prepared.bet);
    });
    return { bets: bets, errors: errors };
  }

  function toCsv(bets) {
    const delimiter = ";";
    const header = ["fecha", "deporte", "competicion", "evento", "tipo", "cuota", "stake", "resultado", "importe_cashout", "casa", "notas", "beneficio"];
    const lines = [header.join(delimiter)];
    BT.calc.sortBets(bets || []).forEach(function (b) {
      const cells = [
        b.date,
        b.sport,
        b.competition || "",
        b.event,
        b.betType,
        decimal(b.odds),
        decimal(b.stake),
        resultWord(b.result),
        b.result === "cashout" ? decimal(b.cashoutAmount) : "",
        b.bookmaker,
        b.notes || "",
        decimal(BT.calc.profit(b)),
      ];
      lines.push(cells.map(function (cell) {
        return csvEscape(cell, delimiter);
      }).join(delimiter));
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  function template() {
    const sample = {
      id: "plantilla",
      date: "2026-11-02",
      sport: "Fútbol",
      competition: "LaLiga",
      event: "Real Madrid – Barcelona",
      betType: "1X2",
      odds: 1.85,
      stake: 25,
      result: "won",
      cashoutAmount: null,
      bookmaker: "Bet365",
      notes: "Ejemplo. Borra esta fila antes de importar la tuya.",
      createdAt: "2026-11-02T12:00:00.000Z",
    };
    return toCsv([sample]);
  }

  function toBackup(data) {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: data.settings,
        bets: data.bets,
      },
      null,
      2
    );
  }

  function parseBackup(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { settings: null, bets: [], errors: [{ line: 1, message: "El JSON no se puede leer." }] };
    }
    const source = Array.isArray(data) ? { bets: data } : data || {};
    if (!Array.isArray(source.bets)) {
      return { settings: null, bets: [], errors: [{ line: 1, message: "El JSON no contiene una lista de apuestas." }] };
    }
    const bets = [];
    const errors = [];
    source.bets.forEach(function (raw, index) {
      if (!raw || typeof raw !== "object") {
        errors.push({ line: index + 1, message: "El registro no es un objeto." });
        return;
      }
      const prepared = BT.calc.prepareBet(raw);
      const keys = Object.keys(prepared.errors);
      if (keys.length) {
        errors.push({ line: index + 1, message: prepared.errors[keys[0]] });
        return;
      }
      prepared.bet.id = raw.id || null;
      prepared.bet.createdAt = raw.createdAt || prepared.bet.createdAt;
      bets.push(prepared.bet);
    });
    let settings = null;
    if (source.settings && typeof source.settings === "object") settings = source.settings;
    return { settings: settings, bets: bets, errors: errors };
  }

  BT.io = {
    parseCsv: parseCsv,
    toCsv: toCsv,
    template: template,
    toBackup: toBackup,
    parseBackup: parseBackup,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT.io;
})(typeof globalThis !== "undefined" ? globalThis : this);
