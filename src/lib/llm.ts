import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096,
  });
  return response.choices[0]?.message?.content || '';
}

export async function chatCompletionStream(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<ReadableStream<Uint8Array>> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function chatCompletionJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<T> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt + '\n\n你必须只返回合法的 JSON，不要包含 markdown 代码块标记或任何其他文字。' },
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  const cleaned = content.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await chatCompletionJSON<{ embedding: number[] }>(
    `你是一个文本编码器。给定一段文本，生成一个 64 维的浮点数向量来表示其语义。
每个值在 -1 到 1 之间。返回格式：{"embedding": [0.1, -0.3, ...]}
只返回 JSON，不要有其他文字。`,
    `请为以下文本生成语义向量：\n\n${text.slice(0, 500)}`,
    { temperature: 0 }
  );
  return result.embedding || new Array(64).fill(0);
}
