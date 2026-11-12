import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { Toaster } from "sonner";
import { I18nProvider, useI18n } from "./lib/i18n";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Logo, Spinner } from "./components/ui";
import { LoginPage, SetupPage } from "./pages/Auth";
import { DashboardPage } from "./pages/Dashboard";
import { QueuePage } from "./pages/Queue";
import { BoardPage } from "./pages/Board";
import { SamplesPage } from "./pages/Samples";
import { SampleDetailPage } from "./pages/SampleDetail";
import { SuppliersPage, SupplierDetailPage } from "./pages/Suppliers";
import { AdminPage } from "./pages/Admin";
import { AccountPage } from "./pages/Account";

function Gate() {
  const { user, ready, setupNeeded } = useAuth();
  const { pathname } = useLocation();

  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={44} />
          <Spinner />
        </div>
      </div>
    );

  if (!user)
    return (
      <Routes>
        <Route path="*" element={setupNeeded ? <SetupPage /> : <LoginPage />} />
      </Routes>
    );

  if (user.must_change_password && pathname !== "/account") return <Navigate to="/account" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="samples" element={<SamplesPage />} />
        <Route path="samples/:id" element={<SampleDetailPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="admin" element={user.role === "admin" ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function ThemedToaster() {
  const { dir } = useI18n();
  return (
    <Toaster
      position={dir === "rtl" ? "top-left" : "top-right"}
      dir={dir}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-line !bg-paper !text-ink !shadow-pop !font-sans",
          description: "!text-muted",
        },
      }}
    />
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <Gate />
          <ThemedToaster />
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
