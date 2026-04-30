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
}: CalendarGridProps) {
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  return (
    <div role="grid" aria-label={ariaLabel} className="w-full">
      <div role="row" className="grid grid-cols-7">
        {DAY_HEADERS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="p-1 text-center text-xs font-semibold uppercase text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} role="row" className="grid grid-cols-7">
          {week.map((date, dayIdx) => {
            if (date === null) {
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
            return (
              <Fragment key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}>
                {renderCell(date)}
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Fragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function buildWeeks(year: number, month: number): Array<Array<Date | null>> {
  // 0 = Sunday, 6 = Saturday — JS Date.getDay() convention, which
  // matches our Sunday-first layout exactly.
  const firstDayWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const weeks: Array<Array<Date | null>> = [];
  let currentWeek: Array<Date | null> = Array.from(
    { length: firstDayWeekday },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    currentWeek.push(new Date(year, month - 1, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}
