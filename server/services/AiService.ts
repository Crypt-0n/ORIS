import { getDb } from '../db-arango';

const AI_CONFIG_KEYS = [
  'ai_enabled',
  'ai_provider',
  'ai_api_url',
  'ai_api_key',
  'ai_model',
  'ai_temperature',
  'ai_max_tokens',
  'ai_system_prompt',
  'ai_quick_prompts',
];

const DEFAULT_QUICK_PROMPTS = [
  { label: 'Résumer la timeline', prompt: 'Résume cette chronologie en 5 points clés pour le rapport de réponse à incident.' },
  { label: 'Analyser le Diamant', prompt: 'Analyse le Modèle Diamant de ce dossier. Identifie les axes incomplets, les corrélations entre événements, et les relations adversaire-infrastructure qui pourraient passer inaperçues.' },
  { label: 'Points aveugles', prompt: 'En tant qu\'expert CTI, quels sont les angles morts de cette investigation ? Quelles pistes l\'analyste n\'a peut-être pas explorées ? Quels événements manquent potentiellement dans la chronologie ?' },
  { label: 'Suggérer des TTPs', prompt: 'Quels TTPs MITRE ATT&CK correspondent aux activités observées dans ce dossier ? Propose une matrice des techniques identifiées.' },
  { label: 'Rédiger la synthèse', prompt: 'Rédige une synthèse technique de ce cas au format ANSSI/CERT-FR, incluant : le résumé, la chronologie, les IOCs, et les recommandations.' },
];

const DEFAULT_SYSTEM_PROMPT = `Tu es un analyste CTI (Cyber Threat Intelligence) senior spécialisé en réponse à incident.
Tu aides l'analyste à investiguer en te basant sur le contexte du dossier fourni.
Réponds toujours en français, de manière concise et technique.
Utilise le vocabulaire ANSSI/CERT-FR quand c'est pertinent.`;

const ObjectProviders = {
  openai: {
    label: 'OpenAI (GPT)',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    format: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
  },
  google: {
    label: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    format: 'gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
  },
  mistral: {
    label: 'Mistral AI',
    defaultUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    format: 'openai',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'open-mistral-nemo',
      'codestral-latest',
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    format: 'anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  ollama: {
    label: 'Ollama (local)',
    defaultUrl: process.env.OLLAMA_URL || 'http://ollama:11434/v1',
    defaultModel: 'mistral-nemo',
    format: 'openai',
    models: [
      'mistral-nemo',
      'mistral:7b',
      'llama3:8b',
      'llama3:70b',
      'gemma2:9b',
      'phi3:mini',
      'qwen2:7b',
      'deepseek-r1:8b',
      'deepseek-coder-v2:lite',
      'codellama:7b',
    ],
  },
  groq: {
    label: 'Groq (gratuit)',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    format: 'openai',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
      'deepseek-r1-distill-llama-70b',
    ],
  },
  openrouter: {
    label: 'OpenRouter (gratuit)',
    defaultUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    format: 'openai',
    models: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'deepseek/deepseek-r1:free',
    ],
  },
  custom: { label: 'Custom (OpenAI-compatible)', defaultUrl: '', defaultModel: '', format: 'openai', models: [] },
};

export class AiService {
  static async getStatus() {
    try {
      const db = getDb();
      const cursor = await db.query(`FOR c IN system_config FILTER c.key IN ['ai_enabled', 'ai_quick_prompts'] RETURN { key: c.key, value: c.value }`);
      const rows = await cursor.all();
      
      let enabled = false;
      let quick_prompts = DEFAULT_QUICK_PROMPTS;

      for (const r of rows) {
        if (r.key === 'ai_enabled') enabled = r.value === 'true';
        if (r.key === 'ai_quick_prompts' && r.value) {
          try { quick_prompts = JSON.parse(r.value); } catch(e) {}
        }
      }
      return { enabled, quick_prompts };
    } catch {
      return { enabled: false, quick_prompts: DEFAULT_QUICK_PROMPTS };
    }
  }

  static getProviders() {
    return Object.entries(ObjectProviders).map(([id, p]) => ({
      id,
      label: p.label,
      defaultUrl: p.defaultUrl,
      defaultModel: p.defaultModel,
      format: p.format,
      models: p.models,
    }));
  }

  static async getConfig() {
    const db = getDb();
    const cursor = await db.query(
      `FOR c IN system_config FILTER c.key IN @keys RETURN { key: c.key, value: c.value }`,
      { keys: AI_CONFIG_KEYS }
    );
    const items = await cursor.all();
    const config: any = {};
    for (const item of items) config[item.key] = item.value;
    if (!config.ai_quick_prompts) {
      config.ai_quick_prompts = JSON.stringify(DEFAULT_QUICK_PROMPTS);
    }
    return config;
  }

