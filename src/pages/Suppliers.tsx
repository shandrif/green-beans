import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Building2, Mail, Pencil, Phone, Plus, UserRound } from "lucide-react";
import { canCreateSamples, type SampleSummary, type Supplier } from "../../shared/workflow";
import { api, useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Sheet, Skeleton, Textarea } from "../components/ui";
import { SampleList } from "../components/workflow";
import { NewSampleSheet } from "../components/NewSampleSheet";

const EMPTY = { name: "", country: "", contact_name: "", email: "", phone: "", notes: "" };

function SupplierSheet({ open, onOpenChange, supplier, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: Supplier; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setF(
        supplier
          ? {
              name: supplier.name,
              country: supplier.country ?? "",
              contact_name: supplier.contact_name ?? "",
              email: supplier.email ?? "",
              phone: supplier.phone ?? "",
              notes: supplier.notes ?? "",
            }
          : EMPTY,
      );
  }, [open, supplier]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(supplier ? `/suppliers/${supplier.id}` : "/suppliers", { method: supplier ? "PATCH" : "POST", json: f });
      toast.success(t("supplierSaved"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  const bind = (k: keyof typeof EMPTY) => ({ id: `s-${k}`, value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={supplier ? t("editSupplier") : t("newSupplier")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("supplierName")} required htmlFor="s-name">
          <Input required autoFocus {...bind("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("country")} htmlFor="s-country">
            <Input {...bind("country")} />
          </Field>
          <Field label={t("contactName")} htmlFor="s-contact_name">
            <Input {...bind("contact_name")} />
          </Field>
          <Field label={t("email")} htmlFor="s-email">
            <Input type="email" dir="ltr" {...bind("email")} />
          </Field>
          <Field label={t("phone")} htmlFor="s-phone">
            <Input type="tel" dir="ltr" {...bind("phone")} />
          </Field>
        </div>
        <Field label={t("notes")} htmlFor="s-notes">
          <Textarea {...bind("notes")} />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export function SuppliersPage() {
  const user = useUser();
  const { t } = useI18n();
  const { data, error, reload } = useApi<{ suppliers: Supplier[] }>("/suppliers");
  const [open, setOpen] = useState(false);
  const canEdit = canCreateSamples(user.role);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("suppliers")}
        actions={canEdit && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{t("newSupplier")}</Button>}
      />
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : data.suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={t("noSuppliers")}
            sub={t("noSuppliersSub")}
            action={canEdit && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{t("newSupplier")}</Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {data.suppliers.map((s) => (
            <li key={s.id}>
              <Link
                to={`/suppliers/${s.id}`}
                className="flex h-full flex-col rounded-2xl border border-line/80 bg-paper p-5 shadow-card transition-[transform,border-color] duration-150 ease-out hover:border-tan active:scale-[0.99]"
              >
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="mt-0.5 text-sm text-muted">{[s.country, s.contact_name].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-auto flex gap-6 pt-4 text-sm">
                  <span>
                    <span className="block text-xl font-bold tabular">{s.sample_count ?? 0}</span>
                    <span className="text-xs text-muted">{t("sampleCount")}</span>
                  </span>
                  <span>
                    <span className="block text-xl font-bold text-deep tabular">{s.approved_count ?? 0}</span>
                    <span className="text-xs text-muted">{t("toPo")}</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <SupplierSheet open={open} onOpenChange={setOpen} onSaved={reload} />
    </div>
  );
}

export function SupplierDetailPage() {
  const { id } = useParams();
  const user = useUser();
  const { t } = useI18n();
  const { data, error, reload } = useApi<{ supplier: Supplier; samples: SampleSummary[] }>(`/suppliers/${id}`);
  const [editing, setEditing] = useState(false);
  const [newSample, setNewSample] = useState(false);
  const canEdit = canCreateSamples(user.role);

  if (error) return <ErrorState onRetry={reload} />;
  if (!data) return <Skeleton className="h-40" />;
  const s = data.supplier;

  return (
    <div className="animate-fade-up">
      <Link to="/suppliers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {t("suppliers")}
      </Link>
      <PageHeader
        title={s.name}
        sub={s.country ?? undefined}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setNewSample(true)}>
                {t("newSample")}
              </Button>
            </>
          )
        }
      />
      {(s.contact_name || s.email || s.phone || s.notes) && (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-2">
            {s.contact_name && (
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-4 text-muted" />
                {s.contact_name}
              </span>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-2 hover:text-ink" dir="ltr">
                <Mail className="size-4 text-muted" />
                {s.email}
              </a>
            )}
            {s.phone && (
              <a href={`tel:${s.phone}`} className="inline-flex items-center gap-2 hover:text-ink" dir="ltr">
                <Phone className="size-4 text-muted" />
                {s.phone}
              </a>
            )}
          </div>
          {s.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{s.notes}</p>}
        </Card>
      )}
      <h2 className="mb-3 text-[15px] font-semibold">{t("sampleHistory")}</h2>
      <Card>{data.samples.length ? <SampleList samples={data.samples} /> : <EmptyState title={t("noSamples")} />}</Card>
      <SupplierSheet open={editing} onOpenChange={setEditing} supplier={s} onSaved={reload} />
      <NewSampleSheet open={newSample} onOpenChange={setNewSample} supplierId={s.id} />
    </div>
  );
}
