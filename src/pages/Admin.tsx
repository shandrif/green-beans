import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role, type SampleEvent, type User } from "../../shared/workflow";
import { api, ApiError, useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Segmented, Select, Sheet, Skeleton, cx } from "../components/ui";
import { EventLine } from "../components/EventLine";

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
  const [tab, setTab] = useState<"users" | "audit">("users");
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
            ]}
          />
        }
      />
      {tab === "users" ? <Users /> : <Audit />}
    </div>
  );
}
