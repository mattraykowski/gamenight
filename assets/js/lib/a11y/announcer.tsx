import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Priority = "polite" | "assertive";

interface AnnouncerContextValue {
  announce: (message: string, priority?: Priority) => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function useAnnounce(): AnnouncerContextValue["announce"] {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) {
    throw new Error("useAnnounce must be used within an <A11yAnnouncer>");
  }
  return ctx.announce;
}

export function A11yAnnouncer({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  const announce = useCallback<AnnouncerContextValue["announce"]>((message, priority = "polite") => {
    if (priority === "assertive") {
      setAssertive(message);
    } else {
      setPolite(message);
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      <div
        data-testid="announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {polite}
      </div>
      <div
        data-testid="announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertive}
      </div>
      {children}
    </AnnouncerContext.Provider>
  );
}
