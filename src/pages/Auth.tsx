import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Field, Input, Logo } from "../components/ui";

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-sand lg:flex">
        <div className="pointer-events-none absolute -bottom-32 -end-24 size-[420px] rounded-full bg-teal/90" aria-hidden />
        <div className="pointer-events-none absolute -bottom-10 end-56 size-40 rounded-full bg-teal/40" aria-hidden />
        <div className="pointer-events-none absolute top-40 end-16 size-16 rounded-full border-2 border-tan" aria-hidden />
        <div className="relative flex items-center gap-3">
          <Logo size={44} className="ring-1 ring-sand/20 rounded-2xl" />
          <span className="text-lg font-bold">{t("appName")}</span>
        </div>
        <div className="relative max-w-md">
          <span className="mb-5 block h-1.5 w-14 rounded-full bg-tan" />
          <p className="text-4xl font-bold leading-tight">{t("appTagline")}</p>
          <p className="mt-4 text-sand/70">{t("signInSub")}</p>
        </div>
        <p className="relative text-sm text-sand/50">Half Million Coffee</p>
      </div>

      {/* Form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex justify-between">
          <Logo size={36} className="lg:invisible" />
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="h-9 rounded-full px-3 text-sm font-medium text-ink-2 hover:bg-sand-2 active:scale-95">
            {t("language")}
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">
          <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted">{sub}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      const code = (err as ApiError).code;
      setError(code === "too_many_attempts" ? t("tooManyAttempts") : code === "invalid_credentials" ? t("invalidCredentials") : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("signInTitle")} sub={t("signInSub")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("email")} htmlFor="email">
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </Field>
        {error && <p className="animate-fade-up rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-2">
          {t("signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}

export function SetupPage() {
  const { refresh } = useAuth();
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", password: "", setup_key: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/setup", { method: "POST", json: { ...form, lang } });
      await refresh();
    } catch (err) {
      toast.error((err as ApiError).code === "invalid_setup_key" ? t("invalidSetupKey") : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("setupTitle")} sub={t("setupSub")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("setupKey")} hint={t("setupKeyHint")} htmlFor="setup_key">
          <Input id="setup_key" type="password" autoComplete="off" value={form.setup_key} onChange={(e) => setForm({ ...form, setup_key: e.target.value })} dir="ltr" />
        </Field>
        <Field label={t("name")} htmlFor="name">
          <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label={t("email")} htmlFor="email">
          <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
        </Field>
        <Field label={t("password")} hint={t("passwordHint")} htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
        </Field>
        <Button type="submit" size="lg" loading={busy} className="mt-2">
          {t("createAdmin")}
        </Button>
      </form>
    </AuthShell>
  );
}
