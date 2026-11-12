import { Link } from "react-router";
import { STAGES, isOverdue, type SampleSummary } from "../../shared/workflow";
import { useApi } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { ErrorState, PageHeader, Skeleton, cx } from "../components/ui";
import { DeptBadge, TimeInStage } from "../components/workflow";

export function BoardPage() {
  const { t, l } = useI18n();
  const { data, error, reload } = useApi<{ samples: SampleSummary[] }>("/samples?status=active");

  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="animate-fade-up">
      <PageHeader title={t("board")} sub={t("activeSamples")} />
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
        <div className="flex gap-3" style={{ minWidth: STAGES.length * 236 }}>
          {STAGES.map((s) => {
            const items = data?.samples.filter((x) => x.stage === s.key) ?? [];
            return (
              <section key={s.key} className="flex w-[236px] shrink-0 flex-col rounded-2xl bg-sand-2/70 p-2">
                <header className="flex items-center justify-between gap-2 px-2 pb-2 pt-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      <span className="text-muted tabular">{s.step}.</span> {l(s.short)}
                    </p>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-paper px-1.5 text-xs font-semibold tabular">{items.length}</span>
                </header>
                <div className="px-2 pb-2">
                  <DeptBadge dept={s.owner} />
                </div>
                <div className="flex flex-col gap-2">
                  {!data && <Skeleton className="h-20 rounded-xl" />}
                  {items.map((x) => (
                    <Link
                      key={x.id}
                      to={`/samples/${x.id}`}
                      className={cx(
                        "rounded-xl border bg-paper p-3 shadow-card transition-[transform,border-color] duration-150 ease-out hover:border-tan active:scale-[0.98]",
                        isOverdue(x) ? "border-danger/40" : "border-line/70",
                      )}
                    >
                      <p className="truncate text-sm font-semibold">{x.sample_code}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{x.supplier_name}</p>
                      {(x.origin || x.variety) && <p className="mt-0.5 truncate text-xs text-ink-2">{[x.origin, x.variety].filter(Boolean).join(" · ")}</p>}
                      <p className="mt-2 text-xs">
                        <TimeInStage s={x} />
                      </p>
                    </Link>
                  ))}
                  {data && items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
