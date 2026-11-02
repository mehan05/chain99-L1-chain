"use client";

import React from "react";

// ── Generic High-Performance Responsive SVG Line / Area Chart ─────────────────
export function ResponsiveSvgChart({
  data = [],
  series = [],
  height = 180,
  unit = "",
  showArea = true,
  zeroBaseline = true,
}) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: "0.85rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "10px",
          border: "1px dashed rgba(255,255,255,0.06)",
        }}
      >
        Waiting for stress test live data stream...
      </div>
    );
  }

  const padding = { top: 15, right: 15, bottom: 25, left: 45 };
  const width = 500; // SVG internal coordinate space

  // Determine global min and max across all series
  let allValues = [];
  series.forEach((s) => {
    data.forEach((d) => {
      const val = typeof d[s.key] === "number" ? d[s.key] : 0;
      allValues.push(val);
    });
  });

  let minVal = zeroBaseline ? 0 : Math.min(...allValues);
  let maxVal = Math.max(...allValues, 1);
  if (minVal === maxVal) maxVal += 5;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const getX = (index) => padding.left + (index / (data.length - 1)) * innerWidth;
  const getY = (val) => padding.top + innerHeight - ((val - minVal) / (maxVal - minVal)) * innerHeight;

  // Grid ticks
  const yTicks = [
    minVal,
    Math.round(minVal + (maxVal - minVal) * 0.5),
    Math.round(maxVal),
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: `${height}px`, overflow: "visible" }}
    >
      <defs>
        {series.map((s, idx) => (
          <linearGradient
            key={`grad-${idx}`}
            id={`grad-${s.key}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
          </linearGradient>
        ))}
      </defs>

      {/* Horizontal Grid lines & Y-axis labels */}
      {yTicks.map((tick, i) => {
        const y = getY(tick);
        return (
          <g key={`ytick-${i}`}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              fill="#64748b"
              fontSize="9"
              textAnchor="end"
              fontFamily="var(--font-mono, monospace)"
            >
              {tick}
              {unit}
            </text>
          </g>
        );
      })}

      {/* Series Lines & Areas */}
      {series.map((s) => {
        const points = data.map((d, i) => `${getX(i)},${getY(d[s.key] || 0)}`);
        const pathLine = "M " + points.join(" L ");
        const firstX = getX(0);
        const lastX = getX(data.length - 1);
        const bottomY = getY(minVal);
        const pathArea = `${pathLine} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

        return (
          <g key={s.key}>
            {showArea && (
              <path d={pathArea} fill={`url(#grad-${s.key})`} opacity="0.8" />
            )}
            <path
              d={pathLine}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Draw current value pulse dot on latest data point */}
            {data.length > 0 && (
              <circle
                cx={lastX}
                cy={getY(data[data.length - 1][s.key] || 0)}
                r="3.5"
                fill="#fff"
                stroke={s.color}
                strokeWidth="2"
              />
            )}
          </g>
        );
      })}

      {/* X-axis start & end labels */}
      {data.length > 0 && (
        <>
          <text
            x={padding.left}
            y={height - 6}
            fill="#64748b"
            fontSize="9"
            textAnchor="start"
            fontFamily="var(--font-mono, monospace)"
          >
            T-{data[data.length - 1]?.seconds || 0}s
          </text>
          <text
            x={width - padding.right}
            y={height - 6}
            fill="#64748b"
            fontSize="9"
            textAnchor="end"
            fontFamily="var(--font-mono, monospace)"
          >
            Latest (0s)
          </text>
        </>
      )}
    </svg>
  );
}

// ── Donut Chart for Success vs Failure ────────────────────────────────────────
export function SuccessDonutChart({ success = 0, failed = 0, size = 160 }) {
  const total = success + failed;
  const successPercent = total > 0 ? (success / total) * 100 : 100;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const successDash = (successPercent / 100) * circumference;
  const failedDash = circumference - successDash;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        height: "180px",
      }}
    >
      <div style={{ position: "relative", width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Failed slice */}
          {failed > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f43f5e"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={-successDash}
            />
          )}
          {/* Success slice */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${successDash} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
        </svg>

        {/* Center label */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "1.3rem",
              fontWeight: 900,
              fontFamily: "var(--font-mono, monospace)",
              color: "#fff",
            }}
          >
            {successPercent.toFixed(1)}%
          </span>
          <span style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase" }}>
            Success
          </span>
        </div>
      </div>

      {/* Breakdown Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "3px",
              background: "#10b981",
            }}
          />
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Successful</div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "#fff",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {success.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "3px",
              background: "#f43f5e",
            }}
          />
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Failed</div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "#f43f5e",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {failed.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

