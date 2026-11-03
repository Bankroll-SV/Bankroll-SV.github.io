"use strict";

(function (root) {
  const BT = (root.BT = root.BT || {});
  const charts = {};

  const DIST = [
    { key: "profit", label: "Profit", color: "#f4f4f5" },
    { key: "loss", label: "Loss", color: "#dc2626" },
    { key: "even", label: "Cero", color: "#52525b" },
  ];

  function destroy(name) {
    if (charts[name]) {
      charts[name].destroy();
      delete charts[name];
    }
  }

  function destroyAll() {
    Object.keys(charts).forEach(destroy);
  }

  function baseTooltip() {
    return {
      backgroundColor: "#111111",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      titleColor: "#f5f5f5",
      bodyColor: "#a3a3a3",
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
      titleFont: { family: "Inter, Segoe UI, sans-serif", size: 13, weight: "500" },
      bodyFont: { family: "Inter, Segoe UI, sans-serif", size: 12 },
    };
  }

  function axisTicks() {
    return { color: "#8a8a8a", maxRotation: 0, autoSkip: true, font: { size: 11 } };
  }

  function applyDefaults() {
    if (typeof Chart === "undefined") return;
    Chart.defaults.color = "#a3a3a3";
    Chart.defaults.font.family = "Inter, Segoe UI, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.animation = false;
  }

  function equity(canvas, points, options) {
    destroy("equity");
    if (!canvas || typeof Chart === "undefined") return;
    const mode = options.mode;
    const currency = options.currency;
    charts.equity = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map(function (p) {
          return p.date ? BT.format.date(p.date) : "Inicio";
        }),
        datasets: [
          {
            data: points.map(function (p) {
              return p.equity;
            }),
            borderColor: "#ef4444",
            borderWidth: 1.75,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#0a0a0a",
            pointBorderColor: "#ef4444",
            pointBorderWidth: 1.5,
            tension: 0,
            fill: true,
            backgroundColor: function (ctx) {
              const area = ctx.chart.chartArea;
              if (!area) return "rgba(220,38,38,0.16)";
              const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              g.addColorStop(0, "rgba(220, 38, 38, 0.34)");
              g.addColorStop(1, "rgba(220, 38, 38, 0)");
              return g;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(), {
            callbacks: {
              title: function (items) {
                const p = points[items[0].dataIndex];
                return p.event || "Inicio";
              },
              afterTitle: function (items) {
                const p = points[items[0].dataIndex];
                return p.date ? BT.format.date(p.date) : "";
              },
              label: function (item) {
                const p = points[item.dataIndex];
                const lines = [(mode === "selection" ? "Acumulado: " : "Bankroll: ") + BT.format.money(p.equity, currency)];
                if (p.date) lines.push("Apuesta: " + BT.format.signedMoney(p.delta, currency));
                return lines;
              },
            },
          }),
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: Object.assign(axisTicks(), { maxTicksLimit: 8 }),
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)", drawTicks: false },
            border: { display: false },
            ticks: Object.assign(axisTicks(), {
              maxTicksLimit: 6,
              callback: function (value) {
                return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
              },
            }),
          },
        },
      },
    });
  }

  function distribution(canvas, results) {
    destroy("dist");
    if (!canvas || typeof Chart === "undefined") return;
    const slices = DIST.filter(function (item) {
      return results[item.key] > 0;
    });
    const total = slices.reduce(function (sum, item) {
      return sum + results[item.key];
    }, 0);
    charts.dist = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: slices.map(function (item) {
          return item.label;
        }),
        datasets: [
          {
            data: slices.map(function (item) {
              return results[item.key];
            }),
            backgroundColor: slices.map(function (item) {
              return item.color;
            }),
            borderColor: "#111111",
            borderWidth: 3,
            hoverOffset: 4,
          },
        ],
      },
      plugins: [
        {
          id: "centerText",
          afterDraw: function (chart) {
            const area = chart.chartArea;
            if (!area) return;
            const ctx = chart.ctx;
            const x = (area.left + area.right) / 2;
            const y = (area.top + area.bottom) / 2;
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#f5f5f5";
            ctx.font = "500 26px Inter, Segoe UI, sans-serif";
            ctx.fillText(String(total), x, y - 8);
            ctx.fillStyle = "#8a8a8a";
            ctx.font = "500 11px Inter, Segoe UI, sans-serif";
            ctx.fillText("APUESTAS", x, y + 16);
            ctx.restore();
          },
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(), {
            callbacks: {
              label: function (item) {
                const count = item.raw;
                const pct = total ? count / total : 0;
                return item.label + ": " + count + " · " + BT.format.percent(pct, 1);
              },
            },
          }),
        },
      },
    });
  }

  function monthly(canvas, rows, currency) {
    destroy("monthly");
    if (!canvas || typeof Chart === "undefined") return;
    charts.monthly = new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map(function (row) {
          return BT.format.monthLabel(row.month);
        }),
        datasets: [
          {
            data: rows.map(function (row) {
              return row.profit;
            }),
            backgroundColor: rows.map(function (row) {
              return row.profit < 0 ? "#dc2626" : "#f4f4f5";
            }),
            borderRadius: 3,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(), {
            callbacks: {
              title: function (items) {
                return BT.format.monthLabel(rows[items[0].dataIndex].month);
              },
              label: function (item) {
                const row = rows[item.dataIndex];
                return [
                  BT.format.signedMoney(row.profit, currency),
                  "Yield " + BT.format.signedPercent(row.yield, 2),
                  row.count + (row.count === 1 ? " apuesta" : " apuestas"),
                ];
              },
            },
          }),
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: axisTicks(),
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)", drawTicks: false },
            border: { display: false },
            ticks: Object.assign(axisTicks(), {
              maxTicksLimit: 6,
              callback: function (value) {
                return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
              },
            }),
          },
        },
      },
    });
  }

  applyDefaults();

  BT.charts = {
    DIST: DIST,
    destroyAll: destroyAll,
    equity: equity,
    distribution: distribution,
    monthly: monthly,
  };
})(typeof window !== "undefined" ? window : globalThis);
