const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../utils/access');

const router = express.Router();

// ─── AI Config keys in system_config ───
const AI_CONFIG_KEYS = [
    'ai_enabled', 'ai_provider', 'ai_api_url', 'ai_api_key',
    'ai_model', 'ai_temperature', 'ai_max_tokens', 'ai_system_prompt',
];

const DEFAULT_SYSTEM_PROMPT = `Tu es un analyste CTI (Cyber Threat Intelligence) senior spécialisé en réponse à incident.
Tu aides l'analyste à investiguer en te basant sur le contexte du dossier fourni.
Réponds toujours en français, de manière concise et technique.
Utilise le vocabulaire ANSSI/CERT-FR quand c'est pertinent.`;

// ─── Providers config ───
const PROVIDERS = {
    openai: { label: 'OpenAI (GPT)', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', format: 'openai', models: [
        'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini',
    ]},
    google: { label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.0-flash', format: 'gemini', models: [
        'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite',
    ]},
    mistral: { label: 'Mistral AI', defaultUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large-latest', format: 'openai', models: [
        'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo', 'codestral-latest',
    ]},
    anthropic: { label: 'Anthropic (Claude)', defaultUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', format: 'anthropic', models: [
        'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
    ]},
    ollama: { label: 'Ollama (local)', defaultUrl: process.env.OLLAMA_URL || 'http://ollama:11434/v1', defaultModel: 'mistral-nemo', format: 'openai', models: [
        'mistral-nemo', 'mistral:7b', 'llama3:8b', 'llama3:70b', 'gemma2:9b', 'phi3:mini', 'qwen2:7b', 'deepseek-r1:8b', 'deepseek-coder-v2:lite', 'codellama:7b',
    ]},
    groq: { label: 'Groq (gratuit)', defaultUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', format: 'openai', models: [
        'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b',
    ]},
    openrouter: { label: 'OpenRouter (gratuit)', defaultUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.0-flash-exp:free', format: 'openai', models: [
        'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free', 'deepseek/deepseek-r1:free',
    ]},
    custom: { label: 'Custom (OpenAI-compatible)', defaultUrl: '', defaultModel: '', format: 'openai', models: [] },
};

// ─── GET /status — check if AI is enabled (any authenticated user) ───
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const row = await db('system_config').where({ key: 'ai_enabled' }).select('value').first();
        res.json({ enabled: row?.value === 'true' });
    } catch { res.json({ enabled: false }); }
});

// ─── GET /providers — list available providers ───
router.get('/providers', authenticateToken, (req, res) => {
    const list = Object.entries(PROVIDERS).map(([id, p]) => ({
        id, label: p.label, defaultUrl: p.defaultUrl, defaultModel: p.defaultModel, format: p.format, models: p.models,
    }));
    res.json(list);
});

// ─── GET /config — get AI config (admin only) ───
router.get('/config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const items = await db('system_config').whereIn('key', AI_CONFIG_KEYS).select('key', 'value');
        const config = {};
        for (const item of items) {
            config[item.key] = item.key === 'ai_api_key' ? '••••••••' : item.value;
        }
        res.json(config);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── PUT /config — update AI config (admin only) ───
router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            if (!AI_CONFIG_KEYS.includes(key)) continue;
            // Don't overwrite key if masked
            if (key === 'ai_api_key' && value === '••••••••') continue;
            await db('system_config').insert({ key, value: String(value) }).onConflict('key').merge({ value: String(value) });
        }
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── POST /test — test connection to AI provider ───
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const config = await getAiConfig();
        if (!config.ai_provider || !config.ai_api_url) {
            return res.status(400).json({ error: 'AI provider not configured' });
        }
        const result = await sendToProvider(config, [{ role: 'user', content: 'Réponds uniquement "OK".' }], false);
        res.json({ success: true, response: result });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Connection failed' });
    }
});

