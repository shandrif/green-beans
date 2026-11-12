-- Users & sessions
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','procurement','roasting','npd','warehouse','viewer')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- SHA-256 of the session token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Suppliers
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Samples: one record per green bean sample, moving through the stages
CREATE TABLE samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_code TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- Procurement's own sample ID
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  stage TEXT NOT NULL DEFAULT 'registration',       -- current stage key
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rejected','completed')),
  rejected_stage TEXT,
  rejection_reason TEXT,
  parent_sample_id INTEGER REFERENCES samples(id),  -- resubmission link
  origin TEXT,
  variety TEXT,
  stage_entered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX idx_samples_stage ON samples(status, stage);
CREATE INDEX idx_samples_supplier ON samples(supplier_id);

-- Data captured by each department for each stage
CREATE TABLE stage_records (
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  decision TEXT,                     -- approved / rejected / done
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_by INTEGER REFERENCES users(id),
  completed_at TEXT,
  PRIMARY KEY (sample_id, stage)
);

-- Audit trail
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER REFERENCES samples(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  stage TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_sample ON events(sample_id);
CREATE INDEX idx_events_created ON events(created_at);

-- Attachments stored in R2
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_attachments_sample ON attachments(sample_id);
