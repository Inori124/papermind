import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'papermind.db');

let db: Database.Database;

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT DEFAULT '',
      abstract TEXT DEFAULT '',
      filePath TEXT NOT NULL,
      totalParagraphs INTEGER DEFAULT 0,
      readProgress REAL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS paragraphs (
      id TEXT PRIMARY KEY,
      paperId TEXT NOT NULL,
      idx INTEGER NOT NULL,
      content TEXT NOT NULL,
      section TEXT DEFAULT '',
      pageNumber INTEGER DEFAULT 0,
      isRead INTEGER DEFAULT 0,
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      paragraphId TEXT NOT NULL,
      paperId TEXT NOT NULL,
      content TEXT DEFAULT '',
      aiExplanation TEXT DEFAULT '',
      type TEXT DEFAULT 'note',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paragraphId) REFERENCES paragraphs(id) ON DELETE CASCADE,
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      paperId TEXT NOT NULL,
      paperIds TEXT DEFAULT '[]',
      embedding TEXT DEFAULT '[]',
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS concept_relations (
      id TEXT PRIMARY KEY,
      sourceId TEXT NOT NULL,
      targetId TEXT NOT NULL,
      relationType TEXT NOT NULL,
      strength REAL DEFAULT 0.5,
      evidence TEXT DEFAULT '',
      paperId TEXT NOT NULL,
      FOREIGN KEY (sourceId) REFERENCES concepts(id) ON DELETE CASCADE,
      FOREIGN KEY (targetId) REFERENCES concepts(id) ON DELETE CASCADE,
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_paragraphs_paper ON paragraphs(paperId);
    CREATE INDEX IF NOT EXISTS idx_annotations_paper ON annotations(paperId);
    CREATE INDEX IF NOT EXISTS idx_concepts_paper ON concepts(paperId);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON concept_relations(sourceId);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON concept_relations(targetId);

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      paragraphId TEXT NOT NULL,
      paperId TEXT NOT NULL,
      startOffset INTEGER NOT NULL,
      endOffset INTEGER NOT NULL,
      text TEXT NOT NULL,
      color TEXT DEFAULT 'blue',
      note TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paragraphId) REFERENCES paragraphs(id) ON DELETE CASCADE,
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_highlights_paragraph ON highlights(paragraphId);

    CREATE TABLE IF NOT EXISTS chat_memory (
      id TEXT PRIMARY KEY,
      paperId TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_memory_paper ON chat_memory(paperId);
  `);

  // Migration: add PDF coordinate highlight columns + relax paragraphId FK
  for (const sql of [
    "ALTER TABLE highlights ADD COLUMN page INTEGER DEFAULT 0",
    "ALTER TABLE highlights ADD COLUMN rects TEXT DEFAULT '[]'",
  ]) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // Migration: add position and comment columns for react-pdf-highlighter-extended
  for (const sql of [
    "ALTER TABLE highlights ADD COLUMN position TEXT DEFAULT '{}'",
    "ALTER TABLE highlights ADD COLUMN comment TEXT DEFAULT '{}'",
  ]) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // Migration: recreate highlights table without paragraphId FK constraint
  // (PDF-mode highlights don't have a paragraph; paragraphId column kept for backward compat)
  const hasParagraphFk = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='highlights'"
  ).get() as any;
  if (hasParagraphFk && hasParagraphFk.sql.includes('FOREIGN KEY (paragraphId)')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS highlights_new (
        id TEXT PRIMARY KEY,
        paragraphId TEXT NOT NULL DEFAULT '',
        paperId TEXT NOT NULL,
        startOffset INTEGER NOT NULL,
        endOffset INTEGER NOT NULL,
        text TEXT NOT NULL,
        color TEXT DEFAULT 'blue',
        note TEXT DEFAULT '',
        page INTEGER DEFAULT 0,
        rects TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (paperId) REFERENCES papers(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO highlights_new (id, paragraphId, paperId, startOffset, endOffset, text, color, note, createdAt, page, rects)
        SELECT id, paragraphId, paperId, startOffset, endOffset, text, color, note, createdAt, page, rects FROM highlights;
      DROP TABLE highlights;
      ALTER TABLE highlights_new RENAME TO highlights;
      CREATE INDEX IF NOT EXISTS idx_highlights_paragraph ON highlights(paragraphId);
      CREATE INDEX IF NOT EXISTS idx_highlights_paper ON highlights(paperId);
    `);
  }

  // Migration: add journal metadata columns if they don't exist
  const existingCols = (
    db.pragma('table_info(papers)') as { name: string }[]
  ).map((r) => r.name);

  const newColumns: { name: string; def: string }[] = [
    { name: 'year', def: 'INTEGER DEFAULT NULL' },
    { name: 'journal', def: "TEXT DEFAULT ''" },
    { name: 'impactFactor', def: 'REAL DEFAULT NULL' },
    { name: 'jcrQuartile', def: 'TEXT DEFAULT NULL' },
    { name: 'reviewNote', def: "TEXT DEFAULT ''" },
    { name: 'doi', def: "TEXT DEFAULT ''" },
    { name: 'issn', def: "TEXT DEFAULT ''" },
    { name: 'publishYear', def: 'INTEGER DEFAULT 0' },
    { name: 'hIndex', def: 'INTEGER DEFAULT 0' },
    { name: 'citationCount', def: 'INTEGER DEFAULT 0' },
    { name: 'openAccessStatus', def: "TEXT DEFAULT ''" },
  ];

  for (const col of newColumns) {
    if (!existingCols.includes(col.name)) {
      db.exec(`ALTER TABLE papers ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // Migration: writing sessions table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS writing_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        style TEXT DEFAULT 'academic',
        language TEXT DEFAULT 'zh',
        content TEXT DEFAULT '',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch { /* already exists */ }

  // Migration: categories table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch { /* already exists */ }

  // Migration: categoryId on papers
  const paperCols = (db.pragma('table_info(papers)') as { name: string }[]).map(r => r.name);
  if (!paperCols.includes('categoryId')) {
    db.exec(`ALTER TABLE papers ADD COLUMN categoryId TEXT DEFAULT ''`);
  }

  // Seed default categories if empty
  const catCount = (db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }).cnt;
  if (catCount === 0) {
    db.prepare('INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)').run('cat-default', '未分类', '#6b7280', 0);
    db.prepare('INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)').run('cat-reading', '待精读', '#3b82f6', 1);
    db.prepare('INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)').run('cat-important', '重点文献', '#ef4444', 2);
    db.prepare('INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)').run('cat-reference', '参考引用', '#8b5cf6', 3);
    db.prepare('INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)').run('cat-archive', '已归档', '#9ca3af', 4);
  }

  // Migration: folders table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch { /* already exists */ }

  // Migration: folderId on papers
  const paperCols2 = (db.pragma('table_info(papers)') as { name: string }[]).map(r => r.name);
  if (!paperCols2.includes('folderId')) {
    db.exec(`ALTER TABLE papers ADD COLUMN folderId TEXT DEFAULT ''`);
  }

  // Migration: analysis columns on folders
  const folderCols = (db.pragma('table_info(folders)') as { name: string }[]).map(r => r.name);
  if (!folderCols.includes('analysis')) {
    db.exec(`ALTER TABLE folders ADD COLUMN analysis TEXT DEFAULT ''`);
  }
  if (!folderCols.includes('analysisUpdatedAt')) {
    db.exec(`ALTER TABLE folders ADD COLUMN analysisUpdatedAt TEXT DEFAULT ''`);
  }
}

export default getDb;
