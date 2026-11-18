// ============================================================================
// EEMS - Attendance Auto Checkout Scheduler
// ============================================================================
//
// Runs continuously while the API process is alive.
//
// A recovery execution happens immediately when the server starts, then
// every minute afterward.
//
// This means forgotten sessions are closed at most approximately one minute
// after their 24-hour deadline.
//
// ============================================================================

import {
  autoCloseExpiredAttendanceSessions,
} from "./attendance.service.js";

const AUTO_CHECKOUT_INTERVAL_MS =
  60 * 1000;

let timer:
  | ReturnType<
      typeof setInterval
    >
  | null = null;

let running = false;

async function runAutoCheckoutJob(): Promise<void> {
  if (running) {
    return;
  }

  running = true;

  try {
    const result =
      await autoCloseExpiredAttendanceSessions();

    if (
      result.closedCount > 0
    ) {
      console.log(
        "[Attendance] Automatic checkout completed",
        result,
      );
    }
  } catch (error) {
    console.error(
      "[Attendance] Automatic checkout job failed",
      error,
    );
  } finally {
    running = false;
  }
}

export function startAttendanceAutoCheckoutScheduler(): void {
  if (timer) {
    return;
  }

  void runAutoCheckoutJob();

  timer = setInterval(
    () => {
      void runAutoCheckoutJob();
    },
    AUTO_CHECKOUT_INTERVAL_MS,
  );

  timer.unref?.();

  console.log(
    "[Attendance] Auto-checkout scheduler started",
  );
}

export function stopAttendanceAutoCheckoutScheduler(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);

  timer = null;
}