import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import getDb from '@/lib/db';
import { getMemories, analyzeAndUpdateMemory } from '@/lib/chat-memory';

export async function POST(request: NextRequest) {
  try {
    const {
      paperId,
      paragraphId,
      paragraphContent,
      history,
      userMessage,
    } = await request.json();

    if (!paragraphContent || !userMessage) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const db = getDb();

    const paper = db.prepare('SELECT title, abstract FROM papers WHERE id = ?').get(paperId) as any;

    const currentPara = db.prepare(
      'SELECT idx FROM paragraphs WHERE id = ?'
    ).get(paragraphId) as any;

    let contextText = paragraphContent;
    if (currentPara) {
      const prevPara = db.prepare(
        'SELECT content FROM paragraphs WHERE paperId = ? AND idx = ?'
      ).get(paperId, currentPara.idx - 1) as any;
      const nextPara = db.prepare(
        'SELECT content FROM paragraphs WHERE paperId = ? AND idx = ?'
      ).get(paperId, currentPara.idx + 1) as any;

      contextText = [
        prevPara ? `[上一段] ${prevPara.content.slice(0, 200)}` : '',
        `[当前段落] ${paragraphContent}`,
        nextPara ? `[下一段] ${nextPara.content.slice(0, 200)}` : '',
      ].filter(Boolean).join('\n\n');
    }

    // Build memory context from chat_memory table
    const memories = getMemories(paperId);
    let memoryContext = '';
    if (memories.length > 0) {
      const difficulties = memories.filter(m => m.type === 'difficulty').slice(-5);
      const insights = memories.filter(m => m.type === 'insight').slice(-5);
      const summaries = memories.filter(m => m.type === 'summary').slice(-2);

      memoryContext = '\n\n--- 学生阅读档案 ---';
      if (difficulties.length > 0) {
        memoryContext += '\n之前遇到的困难：' + difficulties.map(d => d.content).join('；');
      }
      if (insights.length > 0) {
        memoryContext += '\n已掌握的要点：' + insights.map(i => i.content).join('；');
      }
      if (summaries.length > 0) {
        memoryContext += '\n阶段总结：' + summaries[summaries.length - 1].content;
      }
      memoryContext += '\n请基于以上档案调整你的解释策略：对学生已掌握的内容简略带过，对反复出现的困难概念用新的方式重新解释。';
    }

    const systemPrompt = `你是一位耐心的学术导师，正在帮助一位硕士研究生精读一篇学术论文。

论文标题：${paper?.title || '未知'}
论文摘要：${paper?.abstract?.slice(0, 300) || '无'}

用户当前正在阅读以下段落及其上下文：
${contextText}
${memoryContext}

对话规则：
1. 用清晰易懂的中文回答
2. 结合当前段落的内容来回答问题
3. 遇到专业概念用类比和大白话解释
4. 如果用户的问题超出当前段落范围，可以结合论文摘要来回答
5. 语气像学长帮学弟学妹，亲切但专业
6. 回答简洁有重点，通常不超过 200 字，除非用户明确要求详细解释
7. 不要使用 Markdown 标题格式（不要用 # ## ###），直接用自然段落回答`;

    // Build conversation string from history
    const recentHistory = (history || []).slice(-8);
    let conversationStr = '';
    for (const msg of recentHistory) {
      if (msg.role === 'assistant' && msg.type === 'explanation' && msg.explanationData) {
        conversationStr += `导师：[我对这段话的解释摘要] ${msg.explanationData.summary}\n\n`;
      } else if (msg.role === 'assistant') {
        conversationStr += `导师：${msg.content}\n\n`;
      } else {
        conversationStr += `学生：${msg.content}\n\n`;
      }
    }
    conversationStr += `学生：${userMessage}\n\n导师：`;

    const reply = await chatCompletion(systemPrompt, conversationStr, {
      temperature: 0.4,
      maxTokens: 1024,
    });

    // Async memory analysis (doesn't block response)
    (async () => {
      await analyzeAndUpdateMemory(paperId, userMessage, reply, paragraphContent);
    })();

    return Response.json({ reply });

  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: '对话失败，请重试' }, { status: 500 });
  }
}
