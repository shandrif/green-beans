import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { L10n, Lang } from "../../shared/workflow";

const dict = {
  appName: { en: "Green Beans", ar: "البن الأخضر" },
  appTagline: { en: "Sample to PO tracking", ar: "تتبع العينات حتى أمر الشراء" },
  // nav
  dashboard: { en: "Dashboard", ar: "لوحة المتابعة" },
  myQueue: { en: "My queue", ar: "مهامي" },
  board: { en: "Pipeline", ar: "مسار العمل" },
  samples: { en: "Samples", ar: "العينات" },
  suppliers: { en: "Suppliers", ar: "الموردون" },
  admin: { en: "Admin", ar: "الإدارة" },
  account: { en: "Account", ar: "الحساب" },
  signOut: { en: "Sign out", ar: "تسجيل الخروج" },
  language: { en: "العربية", ar: "English" },
  // auth
  signIn: { en: "Sign in", ar: "تسجيل الدخول" },
  signInTitle: { en: "Sign in to Green Beans", ar: "تسجيل الدخول إلى البن الأخضر" },
  signInSub: { en: "Track every green bean sample from first cup to purchase order.", ar: "تابع كل عينة بن أخضر من أول تذوق حتى أمر الشراء." },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  name: { en: "Full name", ar: "الاسم الكامل" },
  invalidCredentials: { en: "Email or password is incorrect.", ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
  tooManyAttempts: { en: "Too many attempts. Try again in 15 minutes.", ar: "محاولات كثيرة. حاول بعد ١٥ دقيقة." },
  setupTitle: { en: "Create the first admin", ar: "إنشاء حساب المسؤول الأول" },
  setupSub: { en: "This account manages users and departments. You only do this once.", ar: "يدير هذا الحساب المستخدمين والأقسام. تتم هذه الخطوة مرة واحدة فقط." },
  setupKey: { en: "Setup key", ar: "مفتاح الإعداد" },
  setupKeyHint: { en: "Provided with the deployment", ar: "يُسلَّم مع النشر" },
  invalidSetupKey: { en: "Setup key is incorrect.", ar: "مفتاح الإعداد غير صحيح." },
  createAdmin: { en: "Create admin account", ar: "إنشاء حساب المسؤول" },
  passwordHint: { en: "At least 8 characters", ar: "٨ أحرف على الأقل" },
  changePassword: { en: "Change password", ar: "تغيير كلمة المرور" },
  currentPassword: { en: "Current password", ar: "كلمة المرور الحالية" },
  newPassword: { en: "New password", ar: "كلمة المرور الجديدة" },
  mustChangePassword: { en: "Please set your own password before you continue.", ar: "يرجى تعيين كلمة مرور خاصة بك قبل المتابعة." },
  passwordChanged: { en: "Password updated", ar: "تم تحديث كلمة المرور" },
  wrongPassword: { en: "Current password is incorrect.", ar: "كلمة المرور الحالية غير صحيحة." },
  // general
  save: { en: "Save", ar: "حفظ" },
  saveDraft: { en: "Save draft", ar: "حفظ كمسودة" },
  saved: { en: "Saved", ar: "تم الحفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  create: { en: "Create", ar: "إنشاء" },
  edit: { en: "Edit", ar: "تعديل" },
  search: { en: "Search", ar: "بحث" },
  all: { en: "All", ar: "الكل" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  somethingWrong: { en: "Something went wrong. Please try again.", ar: "حدث خطأ. يرجى المحاولة مرة أخرى." },
  retry: { en: "Try again", ar: "إعادة المحاولة" },
  required: { en: "Required", ar: "مطلوب" },
  optional: { en: "Optional", ar: "اختياري" },
  back: { en: "Back", ar: "رجوع" },
  notFound: { en: "Not found", ar: "غير موجود" },
  exportCsv: { en: "Export CSV", ar: "تصدير CSV" },
  days: { en: "days", ar: "أيام" },
  day: { en: "day", ar: "يوم" },
  by: { en: "by", ar: "بواسطة" },
  // samples
  sampleId: { en: "Sample ID", ar: "رقم العينة" },
  sampleIdHint: { en: "Use Procurement's existing sample ID", ar: "استخدم رقم العينة المعتمد لدى المشتريات" },
  supplier: { en: "Supplier", ar: "المورد" },
  stage: { en: "Stage", ar: "المرحلة" },
  status: { en: "Status", ar: "الحالة" },
  origin: { en: "Origin", ar: "المنشأ" },
  variety: { en: "Variety", ar: "الصنف" },
  updated: { en: "Updated", ar: "آخر تحديث" },
  created: { en: "Created", ar: "تاريخ الإنشاء" },
  inStage: { en: "In stage", ar: "في المرحلة منذ" },
  newSample: { en: "New sample", ar: "عينة جديدة" },
  newSampleSub: { en: "Register a sample received from a supplier.", ar: "سجّل عينة مستلمة من مورد." },
  selectSupplier: { en: "Select a supplier", ar: "اختر المورد" },
  addSupplierInline: { en: "Add new supplier", ar: "إضافة مورد جديد" },
  duplicateCode: { en: "This sample ID already exists.", ar: "رقم العينة موجود مسبقًا." },
  sampleCreated: { en: "Sample registered", ar: "تم تسجيل العينة" },
  noSamples: { en: "No samples yet", ar: "لا توجد عينات بعد" },
  noSamplesSub: { en: "Samples registered by Procurement will show here.", ar: "ستظهر هنا العينات التي تسجلها المشتريات." },
  noMatches: { en: "No samples match these filters.", ar: "لا توجد عينات مطابقة لعوامل التصفية." },
  searchSamples: { en: "Search ID, supplier, origin, PR, PO…", ar: "ابحث برقم العينة أو المورد أو المنشأ أو PR أو PO…" },
  overdue: { en: "Overdue", ar: "متأخرة" },
  waitingOn: { en: "Waiting on", ar: "بانتظار" },
  queueEmpty: { en: "You're all caught up", ar: "لا توجد مهام معلقة" },
  queueEmptySub: { en: "Samples that need your department will appear here.", ar: "ستظهر هنا العينات التي تحتاج إلى قسمك." },
  queueSub: { en: "Samples waiting for your department, oldest first.", ar: "العينات التي تنتظر قسمك، الأقدم أولًا." },
  viewOnlyQueue: { en: "Your role is view-only, so you have no queue.", ar: "دورك للمشاهدة فقط، لذا لا توجد مهام لك." },
  // detail
  timeline: { en: "Progress", ar: "المراحل" },
  activity: { en: "Activity", ar: "سجل النشاط" },
  attachments: { en: "Attachments", ar: "المرفقات" },
  addFile: { en: "Attach file", ar: "إرفاق ملف" },
  noFiles: { en: "No files attached.", ar: "لا توجد مرفقات." },
  fileTooLarge: { en: "File is larger than 10 MB.", ar: "حجم الملف أكبر من ١٠ ميغابايت." },
  storageFull: { en: "File storage is nearly full. Ask an admin to remove old files.", ar: "مساحة الملفات شبه ممتلئة. اطلب من المسؤول حذف الملفات القديمة." },
  uploaded: { en: "File attached", ar: "تم إرفاق الملف" },
  removeFile: { en: "Remove", ar: "حذف" },
  approve: { en: "Approve", ar: "اعتماد" },
  reject: { en: "Reject", ar: "رفض" },
  approved: { en: "Approved", ar: "معتمدة" },
  rejected: { en: "Rejected", ar: "مرفوضة" },
  completedStage: { en: "Completed", ar: "مكتملة" },
  current: { en: "Current", ar: "الحالية" },
  upcoming: { en: "Upcoming", ar: "قادمة" },
  rejectionReason: { en: "Reason for rejection", ar: "سبب الرفض" },
  rejectionReasonHint: { en: "Procurement will share this with the supplier.", ar: "ستشارك المشتريات هذا السبب مع المورد." },
  decision: { en: "Decision", ar: "القرار" },
  confirmReject: { en: "Reject sample", ar: "رفض العينة" },
  missingFields: { en: "Fill in the required fields first.", ar: "يرجى تعبئة الحقول المطلوبة أولًا." },
  stageLocked: { en: "This stage was already updated by someone else. Refreshing.", ar: "تم تحديث هذه المرحلة من قبل شخص آخر. جارٍ التحديث." },
  movedTo: { en: "Moved to", ar: "انتقلت إلى" },
  closedOracle: { en: "PO recorded. Handed over to Oracle.", ar: "تم تسجيل أمر الشراء وتحويله إلى أوراكل." },
  sampleRejected: { en: "Sample rejected", ar: "تم رفض العينة" },
  notYourStage: { en: "Only {dept} can fill this stage.", ar: "يمكن لقسم {dept} فقط تعبئة هذه المرحلة." },
  waitingForPrevious: { en: "Opens after the previous stage is complete.", ar: "تُفتح بعد اكتمال المرحلة السابقة." },
  resubmit: { en: "Resubmit new sample", ar: "إعادة تقديم عينة جديدة" },
  resubmitSub: { en: "Register a new sample from the same supplier. Details are copied from this one.", ar: "سجّل عينة جديدة من نفس المورد. تُنسخ البيانات من هذه العينة." },
  newSampleId: { en: "New sample ID", ar: "رقم العينة الجديدة" },
  resubmissionOf: { en: "Resubmission of", ar: "إعادة تقديم للعينة" },
  resubmittedAs: { en: "Resubmitted as", ar: "أُعيد تقديمها برقم" },
  rejectedAt: { en: "Rejected at {stage}", ar: "رُفضت في مرحلة {stage}" },
  handedToOracle: { en: "Handed to Oracle", ar: "حُوّلت إلى أوراكل" },
  oracleNote: { en: "PR and PO are created in Oracle. This app only records their references.", ar: "يتم إنشاء طلب الشراء وأمر الشراء في أوراكل. يسجّل هذا التطبيق المراجع فقط." },
  registeredBy: { en: "Registered by", ar: "سجّلها" },
  lastSaved: { en: "Draft saved", ar: "آخر حفظ للمسودة" },
  // events
  ev_created: { en: "registered the sample", ar: "سجّل العينة" },
  ev_resubmitted: { en: "registered a resubmission", ar: "سجّل إعادة تقديم" },
  ev_saved: { en: "saved a draft of", ar: "حفظ مسودة" },
  ev_completed: { en: "completed", ar: "أكمل" },
  ev_approved: { en: "approved at", ar: "اعتمد في" },
  ev_rejected: { en: "rejected at", ar: "رفض في" },
  ev_closed: { en: "recorded the PO and closed", ar: "سجّل أمر الشراء وأغلق" },
  ev_file_added: { en: "attached a file to", ar: "أرفق ملفًا في" },
  ev_file_removed: { en: "removed a file from", ar: "حذف ملفًا من" },
  ev_user_created: { en: "created user", ar: "أنشأ المستخدم" },
  ev_user_updated: { en: "updated user", ar: "حدّث المستخدم" },
  ev_login_failed: { en: "Failed sign-in for", ar: "محاولة دخول فاشلة لـ" },
  // dashboard
  activeSamples: { en: "In progress", ar: "قيد التنفيذ" },
  completedSamples: { en: "Handed to Oracle", ar: "حُوّلت إلى أوراكل" },
  rejectedSamples: { en: "Rejected", ar: "مرفوضة" },
  avgCycle: { en: "Avg. sample → PO", ar: "متوسط المدة حتى أمر الشراء" },
  roastingApproval: { en: "Roasting approval rate", ar: "نسبة اعتماد التحميص" },
  npdApproval: { en: "NPD approval rate", ar: "نسبة اعتماد تطوير المنتجات" },
  samplesByStage: { en: "Samples by stage", ar: "العينات حسب المرحلة" },
  overdueSamples: { en: "Overdue", ar: "متأخرة" },
  overdueSub: { en: "Longer in their stage than expected", ar: "تجاوزت المدة المتوقعة في مرحلتها" },
  nothingOverdue: { en: "Nothing overdue. Nice.", ar: "لا توجد عينات متأخرة." },
  recentActivity: { en: "Recent activity", ar: "آخر النشاطات" },
  noActivity: { en: "No activity yet.", ar: "لا يوجد نشاط بعد." },
  waitingForYou: { en: "{n} waiting for you", ar: "{n} بانتظارك" },
  greeting: { en: "Hello, {name}", ar: "مرحبًا، {name}" },
  expected: { en: "expected {n}", ar: "المتوقع {n}" },
  ofDecisions: { en: "of {n} decisions", ar: "من {n} قرارات" },
  // suppliers
  newSupplier: { en: "New supplier", ar: "مورد جديد" },
  editSupplier: { en: "Edit supplier", ar: "تعديل المورد" },
  supplierName: { en: "Supplier name", ar: "اسم المورد" },
  country: { en: "Country", ar: "الدولة" },
  contactName: { en: "Contact person", ar: "جهة الاتصال" },
  phone: { en: "Phone", ar: "الهاتف" },
  notes: { en: "Notes", ar: "ملاحظات" },
  sampleCount: { en: "Samples", ar: "العينات" },
  toPo: { en: "Reached PO", ar: "وصلت لأمر شراء" },
  noSuppliers: { en: "No suppliers yet", ar: "لا يوجد موردون بعد" },
  noSuppliersSub: { en: "Add a supplier before registering their samples.", ar: "أضف المورد قبل تسجيل عيناته." },
  supplierSaved: { en: "Supplier saved", ar: "تم حفظ المورد" },
  sampleHistory: { en: "Sample history", ar: "سجل العينات" },
  // admin
  users: { en: "Users", ar: "المستخدمون" },
  auditLog: { en: "Audit log", ar: "سجل التدقيق" },
  newUser: { en: "New user", ar: "مستخدم جديد" },
  editUser: { en: "Edit user", ar: "تعديل المستخدم" },
  role: { en: "Department / role", ar: "القسم / الدور" },
  active: { en: "Active", ar: "نشط" },
  disabled: { en: "Disabled", ar: "معطل" },
  disable: { en: "Disable", ar: "تعطيل" },
  enable: { en: "Enable", ar: "تفعيل" },
  tempPassword: { en: "Temporary password", ar: "كلمة مرور مؤقتة" },
  tempPasswordHint: { en: "They will be asked to change it after signing in.", ar: "سيُطلب منه تغييرها بعد تسجيل الدخول." },
  resetPassword: { en: "Set new temporary password", ar: "تعيين كلمة مرور مؤقتة جديدة" },
  userSaved: { en: "User saved", ar: "تم حفظ المستخدم" },
  emailTaken: { en: "A user with this email already exists.", ar: "يوجد مستخدم بهذا البريد الإلكتروني." },
  usage: { en: "Usage", ar: "الاستخدام" },
  usageSub: { en: "Compared with Cloudflare's free plan. Uploads stop automatically at 9 GB.", ar: "مقارنة بخطة Cloudflare المجانية. يتوقف رفع الملفات تلقائيًا عند ٩ غيغابايت." },
  databaseSize: { en: "Database", ar: "قاعدة البيانات" },
  fileStorage: { en: "File storage", ar: "مساحة الملفات" },
  filesCount: { en: "{n} files", ar: "{n} ملفات" },
  records: { en: "Records", ar: "السجلات" },
  activeUsers: { en: "Active users", ar: "المستخدمون النشطون" },
  loadMore: { en: "Load more", ar: "تحميل المزيد" },
  you: { en: "you", ar: "أنت" },
  rolesExplained: { en: "Each department can only fill its own stages. Admins can act on any stage. Viewers can only read.", ar: "يمكن لكل قسم تعبئة مراحله فقط. يمكن للمسؤول العمل على أي مرحلة. المشاهد للاطلاع فقط." },
  profile: { en: "Profile", ar: "الملف الشخصي" },
} satisfies Record<string, L10n>;

export type DictKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  l: (v: L10n | undefined | null) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function initialLang(): Lang {
  try {
    const s = localStorage.getItem("gb_lang");
    if (s === "ar" || s === "en") return s;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.startsWith("ar") ? "ar" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem("gb_lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang, dir]);

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => {
      let s: string = dict[key]?.[lang] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
  const l = useCallback((v: L10n | undefined | null) => (v ? v[lang] : ""), [lang]);

  const value = useMemo(() => ({ lang, dir, setLang: setLangState, t, l }) as I18nCtx, [lang, dir, t, l]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
