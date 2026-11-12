import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  STAGE_MAP,
  nextStage,
  sanitizeStageData,
  validateStageData,
  type FieldDef,
  type StageData,
  type StageKey,
} from "../../shared/workflow";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { fmtDate, fmtNumber, today } from "../lib/format";
import { Button, Field, Input, Select, Textarea, cx } from "./ui";

type Values = Record<string, string>;

const toValues = (d: StageData | undefined): Values =>
  Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [k, v === null ? "" : String(v)]));

/** Fills sensible defaults on a brand-new stage form. */
function withDefaults(stage: StageKey, v: Values, prev: Partial<Record<StageKey, StageData>>): Values {
  const out: Values = {};
  const reg = prev.registration ?? {};
  const neg = prev.negotiation ?? {};
  const prq = prev.pr_request ?? {};
  if (stage === "registration") out.received_date = today();
  if (stage === "roasting") out.received_date = today();
  if (stage === "negotiation") {
    out.confirmed_date = today();
    if (reg.currency) out.currency = String(reg.currency);
    if (reg.indicative_price) out.final_price = String(reg.indicative_price);
  }
  if (stage === "pr_request") {
    out.request_date = today();
    if (neg.quantity_kg) out.requested_qty_kg = String(neg.quantity_kg);
    if (neg.delivery_to) out.expected_arrival = String(neg.delivery_to);
  }
  if (stage === "pr") {
    out.pr_date = today();
    if (prq.requested_qty_kg) out.pr_qty_kg = String(prq.requested_qty_kg);
    if (prq.delivery_location) out.storage_location = String(prq.delivery_location);
  }
  if (stage === "po") {
    out.po_date = today();
    if (neg.currency) out.currency = String(neg.currency);
    if (neg.final_price && prq.requested_qty_kg)
      out.po_value = String(Math.round(Number(neg.final_price) * Number(prq.requested_qty_kg) * 100) / 100);
  }
  // Saved values always win over suggestions.
  return { ...out, ...v };
}

function FieldInput({ f, value, onChange, invalid, id }: { f: FieldDef; value: string; onChange: (v: string) => void; invalid: boolean; id: string }) {
  const { l, t } = useI18n();
  const common = { id, value, "aria-invalid": invalid, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  if (f.type === "textarea") return <Textarea {...common} />;
  if (f.type === "select")
    return (
      <Select {...common}>
        <option value="">{f.required ? "—" : t("optional")}</option>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {l(o.label)}
          </option>
        ))}
      </Select>
    );
  if (f.type === "number")
    return (
      <div className="relative">
        <Input {...common} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step ?? "any"} className={cx("tabular", f.unit && "pe-12")} />
        {f.unit && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted">{f.unit}</span>}
      </div>
    );
  if (f.type === "date") return <Input {...common} type="date" />;
  return <Input {...common} />;
}

