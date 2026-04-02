import { useState, useRef, useEffect, useCallback } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { Bot, Send, X, Loader2, Sparkles, Trash2, ChevronDown } from 'lucide-react';
import { marked } from 'marked';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskContext {
  caseTitle: string;
  taskTitle: string;
  events: Array<{
    description?: string;
    event_datetime: string;
    kill_chain?: string;
  }>;
  systems: Array<{ name: string; system_type?: string; investigation_status?: string }>;
  malware: Array<{ file_name: string; description?: string }>;
  accounts: Array<{ account_name: string; domain?: string; privileges?: string }>;
  indicators: Array<{ ip?: string; domain_name?: string; url?: string; context?: string }>;
  exfiltrations: Array<{ file_name?: string; content_description?: string }>;
  diamondNodes: Array<{
    label: string;
    killChainPhaseLabel: string;
    axes: {
      adversary: Array<{ label: string; type: string }>;
      infrastructure: Array<{ label: string; type: string }>;
      capability: Array<{ label: string; type: string }>;
      victim: Array<{ label: string; type: string }>;
    };
  }>;
}

interface AiChatPanelProps {
  context: TaskContext;
  onClose: () => void;
}

function buildContextString(ctx: TaskContext): string {
  const parts: string[] = [];

  parts.push(`## Dossier: ${ctx.caseTitle}`);
  parts.push(`## Tâche: ${ctx.taskTitle}`);

  // Timeline
  if (ctx.events.length > 0) {
    parts.push('\n## Chronologie');
    ctx.events.forEach((e) => {
      parts.push(`- ${e.event_datetime} | ${e.kill_chain || 'N/A'} | ${e.description || '(sans description)'}`);
    });
  }

  // Diamond Model
  if (ctx.diamondNodes.length > 0) {
    parts.push('\n## Modèle Diamant (par événement)');
    ctx.diamondNodes.forEach((node, i) => {
      parts.push(`\n### Événement ${i + 1}: ${node.label} [${node.killChainPhaseLabel}]`);
      if (node.axes.adversary.length > 0) {
        parts.push(`  Adversaire: ${node.axes.adversary.map((o) => `${o.label} (${o.type})`).join(', ')}`);
      }
      if (node.axes.infrastructure.length > 0) {
        parts.push(`  Infrastructure: ${node.axes.infrastructure.map((o) => `${o.label} (${o.type})`).join(', ')}`);
      }
      if (node.axes.capability.length > 0) {
        parts.push(`  Capacité: ${node.axes.capability.map((o) => `${o.label} (${o.type})`).join(', ')}`);
      }
      if (node.axes.victim.length > 0) {
        parts.push(`  Victime: ${node.axes.victim.map((o) => `${o.label} (${o.type})`).join(', ')}`);
      }
    });
  }

  // Systems
  if (ctx.systems.length > 0) {
    parts.push('\n## Systèmes impliqués');
    ctx.systems.forEach((s) => {
      parts.push(`- ${s.name} (${s.system_type || 'type inconnu'}) — statut: ${s.investigation_status || 'non défini'}`);
    });
  }

  // Malware
  if (ctx.malware.length > 0) {
    parts.push('\n## Malwares / Outils');
    ctx.malware.forEach((m) => {
      parts.push(`- ${m.file_name}${m.description ? ` — ${m.description}` : ''}`);
    });
  }

  // Accounts
  if (ctx.accounts.length > 0) {
    parts.push('\n## Comptes compromis');
    ctx.accounts.forEach((a) => {
      parts.push(`- ${a.account_name}${a.domain ? `@${a.domain}` : ''} (${a.privileges || 'privileges inconnues'})`);
    });
  }

  // Indicators
  if (ctx.indicators.length > 0) {
    parts.push('\n## Indicateurs réseau');
    ctx.indicators.forEach((ind) => {
      const val = ind.ip || ind.domain_name || ind.url || 'N/A';
      parts.push(`- ${val}${ind.context ? ` — ${ind.context}` : ''}`);
    });
  }

  // Exfiltrations
  if (ctx.exfiltrations.length > 0) {
    parts.push('\n## Exfiltrations');
    ctx.exfiltrations.forEach((ex) => {
      parts.push(`- ${ex.file_name || 'fichier inconnu'}${ex.content_description ? ` — ${ex.content_description}` : ''}`);
    });
  }

  return parts.join('\n');
}

const QUICK_PROMPTS = [
  { label: 'Résumer la timeline', prompt: 'Résume cette chronologie en 5 points clés pour le rapport de réponse à incident.' },
  { label: 'Analyser le Diamant', prompt: 'Analyse le Modèle Diamant de ce dossier. Identifie les axes incomplets, les corrélations entre événements, et les relations adversaire-infrastructure qui pourraient passer inaperçues.' },
  { label: 'Points aveugles', prompt: 'En tant qu\'expert CTI, quels sont les angles morts de cette investigation ? Quelles pistes l\'analyste n\'a peut-être pas explorées ? Quels événements manquent potentiellement dans la chronologie ?' },
  { label: 'Suggérer des TTPs', prompt: 'Quels TTPs MITRE ATT&CK correspondent aux activités observées dans ce dossier ? Propose une matrice des techniques identifiées.' },
  { label: 'Rédiger la synthèse', prompt: 'Rédige une synthèse technique de ce cas au format ANSSI/CERT-FR, incluant : le résumé, la chronologie, les IOCs, et les recommandations.' },
];

function renderMarkdown(text: string): string {
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(text) as string;
}

export function AiChatPanel({ context, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      const contextStr = buildContextString(context);
      const controller = new AbortController();
      abortRef.current = controller;

      const token = localStorage.getItem('oris_token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context: contextStr,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = `Erreur ${response.status}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error) errMsg = errJson.error;
        } catch {
          if (errText) errMsg += `: ${errText.slice(0, 100)}`;
        }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                accumulated += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                  return updated;
                });
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Erreur de connexion à l\'IA');
      setMessages((prev) => prev.slice(0, -1)); // Remove empty assistant message
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">Assistant IA</span>
          <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">CTI</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="p-1.5 text-gray-500 hover:text-red-500 transition rounded"
              title="Effacer la conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-600 dark:hover:text-white transition rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-10 h-10 text-purple-300 dark:text-purple-700 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Assistant CTI</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 max-w-[240px]">
              Le contexte du dossier (Diamant, timeline, IOCs) est automatiquement partagé avec l'IA.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap bg-purple-600 text-white rounded-br-sm">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm border border-gray-200 dark:border-slate-700">
                {msg.content ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:before:content-none prose-code:after:content-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(msg.content)) }}
                  />
                ) : streaming && i === messages.length - 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                ) : null}
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="text-center text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll indicator */}
      {messages.length > 3 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full p-1.5 shadow-md hover:shadow-lg transition"
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur le dossier..."
            rows={1}
            className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-24"
            style={{ minHeight: '38px' }}
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
