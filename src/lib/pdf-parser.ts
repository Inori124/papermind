import pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

interface ParsedParagraph {
  id: string;
  index: number;
  content: string;
  section: string;
  pageNumber: number;
}

interface ParsedPaper {
  title: string;
  authors: string;
  abstract: string;
  year: number | null;
  paragraphs: ParsedParagraph[];
}

// ========== 章节标题检测 ==========

const NUMBERED_SECTION_PATTERNS = [
  /^\d+\.?\s+(introduction|引言|背景)/i,
  /^\d+\.?\s+(related\s+work|literature\s+review|相关工作|文献综述)/i,
  /^\d+\.?\s+(method|methodology|方法)/i,
  /^\d+\.?\s+(experiment|实验|results?|结果)/i,
  /^\d+\.?\s+(discussion|讨论|analysis|分析)/i,
  /^\d+\.?\s+(conclusion|结论|summary|总结)/i,
  /^\d+\.?\s+(references|参考文献|bibliography)/i,
  /^\d+\.?\s+(appendix|附录|supplementary)/i,
  /^\d+\.\d+\.?\s+\S/,
];

const STANDALONE_SECTION_KEYWORDS = [
  /^abstract$/i,
  /^摘要$/,
  /^introduction$/i,
  /^引言$/,
  /^(related\s+work|literature\s+review)$/i,
  /^(method|methodology|methods)$/i,
  /^(experiment|experiments|experimental\s+setup)$/i,
  /^(results?|results?\s+and\s+discussion)$/i,
  /^(discussion)$/i,
  /^(conclusion|conclusions|concluding\s+remarks)$/i,
  /^(references|bibliography)$/i,
  /^(acknowledgements?|acknowledgments?)$/i,
  /^(appendix|appendices)$/i,
];

function detectSection(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length > 80 || trimmed.length < 2) return null;

  for (const pattern of NUMBERED_SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return trimmed;
  }

  for (const pattern of STANDALONE_SECTION_KEYWORDS) {
    if (pattern.test(trimmed)) return trimmed;
  }

  if (/^\d+\.?\s+[A-Z]/.test(trimmed) && trimmed.length < 60) {
    const contentAfterNumber = trimmed.replace(/^\d+\.?\s+/, '');
    if (!contentAfterNumber.includes('.') || contentAfterNumber.length < 30) {
      return trimmed;
    }
  }

  return null;
}

// ========== 元数据过滤 ==========

function isMetadata(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 20) return true;

  // Check for DOI, URL, email patterns anywhere in text
  if (/\bdoi:\s*10\.\d{4,}/i.test(trimmed)) return true;
  if (/\bhttps?:\/\/[^\s]+\.[^\s]{2,}/.test(trimmed)) return true;
  if (/\b\w+@[\w.]+\.\w{2,}\b/.test(trimmed)) return true;

  // Check start-of-line patterns (but also mid-line for important ones)
  const startPatterns = [
    /^(published|received|accepted|edited|reviewed\s+by):?\s/i,
    /^(original\s+research)/i,
    /^(doi|DOI):?\s/i,
    /^\*?correspondence:?\s/i,
    /^citation:?\s/i,
    /^(volume|issue|article)\s+\d+/i,
    /^(copyright|©|\(c\))\s/i,
    /^ISSN\s/i,
    /^(specialty\s+section|submitted\s+to):?\s/i,
    /^(this\s+article\s+was\s+submitted)/i,
    /^(frontiers\s+in\s+psychology)/i,
  ];

  return startPatterns.some(p => p.test(trimmed));
}

// ========== 段落结尾检测 ==========

function endsWithCompleteSentence(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const lastChar = trimmed[trimmed.length - 1];
  if (['.', '?', '!', '。', '？', '！', '）', ')', ':', '：'].includes(lastChar)) {
    return true;
  }
  return false;
}

function isReferenceEntry(text: string): boolean {
  return /^\s*\[\d+\]/.test(text) || /^\s*\d+\.\s+[A-Z][a-z]+,?\s+[A-Z]/.test(text);
}

