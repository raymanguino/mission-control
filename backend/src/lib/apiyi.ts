import OpenAI from 'openai';

let _apiyi: OpenAI | null = null;

function getApiyiClient(): OpenAI {
  if (!_apiyi) {
    _apiyi = new OpenAI({
      apiKey: process.env.APIYI_API_KEY,
      baseURL: 'https://api.apiyi.com/v1',
    });
  }
  return _apiyi;
}

export interface TaskSpec {
  title: string;
  description: string;
  specialization: string;
  complexity?: 'small' | 'medium' | 'large';
}

export async function decomposeProjectIntoTasks(
  projectName: string,
  description: string,
): Promise<TaskSpec[]> {
  const apiyi = getApiyiClient();
  const response = await apiyi.chat.completions.create({
    model: 'qwen3.6-plus',
    messages: [
      {
        role: 'system',
        content: `You are a Chief of Staff agent. Decompose projects into discrete, actionable tasks.
        
Rules:
- Each task should be independently assignable
- Split by concern: frontend, backend, database, testing, docs
- Include specific implementation details
- Estimate complexity (small/medium/large)
- Output ONLY valid JSON array with format: [{"title": "...", "description": "...", "specialization": "...", "complexity": "..."}]
- Specializations should be: frontend, backend, devops, python, qa`,
      },
      {
        role: 'user',
        content: `Project: ${projectName}\nDescription: ${description}`,
      },
    ],
    response_format: { type: 'json_object' },
  });
  
  const content = response.choices[0].message.content || '{"tasks": []}';
  const parsed = JSON.parse(content);
  
  // Handle both {tasks: [...]} and direct array formats
  return Array.isArray(parsed) ? parsed : (parsed.tasks || []);
}
