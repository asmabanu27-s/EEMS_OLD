import { useEffect, useMemo, useState } from "react";

import { PieChart, Pie, Cell } from "recharts";

interface WorkingTimerProps {
  checkInAt: string | null;
  isRunning: boolean;

  /**
   * Total working minutes already completed today.
   *
   * This includes all previously completed sessions.
   */
  todayWorkedMinutes?: number;

  targetMinutes?: number;
}

export function WorkingTimer({
  checkInAt,
  isRunning,
  todayWorkedMinutes = 0,
  targetMinutes = 8 * 60,
}: WorkingTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  // ==========================================================================
  // LIVE CLOCK
  // ==========================================================================

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRunning]);

  // ==========================================================================
  // CURRENT SESSION ELAPSED TIME
  // ==========================================================================

  const currentSessionSeconds = useMemo(() => {
    if (!isRunning || !checkInAt) {
      return 0;
    }

    const start = new Date(checkInAt).getTime();

    if (Number.isNaN(start)) {
      return 0;
    }

    return Math.max(0, Math.floor((now - start) / 1000));
  }, [checkInAt, isRunning, now]);

  // ==========================================================================
  // TODAY'S CUMULATIVE TIME
  // ==========================================================================

  const baseSeconds = Math.max(0, Math.floor(todayWorkedMinutes * 60));

  const totalWorkedSeconds = baseSeconds + currentSessionSeconds;

  const targetSeconds = targetMinutes * 60;

  const progress =
    targetSeconds > 0
      ? Math.min(100, (totalWorkedSeconds / targetSeconds) * 100)
      : 0;

  const remainingSeconds = Math.max(0, targetSeconds - totalWorkedSeconds);

  // ==========================================================================
  // FORMAT CUMULATIVE TIME
  // ==========================================================================

  const hours = Math.floor(totalWorkedSeconds / 3600);

  const minutes = Math.floor((totalWorkedSeconds % 3600) / 60);

  const seconds = totalWorkedSeconds % 60;

  const timer = [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");

  const remainingHours = Math.floor(remainingSeconds / 3600);

  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);

  // ==========================================================================
  // PIE CHART
  // ==========================================================================

  const chartData = [
    {
      name: "Worked",
      value: progress,
    },
    {
      name: "Remaining",
      value: Math.max(0, 100 - progress),
    },
  ];

  const activeColor = isRunning ? "#ef4444" : "#22c55e";

  const remainingColor = "#707171";

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-64 w-64">
        <PieChart width={256} height={256}>
          <Pie
            data={chartData}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius={88}
            outerRadius={110}
            paddingAngle={0}
            strokeWidth={0}
          >
            <Cell fill={activeColor} />

            <Cell fill={remainingColor} />
          </Pie>
        </PieChart>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={
              isRunning
                ? "text-sm font-semibold text-destructive"
                : "text-sm font-semibold text-green-600"
            }
          >
            {isRunning ? "● RUNNING" : "● COMPLETED"}
          </span>

          <span
            className={
              isRunning
                ? "mt-1 font-mono text-3xl font-bold text-destructive"
                : "mt-1 font-mono text-3xl font-bold text-green-600"
            }
          >
            {timer}
          </span>

          <span className="mt-1 text-xs text-muted-foreground">
            {remainingSeconds > 0
              ? `${remainingHours}h ${remainingMinutes}m remaining`
              : "Target completed"}
          </span>
        </div>
      </div>

      {isRunning && checkInAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Checked in at {new Date(checkInAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
