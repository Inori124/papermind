import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const folders = db.prepare('SELECT * FROM folders ORDER BY sortOrder ASC').all() as any[];
  const result = folders.map((f: any) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM papers WHERE folderId = ?').get(f.id) as any;
    return { ...f, paperCount: count.c };
  });
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) return Response.json({ error: '名称不能为空' }, { status: 400 });
  const db = getDb();
  const id = uuidv4();
  const max = db.prepare('SELECT MAX(sortOrder) as m FROM folders').get() as any;
  db.prepare('INSERT INTO folders (id, name, sortOrder) VALUES (?, ?, ?)').run(id, name.trim(), (max.m || 0) + 1);
  return Response.json({ id, name: name.trim(), paperCount: 0 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const db = getDb();

  // 重命名文件夹
  if (body.id && body.name) {
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(body.name, body.id);
  }

  // 移动论文到文件夹
  if (body.paperId !== undefined && body.folderId !== undefined) {
    db.prepare('UPDATE papers SET folderId = ? WHERE id = ?').run(body.folderId, body.paperId);
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: '缺少 id' }, { status: 400 });
  const db = getDb();
  // 论文移回无文件夹状态
  db.prepare("UPDATE papers SET folderId = '' WHERE folderId = ?").run(id);
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  return Response.json({ success: true });
}
