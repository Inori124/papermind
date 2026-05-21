import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/llm';

const ACTION_PROMPTS: Record<string, string> = {
  expand: '请将以下文本扩展，增加更多细节、论证或例证，使内容更加充实。保持原文风格和语气，长度扩展约 1.5-2 倍。',
  condense: '请将以下文本精简，保留核心论点，删除冗余表达，使行文更紧凑有力。长度压缩约 50%。',
  rephrase: '请用不同的表达方式重写以下文本，保持原意不变，但换用新的句式和词汇，避免重复。',
  polish: '请润色以下文本，修正语法问题，提升表达的学术性和流畅度，优化句子结构，但保持原意和长度不变。',
};

export async function POST(request: NextRequest) {
  try {
    const { content, action, context } = await request.json();

    if (!content || !action) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const actionPrompt = ACTION_PROMPTS[action];
    if (!actionPrompt) {
      return Response.json({ error: '不支持的操作，可选值：expand, condense, rephrase, polish' }, { status: 400 });
    }

    const systemPrompt = `你是一位学术写作编辑，帮助修改和优化学术文本。

${actionPrompt}

规则：
1. 保持学术写作的严谨风格
2. 保留原文中的所有引用标记（如 [1] [2]）
3. 不要添加原文中没有的新论点或数据
4. 直接返回改写后的文本，不要加任何前缀、说明或 Markdown 标记
${context ? `\n额外上下文：${context}` : ''}`;

    const result = await chatCompletion(systemPrompt, content, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    return Response.json({ content: result });

  } catch (error) {
    console.error('Writing rewrite error:', error);
    return Response.json({ error: '改写失败，请重试' }, { status: 500 });
  }
}
