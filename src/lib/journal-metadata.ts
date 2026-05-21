/**
 * 期刊元数据自动获取模块
 *
 * 数据来源：
 * 1. CrossRef API（免费，无需 key）→ DOI 解析 → 期刊名、ISSN、出版年、被引次数
 * 2. OpenAlex API（免费）→ ISSN 查询 → 影响因子（2yr_mean_citedness）、h-index
 */

export interface JournalMetadata {
  doi: string;
  journal: string;
  issn: string;
  publishYear: number;
  impactFactor: number;
  hIndex: number;
  jcrQuartile: string;
  citationCount: number;
  openAccessStatus: string;
}

// ===== Step 1: 从 PDF 文本中提取 DOI =====

export function extractDOI(text: string): string | null {
  const patterns = [
    /\b(10\.\d{4,9}\/[^\s,;}\]]+)/i,
    /doi[:\s]*\s*(10\.\d{4,9}\/[^\s,;}\]]+)/i,
    /https?:\/\/doi\.org\/(10\.\d{4,9}\/[^\s,;}\]]+)/i,
    /https?:\/\/dx\.doi\.org\/(10\.\d{4,9}\/[^\s,;}\]]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let doi = match[1].replace(/[.\s]+$/, '');
      return doi;
    }
  }

  return null;
}

// ===== Step 2: 从 CrossRef 获取基本信息 =====

async function fetchCrossRefMetadata(doi: string): Promise<Partial<JournalMetadata> | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PaperMind/1.0 (mailto:papermind@example.com)',
      },
    });

    if (!res.ok) {
      console.log(`[CrossRef] DOI ${doi} 未找到 (${res.status})`);
      return null;
    }

    const data = await res.json();
    const work = data.message;

    const journal = work['container-title']?.[0] || '';
    const issn = work.ISSN?.[0] || '';
    const publishYear = work.published?.['date-parts']?.[0]?.[0] || 0;
    const citationCount = work['is-referenced-by-count'] || 0;

    console.log(`[CrossRef] 获取成功: ${journal} (${publishYear}), 被引 ${citationCount} 次`);

    return { doi, journal, issn, publishYear, citationCount };

  } catch (error) {
    console.error('[CrossRef] 请求失败:', error);
    return null;
  }
}

// ===== Step 3: 从 OpenAlex 获取期刊级别指标 =====

async function fetchOpenAlexMetadata(issn: string): Promise<{
  impactFactor: number;
  hIndex: number;
} | null> {
  if (!issn) return null;

  try {
    const url = `https://api.openalex.org/sources/issn:${issn}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PaperMind/1.0 (mailto:papermind@example.com)',
      },
    });

    if (!res.ok) {
      console.log(`[OpenAlex] ISSN ${issn} 未找到 (${res.status})`);
      return null;
    }

    const source = await res.json();
    const impactFactor = source.summary_stats?.['2yr_mean_citedness'] || 0;
    const hIndex = source.summary_stats?.h_index || 0;

    console.log(`[OpenAlex] ${source.display_name}: IF=${impactFactor.toFixed(2)}, h-index=${hIndex}`);

    return {
      impactFactor: Math.round(impactFactor * 100) / 100,
      hIndex,
    };

  } catch (error) {
    console.error('[OpenAlex] 请求失败:', error);
    return null;
  }
}

// ===== Step 4: 根据影响因子估算 JCR 分区 =====

function estimateJcrQuartile(impactFactor: number): string {
  if (impactFactor <= 0) return '未知';
  if (impactFactor >= 5.0) return 'Q1';
  if (impactFactor >= 2.5) return 'Q1/Q2';
  if (impactFactor >= 1.5) return 'Q2';
  if (impactFactor >= 0.8) return 'Q2/Q3';
  if (impactFactor >= 0.3) return 'Q3';
  return 'Q3/Q4';
}

// ===== 主函数：一站式获取所有元数据 =====

export async function fetchJournalMetadata(pdfText: string): Promise<JournalMetadata> {
  const result: JournalMetadata = {
    doi: '',
    journal: '',
    issn: '',
    publishYear: 0,
    impactFactor: 0,
    hIndex: 0,
    jcrQuartile: '未知',
    citationCount: 0,
    openAccessStatus: '',
  };

  const doi = extractDOI(pdfText);
  if (!doi) {
    console.log('[元数据] 未在 PDF 中找到 DOI');
    return result;
  }

  result.doi = doi;
  console.log(`[元数据] 提取到 DOI: ${doi}`);

  const crossref = await fetchCrossRefMetadata(doi);
  if (crossref) {
    result.journal = crossref.journal || '';
    result.issn = crossref.issn || '';
    result.publishYear = crossref.publishYear || 0;
    result.citationCount = crossref.citationCount || 0;
  }

  if (result.issn) {
    const openalex = await fetchOpenAlexMetadata(result.issn);
    if (openalex) {
      result.impactFactor = openalex.impactFactor;
      result.hIndex = openalex.hIndex;
    }
  }

  result.jcrQuartile = estimateJcrQuartile(result.impactFactor);

  console.log(`[元数据] 最终结果: ${result.journal}, IF=${result.impactFactor}, ${result.jcrQuartile}`);

  return result;
}
