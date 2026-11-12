// Branded Excel report: Dashboard + Samples (every stage's fields) + Activity.
// exceljs is loaded on demand so it never weighs down normal page loads.
import type ExcelJSType from "exceljs";
import {
  ROLE_LABELS,
  STAGES,
  STAGE_MAP,
  STATUS_LABELS,
  daysBetween,
  isOverdue,
  type L10n,
  type Lang,
  type SampleSummary,
  type StageData,
  type StageKey,
} from "../../shared/workflow";

export interface ExportPayload {
  samples: SampleSummary[];
  stages: { sample_id: number; stage: StageKey; data: string; decision: string | null; completed_at: string | null; completed_by_name: string | null }[];
  events: { sample_id: number; type: string; stage: StageKey | null; message: string | null; created_at: string; user_name: string | null; sample_code: string }[];
}

type T = (key: string, vars?: Record<string, string | number>) => string;

// HM brand palette (ARGB)
const C = {
  ink: "FF1D1B17",
  ink2: "FF4A453D",
  sand: "FFF5EDE3",
  sand2: "FFEFE4D6",
  paper: "FFFFFCF8",
  line: "FFE4D8C8",
  muted: "FF7A7266",
  tan: "FFD4B38B",
  tanSoft: "FFEFE0CC",
  tanText: "FF7A5A32",
  teal: "FF84C6B2",
  tealSoft: "FFDCEFE8",
  deep: "FF2B8A74",
  danger: "FFC2564A",
  dangerSoft: "FFF6E1DD",
  white: "FFFFFFFF",
};
const FONT = "Arial";
const DEPT_FILL: Record<string, [string, string]> = {
  procurement: [C.tanSoft, C.tanText],
  roasting: [C.ink, C.sand],
  npd: [C.tealSoft, C.deep],
  warehouse: [C.sand2, C.ink2],
};

const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const font = (o: Partial<{ size: number; bold: boolean; color: string; italic: boolean }> = {}) => ({
  name: FONT,
  size: o.size ?? 10,
  bold: o.bold ?? false,
  italic: o.italic ?? false,
  color: { argb: o.color ?? C.ink },
});
const thin = (argb = C.line) => ({ style: "thin" as const, color: { argb } });