// ========== 文本清洗 ==========

function cleanText(text: string): string {
  return text
    .replace(/(\w)-\s+(\w)/g, '$1$2')   // de-hyphenate
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ========== 段落内容清洗：去除混入正文的元数据 ==========

function cleanParagraphContent(text: string, paperTitle: string): string {
  let cleaned = text;

  // 去除作者信息块：名字 + 上标字母 + 逗号，如 "Zhenyu Li a , Qiong Li a,b,*"
  cleaned = cleaned.replace(
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[a-z]\s*,?\s*(\*\s*)?/g,
    ''
  );

  // 去除机构/地址信息：包含 University/Institute/School of 等 + 国家 + 邮编
  cleaned = cleaned.replace(
    /(?:Center|Department|Faculty|School|Institute|College|Key Research|Laboratory)\s+(?:for|of)\s+[^.,]*?(?:China|USA|UK|Australia|Sweden|Italy|Germany|France|Japan|Korea|Canada|Brazil|India|Spain|Netherlands)[^.,]*?\d{4,6}\s*,?\s*(?:China|USA|UK)?/gi,
    ''
  );

  // 去除邮箱
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, '');

  // 去除 "ARTICLE INFO" 及其后续 Keywords 行
  cleaned = cleaned.replace(
    /ARTICLE\s+INFO\s*(?:Keywords?:?\s*[^.]*?)(?=(?:ABSTRACT|Abstract|Introduction|1\.))/gi,
    ''
  );

  // 单独出现的 Keywords 行
  cleaned = cleaned.replace(
    /Keywords?:?\s*(?:[a-zA-Z\s,\-]+?)(?=(?:The\s|This\s|In\s|A\s|We\s))/gi,
    ''
  );

  // 去除 ABSTRACT 标签本身（正文不需要显示这个词）
  cleaned = cleaned.replace(/^(?:ABSTRACT|Abstract)\s+/i, '');

  // 去除残留的上标标注：单独出现的 "a,b,*" "1,2"
  cleaned = cleaned.replace(/\s+[a-e](?:,[a-e])?\*?\s+/g, ' ');
  cleaned = cleaned.replace(/\s+\*\s+/g, ' ');

  // 如果段落以论文标题开头（模糊匹配前 60 字符），去除标题部分
  if (paperTitle && paperTitle.length > 10) {
    const titleStart = paperTitle.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedStart = titleStart.slice(0, 40);
    const titleRegex = new RegExp(`^${escapedStart}[^.]*?\\.?\\s*`, 'i');
    cleaned = cleaned.replace(titleRegex, '');
  }

  // 清理多余空格
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

// ========== 页面页眉检测与剥离 ==========

// 在文本块集合中找出反复出现的前缀（即页面页眉）
function detectPageHeaders(blocks: string[]): string[] {
  // 取每个 block 的前 80 个字符作为候选
  const prefixes = blocks.map(b => b.slice(0, 80).trim());
  const freq: Record<string, number> = {};
  for (const p of prefixes) {
    if (p.length > 10) {
      freq[p] = (freq[p] || 0) + 1;
    }
  }

  // 出现 3 次以上，且占比超过 1/3 的视为页眉
  return Object.entries(freq)
    .filter(([_, count]) => count >= 3 && count / blocks.length > 0.3)
    .map(([prefix]) => prefix);
}

function stripHeaders(text: string, headers: string[]): string {
  let result = text;
  for (const h of headers) {
    // 去掉块首的页眉（可能紧贴正文无空格）
    if (result.startsWith(h)) {
      result = result.slice(h.length);
      // 去掉页眉和正文之间可能缺失的空格导致的首字母粘合
      // e.g. "Maxwell et al....could play" — 没有空格，保持原样
    }
    // 也去掉中间出现的页眉（如跨页后在新段落开头再次出现）
    // 用 split-rejoin 模式
  }
  return result.trim();
}

// ========== 智能块内分段 ==========

// 对一个大块按内部线索切分成多个子块
// 线索：章节标题、短标题行、句号后的大写字母开头
function splitLargeBlock(text: string): string[] {
  // 先尝试在章节标题处切分
  const lines = text.split('. ').map(s => s.trim()).filter(Boolean);
  if (lines.length <= 1) return [text];  // 没有句号分隔，无法切分

  // 基于句号分隔重建，但只在发现章节或短标题时真正切开
  const segments: string[] = [];
  let current = '';

  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    // 如果这一段看起来像是段首（以大写字母开头且已有内容不少）
    // 且当前积累的内容已经以一个完整的句子结束
    if (current && endsWithCompleteSentence(current) && trimmed.length > 30 && /^[A-Z]/.test(trimmed)) {
      // 检查是否应该在此处分段
      // 如果在 trimmed 的开头附近检测到章节标题 → 切开
      const secInBlock = detectSection(trimmed.slice(0, 80));
      if (secInBlock) {
        segments.push(current.trim());
        current = trimmed;
        continue;
      }

      // 如果当前段落已经足够长（> 500 字符）且此处是自然句号结束 → 切开
      if (current.length > 500) {
        segments.push(current.trim());
        current = trimmed;
        continue;
      }
    }

    current += (current ? ' ' : '') + trimmed;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments.length > 0 ? segments : [text];
}

// ========== 标题提取 ==========

function extractTitleFromText(text: string): string {
  const firstLines = text.split('\n')
    .slice(0, 15)
    .map(l => l.trim())
    .filter(l => l.length > 10 && l.length < 200)
    .filter(l => !isMetadata(l));

  if (firstLines.length === 0) return 'Untitled Paper';
  return firstLines.reduce((a, b) => (a.length > b.length ? a : b)).slice(0, 200);
}

// ========== 年份提取 ==========

export function extractYear(text: string): number | null {
  const contextual = text.match(
    /(?:\b(?:copyright|published|\(\s*c\s*\)|accepted|submitted|received)\b[^.\n]*?)(19\d\d|20[0-2]\d)/i
  );
  if (contextual) {
    const y = parseInt(contextual[1], 10);
    if (y >= 1900 && y <= 2029) return y;
  }
  const fallback = text.match(/\b(19\d\d|20[0-2]\d)\b/);
  if (fallback) {
    const y = parseInt(fallback[1], 10);
    if (y >= 1900 && y <= 2029) return y;
  }
  return null;
}

// ========== 主解析函数 ==========

export async function parsePDF(buffer: Buffer): Promise<ParsedPaper> {
  const data = await pdf(buffer);

  const fullText = data.text;
  const title = data.info?.Title || extractTitleFromText(fullText);
  let authors = data.info?.Author || '';

  // ===== 预处理：定位 ABSTRACT 并截断前面的元数据 =====
  // ABSTRACT 标记了正文的真正起点，之前的内容（标题/作者/机构/关键词）都是元数据
  const abstractIndex = fullText.search(/\b(ABSTRACT|Abstract)\b/);
  let metadataText = '';

  if (abstractIndex > 0 && abstractIndex < fullText.length * 0.3) {
    metadataText = fullText.slice(0, abstractIndex);
  }

  // 从元数据中补充提取作者
  if (!authors && metadataText) {
    const afterTitle = metadataText.replace(title, '').trim();
    const authorMatch = afterTitle.match(/^([A-Z][a-z]+\s+[A-Z][a-z\-]+[\s,*a-e]*)+/);
    if (authorMatch) {
      authors = authorMatch[0]
        .replace(/\s*[a-e,*]+\s*/g, ' ')
        .replace(/\s{2,}/g, ', ')
        .trim();
    }
  }

  const lines = fullText.split('\n');
  const charsPerPage = Math.ceil(data.text.length / (data.numpages || 1));

  // ===== 第 0 遍：按空行分成 raw blocks =====
  const rawBlocks: { text: string; charOffset: number }[] = [];
  let currentBlock = '';
  let blockStartOffset = 0;
  let charOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    charOffset += line.length + 1;

    if (!trimmed) {
      if (currentBlock.trim()) {
        rawBlocks.push({ text: currentBlock.trim(), charOffset: blockStartOffset });
        currentBlock = '';
      }
      continue;
    }

    if (!currentBlock) {
      blockStartOffset = charOffset - line.length - 1;
    }

    currentBlock += (currentBlock ? ' ' : '') + trimmed;
  }

  if (currentBlock.trim()) {
    rawBlocks.push({ text: currentBlock.trim(), charOffset: blockStartOffset });
  }

  // ===== 第 1 遍：检测并剥离页眉 =====
  const blockTexts = rawBlocks.map(b => b.text);
  const headers = detectPageHeaders(blockTexts);

  const strippedBlocks = rawBlocks.map(b => ({
    ...b,
    text: stripHeaders(b.text, headers),
  }));

  // ===== 第 2 遍：将大块按内部线索切分 =====
  const splitBlocks: { text: string; charOffset: number }[] = [];
  for (const b of strippedBlocks) {
    if (b.text.length > 600) {
      const parts = splitLargeBlock(b.text);
      for (const part of parts) {
        splitBlocks.push({ text: part, charOffset: b.charOffset });
      }
    } else {
      splitBlocks.push(b);
    }
  }

  // ===== 第 3 遍：识别章节标题 + 过滤元数据 + 智能合并 =====
  const paragraphs: ParsedParagraph[] = [];
  let currentSection = 'Untitled';
  let abstractText = '';
  let paragraphIndex = 0;

  let i = 0;
  while (i < splitBlocks.length) {
    const block = splitBlocks[i];
    const text = block.text;

    // 过滤元数据
    if (isMetadata(text)) {
      i++;
      continue;
    }

    // 过滤引用条目
    if (/references|参考文献/i.test(currentSection) && isReferenceEntry(text)) {
      i++;
      continue;
    }

    // 检测章节标题
    const sectionTitle = detectSection(text);
    if (sectionTitle) {
      currentSection = sectionTitle;
      i++;
      continue;
    }

    // ===== 智能段落合并 =====
    let mergedText = text;
    let mergeCount = 0;

    while (
      !endsWithCompleteSentence(mergedText) &&
      mergeCount < 3 &&
      i + 1 + mergeCount < splitBlocks.length
    ) {
      const nextBlock = splitBlocks[i + 1 + mergeCount];
      const nextText = nextBlock.text;

      if (detectSection(nextText) || isMetadata(nextText)) break;

      mergedText += ' ' + nextText;
      mergeCount++;
    }

    i += 1 + mergeCount;

    const pageNum = Math.min(
      Math.ceil(block.charOffset / charsPerPage) + 1,
      data.numpages || 1,
    );

    if (/abstract|摘要/i.test(currentSection)) {
      abstractText += mergedText + ' ';
    }

    paragraphs.push({
      id: uuidv4(),
      index: paragraphIndex++,
      content: cleanParagraphContent(cleanText(mergedText), title),
      section: currentSection,
      pageNumber: pageNum,
    });
  }

  // ===== 第 4 遍：过滤噪音 =====
  const filteredParagraphs = paragraphs
    .filter(p => p.content.length > 40)
    .filter(p => !isMetadata(p.content))
    .filter(p => {
      const alphaRatio = (p.content.match(/[a-zA-Z一-鿿]/g) || []).length / p.content.length;
      return alphaRatio > 0.3;
    })
    .filter(p => {
      // 过滤机构地址残留：一段中出现 2 个以上机构关键词 → 判定为元数据
      const institutionKeywords = ['University', 'Institute', 'Faculty', 'Department', 'School of', 'College of', 'Laboratory'];
      const matchCount = institutionKeywords.filter(kw => p.content.includes(kw)).length;
      return matchCount < 2;
    })
    .map((p, idx) => ({ ...p, index: idx }));

  return {
    title,
    authors,
    abstract: abstractText.trim() || filteredParagraphs.slice(0, 3).map(p => p.content).join(' ').slice(0, 500),
    year: extractYear(data.text),
    paragraphs: filteredParagraphs,
  };
}
