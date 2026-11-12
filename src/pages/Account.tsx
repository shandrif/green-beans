import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LogOut, Shield } from "lucide-react";
import { ROLE_LABELS } from "../../shared/workflow";
import { api, ApiError } from "../lib/api";
import { useAuth, useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented } from "../components/ui";

export function AccountPage() {
  const user = useUser();
  const { setUser, signOut, changeLang } = useAuth();
  const { t, l, lang } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/auth/password", { method: "POST", json: { current, next } });
      toast.success(t("passwordChanged"));
      setCurrent("");
      setNext("");
      setUser({ ...user, must_change_password: false });
    } catch (err) {
      toast.error((err as ApiError).code === "invalid_credentials" ? t("wrongPassword") : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-2xl">
      <PageHeader title={t("account")} />
      {user.must_change_password && (
        <p className="mb-5 rounded-2xl border border-tan bg-tan-soft px-4 py-3 text-sm font-medium text-ink" role="alert">
          {t("mustChangePassword")}
        </p>
      )}
      <Card className="mb-5">
        <CardHeader title={t("profile")} />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-teal text-lg font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-muted" dir="ltr">
                {user.email}
              </p>
              <p className="text-sm text-muted">{l(ROLE_LABELS[user.role])}</p>
            </div>
          </div>
          <Segmented
            value={lang}
            onChange={changeLang}
            className="self-start"
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
            ]}
          />
          <div className="flex flex-wrap gap-2 md:hidden">
            {user.role === "admin" && (
              <Link to="/admin">
                <Button variant="secondary" icon={<Shield className="size-4" />}>
                  {t("admin")}
                </Button>
              </Link>
            )}
            <Button variant="ghost" icon={<LogOut className="size-4 rtl:-scale-x-100" />} onClick={signOut}>
              {t("signOut")}
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title={t("changePassword")} />
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <Field label={t("currentPassword")} htmlFor="cur">
            <Input id="cur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t("newPassword")} hint={t("passwordHint")} htmlFor="new">
            <Input id="new" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" />
          </Field>
          <Button type="submit" loading={busy} className="self-end">
            {t("changePassword")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
