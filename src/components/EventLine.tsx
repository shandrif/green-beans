import { Link } from "react-router";
import { STAGE_MAP, type SampleEvent } from "../../shared/workflow";
import { useI18n, type DictKey } from "../lib/i18n";
import { fmtDateTime, relTime } from "../lib/format";
import { cx } from "./ui";

const DOT: Record<string, string> = {
  approved: "bg-deep",
  closed: "bg-deep",
  rejected: "bg-danger",
  login_failed: "bg-danger",
  created: "bg-tan",
  resubmitted: "bg-tan",
  completed: "bg-teal",
};

export function EventLine({ e, showSample = false, absolute = false }: { e: SampleEvent; showSample?: boolean; absolute?: boolean }) {
  const { t, l, lang } = useI18n();
  const verbKey = `ev_${e.type}` as DictKey;
  const stage = e.stage && STAGE_MAP[e.stage] ? l(STAGE_MAP[e.stage].short) : null;
  const showStage = stage && !["created", "resubmitted", "user_created", "user_updated", "login_failed"].includes(e.type);
  return (
    <li className="relative flex gap-3 ps-1">
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", DOT[e.type] ?? "bg-line")} aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="text-ink-2">
          {e.type === "login_failed" ? (
            <>
              {t(verbKey)} <span className="font-medium text-ink" dir="ltr">{e.message}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{e.user_name ?? "—"}</span> {t(verbKey)}
              {showStage && <span className="font-medium text-ink"> {stage}</span>}
              {(e.type === "user_created" || e.type === "user_updated") && <span className="font-medium text-ink"> {e.message}</span>}
              {showSample && e.sample_code && (
                <>
                  {" · "}
                  <Link to={`/samples/${e.sample_id}`} className="font-semibold text-deep hover:underline">
                    {e.sample_code}
                  </Link>
                </>
              )}
            </>
          )}
        </p>
        {e.message && ["rejected", "file_added", "file_removed"].includes(e.type) && (
          <p className={cx("mt-0.5 break-words text-[13px]", e.type === "rejected" ? "text-danger" : "text-muted")}>“{e.message}”</p>
        )}
        <p className="text-xs text-muted" title={fmtDateTime(e.created_at, lang)}>
          {absolute ? fmtDateTime(e.created_at, lang) : relTime(e.created_at, lang)}
        </p>
      </div>
    </li>
  );
}
