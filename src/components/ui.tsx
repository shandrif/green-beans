import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Drawer } from "vaul";
import { Loader2, X } from "lucide-react";
import { useI18n } from "../lib/i18n";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- Button

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-sand hover:bg-ink-2 shadow-card",
  secondary: "bg-paper text-ink border border-line hover:border-tan shadow-card",
  ghost: "text-ink-2 hover:bg-sand-2",
  danger: "bg-danger text-white hover:brightness-95 shadow-card",
  success: "bg-deep text-white hover:brightness-95 shadow-card",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium",
        "transition-[transform,background-color,border-color,filter,opacity] duration-150 ease-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Form controls

const controlBase =
  "w-full rounded-xl border border-line bg-paper px-3 text-[15px] text-ink placeholder:text-muted/70 " +
  "transition-[border-color,box-shadow] duration-150 ease-out " +
  "focus:border-deep focus:outline-none focus:ring-4 focus:ring-teal/30 " +
  "disabled:bg-sand-2 disabled:text-ink-2 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(controlBase, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={3} className={cx(controlBase, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(
        controlBase,
        "h-11 appearance-none bg-[length:16px] bg-no-repeat pe-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237a7266%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        "[background-position:right_12px_center] rtl:[background-position:left_12px_center]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-2">
        <span>
          {label}
          {required && (
            <span className="text-danger" aria-label={t("required")}>
              {" "}
              *
            </span>
          )}
        </span>
        {hint && <span className="truncate text-xs font-normal text-muted">{hint}</span>}
      </label>
      {children}
      {error && <p className="animate-fade-up text-xs text-danger">{error}</p>}
    </div>
  );
}

export function useFieldId() {
  return useId();
}

// ---------------------------------------------------------------- Surfaces

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-2xl border border-line/80 bg-paper shadow-card", className)}>{children}</As>;
}

export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "tan" | "teal" | "deep" | "danger" | "ink"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-sand-2 text-ink-2",
    tan: "bg-tan-soft text-[#7a5a32]",
    teal: "bg-teal-soft text-deep",
    deep: "bg-deep text-white",
    danger: "bg-danger-soft text-danger",
    ink: "bg-ink text-sand",
  };
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-muted", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-sand-2", className)} />;
}

export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-teal-soft text-deep">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-muted">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t("somethingWrong")}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>{t("retry")}</Button>}
    />
  );
}

// ---------------------------------------------------------------- Sheet (Vaul drawer)

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}

/** Bottom sheet on phones, side panel on larger screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const { dir, t } = useI18n();
  const direction = desktop ? (dir === "rtl" ? "left" : "right") : "bottom";
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={direction}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Drawer.Content
          dir={dir}
          className={cx(
            "fixed z-50 flex flex-col bg-paper outline-none",
            desktop
              ? cx("inset-y-2 w-[min(520px,calc(100vw-1rem))] rounded-2xl shadow-pop", direction === "right" ? "right-2" : "left-2")
              : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl",
          )}
        >
          {!desktop && <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />}
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <Drawer.Title className="text-lg font-semibold text-ink">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-sm text-muted">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="-me-2 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-sand-2 active:scale-95"
              aria-label={t("cancel")}
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2" data-vaul-no-drag>
            {children}
          </div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ---------------------------------------------------------------- Brand

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Half Million">
      <rect width="64" height="64" rx="16" fill="#1D1B17" />
      <text x="32" y="42" textAnchor="middle" fontFamily="Inter Variable, Helvetica, Arial, sans-serif" fontWeight="800" fontSize="26" fill="#F5EDE3" direction="ltr">
        ½M
      </text>
      <circle cx="49" cy="15" r="5" fill="#84C6B2" />
    </svg>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl bg-sand-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-lg px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
            value === o.value ? "bg-paper text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
