import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Supplier } from "../../shared/workflow";
import { api, ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Button, Field, Input, Select, Sheet } from "./ui";

export function NewSampleSheet({
  open,
  onOpenChange,
  supplierId,
  parent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplierId?: number;
  parent?: { id: number; code: string; supplier_id: number };
}) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [code, setCode] = useState("");
  const [sup, setSup] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", country: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setAdding(false);
    setSup(String(parent?.supplier_id ?? supplierId ?? ""));
    api<{ suppliers: Supplier[] }>("/suppliers").then((r) => {
      setSuppliers(r.suppliers);
      if (!r.suppliers.length) setAdding(true);
    });
  }, [open, supplierId, parent?.id, parent?.supplier_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let supplier_id = Number(sup);
      if (adding) {
        const r = await api<{ supplier: Supplier }>("/suppliers", { method: "POST", json: newSup });
        supplier_id = r.supplier.id;
      }
      const { id } = await api<{ id: number }>("/samples", {
        method: "POST",
        json: { sample_code: code, supplier_id, parent_sample_id: parent?.id },
      });
      toast.success(t("sampleCreated"), { description: code });
      onOpenChange(false);
      nav(`/samples/${id}`);
    } catch (err) {
      setError((err as ApiError).code === "duplicate_code" ? t("duplicateCode") : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={parent ? t("resubmit") : t("newSample")}
      description={parent ? t("resubmitSub") : t("newSampleSub")}
    >
      <form id="new-sample" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={parent ? t("newSampleId") : t("sampleId")} hint={t("sampleIdHint")} required htmlFor="code" error={error}>
          <Input id="code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!error} dir="ltr" className="font-medium" />
        </Field>

        {!adding ? (
          <Field label={t("supplier")} required htmlFor="sup">
            <Select id="sup" required value={sup} onChange={(e) => setSup(e.target.value)} disabled={!!parent}>
              <option value="" disabled>
                {t("selectSupplier")}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.country ? ` — ${s.country}` : ""}
                </option>
              ))}
            </Select>
            {!parent && (
              <button type="button" onClick={() => setAdding(true)} className="mt-1 inline-flex items-center gap-1 self-start text-[13px] font-medium text-deep hover:underline">
                <Plus className="size-3.5" />
                {t("addSupplierInline")}
              </button>
            )}
          </Field>
        ) : (
          <div className="animate-fade-up rounded-2xl border border-line bg-sand/50 p-4">
            <p className="mb-3 text-sm font-semibold">{t("newSupplier")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("supplierName")} required htmlFor="sn">
                <Input id="sn" required value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} />
              </Field>
              <Field label={t("country")} htmlFor="sc">
                <Input id="sc" value={newSup.country} onChange={(e) => setNewSup({ ...newSup, country: e.target.value })} />
              </Field>
            </div>
            {suppliers.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="mt-3 text-[13px] font-medium text-muted hover:text-ink">
                {t("cancel")}
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("create")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
