import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { chatCompletionJSON } from '@/lib/llm';

interface AnalysisResult {
  overview: string;
  commonalities: {
    themes: string[];
    methods: string[];
    gaps: string[];
  };
  paperSummaries: {
    paperId: string;
    title: string;
    summary: string;
    contribution: string;
  }[];
  clusters: {
    label: string;
    paperIds: string[];
    description: string;
  }[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const { folderId } = await params;
  const db = getDb();

  const folder = db.prepare('SELECT analysis, analysisUpdatedAt FROM folders WHERE id = ?').get(folderId) as any;
  if (!folder) {
    return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
  }

  if (folder.analysis) {
    return NextResponse.json({
      analysis: JSON.parse(folder.analysis),
      updatedAt: folder.analysisUpdatedAt,
    });
  }

  return NextResponse.json({ analysis: null, updatedAt: null });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const { folderId } = await params;
  const db = getDb();

  const folder = db.prepare('SELECT id, name FROM folders WHERE id = ?').get(folderId) as any;
  if (!folder) {
    return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
  }

  const papers = db.prepare(
    'SELECT id, title, authors, abstract, publishYear, journal, impactFactor, jcrQuartile, citationCount FROM papers WHERE folderId = ?'
  ).all(folderId) as any[];

  if (papers.length === 0) {
    return NextResponse.json({ error: '文件夹中没有论文' }, { status: 400 });
  }

  const paperListText = papers.map((p, i) =>
    `${i + 1}. 标题: ${p.title}
   作者: ${p.authors || '未知'}
   年份: ${p.publishYear || '未知'}
   期刊: ${p.journal || '未知'} (IF: ${p.impactFactor || 'N/A'}, JCR: ${p.jcrQuartile || 'N/A'})
   被引: ${p.citationCount || 0}
   摘要: ${p.abstract || '无'}`
  ).join('\n\n');

  const systemPrompt = `你是一位资深科研文献分析专家。给定一个文件夹中的多篇论文，你需要进行综合文献解读。

返回严格的 JSON 格式，结构如下：
{
  "overview": "该文件夹研究方向的一句话概述（中文，不超过80字）",
  "commonalities": {
    "themes": ["共同研究主题1", "共同研究主题2", ...],
    "methods": ["常用方法1", "常用方法2", ...],
    "gaps": ["研究空白1", "研究空白2", ...]
  },
  "paperSummaries": [
    { "paperId": "论文ID", "title": "论文标题", "summary": "一句话研究内容（中文，不超过50字）", "contribution": "主要贡献（中文，不超过40字）" }
  ],
  "clusters": [
    { "label": "聚类标签", "paperIds": ["id1", "id2"], "description": "该聚类的简要说明（中文，不超过60字）" }
  ]
}

注意：
- themes/methods/gaps 各提取 2-5 个最关键的
- 如果论文少于3篇，clusters 可以只返回 1 个聚类
- 所有文字使用中文
- paperSummaries 必须包含每篇论文`;

  try {
    const analysis = await chatCompletionJSON<AnalysisResult>(
      systemPrompt,
      `文件夹名称: ${folder.name}\n论文数量: ${papers.length}\n\n论文列表:\n${paperListText}`,
      { temperature: 0.3, maxTokens: 4096 }
    );

    // Ensure paperSummaries has correct paperIds from the actual papers
    analysis.paperSummaries = papers.map((p, i) => {
      const existing = analysis.paperSummaries?.[i];
      return {
        paperId: p.id,
        title: p.title,
        summary: existing?.summary || '',
        contribution: existing?.contribution || '',
      };
    });

    // Fix cluster paperIds: AI may return 1-based indices instead of real UUIDs
    analysis.clusters = (analysis.clusters || []).map((cluster) => {
      const mappedIds = cluster.paperIds
        .map((id) => {
          const idx = parseInt(id, 10);
          if (!isNaN(idx) && idx >= 1 && idx <= papers.length) {
            return papers[idx - 1].id;
          }
          // If it looks like a UUID already, keep it
          if (/^[a-f0-9-]{36}$/i.test(id)) return id;
          return null;
        })
        .filter(Boolean) as string[];
      return { ...cluster, paperIds: mappedIds };
    });

    const now = new Date().toISOString();
    db.prepare('UPDATE folders SET analysis = ?, analysisUpdatedAt = ? WHERE id = ?')
      .run(JSON.stringify(analysis), now, folderId);

    return NextResponse.json({ analysis, updatedAt: now });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'AI 分析失败' }, { status: 500 });
  }
}
