import { useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, FileText, Lock, Paperclip, RotateCcw, Trash2, X, Building2, Image as ImageIcon } from "lucide-react";
import {
  ROLE_LABELS,
  STAGES,
  STAGE_MAP,
  canActOn,
  canCreateSamples,
  daysBetween,
  type Attachment,
  type SampleDetail,
  type StageDef,
  type StageKey,
} from "../../shared/workflow";
import { api, useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { fmtBytes, fmtDate, fmtDateTime } from "../lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, cx } from "../components/ui";
import { DeptBadge, StatusBadge } from "../components/workflow";
import { StageForm, StageSummary } from "../components/StageForm";
import { EventLine } from "../components/EventLine";
import { NewSampleSheet } from "../components/NewSampleSheet";

const MAX_FILE = 15 * 1024 * 1024;

function Files({ sampleId, stage, files, canUpload, onChange }: { sampleId: number; stage: StageKey; files: Attachment[]; canUpload: boolean; onChange: () => void }) {
  const { t, lang } = useI18n();
  const user = useUser();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        if (file.size > MAX_FILE) {
          toast.error(t("fileTooLarge"), { description: file.name });
          continue;
        }
        const fd = new FormData();
        fd.set("file", file);
        fd.set("stage", stage);
        await api(`/samples/${sampleId}/attachments`, { method: "POST", body: fd });
      }
      toast.success(t("uploaded"));
      onChange();
    } catch {
      toast.error(t("somethingWrong"));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (a: Attachment) => {
    try {
      await api(`/attachments/${a.id}`, { method: "DELETE" });
      onChange();
    } catch {
      toast.error(t("somethingWrong"));
    }
  };

  if (!files.length && !canUpload) return null;

  return (
    <div className="mt-5 border-t border-dashed border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("attachments")}</p>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple className="hidden" onChange={upload} accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx" />
            <Button type="button" size="sm" variant="ghost" icon={<Paperclip className="size-3.5" />} loading={uploading} onClick={() => input.current?.click()}>
              {t("addFile")}
            </Button>
          </>
        )}
      </div>
      {files.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {files.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 rounded-xl border border-line/80 bg-sand/40 px-3 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper text-muted">
                {a.content_type?.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
              </span>
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink hover:underline">{a.filename}</span>
                <span className="block truncate text-xs text-muted">
                  {fmtBytes(a.size)} · {a.uploaded_by_name} · {fmtDate(a.created_at, lang)}
                </span>
              </a>
              {(user.role === "admin" || a.uploaded_by_name === user.name) && (
                <button
                  onClick={() => remove(a)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted opacity-100 transition-[opacity,color] hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  aria-label={t("removeFile")}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type StepState = "done" | "approved" | "rejected" | "current" | "upcoming" | "skipped";

function StepMarker({ state, step }: { state: StepState; step: number }) {
  return (
    <span
      className={cx(
        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular transition-colors duration-300",
        (state === "done" || state === "approved") && "bg-deep text-white",
        state === "rejected" && "bg-danger text-white",
        state === "current" && "bg-tan text-ink ring-4 ring-tan/25",
        (state === "upcoming" || state === "skipped") && "border border-line bg-paper text-muted",
      )}
    >
      {state === "done" || state === "approved" ? <Check className="size-4" /> : state === "rejected" ? <X className="size-4" /> : step}
    </span>
  );
}

function StageSection({
  def,
  detail,
  state,
  isLast,
  onChange,
}: {
  def: StageDef;
  detail: SampleDetail;
  state: StepState;
  isLast: boolean;
  onChange: () => void;
}) {
  const user = useUser();
  const { t, l, lang } = useI18n();
  const rec = detail.stages[def.key];
  const mine = canActOn(user.role, def.key);
  const [open, setOpen] = useState(state === "current" || state === "rejected");
  const files = detail.attachments.filter((a) => a.stage === def.key);
  const previous = Object.fromEntries(Object.entries(detail.stages).map(([k, v]) => [k, v!.data]));
  const collapsible = state !== "current" && state !== "upcoming" && state !== "skipped";

  return (
    <li className="relative flex gap-4">
      {!isLast && <span className={cx("absolute start-4 top-9 -bottom-3 w-px -translate-x-1/2 rtl:translate-x-1/2", state === "done" || state === "approved" ? "bg-deep/40" : "bg-line")} aria-hidden />}
      <StepMarker state={state} step={def.step} />
      <Card
        as="article"
        className={cx(
          "mb-4 min-w-0 flex-1 transition-shadow duration-300",
          state === "current" && "border-tan/70 shadow-pop",
          (state === "upcoming" || state === "skipped") && "bg-paper/50 shadow-none",
        )}
      >
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start justify-between gap-3 px-5 py-4 text-start disabled:cursor-default"
          aria-expanded={collapsible ? open : undefined}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cx("font-semibold", state === "upcoming" || state === "skipped" ? "text-muted" : "text-ink")}>{l(def.title)}</h3>
              <DeptBadge dept={def.owner} />
              {state === "approved" && <Badge tone="teal">{t("approved")}</Badge>}
              {state === "rejected" && <Badge tone="danger">{t("rejected")}</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {rec?.completed_at ? (
                <>
                  {rec.completed_by_name} · {fmtDateTime(rec.completed_at, lang)}
                </>
              ) : state === "current" ? (
                l(def.description)
              ) : state === "upcoming" ? (
                t("waitingForPrevious")
              ) : null}
            </p>
          </div>
          {collapsible && <ChevronDown className={cx("mt-1 size-4 shrink-0 text-muted transition-transform duration-200 ease-out", open && "rotate-180")} />}
        </button>

        {state === "current" && (
          <div className="px-5 pb-5">
            {mine ? (
              <StageForm sampleId={detail.sample.id} stage={def.key} initial={rec?.data} previous={previous} onDone={onChange} />
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2.5 text-sm text-ink-2">
                  <Lock className="size-4 shrink-0 text-muted" />
                  {t("notYourStage", { dept: l(ROLE_LABELS[def.owner]) })}
                </div>
                {rec && Object.keys(rec.data).length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-muted">
                      {t("lastSaved")} · {rec.updated_by_name} · {fmtDateTime(rec.updated_at, lang)}
                    </p>
                    <StageSummary stage={def.key} data={rec.data} />
                  </div>
                )}
              </>
            )}
            <Files sampleId={detail.sample.id} stage={def.key} files={files} canUpload={mine} onChange={onChange} />
          </div>
        )}

        {collapsible && (
          <div className={cx("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="px-5 pb-5">
                {state === "rejected" && detail.sample.rejection_reason && (
                  <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3">
                    <p className="text-xs font-medium text-danger">{t("rejectionReason")}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{detail.sample.rejection_reason}</p>
                  </div>
                )}
                {rec && <StageSummary stage={def.key} data={rec.data} />}
                <Files sampleId={detail.sample.id} stage={def.key} files={files} canUpload={mine && user.role !== "viewer"} onChange={onChange} />
              </div>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

export function SampleDetailPage() {
  const { id } = useParams();
  const user = useUser();
  const { t, l, lang } = useI18n();
  const { data, error, reload } = useApi<SampleDetail>(`/samples/${id}`);
  const [resubmit, setResubmit] = useState(false);

  if (error?.status === 404) return <EmptyState title={t("notFound")} action={<Link to="/samples"><Button variant="secondary">{t("back")}</Button></Link>} />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );

  const s = data.sample;
  const currentIdx = STAGES.findIndex((x) => x.key === s.stage);
  const rejectedIdx = s.rejected_stage ? STAGES.findIndex((x) => x.key === s.rejected_stage) : -1;

  const stateOf = (i: number): StepState => {
    const def = STAGES[i];
    const rec = data.stages[def.key];
    if (s.status === "rejected") {
      if (i === rejectedIdx) return "rejected";
      if (i > rejectedIdx) return "skipped";
    }
    if (s.status === "completed" || i < currentIdx || rec?.completed_at) return rec?.decision === "approved" ? "approved" : "done";
    if (i === currentIdx) return "current";
    return "upcoming";
  };

  const reg = data.stages.registration?.data ?? {};
  const facts: [string, string | null | undefined][] = [
    [t("origin"), [s.origin, reg.region].filter(Boolean).join(", ") || null],
    [t("variety"), s.variety],
    ["PR", s.pr_number],
    ["PO", s.po_number],
  ];

  return (
    <div className="animate-fade-up">
      <Link to="/samples" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {t("samples")}
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-tight" dir="ltr">
            {s.sample_code}
          </h1>
          <StatusBadge s={s} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Link to={`/suppliers/${s.supplier_id}`} className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink">
            <Building2 className="size-4" />
            {s.supplier_name}
          </Link>
          <span>
            {t("registeredBy")} {s.created_by_name} · {fmtDate(s.created_at, lang)}
          </span>
          {s.parent_code && (
            <Link to={`/samples/${s.parent_sample_id}`} className="font-medium text-deep hover:underline">
              {t("resubmissionOf")} {s.parent_code}
            </Link>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line/70 bg-paper/60 px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 truncate font-semibold">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </header>

      {s.status === "rejected" && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-danger/25 bg-danger-soft/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-danger">{t("rejectedAt", { stage: l(STAGE_MAP[s.rejected_stage!].title) })}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{s.rejection_reason}</p>
            {data.children.length > 0 && (
              <p className="mt-2 text-sm">
                {t("resubmittedAs")}{" "}
                {data.children.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link to={`/samples/${c.id}`} className="font-semibold text-deep hover:underline">
                      {c.sample_code}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
          {canCreateSamples(user.role) && (
            <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setResubmit(true)} className="shrink-0">
              {t("resubmit")}
            </Button>
          )}
        </div>
      )}

      {s.status === "completed" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-deep/20 bg-teal-soft/70 p-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-deep text-white">
            <Check className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-deep">{t("handedToOracle")}</p>
            <p className="mt-0.5 text-sm text-ink-2">
              PO {s.po_number} · PR {s.pr_number} · {fmtDate(s.completed_at, lang)} ·{" "}
              {(() => {
                const d = daysBetween(s.created_at, new Date(s.completed_at!));
                return d < 1 ? `< 1 ${t("day")}` : `${Math.round(d)} ${t("days")}`;
              })()}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section aria-label={t("timeline")}>
          <ol>
            {STAGES.map((def, i) => (
              <StageSection key={`${def.key}-${stateOf(i)}`} def={def} detail={data} state={stateOf(i)} isLast={i === STAGES.length - 1} onChange={reload} />
            ))}
          </ol>
          <p className="ms-12 text-xs text-muted">{t("oracleNote")}</p>
        </section>

        <aside>
          <Card className="xl:sticky xl:top-8">
            <div className="px-5 pt-5">
              <h2 className="text-[15px] font-semibold">{t("activity")}</h2>
            </div>
            <ul className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-5">
              {data.events
                .filter((e) => e.type !== "saved")
                .map((e) => (
                  <EventLine key={e.id} e={e} absolute />
                ))}
            </ul>
          </Card>
        </aside>
      </div>

      <NewSampleSheet open={resubmit} onOpenChange={setResubmit} parent={{ id: s.id, code: s.sample_code, supplier_id: s.supplier_id }} />
    </div>
  );
}
