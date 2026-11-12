import { Hono } from "hono";
import {
  createSession,
  csrfGuard,
  destroySession,
  hashPassword,
  requireAuth,
  requireRole,
  rowToUser,
  tooManyAttempts,
  verifyPassword,
  type AppEnv,
} from "./auth";
import {
  ROLES,
  STAGE_KEYS,
  STAGE_MAP,
  canActOn,
  canCreateSamples,
  daysBetween,
  isOverdue,
  isStageKey,
  nextStage,
  sanitizeStageData,
  validateStageData,
  type DashboardData,
  type Role,
  type SampleSummary,
  type StageKey,
  type StageRecord,
} from "../shared/workflow";

const app = new Hono<AppEnv>().basePath("/api");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Free R2 includes 10 GB. Stop accepting uploads at 9 GB so we never cross it.
const FILE_STORAGE_CAP = 9 * 1024 ** 3;
// Free D1 allows 500 MB per database.
const DB_SIZE_LIMIT = 500 * 1024 ** 2;

app.use("*", csrfGuard);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

const now = () => new Date().toISOString();
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function logEvent(
  db: D1Database,
  e: { sampleId?: number | null; userId?: number | null; type: string; stage?: string | null; message?: string | null },
) {
  return db
    .prepare("INSERT INTO events (sample_id, user_id, type, stage, message) VALUES (?, ?, ?, ?, ?)")
    .bind(e.sampleId ?? null, e.userId ?? null, e.type, e.stage ?? null, e.message ?? null);
}

// ---------------------------------------------------------------- setup & auth

app.get("/setup", async (c) => {
  const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return c.json({ needed: (r?.n ?? 0) === 0, keyRequired: !!c.env.SETUP_KEY });
});

app.post("/setup", async (c) => {
  const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  if ((r?.n ?? 0) > 0) return c.json({ error: "already_setup" }, 409);
  const body = await c.req.json().catch(() => ({}));
  if (c.env.SETUP_KEY && body.setup_key !== c.env.SETUP_KEY) return c.json({ error: "invalid_setup_key" }, 403);
  const email = str(body.email).toLowerCase();
  const name = str(body.name);
  const password = typeof body.password === "string" ? body.password : "";
  if (!isEmail(email) || !name || password.length < 8) return c.json({ error: "invalid" }, 400);
  const { hash, salt } = await hashPassword(password);
  const res = await c.env.DB.prepare(
    "INSERT INTO users (email, name, role, password_hash, password_salt, lang) VALUES (?, ?, 'admin', ?, ?, ?)",
  )
    .bind(email, name, hash, salt, body.lang === "ar" ? "ar" : "en")
    .run();
  const id = res.meta.last_row_id as number;
  await logEvent(c.env.DB, { userId: id, type: "user_created", message: `${name} (admin, setup)` }).run();
  await createSession(c, id);
  return c.json({ ok: true });
});

app.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return c.json({ error: "invalid_credentials" }, 401);
  if (await tooManyAttempts(c.env.DB, email)) return c.json({ error: "too_many_attempts" }, 429);
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE email = ? AND active = 1").bind(email).first();
  const check = row ? await verifyPassword(password, row.password_hash as string, row.password_salt as string) : null;
  if (!row || !check?.ok) {
    await logEvent(c.env.DB, { type: "login_failed", message: email }).run();
    return c.json({ error: "invalid_credentials" }, 401);
  }
  if (check.upgrade) {
    const { hash, salt } = await hashPassword(password);
    await c.env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(hash, salt, row.id).run();
  }
  await createSession(c, row.id as number);
  return c.json({ user: rowToUser(row) });
});

app.post("/auth/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// Everything below needs a signed-in user.
app.use("/*", async (c, next) => {
  const p = c.req.path;
  if (p === "/api/setup" || p === "/api/auth/login" || p === "/api/auth/logout") return next();
  return requireAuth(c, next);
});

app.get("/auth/me", (c) => c.json({ user: c.get("user") }));

app.patch("/auth/me", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const lang = body.lang === "ar" ? "ar" : body.lang === "en" ? "en" : null;
  if (lang) await c.env.DB.prepare("UPDATE users SET lang = ? WHERE id = ?").bind(lang, user.id).run();
  return c.json({ user: { ...user, lang: lang ?? user.lang } });
});

