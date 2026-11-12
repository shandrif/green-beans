import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang, User } from "../../shared/workflow";
import { api } from "./api";
import { useI18n } from "./i18n";

interface AuthCtx {
  user: User | null;
  ready: boolean;
  setupNeeded: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User | null) => void;
  changeLang: (l: Lang) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      setUser(user);
      setLang(user.lang);
    } catch {
      setUser(null);
      try {
        const s = await api<{ needed: boolean }>("/setup");
        setSetupNeeded(s.needed);
      } catch {
        /* offline */
      }
    } finally {
      setReady(true);
    }
  }, [setLang]);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    window.addEventListener("gb:unauthorized", onUnauthorized);
    return () => window.removeEventListener("gb:unauthorized", onUnauthorized);
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { user } = await api<{ user: User }>("/auth/login", { method: "POST", json: { email, password } });
      setUser(user);
      setSetupNeeded(false);
      setLang(user.lang);
    },
    [setLang],
  );

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const changeLang = useCallback(
    (l: Lang) => {
      setLang(l);
      if (user) {
        setUser({ ...user, lang: l });
        api("/auth/me", { method: "PATCH", json: { lang: l } }).catch(() => {});
      }
    },
    [user, setLang],
  );

  return (
    <Ctx.Provider value={{ user, ready, setupNeeded, refresh, signIn, signOut, setUser, changeLang }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}

export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("No user");
  return user;
}
