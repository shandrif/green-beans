import { Link } from "react-router";
import { ArrowRight, Inbox, CheckCircle2, Clock, XCircle, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABELS, STAGES, STAGE_MAP, type DashboardData } from "../../shared/workflow";
import { useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { fmtNumber } from "../lib/format";
import { Badge, Button, Card, CardHeader, ErrorState, PageHeader, Skeleton, cx } from "../components/ui";
import { DeptBadge } from "../components/workflow";
import { EventLine } from "../components/EventLine";

function Kpi({ label, value, icon, tone }: { label: string; value: ReactNode; icon: ReactNode; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className={cx("grid size-8 place-items-center rounded-xl", tone)}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular">{value}</p>
    </Card>
  );
}

function Rate({ label, a, r }: { label: string; a: number; r: number }) {
  const { t } = useI18n();
  const total = a + r;
  const pct = total ? Math.round((a / total) * 100) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <p className="text-xl font-bold tabular">{pct === null ? "—" : `${pct}%`}</p>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-sand-2">
        <div className="bg-deep transition-[width] duration-700 ease-out" style={{ width: `${total ? (a / total) * 100 : 0}%` }} />
        <div className="bg-danger/80 transition-[width] duration-700 ease-out" style={{ width: `${total ? (r / total) * 100 : 0}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">{t("ofDecisions", { n: total })}</p>
    </div>
  );
}

export function DashboardPage() {
  const user = useUser();
  const { t, l, lang } = useI18n();
  const { data, error, reload } = useApi<DashboardData>("/dashboard");

  if (error) return <ErrorState onRetry={reload} />;

  const max = data ? Math.max(1, ...Object.values(data.byStage)) : 1;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("greeting", { name: user.name.split(" ")[0] })}
        sub={l(ROLE_LABELS[user.role])}
        actions={
          data && data.myQueue > 0 ? (
            <Link to="/queue">
              <Button icon={<Inbox className="size-4" />}>
                {t("waitingForYou", { n: data.myQueue })}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {data ? (
          <>
            <Kpi label={t("activeSamples")} value={data.totals.active} icon={<Clock className="size-4" />} tone="bg-tan-soft text-[#7a5a32]" />
            <Kpi label={t("completedSamples")} value={data.totals.completed} icon={<CheckCircle2 className="size-4" />} tone="bg-teal-soft text-deep" />
            <Kpi label={t("rejectedSamples")} value={data.totals.rejected} icon={<XCircle className="size-4" />} tone="bg-danger-soft text-danger" />
            <Kpi
              label={t("avgCycle")}
              value={data.avgCycleDays === null ? "—" : <>{data.avgCycleDays < 1 ? "< 1" : fmtNumber(data.avgCycleDays, lang, 1)} <span className="text-base font-medium text-muted">{t("days")}</span></>}
              icon={<Timer className="size-4" />}
              tone="bg-sand-2 text-ink-2"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
        <Card>
          <CardHeader title={t("samplesByStage")} sub={t("activeSamples")} />
          <ul className="flex flex-col gap-1 p-3">
            {STAGES.map((s) => {
              const n = data?.byStage[s.key] ?? 0;
              return (
                <li key={s.key}>
                  <Link
                    to={`/samples?status=active&stage=${s.key}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-sand/70 sm:grid-cols-[180px_1fr_auto]"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="grid size-5 place-items-center rounded-full bg-sand-2 text-[11px] font-semibold tabular">{s.step}</span>
                      {l(s.short)}
                    </span>
                    <span className="col-span-2 order-last h-2 overflow-hidden rounded-full bg-sand-2 sm:order-none sm:col-span-1">
                      <span
                        className="block h-full rounded-full bg-tan transition-[width] duration-700 ease-out"
                        style={{ width: data ? `${(n / max) * 100}%` : 0 }}
                      />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="hidden sm:inline">
                        <DeptBadge dept={s.owner} />
                      </span>
                      <span className="w-6 text-end text-sm font-semibold tabular">{n}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4 lg:gap-6">
          <Card className="p-5">
            <div className="flex flex-col gap-5">
              <Rate label={t("roastingApproval")} a={data?.roastingApproval.approved ?? 0} r={data?.roastingApproval.rejected ?? 0} />
              <Rate label={t("npdApproval")} a={data?.npdApproval.approved ?? 0} r={data?.npdApproval.rejected ?? 0} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t("overdueSamples")} sub={t("overdueSub")} action={data && data.overdue.length > 0 && <Badge tone="danger">{data.overdue.length}</Badge>} />
            {data && data.overdue.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-muted">{t("nothingOverdue")}</p>
            ) : (
              <ul className="p-2">
                {data?.overdue.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link to={`/samples/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sand/70">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{s.sample_code}</span>
                        <span className="block truncate text-xs text-muted">
                          {l(STAGE_MAP[s.stage].short)} · {s.supplier_name}
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        <span className="block text-sm font-semibold text-danger tabular">
                          {Math.floor(s.days)} {t("days")}
                        </span>
                        <span className="block text-xs text-muted">{t("expected", { n: STAGE_MAP[s.stage].slaDays })}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 lg:mt-6">
        <CardHeader title={t("recentActivity")} />
        {data && data.recent.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-muted">{t("noActivity")}</p>
        ) : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2">
            {data?.recent.map((e) => <EventLine key={e.id} e={e} showSample />)}
          </ul>
        )}
      </Card>
    </div>
  );
}