app.post("/auth/password", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (next.length < 8) return c.json({ error: "weak_password" }, 400);
  const row = await c.env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").bind(user.id).first();
  if (!row || !(await verifyPassword(current, row.password_hash as string, row.password_salt as string)).ok)
    return c.json({ error: "invalid_credentials" }, 400);
  const { hash, salt } = await hashPassword(next);
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?")
    .bind(hash, salt, user.id)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- users (admin)

app.get("/users", requireRole("admin"), async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM users ORDER BY active DESC, name").all();
  return c.json({ users: results.map(rowToUser) });
});

app.post("/users", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = str(body.email).toLowerCase();
  const name = str(body.name);
  const role = body.role as Role;
  const password = typeof body.password === "string" ? body.password : "";
  if (!isEmail(email) || !name || !ROLES.includes(role) || password.length < 8) return c.json({ error: "invalid" }, 400);
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (exists) return c.json({ error: "email_taken" }, 409);
  const { hash, salt } = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (email, name, role, password_hash, password_salt, must_change_password) VALUES (?, ?, ?, ?, ?, 1)",
    ).bind(email, name, role, hash, salt),
    await logEvent(c.env.DB, { userId: c.get("user").id, type: "user_created", message: `${name} (${role})` }),
  ]);
  return c.json({ ok: true });
});

app.patch("/users/:id", requireRole("admin"), async (c) => {
  const id = Number(c.req.param("id"));
  const me = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const target = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  if (!target) return c.json({ error: "not_found" }, 404);

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string" && str(body.name)) {
    sets.push("name = ?");
    vals.push(str(body.name));
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return c.json({ error: "invalid" }, 400);
    if (id === me.id && body.role !== "admin") return c.json({ error: "cannot_demote_self" }, 400);
    sets.push("role = ?");
    vals.push(body.role);
  }
  if (body.active !== undefined) {
    if (id === me.id && !body.active) return c.json({ error: "cannot_disable_self" }, 400);
    sets.push("active = ?");
    vals.push(body.active ? 1 : 0);
  }
  if (typeof body.password === "string") {
    if (body.password.length < 8) return c.json({ error: "weak_password" }, 400);
    const { hash, salt } = await hashPassword(body.password);
    sets.push("password_hash = ?", "password_salt = ?", "must_change_password = 1");
    vals.push(hash, salt);
  }
  if (!sets.length) return c.json({ ok: true });

  const stmts = [c.env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id)];
  if (body.active === false || typeof body.password === "string")
    stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
  stmts.push(await logEvent(c.env.DB, { userId: me.id, type: "user_updated", message: target.name as string }));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- suppliers