// ─── POST /chat — chat with context ───
router.post('/chat', authenticateToken, async (req, res) => {
    try {
        const config = await getAiConfig();
        if (config.ai_enabled !== 'true') {
            return res.status(403).json({ error: 'AI is not enabled. Ask your administrator.' });
        }

        const { messages, context } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        // Build system prompt with context
        let systemPrompt = config.ai_system_prompt || DEFAULT_SYSTEM_PROMPT;
        if (context) {
            systemPrompt += '\n\n--- CONTEXTE DU DOSSIER ---\n' + context;
        }

        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages,
        ];

        // Use non-streaming for reliability (Ollama CPU can be slow)
        const result = await sendToProvider(config, fullMessages, false);

        // Send as SSE format for frontend compatibility
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.write(`data: ${JSON.stringify({ content: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        console.error('[AI] Chat error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'AI request failed' });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
});

// ─── POST /suggest-killchain — suggest kill chain phase from description ───
router.post('/suggest-killchain', authenticateToken, async (req, res) => {
    try {
        const config = await getAiConfig();
        if (config.ai_enabled !== 'true') {
            return res.status(403).json({ error: 'AI is not enabled' });
        }

        const { description, linkedObjects } = req.body;
        if (!description) return res.status(400).json({ error: 'description is required' });

        const prompt = `Analyse cet événement de sécurité et suggère la phase Kill Chain la plus appropriée.
Réponds UNIQUEMENT avec le code de la phase parmi: reconnaissance, delivery, exploitation, installation, c2, actions_on_objectives, ukc_reconnaissance, ukc_resource_development, ukc_initial_access, ukc_execution, ukc_persistence, ukc_privilege_escalation, ukc_defense_evasion, ukc_credential_access, ukc_discovery, ukc_lateral_movement, ukc_collection, ukc_c2, ukc_exfiltration, ukc_impact.

Description: ${description}
${linkedObjects ? `Objets liés: ${linkedObjects}` : ''}

Réponds avec un JSON: {"phase": "code_phase", "confidence": 0.85, "reasoning": "explication courte"}`;

        const result = await sendToProvider(config, [
            { role: 'system', content: 'Tu es un expert en classification Kill Chain. Réponds uniquement en JSON.' },
            { role: 'user', content: prompt },
        ], false);

        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                res.json(JSON.parse(jsonMatch[0]));
            } else {
                res.json({ phase: null, confidence: 0, reasoning: result });
            }
        } catch {
            res.json({ phase: null, confidence: 0, reasoning: result });
        }
    } catch (err) {
        res.status(500).json({ error: err.message || 'AI request failed' });
    }
});

// ========== Provider Adapters ==========

async function getAiConfig() {
    const items = await db('system_config').whereIn('key', AI_CONFIG_KEYS).select('key', 'value');
    const config = {};
    for (const item of items) config[item.key] = item.value;
    return config;
}

async function sendToProvider(config, messages, stream = false) {
    const provider = PROVIDERS[config.ai_provider] || PROVIDERS.custom;
    const format = provider.format;
    const url = config.ai_api_url || provider.defaultUrl;
    const model = config.ai_model || provider.defaultModel;
    const apiKey = config.ai_api_key || '';
    const temperature = parseFloat(config.ai_temperature || '0.3');
    const maxTokens = parseInt(config.ai_max_tokens || '2048', 10);

    if (format === 'gemini') {
        return await sendGemini(url, apiKey, model, messages, temperature, maxTokens, stream);
    } else if (format === 'anthropic') {
        return await sendAnthropic(url, apiKey, model, messages, temperature, maxTokens, stream);
    } else {
        return await sendOpenAI(url, apiKey, model, messages, temperature, maxTokens, stream);
    }
}

async function streamFromProvider(config, messages, res) {
    const provider = PROVIDERS[config.ai_provider] || PROVIDERS.custom;
    const format = provider.format;
    const url = config.ai_api_url || provider.defaultUrl;
    const model = config.ai_model || provider.defaultModel;
    const apiKey = config.ai_api_key || '';
    const temperature = parseFloat(config.ai_temperature || '0.3');
    const maxTokens = parseInt(config.ai_max_tokens || '2048', 10);

    if (format === 'gemini') {
        await streamGemini(url, apiKey, model, messages, temperature, maxTokens, res);
    } else if (format === 'anthropic') {
        await streamAnthropic(url, apiKey, model, messages, temperature, maxTokens, res);
    } else {
        await streamOpenAI(url, apiKey, model, messages, temperature, maxTokens, res);
    }
}

// ── OpenAI / Ollama / Mistral (OpenAI-compatible) ──

async function sendOpenAI(baseUrl, apiKey, model, messages, temperature, maxTokens) {
    const endpoint = `${baseUrl}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
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
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function streamOpenAI(baseUrl, apiKey, model, messages, temperature, maxTokens, res) {
    const endpoint = `${baseUrl}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const reader = response.body;
    let buffer = '';
    for await (const chunk of reader) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            } catch { /* skip invalid JSON chunks */ }
        }
    }
}

// ── Google Gemini ──

async function sendGemini(baseUrl, apiKey, model, messages, temperature, maxTokens) {
    const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
    const systemInstruction = messages.find(m => m.role === 'system');

    const body = {
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
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function streamGemini(baseUrl, apiKey, model, messages, temperature, maxTokens, res) {
    const endpoint = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
    const systemInstruction = messages.find(m => m.role === 'system');

    const body = {
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

    const reader = response.body;
    let buffer = '';
    for await (const chunk of reader) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
                const parsed = JSON.parse(trimmed.slice(6));
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            } catch { /* skip */ }
        }
    }
}

// ── Anthropic (Claude) ──

async function sendAnthropic(baseUrl, apiKey, model, messages, temperature, maxTokens) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role, content: m.content,
    }));

    const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model, max_tokens: maxTokens, temperature,
            system: systemMsg?.content || '',
            messages: chatMessages,
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 200)}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || '';
}

async function streamAnthropic(baseUrl, apiKey, model, messages, temperature, maxTokens, res) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role, content: m.content,
    }));

    const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model, max_tokens: maxTokens, temperature, stream: true,
            system: systemMsg?.content || '',
            messages: chatMessages,
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const reader = response.body;
    let buffer = '';
    for await (const chunk of reader) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    res.write(`data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`);
                }
            } catch { /* skip */ }
        }
    }
}

module.exports = router;
