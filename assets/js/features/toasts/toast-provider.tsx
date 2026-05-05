import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Whitelist of toast keys the SPA will render from a `?toast=` query
 * param. Kept as a closed set so a malicious link can't stuff
 * arbitrary copy into the user's toast surface.
 */
const TOAST_MESSAGES: Record<string, { title: string; variant: ToastVariant }> = {
  email_confirmed: { title: "Your email address has been confirmed.", variant: "success" },
  password_reset: { title: "Your password has been reset.", variant: "success" },
  signed_in: { title: "Welcome back!", variant: "success" },
  signed_out: { title: "You are now signed out.", variant: "info" },
  game_created: { title: "Game registered.", variant: "success" },
  game_updated: { title: "Game updated.", variant: "success" },
  game_deleted: { title: "Game deleted.", variant: "success" },
  invitation_sent: { title: "Invitation sent.", variant: "success" },
  invitation_accepted: { title: "Invitation accepted.", variant: "success" },
  invitation_declined: { title: "Invitation declined.", variant: "info" },
  invitation_revoked: { title: "Invitation revoked.", variant: "info" },
  player_updated: { title: "Player updated.", variant: "success" },
  notification_read: { title: "Notification marked as read.", variant: "info" },
};

export type ToastVariant = "success" | "info" | "error";

export interface Toast {
  id: string;
  title: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within <ToastProvider>");
  return ctx;
}

/**
 * Consumes a `?toast=<key>` query param on mount (exactly once) and
 * strips it from the URL so a browser refresh doesn't re-fire. Silent
 * when the key is not on {@link TOAST_MESSAGES} — prevents arbitrary
 * attacker-crafted links from rendering attacker-controlled toast
 * copy.
 */
export function useConsumeToastParam(toastKey: string | undefined) {
  const { push } = useToasts();
  // Guards the effect against running twice for the same key in a
  // single mount — React Strict Mode and router-state churn can
  // otherwise re-fire the push and leave us with duplicate toasts on
  // the dashboard after flows like reset/confirm land here.
  const consumedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!toastKey) return;
    if (consumedKeys.current.has(toastKey)) return;
    const entry = TOAST_MESSAGES[toastKey];
    if (!entry) return;

    consumedKeys.current.add(toastKey);
    push(entry);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("toast");
      window.history.replaceState(null, "", url.toString());
    }
  }, [toastKey, push]);
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-atomic="false"
      data-testid="toast-viewport"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          data-testid={`toast-${toast.variant}`}
          className={`pointer-events-auto w-full max-w-md rounded-md border-2 px-5 py-3 text-base font-medium shadow-xl ${variantClass(toast.variant)}`}
        >
          <div className="flex items-start gap-3">
            <span className="flex-1">{toast.title}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-sm font-semibold underline-offset-4 hover:underline"
              aria-label="Dismiss notification"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function variantClass(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "border-primary bg-primary text-primary-foreground";
    case "error":
      return "border-destructive bg-destructive text-white";
    default:
      return "border-secondary bg-secondary text-secondary-foreground";
  }
}