app.get("/suppliers", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT sp.*,
       (SELECT COUNT(*) FROM samples s WHERE s.supplier_id = sp.id) AS sample_count,
       (SELECT COUNT(*) FROM samples s WHERE s.supplier_id = sp.id AND s.status = 'completed') AS approved_count
     FROM suppliers sp ORDER BY sp.name COLLATE NOCASE`,
  ).all();
  return c.json({ suppliers: results });
});

function supplierFields(body: Record<string, unknown>) {
  return {
    name: str(body.name, 200),
    country: str(body.country, 100) || null,
    contact_name: str(body.contact_name, 200) || null,
    email: str(body.email, 200) || null,
    phone: str(body.phone, 60) || null,
    notes: str(body.notes, 2000) || null,
  };
}

app.post("/suppliers", requireRole("admin", "procurement"), async (c) => {
  const f = supplierFields(await c.req.json().catch(() => ({})));
  if (!f.name) return c.json({ error: "invalid" }, 400);
  const res = await c.env.DB.prepare(
    "INSERT INTO suppliers (name, country, contact_name, email, phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(f.name, f.country, f.contact_name, f.email, f.phone, f.notes, c.get("user").id)
    .run();
  const supplier = await c.env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(res.meta.last_row_id).first();
  return c.json({ supplier });
});

app.get("/suppliers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const supplier = await c.env.DB.prepare("SELECT * FROM suppliers WHERE id = ?").bind(id).first();
  if (!supplier) return c.json({ error: "not_found" }, 404);
  const { results } = await c.env.DB.prepare(
    `${SAMPLE_SELECT} WHERE s.supplier_id = ? ORDER BY s.created_at DESC`,
  )
    .bind(id)
    .all();
  return c.json({ supplier, samples: results });
});

app.patch("/suppliers/:id", requireRole("admin", "procurement"), async (c) => {
  const id = Number(c.req.param("id"));
  const f = supplierFields(await c.req.json().catch(() => ({})));
  if (!f.name) return c.json({ error: "invalid" }, 400);
  await c.env.DB.prepare(
    "UPDATE suppliers SET name = ?, country = ?, contact_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?",
  )
    .bind(f.name, f.country, f.contact_name, f.email, f.phone, f.notes, id)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- samples

const SAMPLE_SELECT = `
  SELECT s.*, sp.name AS supplier_name,
    json_extract(pr.data, '$.pr_number') AS pr_number,
    json_extract(po.data, '$.po_number') AS po_number
  FROM samples s
  JOIN suppliers sp ON sp.id = s.supplier_id
  LEFT JOIN stage_records pr ON pr.sample_id = s.id AND pr.stage = 'pr'
  LEFT JOIN stage_records po ON po.sample_id = s.id AND po.stage = 'po'`;

function sampleFilter(q: Record<string, string>) {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (q.status && ["active", "rejected", "completed"].includes(q.status)) {
    where.push("s.status = ?");
    vals.push(q.status);
  }
  if (q.stage && isStageKey(q.stage)) {
    where.push("s.stage = ?");
    vals.push(q.stage);
  }
  if (q.supplier) {
    where.push("s.supplier_id = ?");
    vals.push(Number(q.supplier));
  }
  if (q.q) {
    where.push(
      "(s.sample_code LIKE ? OR sp.name LIKE ? OR s.origin LIKE ? OR s.variety LIKE ? OR json_extract(pr.data, '$.pr_number') LIKE ? OR json_extract(po.data, '$.po_number') LIKE ?)",
    );
    const like = `%${str(q.q, 100)}%`;
    vals.push(like, like, like, like, like, like);
  }
  if (q.from) {
    where.push("s.created_at >= ?");
    vals.push(q.from);
  }
  if (q.to) {
    where.push("s.created_at < date(?, '+1 day')");
    vals.push(q.to);
  }
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", vals };
}

app.get("/samples", async (c) => {
  const f = sampleFilter(c.req.query());
  const { results } = await c.env.DB.prepare(`${SAMPLE_SELECT} ${f.sql} ORDER BY s.updated_at DESC LIMIT 1000`)
    .bind(...f.vals)
    .all();
  return c.json({ samples: results });
});

/** Everything the Excel report needs: filtered samples with every stage's data, plus their activity. */
app.get("/export", async (c) => {
  const db = c.env.DB;
  const f = sampleFilter(c.req.query());
  const { results: samples } = await db
    .prepare(`${SAMPLE_SELECT} ${f.sql} ORDER BY s.created_at DESC LIMIT 2000`)
    .bind(...f.vals)
    .all<SampleSummary>();
  if (!samples.length) return c.json({ samples: [], stages: [], events: [] });
  // Pull stage records and events for the matched samples in chunks (D1 bind limit is 100).
  const ids = samples.map((s) => s.id);
  const stages: unknown[] = [];
  const events: unknown[] = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const ph = chunk.map(() => "?").join(",");
    const [r, e] = await db.batch([
      db
        .prepare(
          `SELECT r.sample_id, r.stage, r.data, r.decision, r.completed_at, u.name AS completed_by_name
           FROM stage_records r LEFT JOIN users u ON u.id = r.completed_by WHERE r.sample_id IN (${ph})`,
        )
        .bind(...chunk),
      db
        .prepare(
          `SELECT e.sample_id, e.type, e.stage, e.message, e.created_at, u.name AS user_name, s.sample_code
           FROM events e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN samples s ON s.id = e.sample_id
           WHERE e.sample_id IN (${ph}) AND e.type != 'saved' ORDER BY e.id`,
        )
        .bind(...chunk),
    ]);
    stages.push(...r.results);
    events.push(...e.results);
  }
  return c.json({ samples, stages, events });
});

app.get("/queue", async (c) => {
  const user = c.get("user");
  const stages = STAGE_KEYS.filter((k) => user.role === "admin" || STAGE_MAP[k].owner === user.role);
  if (!stages.length) return c.json({ samples: [] });
  const { results } = await c.env.DB.prepare(
    `${SAMPLE_SELECT} WHERE s.status = 'active' AND s.stage IN (${stages.map(() => "?").join(",")}) ORDER BY s.stage_entered_at ASC`,
  )
    .bind(...stages)
    .all();
  return c.json({ samples: results });
});

app.post("/samples", async (c) => {
  const user = c.get("user");
  if (!canCreateSamples(user.role)) return c.json({ error: "forbidden" }, 403);
  const body = await c.req.json().catch(() => ({}));
  const code = str(body.sample_code, 60);
  const supplierId = Number(body.supplier_id);
  if (!code || !supplierId) return c.json({ error: "invalid" }, 400);
  const supplier = await c.env.DB.prepare("SELECT id FROM suppliers WHERE id = ?").bind(supplierId).first();
  if (!supplier) return c.json({ error: "invalid_supplier" }, 400);
  const dup = await c.env.DB.prepare("SELECT id FROM samples WHERE sample_code = ?").bind(code).first();
  if (dup) return c.json({ error: "duplicate_code" }, 409);

  let parentId: number | null = null;
  let data = sanitizeStageData("registration", body.data);
  if (body.parent_sample_id) {
    const parent = await c.env.DB.prepare("SELECT id, status FROM samples WHERE id = ?").bind(Number(body.parent_sample_id)).first();
    if (!parent || parent.status !== "rejected") return c.json({ error: "invalid_parent" }, 400);
    parentId = parent.id as number;
    if (!body.data) {
      const prev = await c.env.DB.prepare("SELECT data FROM stage_records WHERE sample_id = ? AND stage = 'registration'")
        .bind(parentId)
        .first<{ data: string }>();
      data = sanitizeStageData("registration", prev ? JSON.parse(prev.data) : {});
      delete data.received_date;
    }
  }

  const res = await c.env.DB.prepare(
    "INSERT INTO samples (sample_code, supplier_id, parent_sample_id, origin, variety, created_by) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(code, supplierId, parentId, (data.origin as string) ?? null, (data.variety as string) ?? null, user.id)
    .run();
  const id = res.meta.last_row_id as number;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO stage_records (sample_id, stage, data, updated_by) VALUES (?, 'registration', ?, ?)").bind(
      id,
      JSON.stringify(data),
      user.id,
    ),
    await logEvent(c.env.DB, {
      sampleId: id,
      userId: user.id,
      type: parentId ? "resubmitted" : "created",
      stage: "registration",
      message: parentId ? `parent:${parentId}` : null,
    }),
  ]);
  return c.json({ id });
});

app.get("/samples/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  const sample = await db
    .prepare(
      `SELECT s.*, sp.name AS supplier_name, p.sample_code AS parent_code, u.name AS created_by_name,
         json_extract(pr.data, '$.pr_number') AS pr_number, json_extract(po.data, '$.po_number') AS po_number
       FROM samples s JOIN suppliers sp ON sp.id = s.supplier_id
       LEFT JOIN samples p ON p.id = s.parent_sample_id
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN stage_records pr ON pr.sample_id = s.id AND pr.stage = 'pr'
       LEFT JOIN stage_records po ON po.sample_id = s.id AND po.stage = 'po'
       WHERE s.id = ?`,
    )
    .bind(id)
    .first();
  if (!sample) return c.json({ error: "not_found" }, 404);
  const [records, events, attachments, children] = await db.batch([
    db
      .prepare(
        `SELECT r.*, ub.name AS updated_by_name, cb.name AS completed_by_name FROM stage_records r
         LEFT JOIN users ub ON ub.id = r.updated_by LEFT JOIN users cb ON cb.id = r.completed_by
         WHERE r.sample_id = ?`,
      )
      .bind(id),
    db
      .prepare(
        "SELECT e.*, u.name AS user_name FROM events e LEFT JOIN users u ON u.id = e.user_id WHERE e.sample_id = ? ORDER BY e.id DESC",
      )
      .bind(id),
    db
      .prepare(
        "SELECT a.id, a.stage, a.filename, a.content_type, a.size, a.created_at, u.name AS uploaded_by_name FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by WHERE a.sample_id = ? ORDER BY a.id",
      )
      .bind(id),
    db.prepare("SELECT id, sample_code, status FROM samples WHERE parent_sample_id = ?").bind(id),
  ]);
  const stages: Partial<Record<StageKey, StageRecord>> = {};
  for (const r of records.results as Record<string, unknown>[]) {
    stages[r.stage as StageKey] = {
      stage: r.stage as StageKey,
      data: JSON.parse(r.data as string),
      decision: (r.decision as StageRecord["decision"]) ?? null,
      updated_at: r.updated_at as string,
      updated_by_name: (r.updated_by_name as string) ?? null,
      completed_at: (r.completed_at as string) ?? null,
      completed_by_name: (r.completed_by_name as string) ?? null,
    };
  }
  return c.json({
    sample,
    stages,
    events: events.results,
    attachments: attachments.results,
    children: children.results,
  });
});

async function loadForStage(c: { env: AppEnv["Bindings"] }, id: number) {
  return c.env.DB.prepare("SELECT * FROM samples WHERE id = ?").bind(id).first<SampleSummary>();
}

/** Save a draft of the current stage without moving the sample on. */
app.put("/samples/:id/stages/:stage", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const stage = c.req.param("stage");
  if (!isStageKey(stage)) return c.json({ error: "invalid_stage" }, 400);
  const sample = await loadForStage(c, id);
  if (!sample) return c.json({ error: "not_found" }, 404);
  if (!canActOn(user.role, stage)) return c.json({ error: "forbidden" }, 403);
  if (sample.status !== "active" || sample.stage !== stage) return c.json({ error: "stage_locked" }, 409);
  const body = await c.req.json().catch(() => ({}));
  const data = sanitizeStageData(stage, body.data);
  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO stage_records (sample_id, stage, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (sample_id, stage) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).bind(id, stage, JSON.stringify(data), user.id, now()),
    c.env.DB.prepare("UPDATE samples SET updated_at = ? WHERE id = ?").bind(now(), id),
  ];
  if (stage === "registration")
    stmts.push(
      c.env.DB.prepare("UPDATE samples SET origin = ?, variety = ? WHERE id = ?").bind(
        (data.origin as string) ?? null,
        (data.variety as string) ?? null,
        id,
      ),
    );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

/** Complete the current stage: validates, records the decision and hands over. */
app.post("/samples/:id/stages/:stage/complete", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const stage = c.req.param("stage");
  if (!isStageKey(stage)) return c.json({ error: "invalid_stage" }, 400);
  const def = STAGE_MAP[stage];
  const sample = await loadForStage(c, id);
  if (!sample) return c.json({ error: "not_found" }, 404);
  if (!canActOn(user.role, stage)) return c.json({ error: "forbidden" }, 403);
  if (sample.status !== "active" || sample.stage !== stage) return c.json({ error: "stage_locked" }, 409);

  const body = await c.req.json().catch(() => ({}));
  const data = sanitizeStageData(stage, body.data);
  let decision: "approved" | "rejected" | "done" = "done";
  let reason = "";
  if (def.kind === "decision") {
    if (body.decision !== "approved" && body.decision !== "rejected") return c.json({ error: "decision_required" }, 400);
    decision = body.decision;
    reason = str(body.reason, 2000);
    if (decision === "rejected" && !reason) return c.json({ error: "reason_required" }, 400);
  }
  // A rejection only needs a reason; approvals and hand-overs need the full record.
  const missing = decision === "rejected" ? [] : validateStageData(stage, data);
  if (missing.length) return c.json({ error: "missing_fields", fields: missing }, 400);

  const ts = now();
  const next = decision === "rejected" ? null : nextStage(stage);
  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO stage_records (sample_id, stage, data, decision, updated_by, updated_at, completed_by, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (sample_id, stage) DO UPDATE SET data = excluded.data, decision = excluded.decision,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at,
         completed_by = excluded.completed_by, completed_at = excluded.completed_at`,
    ).bind(id, stage, JSON.stringify(data), decision, user.id, ts, user.id, ts),
  ];
  if (decision === "rejected") {
    stmts.push(
      c.env.DB.prepare(
        "UPDATE samples SET status = 'rejected', rejected_stage = ?, rejection_reason = ?, updated_at = ?, completed_at = ? WHERE id = ?",
      ).bind(stage, reason, ts, ts, id),
    );
  } else if (next) {
    stmts.push(
      c.env.DB.prepare("UPDATE samples SET stage = ?, stage_entered_at = ?, updated_at = ? WHERE id = ?").bind(next, ts, ts, id),
    );
  } else {
    stmts.push(
      c.env.DB.prepare("UPDATE samples SET status = 'completed', updated_at = ?, completed_at = ? WHERE id = ?").bind(ts, ts, id),
    );
  }
  if (stage === "registration")
    stmts.push(
      c.env.DB.prepare("UPDATE samples SET origin = ?, variety = ? WHERE id = ?").bind(
        (data.origin as string) ?? null,
        (data.variety as string) ?? null,
        id,
      ),
    );
  stmts.push(
    await logEvent(c.env.DB, {
      sampleId: id,
      userId: user.id,
      type: decision === "rejected" ? "rejected" : decision === "approved" ? "approved" : next ? "completed" : "closed",
      stage,
      message: reason || null,
    }),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, next, status: decision === "rejected" ? "rejected" : next ? "active" : "completed" });
});

