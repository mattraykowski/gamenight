import { useMemo, type ReactNode } from "react";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface CalendarGridProps {
  /** Calendar year (e.g. 2026). */
  year: number;
  /** 1-indexed month (1 = January). */
  month: number;
  /** Accessible label for the grid (e.g. "October 2026 calendar"). */
  ariaLabel: string;
  /** Renders one gridcell per real day in the month. The consumer is
   *  responsible for emitting `role="gridcell"` and any clickable /
   *  focusable contents inside. */
  renderCell: (date: Date) => ReactNode;
  /** Optional override for blank leading / trailing slots. The default
   *  renders a muted, aria-hidden cell. */
  renderBlank?: (key: string) => ReactNode;
  /** Optional renderer for prior/next-month dates that visually fill
   *  the leading / trailing slots. When provided, those slots are
   *  populated with real `Date` objects from the adjacent months and
   *  this callback owns their rendering. Takes precedence over
   *  `renderBlank`. */
  renderOutOfMonth?: (date: Date) => ReactNode;
}

/**
 * Layout-only Sunday-first month-grid primitive shared across every
 * calendar surface in the SPA — the per-schedule `<MonthCalendar>`
 * (feature 003) and the cross-schedule `<EventCalendar>` (feature
 * 004). It owns the 7-column header row, the chunked week rows, and
 * the leading / trailing blank cells; consumers own cell content,
 * keyboard, and focus model.
 */
export function CalendarGrid({
  year,
  month,
  ariaLabel,
  renderCell,
  renderBlank,
  renderOutOfMonth,
}: CalendarGridProps) {
  const weeks = useMemo(
    () => buildWeeks(year, month, renderOutOfMonth !== undefined),
    [year, month, renderOutOfMonth],
  );

  return (
    <div role="grid" aria-label={ariaLabel} className="w-full">
      <div
        role="row"
        className="mb-4 grid grid-cols-7 border-b border-border pb-2"
      >
        {DAY_HEADERS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="text-center font-serif text-sm font-bold uppercase text-secondary"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} role="row" className="grid grid-cols-7">
          {week.map((cell, dayIdx) => {
            if (cell === null) {
              const key = `blank-${weekIdx}-${dayIdx}`;
              if (renderBlank) {
                return <Fragment key={key}>{renderBlank(key)}</Fragment>;
              }
              return (
                <div
                  key={key}
                  data-testid="calendar-grid-blank"
                  role="presentation"
                  aria-hidden="true"
                  className="border border-border/40 bg-muted/30"
                />
              );
            }
            const dateKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            if (cell.outOfMonth) {
              return (
                <Fragment key={`oom-${dateKey}`}>
                  {renderOutOfMonth!(cell.date)}
                </Fragment>
              );
            }
            return <Fragment key={dateKey}>{renderCell(cell.date)}</Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}

function Fragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type WeekCell = { date: Date; outOfMonth: boolean } | null;

function buildWeeks(
  year: number,
  month: number,
  fillOutOfMonth: boolean,
): WeekCell[][] {
  // 0 = Sunday, 6 = Saturday — JS Date.getDay() convention, which
  // matches our Sunday-first layout exactly.
  const firstDayWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const weeks: WeekCell[][] = [];
  let currentWeek: WeekCell[] = [];
  for (let i = 0; i < firstDayWeekday; i += 1) {
    if (fillOutOfMonth) {
      const day = prevMonthDays - firstDayWeekday + 1 + i;
      currentWeek.push({
        date: new Date(year, month - 2, day),
        outOfMonth: true,
      });
    } else {
      currentWeek.push(null);
    }
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    currentWeek.push({ date: new Date(year, month - 1, day), outOfMonth: false });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      if (fillOutOfMonth) {
        currentWeek.push({
          date: new Date(year, month, nextDay),
          outOfMonth: true,
        });
        nextDay += 1;
      } else {
        currentWeek.push(null);
      }
    }
    weeks.push(currentWeek);
  }

  return weeks;
}
