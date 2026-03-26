import Anthropic from '@anthropic-ai/sdk';

export async function generateWithAnthropic(params: {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('Anthropic provider unavailable: missing ANTHROPIC_API_KEY');
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 1200,
    temperature: params.temperature ?? 0.2,
    messages: [{ role: 'user', content: params.prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

