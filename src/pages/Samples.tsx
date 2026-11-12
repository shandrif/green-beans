import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Coffee, FileSpreadsheet, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { STAGES, STAGE_MAP, STATUS_LABELS, canCreateSamples, type SampleSummary, type StageKey, type Supplier } from "../../shared/workflow";
import { api, useApi } from "../lib/api";
import { buildReport, type ExportPayload } from "../lib/report";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Segmented, Select, Skeleton } from "../components/ui";
import { SampleList } from "../components/workflow";
import { NewSampleSheet } from "../components/NewSampleSheet";

type StatusFilter = "" | "active" | "completed" | "rejected";

export function SamplesPage() {
  const user = useUser();
  const { t, l, lang } = useI18n();
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

  const [exporting, setExporting] = useState(false);
  const exportReport = async () => {
    setExporting(true);
    const id = toast.loading(t("preparingReport"));
    try {
      const data = await api<ExportPayload>(query.replace("/samples?", "/export?"));
      const parts: string[] = [];
      if (status) parts.push(l(STATUS_LABELS[status]));
      if (stage) parts.push(l(STAGE_MAP[stage as StageKey]?.short));
      if (supplier) parts.push(sup.data?.suppliers.find((x) => String(x.id) === supplier)?.name ?? "");
      if (params.get("q")) parts.push(`“${params.get("q")}”`);
      await buildReport({ data, lang, t: t as never, l, user: user.name, scope: parts.filter(Boolean).join(" · ") || t("scopeAll") });
      toast.success(t("reportReady"), { id });
    } catch {
      toast.error(t("somethingWrong"), { id });
    } finally {
      setExporting(false);
    }
  };

  const filtered = !!(status || stage || supplier || params.get("q"));

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("samples")}
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} onClick={exportReport} loading={exporting} disabled={!data?.samples.length}>
              {t("exportReport")}
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
