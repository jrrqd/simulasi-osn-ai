"use client";

import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Recharts 3 ResponsiveContainer with height="100%" often measures 0px inside
 * flex/grid parents and then renders nothing. Pass an explicit pixel height.
 */
export function ChartBox({
  children,
  height = 288,
  className,
}: {
  children: ReactElement;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={className ?? "w-full"}
      style={{ width: "100%", height, minHeight: height }}
    >
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
