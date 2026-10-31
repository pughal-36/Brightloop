"use client";

import { useState } from "react";
import { formatINR } from "@/lib/money";

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground border rounded-md border-dashed">
        No revenue data recorded for the selected period.
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const chartHeight = 220;
  const barWidth = 36;
  const gap = 20;
  const totalWidth = Math.max(500, data.length * (barWidth + gap) + 60);

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative" style={{ minWidth: totalWidth }}>
        {/* Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="absolute -top-3 z-10 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs font-medium text-background shadow pointer-events-none transition-all"
            style={{
              left: 40 + hoveredIdx * (barWidth + gap) + barWidth / 2,
            }}
          >
            <div>{data[hoveredIdx].month}</div>
            <div className="font-bold">{formatINR(data[hoveredIdx].revenue)}</div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${totalWidth} ${chartHeight + 40}`}
          className="w-full h-64 overflow-visible"
        >
          {/* Background Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - chartHeight * ratio + 20;
            const value = Math.round(maxRevenue * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={30}
                  y1={y}
                  x2={totalWidth}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeDasharray="4 4"
                />
                <text
                  x={26}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatINR(value)}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={30}
            y1={chartHeight + 20}
            x2={totalWidth}
            y2={chartHeight + 20}
            stroke="currentColor"
            strokeOpacity={0.2}
          />

          {/* Bars */}
          {data.map((item, idx) => {
            const barH = Math.max(4, (item.revenue / maxRevenue) * chartHeight);
            const x = 40 + idx * (barWidth + gap);
            const y = chartHeight + 20 - barH;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.month}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  className={`transition-all duration-200 ${
                    isHovered
                      ? "fill-primary"
                      : "fill-primary/80 hover:fill-primary"
                  }`}
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 35}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px] font-mono"
                >
                  {item.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

