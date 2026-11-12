import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role, type SampleEvent, type User } from "../../shared/workflow";
import { api, ApiError, useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Segmented, Select, Sheet, Skeleton, cx } from "../components/ui";
import { EventLine } from "../components/EventLine";
import { fmtBytes } from "../lib/format";

interface Usage {
  db: { bytes: number | null; limit: number };
  files: { n: number; bytes: number; limit: number; cap: number };
  counts: { samples: number; suppliers: number; users: number; events: number };
}

function Meter({ label, used, limit, detail }: { label: string; used: number; limit: number; detail?: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <p className="text-sm tabular text-muted">
          <span className="font-semibold text-ink">{fmtBytes(used)}</span> / {fmtBytes(limit)}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-2">
        <div
          className={cx("h-full rounded-full transition-[width] duration-700 ease-out", pct > 80 ? "bg-danger" : pct > 60 ? "bg-tan" : "bg-deep")}
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted tabular">
        {pct < 0.1 ? "< 0.1" : pct.toFixed(1)}%{detail ? ` · ${detail}` : ""}
      </p>
    </div>
  );
}

function UsagePanel() {
  const { t } = useI18n();
  const { data, error, reload } = useApi<Usage>("/usage");
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <Card className="p-5">
      <p className="text-[15px] font-semibold">{t("usage")}</p>
      <p className="mt-0.5 text-[13px] text-muted">{t("usageSub")}</p>
      {!data ? (
        <Skeleton className="mt-5 h-24" />
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <Meter label={t("databaseSize")} used={data.db.bytes ?? 0} limit={data.db.limit} />
          <Meter label={t("fileStorage")} used={data.files.bytes} limit={data.files.limit} detail={t("filesCount", { n: data.files.n })} />
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            {[
              [t("samples"), data.counts.samples],
              [t("suppliers"), data.counts.suppliers],
              [t("activeUsers"), data.counts.users],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sand/60 px-4 py-3">
                <p className="text-xs text-muted">{k}</p>
                <p className="text-xl font-bold tabular">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function UserSheet({ open, onOpenChange, user, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; user?: User; onSaved: () => void }) {
  const { t, l } = useI18n();
  const me = useUser();
  const [f, setF] = useState({ name: "", email: "", role: "procurement" as Role, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(user ? { name: user.name, email: user.email, role: user.role, password: "" } : { name: "", email: "", role: "procurement", password: "" });
      setError(null);
    }
  }, [open, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api(`/users/${user.id}`, {
          method: "PATCH",
          json: { name: f.name, role: f.role, ...(f.password ? { password: f.password } : {}) },
        });
      } else {
        await api("/users", { method: "POST", json: f });
      }
      toast.success(t("userSaved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError((err as ApiError).code === "email_taken" ? t("emailTaken") : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/users/${user.id}`, { method: "PATCH", json: { active: !user.active } });
      toast.success(t("userSaved"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={user ? t("editUser") : t("newUser")} description={t("rolesExplained")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("name")} required htmlFor="u-name">
          <Input id="u-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t("email")} required htmlFor="u-email" error={error}>
          <Input id="u-email" type="email" required disabled={!!user} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" />
        </Field>
        <Field label={t("role")} required htmlFor="u-role">
          <Select id="u-role" value={f.role} disabled={user?.id === me.id} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {l(ROLE_LABELS[r])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={user ? t("resetPassword") : t("tempPassword")} hint={t("passwordHint")} required={!user} htmlFor="u-pw">
          <Input id="u-pw" type="text" autoComplete="off" minLength={8} required={!user} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} dir="ltr" />
        </Field>
        <p className="-mt-2 text-xs text-muted">{t("tempPasswordHint")}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {user && user.id !== me.id ? (
            <Button type="button" variant={user.active ? "ghost" : "secondary"} onClick={toggleActive} disabled={busy} className={user.active ? "text-danger" : ""}>
              {user.active ? t("disable") : t("enable")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function Users() {
  const { t, l } = useI18n();
  const me = useUser();
  const { data, error, reload } = useApi<{ users: User[] }>("/users");
  const [edit, setEdit] = useState<User | undefined>();
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          icon={<UserPlus className="size-4" />}
          onClick={() => {
            setEdit(undefined);
            setOpen(true);
          }}
        >
          {t("newUser")}
        </Button>
      </div>
      <Card>
        {!data ? (
          <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <ul className="divide-y divide-line/70">
            {data.users.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => {
                    setEdit(u);
                    setOpen(true);
                  }}
                  className={cx("flex w-full items-center gap-4 px-5 py-3.5 text-start transition-colors hover:bg-sand/60", !u.active && "opacity-55")}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand-2 text-sm font-semibold">{u.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {u.name}
                      {u.id === me.id && <span className="text-muted"> ({t("you")})</span>}
                    </span>
                    <span className="block truncate text-sm text-muted" dir="ltr">
                      {u.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!u.active && <Badge tone="danger">{t("disabled")}</Badge>}
                    <Badge tone={u.role === "admin" ? "ink" : u.role === "viewer" ? "neutral" : "tan"}>{l(ROLE_LABELS[u.role])}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <UserSheet open={open} onOpenChange={setOpen} user={edit} onSaved={reload} />
    </>
  );
}

function Audit() {
  const { t } = useI18n();
  const [events, setEvents] = useState<SampleEvent[] | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async (before?: number) => {
    setBusy(true);
    try {
      const r = await api<{ events: SampleEvent[] }>(`/events${before ? `?before=${before}` : ""}`);
      setEvents((e) => (before ? [...(e ?? []), ...r.events] : r.events));
      setMore(r.events.length === 100);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      {!events ? (
        <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <>
          <ul className="flex flex-col gap-4 p-5">
            {events.map((e) => (
              <EventLine key={e.id} e={e} showSample absolute />
            ))}
          </ul>
          {more && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" loading={busy} onClick={() => load(events[events.length - 1]?.id)} icon={<Plus className="size-4" />}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"users" | "audit" | "usage">("users");
  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("admin")}
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "users", label: t("users") },
              { value: "audit", label: t("auditLog") },
              { value: "usage", label: t("usage") },
            ]}
          />
        }
      />
      {tab === "users" ? <Users /> : tab === "audit" ? <Audit /> : <UsagePanel />}
    </div>
  );
}
