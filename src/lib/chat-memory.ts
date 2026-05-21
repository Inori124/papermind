import getDb from '@/lib/db';
import { chatCompletionJSON } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryEntry {
  id: string;
  paperId: string;
  type: 'difficulty' | 'insight' | 'summary';
  content: string;
  createdAt: string;
}

export function getMemories(paperId: string): MemoryEntry[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM chat_memory WHERE paperId = ? ORDER BY createdAt ASC'
  ).all(paperId) as MemoryEntry[];
}

export function addMemory(paperId: string, type: MemoryEntry['type'], content: string) {
  const db = getDb();
  db.prepare(
    'INSERT INTO chat_memory (id, paperId, type, content) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), paperId, type, content);
}

/**
 * 每次 AI 回复后，自动分析是否需要记录记忆
 */
export async function analyzeAndUpdateMemory(
  paperId: string,
  userMessage: string,
  aiReply: string,
  paragraphContent: string
) {
  try {
    const result = await chatCompletionJSON<{
      hasDifficulty: boolean;
      difficulty?: string;
      hasInsight: boolean;
      insight?: string;
    }>(
      `分析以下对话，判断：
1. 用户是否在某个概念上遇到了理解困难？如果是，用一句话概括是什么困难。
2. 用户是否表达了一个重要的理解或洞察？如果是，用一句话概括。

返回 JSON：
{
  "hasDifficulty": true/false,
  "difficulty": "用户不理解 XXX 概念",
  "hasInsight": true/false,
  "insight": "用户理解了 XXX 和 YYY 的关系"
}`,
      `段落：${paragraphContent.slice(0, 200)}
用户提问：${userMessage}
AI 回答：${aiReply.slice(0, 300)}`,
      { temperature: 0, maxTokens: 256 }
    );

    if (result.hasDifficulty && result.difficulty) {
      addMemory(paperId, 'difficulty', result.difficulty);
    }
    if (result.hasInsight && result.insight) {
      addMemory(paperId, 'insight', result.insight);
    }
  } catch {
    // 记忆分析失败不影响主流程
  }
}

/**
 * 每阅读 5 段后生成阶段性总结
 */
export async function generatePeriodicSummary(paperId: string, readCount: number) {
  if (readCount % 5 !== 0 || readCount === 0) return;

  const memories = getMemories(paperId);
  const difficulties = memories.filter(m => m.type === 'difficulty');

  if (difficulties.length === 0) return;

  try {
    const result = await chatCompletionJSON<{ summary: string }>(
      `你是学术导师。根据以下学生在阅读论文过程中遇到的理解困难，生成一段简短的整合总结，帮助学生看清自己的薄弱点和进步。

返回 JSON：{"summary": "总结内容（100字以内）"}`,
      `学生遇到的困难：\n${difficulties.map(d => '- ' + d.content).join('\n')}`,
      { temperature: 0.3, maxTokens: 256 }
    );

    if (result.summary) {
      addMemory(paperId, 'summary', result.summary);
    }
  } catch {
    // 静默失败
  }
}