  static async updateConfig(updates: Record<string, string>) {
    const db = getDb();
    for (const [key, value] of Object.entries(updates)) {
      if (!AI_CONFIG_KEYS.includes(key)) continue;
      if (key === 'ai_api_key' && value === '••••••••') continue;
      await db.query(
        `UPSERT { key: @k } INSERT { key: @k, value: @v } UPDATE { value: @v } IN system_config`,
        { k: key, v: String(value) }
      );
    }
  }

  static async testConnection() {
    const config = await this.getConfig();
    if (!config.ai_provider || !config.ai_api_url) {
      throw new Error('AI provider not configured');
    }
    return await this.sendToProvider(config, [{ role: 'user', content: 'Réponds uniquement "OK".' }]);
  }

  static async chat(messages: any[], context?: string) {
    const config = await this.getConfig();
    if (config.ai_enabled !== 'true') {
      throw new Error('AI is not enabled. Ask your administrator.');
    }

    let systemPrompt = config.ai_system_prompt || DEFAULT_SYSTEM_PROMPT;
    if (context) {
      systemPrompt += '\n\n--- CONTEXTE DU DOSSIER ---\n' + context;
    }

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    return await this.sendToProvider(config, fullMessages);
  }

  static async suggestKillchain(description: string, linkedObjects?: string) {
    const config = await this.getConfig();
    if (config.ai_enabled !== 'true') {
      throw new Error('AI is not enabled');
    }

    const prompt = `Analyse cet événement de sécurité et suggère la phase Kill Chain la plus appropriée.
Réponds UNIQUEMENT avec le code de la phase parmi: reconnaissance, delivery, exploitation, installation, c2, actions_on_objectives, ukc_reconnaissance, ukc_resource_development, ukc_initial_access, ukc_execution, ukc_persistence, ukc_privilege_escalation, ukc_defense_evasion, ukc_credential_access, ukc_discovery, ukc_lateral_movement, ukc_collection, ukc_c2, ukc_exfiltration, ukc_impact.

Description: ${description}
${linkedObjects ? `Objets liés: ${linkedObjects}` : ''}

Réponds avec un JSON: {"phase": "code_phase", "confidence": 0.85, "reasoning": "explication courte"}`;

    const result = await this.sendToProvider(config, [
      { role: 'system', content: 'Tu es un expert en classification Kill Chain. Réponds uniquement en JSON.' },
      { role: 'user', content: prompt },
    ]);

    try {
      const jsonMatch = result.match(/\\{[\\s\\S]*\\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { phase: null, confidence: 0, reasoning: result };
    } catch {
      return { phase: null, confidence: 0, reasoning: result };
    }
  }

  private static async sendToProvider(config: any, messages: any[], stream = false): Promise<string> {
    const provider = (ObjectProviders as any)[config.ai_provider] || ObjectProviders.custom;
    const format = provider.format;
    const url = config.ai_api_url || provider.defaultUrl;
    const model = config.ai_model || provider.defaultModel;
    const apiKey = config.ai_api_key || '';
    const temperature = parseFloat(config.ai_temperature || '0.3');
    const maxTokens = parseInt(config.ai_max_tokens || '2048', 10);

    if (format === 'gemini') {
      return await this.sendGemini(url, apiKey, model, messages, temperature, maxTokens);
    } else if (format === 'anthropic') {
      return await this.sendAnthropic(url, apiKey, model, messages, temperature, maxTokens);
    } else {
      return await this.sendOpenAI(url, apiKey, model, messages, temperature, maxTokens);
    }
  }

  private static async sendOpenAI(baseUrl: string, apiKey: string, model: string, messages: any[], temperature: number, maxTokens: number) {
    const endpoint = `${baseUrl}/chat/completions`;
    const headers: any = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 200)}`);
    }
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private static async sendGemini(baseUrl: string, apiKey: string, model: string, messages: any[], temperature: number, maxTokens: number) {
    const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const systemInstruction = messages.find((m) => m.role === 'system');

    const body: any = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 200)}`);
    }
    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private static async sendAnthropic(baseUrl: string, apiKey: string, model: string, messages: any[], temperature: number, maxTokens: number) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMsg?.content || '',
        messages: chatMessages,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 200)}`);
    }
    const data: any = await response.json();
    return data.content?.[0]?.text || '';
  }
}