// ---------------------------------------------------------------- attachments

app.post("/samples/:id/attachments", async (c) => {
  const user = c.get("user");
  if (user.role === "viewer") return c.json({ error: "forbidden" }, 403);
  const id = Number(c.req.param("id"));
  const sample = await loadForStage(c, id);
  if (!sample) return c.json({ error: "not_found" }, 404);
  const form = await c.req.formData();
  const file = form.get("file");
  const stage = String(form.get("stage") ?? "");
  if (!isStageKey(stage) || !canActOn(user.role, stage)) return c.json({ error: "forbidden" }, 403);
  if (!(file instanceof File)) return c.json({ error: "invalid" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "file_too_large" }, 413);
  const used = await c.env.DB.prepare("SELECT COALESCE(SUM(size), 0) AS b FROM attachments").first<{ b: number }>();
  if ((used?.b ?? 0) + file.size > FILE_STORAGE_CAP) return c.json({ error: "storage_full" }, 507);
  const safeName = file.name.replace(/[^\w.\- ؀-ۿ]/g, "_").slice(0, 150) || "file";
  const key = `samples/${id}/${stage}/${crypto.randomUUID()}-${safeName}`;
  await c.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO attachments (sample_id, stage, r2_key, filename, content_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, stage, key, safeName, file.type || null, file.size, user.id),
    await logEvent(c.env.DB, { sampleId: id, userId: user.id, type: "file_added", stage, message: safeName }),
  ]);
  return c.json({ ok: true });
});

