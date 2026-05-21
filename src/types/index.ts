// ===== 论文相关 =====
export interface Paper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  filePath: string;
  totalParagraphs: number;
  readProgress: number;
  year: number | null;
  journal: string;
  impactFactor: number;
  jcrQuartile: string | null;
  conceptCount: number;
  doi: string;
  issn: string;
  publishYear: number;
  hIndex: number;
  citationCount: number;
  openAccessStatus: string;
  categoryId: string;
  categoryName?: string;
  folderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Paragraph {
  id: string;
  paperId: string;
  idx: number;
  content: string;
  section: string;
  pageNumber: number;
  isRead: boolean;
}

export interface Annotation {
  id: string;
  paragraphId: string;
  paperId: string;
  content: string;
  aiExplanation: string;
  type: 'highlight' | 'note' | 'question';
  createdAt: string;
}

// ===== 知识图谱相关 =====
export interface Concept {
  id: string;
  name: string;
  category: 'method' | 'theory' | 'dataset' | 'metric' | 'finding' | 'tool';
  description: string;
  paperId: string;
  paperIds: string[];
  embedding?: number[];
}

export interface ConceptRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: 'builds_on' | 'contradicts' | 'applies' | 'extends' | 'compares' | 'uses';
  strength: number;
  evidence: string;
  paperId: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphNode {
  id: string;
  name: string;
  category: Concept['category'];
  description: string;
  paperCount: number;
  papers: { id: string; title: string }[];
  val: number;
}

export interface GraphLink {
  source: string | { id: string; name: string };
  target: string | { id: string; name: string };
  relationType: ConceptRelation['relationType'];
  strength: number;
  evidence?: string;
}

// ===== 高亮标注 =====
export interface Highlight {
  id: string;
  paragraphId: string;
  paperId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  color: 'blue' | 'amber' | 'teal' | 'pink';
  note: string;
  createdAt: string;
}

// ===== 对话消息 =====
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type: 'explanation' | 'text';
  explanationData?: {
    summary: string;
    sentences: { original: string; explanation: string }[];
    keyTerms: { term: string; definition: string }[];
  };
}

// ===== API 请求/响应 =====
export interface ExplainRequest {
  paragraphId: string;
  paperId: string;
  content: string;
  context?: string;
  userBackground?: string;
}

export interface ExplainResponse {
  explanation: string;
  keyTerms: { term: string; definition: string }[];
  relatedConcepts: string[];
}
