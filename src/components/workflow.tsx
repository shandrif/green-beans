import { Link } from "react-router";
import { Check, X, AlertTriangle } from "lucide-react";
import {
  ROLE_LABELS,
  STAGES,
  STAGE_MAP,
  STATUS_LABELS,
  daysBetween,
  isOverdue,
  type SampleSummary,
  type StageKey,
} from "../../shared/workflow";
import { useI18n } from "../lib/i18n";
import { fmtDate, relTime } from "../lib/format";
import { Badge, cx } from "./ui";

export const DEPT_TONE = {
  procurement: "tan",
  roasting: "ink",
  npd: "teal",
  warehouse: "neutral",
} as const;

export function DeptBadge({ dept }: { dept: keyof typeof DEPT_TONE }) {
  const { l } = useI18n();
  return <Badge tone={DEPT_TONE[dept]}>{l(ROLE_LABELS[dept])}</Badge>;
}

export function StatusBadge({ s }: { s: Pick<SampleSummary, "status" | "stage" | "stage_entered_at" | "rejected_stage"> }) {
  const { l, t } = useI18n();
  if (s.status === "completed") return <Badge tone="deep"><Check className="size-3.5" />{l(STATUS_LABELS.completed)}</Badge>;
  if (s.status === "rejected")
    return (
      <Badge tone="danger">
        <X className="size-3.5" />
        {s.rejected_stage ? t("rejectedAt", { stage: l(STAGE_MAP[s.rejected_stage].short) }) : l(STATUS_LABELS.rejected)}
      </Badge>
    );
  if (isOverdue(s))
    return (
      <Badge tone="danger">
        <AlertTriangle className="size-3.5" />
        {t("overdue")}
      </Badge>
    );
  return <Badge tone="teal">{l(STATUS_LABELS.active)}</Badge>;
}

/** Compact 7-step progress indicator. */
export function StageDots({ s, className }: { s: Pick<SampleSummary, "status" | "stage" | "rejected_stage">; className?: string }) {
  const { l } = useI18n();
  const currentIdx = STAGES.findIndex((x) => x.key === (s.status === "rejected" ? s.rejected_stage : s.stage));
  return (
    <div className={cx("flex items-center gap-1", className)} aria-label={l(STAGE_MAP[s.stage].short)}>
      {STAGES.map((st, i) => {
        const done = s.status === "completed" || i < currentIdx;
        const cur = s.status !== "completed" && i === currentIdx;
        return (
          <span
            key={st.key}
            title={l(st.short)}
            className={cx(
              "h-1.5 rounded-full transition-all duration-300 ease-out",
              cur ? "w-5" : "w-2.5",
              done && "bg-deep",
              cur && (s.status === "rejected" ? "bg-danger" : "bg-tan"),
              !done && !cur && "bg-line",
            )}
          />
        );
      })}
    </div>
  );
}

export function StageLabel({ stage }: { stage: StageKey }) {
  const { l } = useI18n();
  const def = STAGE_MAP[stage];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid size-5 place-items-center rounded-full bg-sand-2 text-[11px] font-semibold text-ink-2 tabular">{def.step}</span>
      {l(def.short)}
    </span>
  );
}

export function TimeInStage({ s }: { s: Pick<SampleSummary, "status" | "stage" | "stage_entered_at"> }) {
  const { t, lang } = useI18n();
  if (s.status !== "active") return <span className="text-muted">—</span>;
  const d = daysBetween(s.stage_entered_at);
  const over = isOverdue(s);
  return (
    <span className={cx("tabular", over ? "font-medium text-danger" : "text-ink-2")}>
      {d < 1 ? relTime(s.stage_entered_at, lang) : `${Math.floor(d)} ${Math.floor(d) === 1 ? t("day") : t("days")}`}
    </span>
  );
}

/** Responsive list of samples: table on desktop, cards on mobile. */
export function SampleList({ samples, showStage = true }: { samples: SampleSummary[]; showStage?: boolean }) {
  const { t, l, lang } = useI18n();
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 text-start font-medium">{t("sampleId")}</th>
              <th className="px-3 py-3 text-start font-medium">{t("supplier")}</th>
              <th className="px-3 py-3 text-start font-medium">{t("origin")}</th>
              {showStage && <th className="px-3 py-3 text-start font-medium">{t("stage")}</th>}
              <th className="px-3 py-3 text-start font-medium">{t("inStage")}</th>
              <th className="px-5 py-3 text-end font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s.id} className="relative border-b border-line/60 last:border-0 transition-colors hover:bg-sand/60">
                <td className="px-5 py-3">
                  <Link to={`/samples/${s.id}`} className="font-semibold text-ink after:absolute after:inset-0">
                    {s.sample_code}
                  </Link>
                  <StageDots s={s} className="mt-1.5" />
                </td>
                <td className="px-3 py-3 text-ink-2">{s.supplier_name}</td>
                <td className="px-3 py-3 text-ink-2">
                  {s.origin ?? "—"}
                  {s.variety && <span className="text-muted"> · {s.variety}</span>}
                </td>
                {showStage && (
                  <td className="px-3 py-3 text-ink-2">
                    {s.status === "completed" ? (
                      <span className="text-muted">PO {s.po_number}</span>
                    ) : (
                      <span className="inline-flex flex-col gap-1">
                        <StageLabel stage={s.status === "rejected" && s.rejected_stage ? s.rejected_stage : s.stage} />
                        {s.status === "active" && <span className="text-xs text-muted">{t("waitingOn")} {l(ROLE_LABELS[STAGE_MAP[s.stage].owner])}</span>}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  <TimeInStage s={s} />
                </td>
                <td className="px-5 py-3 text-end">
                  <StatusBadge s={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line/70 md:hidden">
        {samples.map((s) => (
          <li key={s.id}>
            <Link to={`/samples/${s.id}`} className="flex flex-col gap-2 px-4 py-3.5 transition-colors active:bg-sand-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{s.sample_code}</span>
                <StatusBadge s={s} />
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
                <span className="truncate">
                  {s.supplier_name}
                  {s.origin && ` · ${s.origin}`}
                </span>
                <span className="shrink-0">{s.status === "active" ? l(STAGE_MAP[s.stage].short) : fmtDate(s.updated_at, lang)}</span>
              </div>
              <StageDots s={s} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