app.get("/attachments/:id", async (c) => {
  const a = await c.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(Number(c.req.param("id"))).first();
  if (!a) return c.json({ error: "not_found" }, 404);
  const obj = await c.env.FILES.get(a.r2_key as string);
  if (!obj) return c.json({ error: "not_found" }, 404);
  const type = (a.content_type as string) || "application/octet-stream";
  const inline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/.test(type);
  return new Response(obj.body, {
    headers: {
      "content-type": type,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.filename as string)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=300",
    },
  });
});

app.delete("/attachments/:id", async (c) => {
  const user = c.get("user");
  const a = await c.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(Number(c.req.param("id"))).first();
  if (!a) return c.json({ error: "not_found" }, 404);
  if (user.role !== "admin" && a.uploaded_by !== user.id) return c.json({ error: "forbidden" }, 403);
  await c.env.FILES.delete(a.r2_key as string);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM attachments WHERE id = ?").bind(a.id),
    await logEvent(c.env.DB, {
      sampleId: a.sample_id as number,
      userId: user.id,
      type: "file_removed",
      stage: a.stage as string,
      message: a.filename as string,
    }),
  ]);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- dashboard & audit

app.get("/dashboard", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const [active, totals, decisions, cycle, recent] = await db.batch([
    db.prepare(`${SAMPLE_SELECT} WHERE s.status = 'active'`),
    db.prepare("SELECT status, COUNT(*) AS n FROM samples GROUP BY status"),
    db.prepare(
      "SELECT stage, decision, COUNT(*) AS n FROM stage_records WHERE stage IN ('roasting','npd') AND decision IS NOT NULL GROUP BY stage, decision",
    ),
    db.prepare(
      "SELECT AVG(julianday(completed_at) - julianday(created_at)) AS d FROM samples WHERE status = 'completed'",
    ),
    db.prepare(
      `SELECT e.*, u.name AS user_name, s.sample_code FROM events e
       LEFT JOIN users u ON u.id = e.user_id LEFT JOIN samples s ON s.id = e.sample_id
       WHERE e.sample_id IS NOT NULL AND e.type != 'saved' ORDER BY e.id DESC LIMIT 12`,
    ),
  ]);
  const activeRows = active.results as unknown as SampleSummary[];
  const byStage = Object.fromEntries(STAGE_KEYS.map((k) => [k, 0])) as Record<StageKey, number>;
  for (const s of activeRows) byStage[s.stage]++;
  const t = { active: 0, rejected: 0, completed: 0, total: 0 };
  for (const r of totals.results as { status: keyof typeof t; n: number }[]) {
    t[r.status] = r.n;
    t.total += r.n;
  }
  const roastingApproval = { approved: 0, rejected: 0 };
  const npdApproval = { approved: 0, rejected: 0 };
  for (const r of decisions.results as { stage: string; decision: "approved" | "rejected"; n: number }[]) {
    (r.stage === "roasting" ? roastingApproval : npdApproval)[r.decision] = r.n;
  }
  const nowD = new Date();
  const overdue = activeRows
    .filter((s) => isOverdue(s, nowD))
    .map((s) => ({ ...s, days: daysBetween(s.stage_entered_at, nowD) }))
    .sort((a, b) => b.days - a.days);
  const myQueue = activeRows.filter((s) => canActOn(user.role, s.stage) && user.role !== "admin").length;
  const d = (cycle.results[0] as { d: number | null } | undefined)?.d ?? null;
  const out: DashboardData = {
    byStage,
    overdue,
    totals: t,
    roastingApproval,
    npdApproval,
    avgCycleDays: d === null ? null : Math.round(d * 10) / 10,
    recent: recent.results as never,
    myQueue,
  };
  return c.json(out);
});