async function logoPng(): Promise<string | null> {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256"><rect width="64" height="64" rx="16" fill="#F5EDE3"/><text x="32" y="42" text-anchor="middle" font-family="Inter Variable, Helvetica, Arial, sans-serif" font-weight="800" font-size="26" fill="#1D1B17">½M</text><circle cx="49" cy="15" r="5" fill="#2B8A74"/></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

const toDate = (v: string | null | undefined) => {
  if (!v) return null;
  const d = v.length === 10 ? new Date(v + "T00:00:00Z") : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export async function buildReport(opts: { data: ExportPayload; lang: Lang; t: T; l: (v: L10n | null | undefined) => string; user: string; scope: string }) {
  const { data, lang, t, l, user, scope } = opts;
  const ExcelJS: typeof ExcelJSType = (await import("exceljs")).default;
  const rtl = lang === "ar";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Green Beans · Half Million";
  wb.created = new Date();

  // Index stage records by sample
  const recs = new Map<number, Partial<Record<StageKey, { data: StageData; decision: string | null; completed_at: string | null; by: string | null }>>>();
  for (const r of data.stages) {
    const m = recs.get(r.sample_id) ?? {};
    m[r.stage] = { data: JSON.parse(r.data || "{}"), decision: r.decision, completed_at: r.completed_at, by: r.completed_by_name };
    recs.set(r.sample_id, m);
  }

  const now = new Date();
  const samples = data.samples;
  const active = samples.filter((s) => s.status === "active");
  const completed = samples.filter((s) => s.status === "completed");
  const rejected = samples.filter((s) => s.status === "rejected");
  const cycle = completed.length
    ? completed.reduce((a, s) => a + daysBetween(s.created_at, new Date(s.completed_at!)), 0) / completed.length
    : null;
  const decisions = (stage: StageKey) => {
    let a = 0, r = 0;
    for (const m of recs.values()) {
      const d = m[stage]?.decision;
      if (d === "approved") a++;
      else if (d === "rejected") r++;
    }
    return { a, r };
  };
  const logo = await logoPng();
  const logoId = logo ? wb.addImage({ base64: logo, extension: "png" }) : null;
  const generated = now.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "long", timeStyle: "short" });

  // ================================================================ Dashboard
  const ws = wb.addWorksheet(t("dashboard"), {
    views: [{ rightToLeft: rtl, showGridLines: false }],
    properties: { tabColor: { argb: C.tan } },
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 2.5 }, ...Array.from({ length: 12 }, () => ({ width: 11.5 })), { width: 2.5 }];
  const COLS = 13; // B..M = 2..13
  const band = (row: number, fill: string, height?: number) => {
    for (let c = 1; c <= COLS + 1; c++) ws.getCell(row, c).fill = solid(fill);
    if (height) ws.getRow(row).height = height;
  };
  const merge = (r1: number, c1: number, r2: number, c2: number) => ws.mergeCells(r1, c1, r2, c2);

  // Header band
  band(1, C.ink, 14);
  band(2, C.ink, 34);
  band(3, C.ink, 20);
  band(4, C.ink, 14);
  band(5, C.tan, 5);
  if (logoId !== null) ws.addImage(logoId, { tl: { col: 1.15, row: 1.05 }, ext: { width: 52, height: 52 } });
  merge(2, 3, 2, COLS);
  merge(3, 3, 3, COLS);
  Object.assign(ws.getCell(2, 3), { value: t("reportTitle"), font: font({ size: 20, bold: true, color: C.sand }), alignment: { vertical: "middle", indent: 1 } });
  Object.assign(ws.getCell(3, 3), {
    value: `${t("generatedOn")} ${generated}  ·  ${t("preparedBy")} ${user}`,
    font: font({ size: 10, color: "FFC9BFB2" }),
    alignment: { vertical: "middle", indent: 1 },
  });
  ws.getRow(6).height = 10;
  merge(7, 2, 7, COLS);
  Object.assign(ws.getCell(7, 2), { value: `${t("scope")}: ${scope}  ·  ${samples.length} ${t("samples").toLowerCase()}`, font: font({ size: 10, color: C.muted }) });
  ws.getRow(8).height = 8;

  // KPI tiles
  const kpis: [string, string | number, string, string, string][] = [
    [t("activeSamples"), active.length, C.tanSoft, C.tanText, t("kpiActiveSub")],
    [t("completedSamples"), completed.length, C.tealSoft, C.deep, t("kpiDoneSub")],
    [t("rejectedSamples"), rejected.length, C.dangerSoft, C.danger, t("kpiRejectedSub")],
    [t("avgCycle"), cycle === null ? "—" : `${cycle < 1 ? "< 1" : cycle.toFixed(1)} ${t("days")}`, C.sand2, C.ink, t("kpiCycleSub")],
  ];
  ws.getRow(9).height = 24;
  ws.getRow(10).height = 40;
  ws.getRow(11).height = 20;
  kpis.forEach(([label, value, fill, color, sub], i) => {
    const c1 = 2 + i * 3, c2 = c1 + 2;
    for (const r of [9, 10, 11]) {
      merge(r, c1, r, c2 - (i < 3 ? 0 : 0));
      for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = solid(fill);
    }
    Object.assign(ws.getCell(9, c1), { value: label, font: font({ size: 9, bold: true, color }), alignment: { vertical: "bottom", indent: 1 } });
    Object.assign(ws.getCell(10, c1), { value, font: font({ size: 24, bold: true, color: C.ink }), alignment: { vertical: "middle", horizontal: rtl ? "right" : "left", indent: 1 } });
    Object.assign(ws.getCell(11, c1), { value: sub, font: font({ size: 8, color: C.muted }), alignment: { vertical: "top", indent: 1 } });
    // white gutter between tiles
    if (i < 3) for (const r of [9, 10, 11]) ws.getCell(r, c2).border = { [rtl ? "left" : "right"]: { style: "thick", color: { argb: C.white } } };
  });

  let row = 13;
  const section = (title: string, sub?: string) => {
    ws.getRow(row).height = 24;
    merge(row, 2, row, COLS);
    Object.assign(ws.getCell(row, 2), {
      value: sub ? { richText: [{ text: title + "   ", font: font({ size: 13, bold: true }) }, { text: sub, font: font({ size: 9, color: C.muted }) }] } : title,
      font: font({ size: 13, bold: true }),
      alignment: { vertical: "bottom" },
      border: { bottom: { style: "medium", color: { argb: C.tan } } },
    });
    for (let c = 2; c <= COLS; c++) ws.getCell(row, c).border = { bottom: { style: "medium", color: { argb: C.tan } } };
    row += 1;
    ws.getRow(row).height = 6;
    row += 1;
  };
  // Table helper: spans = column spans per field (sum must be 12)
  const tableRow = (cells: (string | number | null)[], spans: number[], style: "head" | "body" | "foot", zebra = false, opts: { colors?: (string | null)[]; fills?: (string | null)[]; align?: ("left" | "right" | "center")[]; bold?: boolean[] } = {}) => {
    let c = 2;
    ws.getRow(row).height = style === "head" ? 22 : 21;
    cells.forEach((v, i) => {
      const span = spans[i];
      if (span > 1) merge(row, c, row, c + span - 1);
      const cell = ws.getCell(row, c);
      cell.value = v as never;
      const fill = opts.fills?.[i] ?? (style === "head" ? C.sand2 : zebra ? "FFFBF6EF" : C.paper);
      for (let k = c; k < c + span; k++) {
        ws.getCell(row, k).fill = solid(fill);
        ws.getCell(row, k).border = { bottom: thin() };
      }
      cell.font = font({ size: style === "head" ? 9 : 10, bold: style === "head" || !!opts.bold?.[i], color: opts.colors?.[i] ?? (style === "head" ? C.ink2 : C.ink) });
      const h = opts.align?.[i] ?? "left";
      cell.alignment = { vertical: "middle", horizontal: rtl && h === "left" ? "right" : rtl && h === "right" ? "left" : h, indent: h === "center" ? 0 : 1 };
      c += span;
    });
    row += 1;
  };
  const bar = (n: number, max: number, width = 24) => (n > 0 ? "█".repeat(Math.max(1, Math.round((n / Math.max(max, 1)) * width))) : "");

  // Pipeline
  section(t("samplesByStage"), t("activeSamples"));
  const maxStage = Math.max(1, ...STAGES.map((s) => active.filter((x) => x.stage === s.key).length));
  tableRow(["#", t("stage"), t("waitingOn"), t("activeSamples"), "", t("overdue")], [1, 3, 2, 1, 4, 1], "head", false, { align: ["center", "left", "left", "center", "left", "center"] });
  STAGES.forEach((s, i) => {
    const n = active.filter((x) => x.stage === s.key).length;
    const od = active.filter((x) => x.stage === s.key && isOverdue(x, now)).length;
    const [df, dc] = DEPT_FILL[s.owner];
    tableRow([s.step, l(s.title), l(ROLE_LABELS[s.owner]), n, bar(n, maxStage), od || "—"], [1, 3, 2, 1, 4, 1], "body", i % 2 === 1, {
      align: ["center", "left", "left", "center", "left", "center"],
      colors: [C.muted, null, dc, null, C.tan, od ? C.danger : C.muted],
      fills: [null, null, df, null, null, null],
      bold: [false, true, true, true, false, !!od],
    });
  });
  row += 1;

  // Decisions
  section(t("decisions"));
  tableRow([t("stage"), t("approved"), t("rejected"), t("approvalRate"), ""], [3, 2, 2, 2, 3], "head", false, { align: ["left", "center", "center", "center", "left"] });
  (["roasting", "npd"] as StageKey[]).forEach((k, i) => {
    const { a, r } = decisions(k);
    const tot = a + r;
    const rate = tot ? a / tot : null;
    tableRow([l(STAGE_MAP[k].title), a, r, rate === null ? "—" : `${Math.round(rate * 100)}%`, rate === null ? "" : bar(a, tot, 18)], [3, 2, 2, 2, 3], "body", i % 2 === 1, {
      align: ["left", "center", "center", "center", "left"],
      colors: [null, C.deep, C.danger, null, C.deep],
      bold: [true, true, true, true, false],
    });
  });
  row += 1;

  // Overdue
  const overdue = active.filter((s) => isOverdue(s, now)).sort((a, b) => daysBetween(b.stage_entered_at, now) - daysBetween(a.stage_entered_at, now));
  section(t("overdueSamples"), t("overdueSub"));
  if (!overdue.length) {
    merge(row, 2, row, COLS);
    Object.assign(ws.getCell(row, 2), { value: t("nothingOverdue"), font: font({ color: C.deep, bold: true }), fill: solid(C.tealSoft), alignment: { vertical: "middle", indent: 1 } });
    ws.getRow(row).height = 24;
    row += 2;
  } else {
    tableRow([t("sampleId"), t("supplier"), t("stage"), t("waitingOn"), t("inStage"), t("expectedDays")], [2, 3, 2, 2, 2, 1], "head", false, { align: ["left", "left", "left", "left", "center", "center"] });
    overdue.forEach((s, i) => {
      const def = STAGE_MAP[s.stage];
      tableRow([s.sample_code, s.supplier_name, l(def.short), l(ROLE_LABELS[def.owner]), `${Math.floor(daysBetween(s.stage_entered_at, now))} ${t("days")}`, def.slaDays], [2, 3, 2, 2, 2, 1], "body", i % 2 === 1, {
        align: ["left", "left", "left", "left", "center", "center"],
        colors: [null, null, null, null, C.danger, C.muted],
        bold: [true, false, false, false, true, false],
      });
    });
    row += 1;
  }

  // Suppliers
  section(t("suppliers"));
  const bySup = new Map<string, { n: number; a: number; d: number; r: number }>();
  for (const s of samples) {
    const v = bySup.get(s.supplier_name) ?? { n: 0, a: 0, d: 0, r: 0 };
    v.n++;
    if (s.status === "active") v.a++;
    if (s.status === "completed") v.d++;
    if (s.status === "rejected") v.r++;
    bySup.set(s.supplier_name, v);
  }
  tableRow([t("supplier"), t("sampleCount"), t("activeSamples"), t("completedSamples"), t("rejectedSamples"), t("toPo")], [4, 1, 2, 2, 2, 1], "head", false, { align: ["left", "center", "center", "center", "center", "center"] });
  [...bySup.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .forEach(([name, v], i) => {
      const decided = v.d + v.r;
      tableRow([name, v.n, v.a, v.d, v.r, decided ? `${Math.round((v.d / decided) * 100)}%` : "—"], [4, 1, 2, 2, 2, 1], "body", i % 2 === 1, {
        align: ["left", "center", "center", "center", "center", "center"],
        colors: [null, null, C.tanText, C.deep, v.r ? C.danger : C.muted, null],
        bold: [true, true, false, false, false, true],
      });
    });
  row += 1;
  merge(row, 2, row, COLS);
  Object.assign(ws.getCell(row, 2), { value: t("oracleNote"), font: font({ size: 9, italic: true, color: C.muted }) });

  // ================================================================ Samples (full record)
  const ss = wb.addWorksheet(t("samples"), {
    views: [{ rightToLeft: rtl, showGridLines: false, state: "frozen", xSplit: 2, ySplit: 3 }],
    properties: { tabColor: { argb: C.deep } },
    // Wide sheet: print across pages with headers and Sample ID repeated on each.
    pageSetup: { orientation: "landscape", paperSize: 9, scale: 70, printTitlesRow: "1:3", printTitlesColumn: "A:B", margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  type Col = { header: string; width: number; get: (s: SampleSummary) => unknown; fmt?: string; group: string; groupFill: [string, string]; status?: boolean };
  const cols: Col[] = [];
  const general: [string, string] = [C.ink, C.sand];
  cols.push({ header: t("sampleId"), width: 16, get: (s) => s.sample_code, group: t("sampleRecord"), groupFill: general });
  cols.push({ header: t("supplier"), width: 24, get: (s) => s.supplier_name, group: t("sampleRecord"), groupFill: general });
  cols.push({ header: t("status"), width: 24, get: (s) => l(STATUS_LABELS[s.status]), group: t("sampleRecord"), groupFill: general, status: true });
  cols.push({ header: t("stage"), width: 18, get: (s) => (s.status === "completed" ? "—" : l(STAGE_MAP[s.status === "rejected" && s.rejected_stage ? s.rejected_stage : s.stage].short)), group: t("sampleRecord"), groupFill: general });
  cols.push({ header: t("created"), width: 13, get: (s) => toDate(s.created_at), fmt: "dd mmm yyyy", group: t("sampleRecord"), groupFill: general });
  cols.push({ header: t("handedToOracle"), width: 14, get: (s) => (s.status === "completed" ? toDate(s.completed_at) : null), fmt: "dd mmm yyyy", group: t("sampleRecord"), groupFill: general });
  cols.push({ header: t("rejectionReason"), width: 34, get: (s) => s.rejection_reason, group: t("sampleRecord"), groupFill: general });
  for (const st of STAGES) {
    const g = `${st.step}. ${l(st.title)}`;
    const gf = DEPT_FILL[st.owner];
    for (const f of st.fields) {
      cols.push({
        header: l(f.label) + (f.unit ? ` (${f.unit})` : ""),
        width: f.type === "textarea" ? 36 : f.type === "number" ? 12 : f.type === "date" ? 13 : f.type === "select" ? 15 : 18,
        fmt: f.type === "date" ? "dd mmm yyyy" : f.type === "number" ? (f.step && f.step < 1 ? "#,##0.00" : "#,##0.##") : undefined,
        group: g,
        groupFill: gf,
        get: (s) => {
          const v = recs.get(s.id)?.[st.key]?.data?.[f.key];
          if (v === undefined || v === null || v === "") return null;
          if (f.type === "select") return l(f.options?.find((o) => o.value === v)?.label) || String(v);
          if (f.type === "date") return toDate(String(v));
          return v;
        },
      });
    }
    if (st.kind === "decision")
      cols.push({ header: t("decision"), width: 13, group: g, groupFill: gf, get: (s) => { const d = recs.get(s.id)?.[st.key]?.decision; return d === "approved" ? t("approved") : d === "rejected" ? t("rejected") : null; } });
    cols.push({ header: t("completedBy"), width: 18, group: g, groupFill: gf, get: (s) => recs.get(s.id)?.[st.key]?.by ?? null });
    cols.push({ header: t("completedOn"), width: 13, fmt: "dd mmm yyyy", group: g, groupFill: gf, get: (s) => toDate(recs.get(s.id)?.[st.key]?.completed_at) });
  }
  ss.columns = cols.map((c) => ({ width: c.width }));
  // Row 1: title strip
  ss.getRow(1).height = 26;
  ss.mergeCells(1, 1, 1, Math.min(cols.length, 10));
  Object.assign(ss.getCell(1, 1), { value: `${t("reportTitle")}  ·  ${generated}`, font: font({ size: 12, bold: true, color: C.sand }), alignment: { vertical: "middle", indent: 1 } });
  for (let c = 1; c <= cols.length; c++) ss.getCell(1, c).fill = solid(C.ink);
  // Row 2: stage groups
  ss.getRow(2).height = 22;
  let start = 0;
  while (start < cols.length) {
    let end = start;
    while (end + 1 < cols.length && cols[end + 1].group === cols[start].group) end++;
    if (end > start) ss.mergeCells(2, start + 1, 2, end + 1);
    const [bg, fg] = cols[start].groupFill;
    const cell = ss.getCell(2, start + 1);
    cell.value = cols[start].group;
    cell.font = font({ size: 10, bold: true, color: fg });
    cell.alignment = { vertical: "middle", horizontal: "center" };
    for (let c = start + 1; c <= end + 1; c++) {
      ss.getCell(2, c).fill = solid(bg);
      ss.getCell(2, c).border = { [rtl ? "right" : "left"]: c === start + 1 ? { style: "medium", color: { argb: C.white } } : undefined } as never;
    }
    start = end + 1;
  }
  // Row 3: field headers
  ss.getRow(3).height = 34;
  cols.forEach((c, i) => {
    const cell = ss.getCell(3, i + 1);
    cell.value = c.header;
    cell.font = font({ size: 9, bold: true, color: C.ink2 });
    cell.fill = solid(C.sand2);
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
    cell.border = { bottom: { style: "medium", color: { argb: C.tan } } };
  });
  samples.forEach((s, i) => {
    const r = ss.getRow(4 + i);
    r.height = 20;
    cols.forEach((c, j) => {
      const cell = r.getCell(j + 1);
      cell.value = c.get(s) as never;
      cell.font = font({ size: 10, bold: j === 0 });
      cell.fill = solid(i % 2 ? "FFFBF6EF" : C.paper);
      cell.border = { bottom: thin() };
      cell.alignment = { vertical: "top", wrapText: c.width >= 30, indent: 1 };
      if (c.fmt) cell.numFmt = c.fmt;
      if (c.status) {
        const [bg, fg] = s.status === "completed" ? [C.tealSoft, C.deep] : s.status === "rejected" ? [C.dangerSoft, C.danger] : isOverdue(s, now) ? [C.dangerSoft, C.danger] : [C.tanSoft, C.tanText];
        cell.fill = solid(bg);
        cell.font = font({ size: 10, bold: true, color: fg });
        if (s.status === "active" && isOverdue(s, now)) cell.value = `${l(STATUS_LABELS.active)} · ${t("overdue")}`;
      }
    });
  });
  ss.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + samples.length, column: cols.length } };

  // ================================================================ Activity
  const as = wb.addWorksheet(t("activity"), {
    views: [{ rightToLeft: rtl, showGridLines: false, state: "frozen", ySplit: 2 }],
    properties: { tabColor: { argb: C.teal } },
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  as.columns = [{ width: 20 }, { width: 16 }, { width: 22 }, { width: 22 }, { width: 26 }, { width: 50 }];
  as.getRow(1).height = 26;
  as.mergeCells(1, 1, 1, 6);
  Object.assign(as.getCell(1, 1), { value: t("activity"), font: font({ size: 12, bold: true, color: C.sand }), alignment: { vertical: "middle", indent: 1 } });
  for (let c = 1; c <= 6; c++) as.getCell(1, c).fill = solid(C.ink);
  [t("when"), t("sampleId"), t("stage"), t("who"), t("action"), t("notes")].forEach((h, i) => {
    const cell = as.getCell(2, i + 1);
    cell.value = h;
    cell.font = font({ size: 9, bold: true, color: C.ink2 });
    cell.fill = solid(C.sand2);
    cell.alignment = { vertical: "middle", indent: 1 };
    cell.border = { bottom: { style: "medium", color: { argb: C.tan } } };
  });
  as.getRow(2).height = 22;
  const evs = [...data.events].sort((a, b) => b.created_at.localeCompare(a.created_at));
  evs.forEach((e, i) => {
    const r = as.getRow(3 + i);
    r.height = 19;
    const verb = t(`ev_${e.type}`);
    const vals = [toDate(e.created_at), e.sample_code, e.stage ? l(STAGE_MAP[e.stage]?.short) : "", e.user_name ?? "", verb, e.message ?? ""];
    vals.forEach((v, j) => {
      const cell = r.getCell(j + 1);
      cell.value = v as never;
      cell.font = font({ size: 10, bold: j === 1, color: j === 4 && e.type === "rejected" ? C.danger : j === 4 && (e.type === "approved" || e.type === "closed") ? C.deep : C.ink });
      cell.fill = solid(i % 2 ? "FFFBF6EF" : C.paper);
      cell.border = { bottom: thin() };
      cell.alignment = { vertical: "top", wrapText: j === 5, indent: 1 };
      if (j === 0) cell.numFmt = "dd mmm yyyy hh:mm";
    });
  });
  if (evs.length) as.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + evs.length, column: 6 } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `GreenBeans-Report-${now.toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
