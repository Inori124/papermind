import { NextRequest, NextResponse } from 'next/server';
import { chatCompletionJSON } from '@/lib/llm';

const SYSTEM_PROMPT = `你是一位耐心的学术导师，正在帮助一位硕士研究生精读学术论文。

你必须严格按照以下 JSON 格式返回，不要包含任何 markdown 代码块标记，不要有 JSON 之外的任何文字：

{
  "summary": "用一句中文概括这个段落的核心内容（不超过 50 字）",
  "sentences": [
    {
      "original": "原文中的一句话（英文保持原文）",
      "explanation": "用通俗易懂的中文解释这句话的含义，遇到专业概念用类比说明"
    }
  ],
  "keyTerms": [
    {
      "term": "术语名称",
      "definition": "一句话定义"
    }
  ]
}

要求：
- summary 要简洁精炼，一句话概括核心意思
- sentences 数组中，把段落拆成一句一句来解释，每句都要有 original 和 explanation
- original 保留原文语言（英文论文就写英文）
- explanation 用中文，像学长帮学弟学妹读论文一样的语气，用类比和大白话解释
- keyTerms 提取 3-6 个关键术语，给出简明定义
- 只返回 JSON，不要有任何其他文字`;

interface ExplainResult {
  summary: string;
  sentences: { original: string; explanation: string }[];
  keyTerms: { term: string; definition: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, context } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const userMessage = context
      ? `上下文：${context}\n\n请解释以下段落：\n${content}`
      : `请解释以下段落：\n${content}`;

    const result = await chatCompletionJSON<ExplainResult>(
      SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.3, maxTokens: 4096 }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Explain API error:', error);
    return NextResponse.json(
      { error: '解释生成失败，请重试' },
      { status: 500 }
    );
  }
}
