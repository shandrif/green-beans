// Single source of truth for the green bean workflow.
// Both the API (validation, permissions) and the UI (forms, labels) read from here.

export type Lang = "en" | "ar";
export type L10n = { en: string; ar: string };

export const ROLES = ["admin", "procurement", "roasting", "npd", "warehouse", "viewer"] as const;
export type Role = (typeof ROLES)[number];
export type Department = Exclude<Role, "admin" | "viewer">;

export const ROLE_LABELS: Record<Role, L10n> = {
  admin: { en: "Admin", ar: "مسؤول النظام" },
  procurement: { en: "Procurement", ar: "المشتريات" },
  roasting: { en: "Roasting", ar: "التحميص" },
  npd: { en: "NPD", ar: "تطوير المنتجات" },
  warehouse: { en: "Warehouse", ar: "المستودع" },
  viewer: { en: "Viewer", ar: "مشاهد" },
};

export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export interface FieldOption {
  value: string;
  label: L10n;
}

export interface FieldDef {
  key: string;
  type: FieldType;
  label: L10n;
  required?: boolean;
  options?: FieldOption[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Spans the full width of the form grid. */
  wide?: boolean;
  hint?: L10n;
}

export type Decision = "approved" | "rejected" | "done";

export interface StageDef {
  key: StageKey;
  step: number;
  owner: Department;
  title: L10n;
  short: L10n;
  description: L10n;
  /** Approve / reject decision (Roasting, NPD) or a single "complete" action. */
  kind: "decision" | "action";
  actionLabel: L10n;
  /** Expected days in this stage before it is flagged overdue. */
  slaDays: number;
  fields: FieldDef[];
}

const opt = (value: string, en: string, ar: string): FieldOption => ({ value, label: { en, ar } });

const CURRENCIES = [opt("USD", "USD", "دولار أمريكي"), opt("EUR", "EUR", "يورو"), opt("SAR", "SAR", "ريال سعودي")];

export const STAGE_KEYS = ["registration", "roasting", "npd", "negotiation", "pr_request", "pr", "po"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGES: StageDef[] = [
  {
    key: "registration",
    step: 1,
    owner: "procurement",
    title: { en: "Sample registration", ar: "تسجيل العينة" },
    short: { en: "Registration", ar: "التسجيل" },
    description: {
      en: "Record the supplier and sample details, then send the sample to Roasting.",
      ar: "سجّل بيانات المورد والعينة، ثم أرسل العينة إلى قسم التحميص.",
    },
    kind: "action",
    actionLabel: { en: "Submit to Roasting", ar: "إرسال إلى التحميص" },
    slaDays: 2,
    fields: [
      { key: "origin", type: "text", required: true, label: { en: "Origin (country)", ar: "بلد المنشأ" } },
      { key: "region", type: "text", label: { en: "Region", ar: "المنطقة" } },
      { key: "producer", type: "text", label: { en: "Farm / producer", ar: "المزرعة / المنتج" } },
      { key: "variety", type: "text", required: true, label: { en: "Variety", ar: "الصنف" } },
      {
        key: "process",
        type: "select",
        required: true,
        label: { en: "Process", ar: "طريقة المعالجة" },
        options: [
          opt("washed", "Washed", "مغسولة"),
          opt("natural", "Natural", "طبيعية"),
          opt("honey", "Honey", "عسلية"),
          opt("anaerobic", "Anaerobic", "لاهوائية"),
          opt("wet_hulled", "Wet hulled", "مقشورة رطبة"),
          opt("other", "Other", "أخرى"),
        ],
      },
      { key: "grade", type: "text", label: { en: "Grade", ar: "الدرجة" }, hint: { en: "e.g. G1, AA, SHB", ar: "مثال: G1، AA، SHB" } },
      { key: "crop_year", type: "text", label: { en: "Crop year", ar: "سنة المحصول" } },
      { key: "lot_number", type: "text", label: { en: "Supplier lot number", ar: "رقم دفعة المورد" } },
      { key: "altitude_m", type: "number", label: { en: "Altitude", ar: "الارتفاع" }, unit: "m", min: 0 },
      { key: "sample_weight_g", type: "number", label: { en: "Sample weight", ar: "وزن العينة" }, unit: "g", min: 0 },
      { key: "available_qty_kg", type: "number", label: { en: "Available quantity", ar: "الكمية المتاحة" }, unit: "kg", min: 0 },
      { key: "indicative_price", type: "number", label: { en: "Indicative price / kg", ar: "السعر المبدئي / كغ" }, min: 0, step: 0.01 },
      { key: "currency", type: "select", label: { en: "Currency", ar: "العملة" }, options: CURRENCIES },
      { key: "received_date", type: "date", required: true, label: { en: "Sample received on", ar: "تاريخ استلام العينة" } },
      { key: "notes", type: "textarea", wide: true, label: { en: "Notes", ar: "ملاحظات" } },
    ],
  },
  {
    key: "roasting",
    step: 2,
    owner: "roasting",
    title: { en: "Roasting evaluation", ar: "تقييم التحميص" },
    short: { en: "Roasting", ar: "التحميص" },
    description: {
      en: "Roast and evaluate the sample (about 2–3 days), then approve or reject it.",
      ar: "حمّص العينة وقيّمها (حوالي ٢–٣ أيام)، ثم اعتمدها أو ارفضها.",
    },
    kind: "decision",
    actionLabel: { en: "Record decision", ar: "تسجيل القرار" },
    slaDays: 3,
    fields: [
      { key: "received_date", type: "date", required: true, label: { en: "Received by Roasting", ar: "تاريخ الاستلام في التحميص" } },
      { key: "roast_date", type: "date", required: true, label: { en: "Roast date", ar: "تاريخ التحميص" } },
      {
        key: "roast_profile",
        type: "select",
        label: { en: "Roast profile", ar: "درجة التحميص" },
        options: [
          opt("light", "Light", "فاتح"),
          opt("medium_light", "Medium-light", "متوسط فاتح"),
          opt("medium", "Medium", "متوسط"),
          opt("medium_dark", "Medium-dark", "متوسط غامق"),
          opt("dark", "Dark", "غامق"),
        ],
      },
      { key: "agtron", type: "number", label: { en: "Agtron", ar: "قراءة أغترون" }, min: 0, max: 150 },
      { key: "moisture_pct", type: "number", label: { en: "Moisture", ar: "الرطوبة" }, unit: "%", min: 0, max: 100, step: 0.1 },
      { key: "water_activity", type: "number", label: { en: "Water activity", ar: "النشاط المائي" }, min: 0, max: 1, step: 0.01 },
      { key: "density", type: "number", label: { en: "Density", ar: "الكثافة" }, unit: "g/L", min: 0 },
      { key: "screen_size", type: "text", label: { en: "Screen size", ar: "حجم الحبة (المنخل)" } },
      { key: "primary_defects", type: "number", label: { en: "Primary defects", ar: "عيوب أساسية" }, min: 0 },
      { key: "secondary_defects", type: "number", label: { en: "Secondary defects", ar: "عيوب ثانوية" }, min: 0 },
      { key: "cupping_score", type: "number", required: true, label: { en: "Cupping score", ar: "درجة التذوق" }, min: 0, max: 100, step: 0.25 },
      { key: "flavor_notes", type: "textarea", wide: true, label: { en: "Flavour notes", ar: "النكهات" } },
      { key: "evaluation_notes", type: "textarea", wide: true, label: { en: "Evaluation notes", ar: "ملاحظات التقييم" } },
    ],
  },
  {
    key: "npd",
    step: 3,
    owner: "npd",
    title: { en: "NPD review", ar: "مراجعة تطوير المنتجات" },
    short: { en: "NPD", ar: "تطوير المنتجات" },
    description: {
      en: "Check the bean fits a product. Cupping is optional. Approve or reject.",
      ar: "تأكد من ملاءمة البن للمنتج. التذوق اختياري. اعتمد أو ارفض.",
    },
    kind: "decision",
    actionLabel: { en: "Record decision", ar: "تسجيل القرار" },
    slaDays: 3,
    fields: [
      { key: "target_product", type: "text", required: true, label: { en: "Target product / blend", ar: "المنتج / الخلطة المستهدفة" } },
      {
        key: "intended_use",
        type: "select",
        label: { en: "Intended use", ar: "الاستخدام المقترح" },
        options: [
          opt("single_origin", "Single origin", "محصول منفرد"),
          opt("blend", "Blend component", "مكوّن في خلطة"),
          opt("espresso", "Espresso", "إسبريسو"),
          opt("filter", "Filter", "قهوة مقطرة"),
          opt("cold_brew", "Cold brew", "قهوة باردة"),
          opt("other", "Other", "أخرى"),
        ],
      },
      {
        key: "product_fit",
        type: "select",
        required: true,
        label: { en: "Product fit", ar: "مدى الملاءمة" },
        options: [
          opt("excellent", "Excellent", "ممتازة"),
          opt("good", "Good", "جيدة"),
          opt("fair", "Fair", "مقبولة"),
          opt("poor", "Poor", "ضعيفة"),
        ],
      },
      {
        key: "cupping_done",
        type: "select",
        label: { en: "NPD cupping done?", ar: "هل أجرى القسم التذوق؟" },
        options: [opt("yes", "Yes", "نعم"), opt("no", "No", "لا")],
      },
      { key: "cupping_date", type: "date", label: { en: "Cupping date", ar: "تاريخ التذوق" } },
      { key: "cupping_score", type: "number", label: { en: "NPD cupping score", ar: "درجة التذوق" }, min: 0, max: 100, step: 0.25 },
      { key: "sensory_notes", type: "textarea", wide: true, label: { en: "Sensory notes", ar: "الملاحظات الحسية" } },
      { key: "comments", type: "textarea", wide: true, label: { en: "Comments", ar: "تعليقات" } },
    ],
  },
  {
    key: "negotiation",
    step: 4,
    owner: "procurement",
    title: { en: "Negotiation & supplier confirmation", ar: "التفاوض وتأكيد المورد" },
    short: { en: "Negotiation", ar: "التفاوض" },
    description: {
      en: "Record the agreed terms and confirm the supplier.",
      ar: "سجّل الشروط المتفق عليها وأكّد المورد.",
    },
    kind: "action",
    actionLabel: { en: "Confirm supplier", ar: "تأكيد المورد" },
    slaDays: 7,
    fields: [
      { key: "final_price", type: "number", required: true, label: { en: "Agreed price / kg", ar: "السعر المتفق عليه / كغ" }, min: 0, step: 0.01 },
      { key: "currency", type: "select", required: true, label: { en: "Currency", ar: "العملة" }, options: CURRENCIES },
      { key: "quantity_kg", type: "number", required: true, label: { en: "Agreed quantity", ar: "الكمية المتفق عليها" }, unit: "kg", min: 0 },
      {
        key: "incoterms",
        type: "select",
        required: true,
        label: { en: "Incoterms", ar: "شروط التسليم" },
        options: ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"].map((v) => opt(v, v, v)),
      },
      { key: "payment_terms", type: "text", label: { en: "Payment terms", ar: "شروط الدفع" } },
      { key: "delivery_from", type: "date", label: { en: "Delivery window from", ar: "التسليم من" } },
      { key: "delivery_to", type: "date", label: { en: "Delivery window to", ar: "التسليم إلى" } },
      { key: "offer_ref", type: "text", label: { en: "Supplier offer / contract ref.", ar: "مرجع العرض / العقد" } },
      { key: "confirmed_date", type: "date", required: true, label: { en: "Supplier confirmed on", ar: "تاريخ تأكيد المورد" } },
      { key: "notes", type: "textarea", wide: true, label: { en: "Negotiation notes", ar: "ملاحظات التفاوض" } },
    ],
  },
  {
    key: "pr_request",
    step: 5,
    owner: "procurement",
    title: { en: "PR request to Warehouse", ar: "طلب إنشاء طلب الشراء" },
    short: { en: "PR request", ar: "طلب PR" },
    description: {
      en: "Ask Warehouse to create the Purchase Requisition (PR) for the stock.",
      ar: "اطلب من المستودع إنشاء طلب الشراء (PR) للكمية المطلوبة.",
    },
    kind: "action",
    actionLabel: { en: "Send request to Warehouse", ar: "إرسال الطلب إلى المستودع" },
    slaDays: 2,
    fields: [
      { key: "request_date", type: "date", required: true, label: { en: "Request date", ar: "تاريخ الطلب" } },
      { key: "requested_qty_kg", type: "number", required: true, label: { en: "Quantity for PR", ar: "الكمية المطلوبة" }, unit: "kg", min: 0 },
      { key: "expected_arrival", type: "date", label: { en: "Expected arrival", ar: "تاريخ الوصول المتوقع" } },
      { key: "delivery_location", type: "text", label: { en: "Delivery warehouse", ar: "مستودع الاستلام" } },
      { key: "notes", type: "textarea", wide: true, label: { en: "Notes for Warehouse", ar: "ملاحظات للمستودع" } },
    ],
  },
  {
    key: "pr",
    step: 6,
    owner: "warehouse",
    title: { en: "Purchase Requisition (PR)", ar: "طلب الشراء (PR)" },
    short: { en: "PR", ar: "طلب الشراء" },
    description: {
      en: "Create the PR in Oracle, then record its number and details here.",
      ar: "أنشئ طلب الشراء في أوراكل، ثم سجّل رقمه وتفاصيله هنا.",
    },
    kind: "action",
    actionLabel: { en: "Send PR to Procurement", ar: "إرسال طلب الشراء إلى المشتريات" },
    slaDays: 3,
    fields: [
      { key: "pr_number", type: "text", required: true, label: { en: "PR number", ar: "رقم طلب الشراء" } },
      { key: "pr_date", type: "date", required: true, label: { en: "PR date", ar: "تاريخ طلب الشراء" } },
      { key: "pr_qty_kg", type: "number", required: true, label: { en: "PR quantity", ar: "كمية طلب الشراء" }, unit: "kg", min: 0 },
      { key: "storage_location", type: "text", label: { en: "Storage location", ar: "موقع التخزين" } },
      { key: "notes", type: "textarea", wide: true, label: { en: "Notes", ar: "ملاحظات" } },
    ],
  },
  {
    key: "po",
    step: 7,
    owner: "procurement",
    title: { en: "Purchase Order (PO)", ar: "أمر الشراء (PO)" },
    short: { en: "PO", ar: "أمر الشراء" },
    description: {
      en: "Create the PO in Oracle, then record it here. This closes the record.",
      ar: "أنشئ أمر الشراء في أوراكل، ثم سجّله هنا. يُغلق هذا السجل بعدها.",
    },
    kind: "action",
    actionLabel: { en: "Record PO & hand over to Oracle", ar: "تسجيل أمر الشراء والتحويل إلى أوراكل" },
    slaDays: 3,
    fields: [
      { key: "po_number", type: "text", required: true, label: { en: "PO number", ar: "رقم أمر الشراء" } },
      { key: "po_date", type: "date", required: true, label: { en: "PO date", ar: "تاريخ أمر الشراء" } },
      { key: "po_value", type: "number", required: true, label: { en: "PO value", ar: "قيمة أمر الشراء" }, min: 0, step: 0.01 },
      { key: "currency", type: "select", required: true, label: { en: "Currency", ar: "العملة" }, options: CURRENCIES },
      { key: "notes", type: "textarea", wide: true, label: { en: "Notes", ar: "ملاحظات" } },
    ],
  },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, StageDef>;

export function isStageKey(v: string): v is StageKey {
  return (STAGE_KEYS as readonly string[]).includes(v);
}

export function nextStage(key: StageKey): StageKey | null {
  const i = STAGE_KEYS.indexOf(key);
  return i >= 0 && i < STAGE_KEYS.length - 1 ? STAGE_KEYS[i + 1] : null;
}

export function canActOn(role: Role, stage: StageKey): boolean {
  return role === "admin" || STAGE_MAP[stage].owner === role;
}

export function canCreateSamples(role: Role): boolean {
  return role === "admin" || role === "procurement";
}

export type StageData = Record<string, string | number | null>;

/** Cleans incoming form data down to the stage's known fields. */
export function sanitizeStageData(stage: StageKey, input: unknown): StageData {
  const out: StageData = {};
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  for (const f of STAGE_MAP[stage].fields) {
    const raw = src[f.key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (f.type === "number") {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (f.type === "select") {
      const v = String(raw);
      if (f.options?.some((o) => o.value === v)) out[f.key] = v;
    } else if (f.type === "date") {
      const v = String(raw).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out[f.key] = v;
    } else {
      out[f.key] = String(raw).slice(0, f.type === "textarea" ? 5000 : 300);
    }
  }
  return out;
}

/** Returns the keys of required fields that are missing or invalid. */
export function validateStageData(stage: StageKey, data: StageData): string[] {
  const errors: string[] = [];
  for (const f of STAGE_MAP[stage].fields) {
    const v = data[f.key];
    if (v === undefined || v === null || v === "") {
      if (f.required) errors.push(f.key);
      continue;
    }
    if (f.type === "number" && typeof v === "number") {
      if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) errors.push(f.key);
    }
  }
  return errors;
}

export const STATUS_LABELS: Record<"active" | "rejected" | "completed", L10n> = {
  active: { en: "In progress", ar: "قيد التنفيذ" },
  rejected: { en: "Rejected", ar: "مرفوضة" },
  completed: { en: "Handed to Oracle", ar: "حُوّلت إلى أوراكل" },
};

// ---- API shapes shared by client and worker ----

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  lang: Lang;
  active: boolean;
  must_change_password: boolean;
  created_at?: string;
}

export interface Supplier {
  id: number;
  name: string;
  country: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  sample_count?: number;
  approved_count?: number;
}

export interface SampleSummary {
  id: number;
  sample_code: string;
  supplier_id: number;
  supplier_name: string;
  stage: StageKey;
  status: "active" | "rejected" | "completed";
  rejected_stage: StageKey | null;
  rejection_reason: string | null;
  origin: string | null;
  variety: string | null;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  parent_sample_id: number | null;
  pr_number?: string | null;
  po_number?: string | null;
}

export interface StageRecord {
  stage: StageKey;
  data: StageData;
  decision: Decision | null;
  updated_at: string;
  updated_by_name: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
}

export interface SampleEvent {
  id: number;
  sample_id: number | null;
  sample_code?: string | null;
  type: string;
  stage: StageKey | null;
  message: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Attachment {
  id: number;
  stage: StageKey;
  filename: string;
  content_type: string | null;
  size: number;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface SampleDetail {
  sample: SampleSummary & { parent_code: string | null; created_by_name: string | null };
  stages: Partial<Record<StageKey, StageRecord>>;
  events: SampleEvent[];
  attachments: Attachment[];
  children: { id: number; sample_code: string; status: string }[];
}

export interface DashboardData {
  byStage: Record<StageKey, number>;
  overdue: (SampleSummary & { days: number })[];
  totals: { active: number; rejected: number; completed: number; total: number };
  roastingApproval: { approved: number; rejected: number };
  npdApproval: { approved: number; rejected: number };
  avgCycleDays: number | null;
  recent: SampleEvent[];
  myQueue: number;
}

export function daysBetween(fromIso: string, to: Date = new Date()): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

export function isOverdue(s: Pick<SampleSummary, "status" | "stage" | "stage_entered_at">, now = new Date()): boolean {
  return s.status === "active" && daysBetween(s.stage_entered_at, now) > STAGE_MAP[s.stage].slaDays;
}
