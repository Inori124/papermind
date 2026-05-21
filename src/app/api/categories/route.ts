import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET — 获取所有分类
export async function GET() {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sortOrder ASC').all();
  return Response.json(categories);
}

// POST — 创建分类
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;
    if (!name?.trim()) {
      return Response.json({ error: '分类名不能为空' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    const maxOrder = (db.prepare('SELECT MAX(sortOrder) as mx FROM categories').get() as { mx: number }).mx || 0;

    db.prepare(
      'INSERT INTO categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)'
    ).run(id, name.trim(), color || '#6366f1', maxOrder + 1);

    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return Response.json(cat, { status: 201 });
  } catch {
    return Response.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT — 更新分类（重命名/改颜色/调整排序）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, color, sortOrder } = body;
    if (!id) return Response.json({ error: '缺少分类 ID' }, { status: 400 });

    const db = getDb();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
    if (sortOrder !== undefined) { sets.push('sortOrder = ?'); vals.push(sortOrder); }

    if (sets.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    vals.push(id);
    db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    return Response.json(cat);
  } catch {
    return Response.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE — 删除分类（将关联论文移回"未分类"）
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: '缺少分类 ID' }, { status: 400 });

  const db = getDb();
  // 将属于该分类的论文移动到默认分类
  db.prepare("UPDATE papers SET categoryId = 'cat-default' WHERE categoryId = ?").run(id);
  // 删除分类
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return Response.json({ success: true });
}
