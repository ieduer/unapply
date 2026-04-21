-- UnApply D1 schema v2（v1.1 啟用時執行）
-- wrangler d1 execute unapply --file=./db/schema.sql

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_simplified TEXT,
  name_en TEXT,
  aliases TEXT,                             -- JSON array
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  city_tier TEXT,                           -- 'tier1' | 'newtier1' | 'tier2' | 'tier3_below'
  level TEXT,                               -- 'C9' | '985非C9' | '211非985' | '雙一流非211' | '普通本科' | '專科'
  type TEXT,                                -- '綜合' | '理工' | '師範' ...
  rank_ruanke INTEGER,
  rank_year INTEGER DEFAULT 2021,
  website TEXT,
  logo_url TEXT,
  campuses TEXT,                            -- JSON array
  main_campus_type TEXT,                    -- 'main_city' | 'suburb_with_metro' | 'suburb' | 'separate_freshman'
  tuition_range TEXT,
  sources TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schools_province ON schools(province);
CREATE INDEX IF NOT EXISTS idx_schools_level ON schools(level);
CREATE INDEX IF NOT EXISTS idx_schools_tier ON schools(city_tier);

-- 生活質量（長表結構便於眾包 upsert）
CREATE TABLE IF NOT EXISTS quality (
  school_id TEXT NOT NULL,
  dim TEXT NOT NULL,                        -- B1...B24, C1...C5
  value TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,              -- 0-1，三人一致升到 0.9+
  source TEXT,                              -- 'CollegesChat-2022-09' / 'user:<hash>'
  raw_quote TEXT,
  sample_count INTEGER DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (school_id, dim),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

CREATE INDEX IF NOT EXISTS idx_quality_dim ON quality(dim);

CREATE TABLE IF NOT EXISTS discipline_grades (
  school_id TEXT NOT NULL,
  discipline_code TEXT NOT NULL,            -- 'CS' 'EE' 'Math' ...
  grade TEXT NOT NULL,                      -- 'A+' 'A' 'A-' 'B+' 'B' 'B-' 'C+' 'C' 'C-'
  year INTEGER DEFAULT 2017,
  PRIMARY KEY (school_id, discipline_code)
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  dim TEXT NOT NULL,
  value TEXT NOT NULL,
  raw_comment TEXT,
  submitter_hash TEXT,
  status TEXT DEFAULT 'pending',            -- pending | approved | rejected
  reject_reason TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewer TEXT
);

CREATE INDEX IF NOT EXISTS idx_contrib_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contrib_school ON contributions(school_id);

CREATE TABLE IF NOT EXISTS filter_sessions (
  id TEXT PRIMARY KEY,                      -- 8 位短 id，分享用
  answers_json TEXT NOT NULL,
  kept_count INTEGER NOT NULL,
  excluded_count INTEGER NOT NULL,
  share_image_key TEXT,                     -- R2 key
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON filter_sessions(expires_at);

CREATE TABLE IF NOT EXISTS takedown_requests (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  dim TEXT,
  reason TEXT NOT NULL,
  contact TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  sessions_count INTEGER DEFAULT 0,
  avg_excluded INTEGER DEFAULT 0,
  top_excluded_schools TEXT                 -- JSON: [[school_id, count], ...]
);
