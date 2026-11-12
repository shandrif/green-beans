import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Coffee, Download, Plus, Search } from "lucide-react";
import { STAGES, STAGE_MAP, STATUS_LABELS, canCreateSamples, type SampleSummary, type Supplier } from "../../shared/workflow";
import { useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Segmented, Select, Skeleton } from "../components/ui";
import { SampleList } from "../components/workflow";
import { NewSampleSheet } from "../components/NewSampleSheet";

type StatusFilter = "" | "active" | "completed" | "rejected";

function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");
}

export function SamplesPage() {
  const user = useUser();
  const { t, l } = useI18n();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const status = (params.get("status") ?? "") as StatusFilter;
  const stage = params.get("stage") ?? "";
  const supplier = params.get("supplier") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounce search into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q) next.set("q", q);
      else next.delete("q");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === "status" && v !== "active") next.delete("stage");
    setParams(next, { replace: true });
  };

  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of ["status", "stage", "supplier", "q"]) {
      const v = params.get(k);
      if (v) p.set(k, v);
    }
    return `/samples?${p}`;
  }, [params]);

  const { data, error, reload } = useApi<{ samples: SampleSummary[] }>(query);
  const sup = useApi<{ suppliers: Supplier[] }>("/suppliers");

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      [t("sampleId"), t("supplier"), t("origin"), t("variety"), t("stage"), t("status"), "PR", "PO", t("created"), t("updated")],
      ...data.samples.map((s) => [
        s.sample_code,
        s.supplier_name,
        s.origin,
        s.variety,
        l(STAGE_MAP[s.status === "rejected" && s.rejected_stage ? s.rejected_stage : s.stage].short),
        l(STATUS_LABELS[s.status]),
        s.pr_number,
        s.po_number,
        s.created_at.slice(0, 10),
        s.updated_at.slice(0, 10),
      ]),
    ];
    const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `green-beans-samples-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filtered = !!(status || stage || supplier || params.get("q"));

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("samples")}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!data?.samples.length}>
              {t("exportCsv")}
            </Button>
            {canCreateSamples(user.role) && (
              <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
                {t("newSample")}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented<StatusFilter>
          value={status}
          onChange={(v) => set("status", v)}
          className="self-start overflow-x-auto"
          options={[
            { value: "", label: t("all") },
            { value: "active", label: l(STATUS_LABELS.active) },
            { value: "completed", label: l(STATUS_LABELS.completed) },
            { value: "rejected", label: l(STATUS_LABELS.rejected) },
          ]}
        />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_180px_200px]">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchSamples")} className="h-10 ps-9" aria-label={t("search")} />
          </div>
          <Select value={stage} onChange={(e) => set("stage", e.target.value)} className="h-10" aria-label={t("stage")} disabled={status !== "" && status !== "active"}>
            <option value="">
              {t("stage")}: {t("all")}
            </option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.step}. {l(s.short)}
              </option>
            ))}
          </Select>
          <Select value={supplier} onChange={(e) => set("supplier", e.target.value)} className="h-10" aria-label={t("supplier")}>
            <option value="">
              {t("supplier")}: {t("all")}
            </option>
            {sup.data?.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        {error ? (
          <ErrorState onRetry={reload} />
        ) : !data ? (
          <div className="flex flex-col gap-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : data.samples.length === 0 ? (
          filtered ? (
            <EmptyState title={t("noMatches")} />
          ) : (
            <EmptyState
              icon={<Coffee className="size-5" />}
              title={t("noSamples")}
              sub={t("noSamplesSub")}
              action={canCreateSamples(user.role) && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{t("newSample")}</Button>}
            />
          )
        ) : (
          <SampleList samples={data.samples} />
        )}
      </Card>
      <NewSampleSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