app.get("/usage", requireRole("admin"), async (c) => {
  const db = c.env.DB;
  const [counts, files] = await db.batch([
    db.prepare(
      `SELECT (SELECT COUNT(*) FROM samples) AS samples, (SELECT COUNT(*) FROM suppliers) AS suppliers,
              (SELECT COUNT(*) FROM users WHERE active = 1) AS users, (SELECT COUNT(*) FROM events) AS events`,
    ),
    db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM attachments"),
  ]);
  return c.json({
    db: { bytes: counts.meta.size_after ?? null, limit: DB_SIZE_LIMIT },
    files: { ...(files.results[0] as { n: number; bytes: number }), limit: 10 * 1024 ** 3, cap: FILE_STORAGE_CAP },
    counts: counts.results[0],
  });
});

app.get("/events", requireRole("admin"), async (c) => {
  const before = Number(c.req.query("before")) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, u.name AS user_name, s.sample_code FROM events e
     LEFT JOIN users u ON u.id = e.user_id LEFT JOIN samples s ON s.id = e.sample_id
     WHERE e.id < ? ORDER BY e.id DESC LIMIT 100`,
  )
    .bind(before)
    .all();
  return c.json({ events: results });
});

app.all("*", (c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: (req: Request, env: AppEnv["Bindings"], ctx: ExecutionContext) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(req, env, ctx);
    return new Response(null, { status: 404 });
  },
  /** Nightly housekeeping keeps the database small. */
  scheduled: async (_event: ScheduledController, env: AppEnv["Bindings"]) => {
    const t = now();
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t),
      env.DB.prepare("DELETE FROM events WHERE type IN ('login_failed', 'saved') AND created_at < ?").bind(monthAgo),
    ]);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