export function StageForm({
  sampleId,
  stage,
  initial,
  previous,
  onDone,
}: {
  sampleId: number;
  stage: StageKey;
  initial?: StageData;
  previous: Partial<Record<StageKey, StageData>>;
  onDone: () => void;
}) {
  const { t, l } = useI18n();
  const def = STAGE_MAP[stage];
  const [values, setValues] = useState<Values>(() => withDefaults(stage, toValues(initial), previous));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "save" | "approved" | "rejected" | "done">(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setDirty(true);
    if (invalid.has(k)) setInvalid((s) => new Set([...s].filter((x) => x !== k)));
  };

  const data = useMemo(() => sanitizeStageData(stage, values), [stage, values]);

  const flagMissing = (keys: string[]) => {
    setInvalid(new Set(keys));
    toast.error(t("missingFields"));
    const el = formRef.current?.querySelector<HTMLElement>(`#f-${stage}-${keys[0]}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleError = (err: unknown) => {
    const e = err as ApiError;
    if (e.code === "missing_fields") flagMissing((e.body.fields as string[]) ?? []);
    else if (e.code === "stage_locked") {
      toast.error(t("stageLocked"));
      onDone();
    } else toast.error(t("somethingWrong"));
  };

  const save = async () => {
    setBusy("save");
    try {
      await api(`/samples/${sampleId}/stages/${stage}`, { method: "PUT", json: { data } });
      setDirty(false);
      toast.success(t("saved"));
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const complete = async (decision: "approved" | "rejected" | "done") => {
    if (decision !== "rejected") {
      const missing = validateStageData(stage, data);
      if (missing.length) return flagMissing(missing);
    }
    setBusy(decision);
    try {
      const r = await api<{ next: StageKey | null; status: string }>(`/samples/${sampleId}/stages/${stage}/complete`, {
        method: "POST",
        json: { data, decision: def.kind === "decision" ? decision : undefined, reason },
      });
      if (r.status === "rejected") toast(t("sampleRejected"));
      else if (r.status === "completed") toast.success(t("closedOracle"));
      else if (r.next) toast.success(`${t("movedTo")} ${l(STAGE_MAP[r.next].title)}`);
      onDone();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const next = nextStage(stage);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (def.kind === "action") complete("done");
      }}
      noValidate
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {def.fields.map((f) => {
          const id = `f-${stage}-${f.key}`;
          return (
            <Field
              key={f.key}
              htmlFor={id}
              label={l(f.label)}
              hint={f.hint ? l(f.hint) : undefined}
              required={f.required}
              error={invalid.has(f.key) ? t("required") : null}
              className={f.wide ? "sm:col-span-2 lg:col-span-3" : undefined}
            >
              <FieldInput f={f} id={id} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} invalid={invalid.has(f.key)} />
            </Field>
          );
        })}
      </div>

      {/* Reject reason, revealed inline */}
      <div className={cx("grid transition-[grid-template-rows,opacity] duration-300 ease-out", rejecting ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-danger/30 bg-danger-soft/60 p-4">
            <Field label={t("rejectionReason")} hint={t("rejectionReasonHint")} required htmlFor={`reason-${stage}`}>
              <Textarea id={`reason-${stage}`} value={reason} onChange={(e) => setReason(e.target.value)} tabIndex={rejecting ? 0 : -1} />
            </Field>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)} tabIndex={rejecting ? 0 : -1}>
                {t("cancel")}
              </Button>
              <Button type="button" variant="danger" loading={busy === "rejected"} disabled={!reason.trim()} onClick={() => complete("rejected")} tabIndex={rejecting ? 0 : -1}>
                {t("confirmReject")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={save} loading={busy === "save"} disabled={!!busy && busy !== "save"}>
          {t("saveDraft")}
          {dirty && <span className="size-1.5 rounded-full bg-tan" aria-hidden />}
        </Button>
        {def.kind === "decision" ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" icon={<X className="size-4 text-danger" />} onClick={() => setRejecting(true)} disabled={!!busy} className="flex-1 sm:flex-none">
              {t("reject")}
            </Button>
            <Button type="button" variant="success" icon={<Check className="size-4" />} loading={busy === "approved"} disabled={!!busy || rejecting} onClick={() => complete("approved")} className="flex-1 sm:flex-none">
              {t("approve")}
              {next && <span className="hidden opacity-80 sm:inline">→ {l(STAGE_MAP[next].short)}</span>}
            </Button>
          </div>
        ) : (
          <Button type="submit" loading={busy === "done"} disabled={!!busy}>
            {l(def.actionLabel)}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Read-only view of a stage's recorded data. */
export function StageSummary({ stage, data }: { stage: StageKey; data: StageData }) {
  const { l, lang } = useI18n();
  const fields = STAGE_MAP[stage].fields.filter((f) => data[f.key] !== undefined && data[f.key] !== null && data[f.key] !== "");
  if (!fields.length) return <p className="text-sm text-muted">—</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => {
        const v = data[f.key];
        let shown: string;
        if (f.type === "select") shown = l(f.options?.find((o) => o.value === v)?.label) || String(v);
        else if (f.type === "date") shown = fmtDate(String(v), lang);
        else if (f.type === "number") shown = `${fmtNumber(Number(v), lang)}${f.unit ? ` ${f.unit}` : ""}`;
        else shown = String(v);
        return (
          <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
            <dt className="text-xs text-muted">{l(f.label)}</dt>
            <dd className={cx("mt-0.5 text-sm text-ink", f.type === "textarea" ? "whitespace-pre-wrap leading-relaxed" : "font-medium", f.type === "number" && "tabular")}>
              {shown}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
