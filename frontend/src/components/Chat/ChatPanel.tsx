'use client';

import { useState } from 'react';
import { ChatMessage, DecisionResult, GeoLocation, ZoneInfo, DecisionObject } from '@/lib/types';
import { sendQuery, trackDecision } from '@/lib/api';

interface ChatPanelProps {
  userOrigin: GeoLocation;
  zones: ZoneInfo[];
  trackedDecisions: DecisionObject[];
  onDecisionReceived: (decision: DecisionResult, zoneId: string) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
}

const QUICK_PROMPTS = [
  'Kal subah fishing ke liye kahan jaana chahiye?',
  'Is Zone B safe tomorrow morning?',
  'Tell me whether I should go to Zone A or Zone B',
  'Zone B kab suitable hoga?',
];

export default function ChatPanel({
  userOrigin,
  zones,
  trackedDecisions,
  onDecisionReceived,
  onDecisionTracked,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'orca',
      text: 'Namaste! I am ORCA, your marine decision support assistant. You can ask me where to fish tomorrow, check if a specific zone is safe, or ask in Hindi/Hinglish.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendQuery(textToSend, undefined, userOrigin);

      const orcaMsg: ChatMessage = {
        id: `orca-${Date.now()}`,
        sender: 'orca',
        text: response.explanation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: response.intent,
        decision: response.decision,
        suggested_action: response.suggested_action,
      };

      setMessages((prev) => [...prev, orcaMsg]);

      if (response.decision) {
        onDecisionReceived(response.decision, response.decision.zone_id);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'orca',
        text: 'Natural-language assistant encountered an error. You can still select and evaluate zones manually on the map.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackFromChat = async (decision: DecisionResult, msgId: string) => {
    setTrackingId(msgId);
    try {
      const res = await trackDecision({
        decision_result: decision,
        zone_id: decision.zone_id,
        user_id: 'user_demo_fisherman',
        user_name: 'Raju (Fisherman)',
        origin: userOrigin,
        planned_start: new Date().toISOString(),
      });
      onDecisionTracked(res.decision);
    } catch (err: any) {
      console.error('Failed to track decision from chat:', err);
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between h-[540px] shadow-2xl backdrop-blur">
      {/* Chat Header */}
      <div className="pb-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="font-bold text-white text-xs">Conversational AI Layer</h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Gemini 2.5 • Multilingual
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto py-2.5 space-y-3 pr-1 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] p-3 rounded-2xl ${
                m.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-950/50'
                  : 'bg-slate-950/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
              }`}
            >
              {m.sender === 'orca' && m.intent && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-cyan-400 font-mono">
                    Intent: {m.intent.intent} ({m.intent.language})
                  </span>
                </div>
              )}

              <p className="leading-relaxed whitespace-pre-wrap text-xs">{m.text}</p>

              {m.decision && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-white">
                      {m.decision.zone_name}:{' '}
                      <strong
                        className={
                          m.decision.status === 'GO'
                            ? 'text-emerald-400'
                            : m.decision.status === 'CAUTION'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {m.decision.status} ({m.decision.score}/100)
                      </strong>
                    </span>
                  </div>

                  {/* Inline Track Button inside Chat */}
                  {trackedDecisions.some((d) => d.mission.zone_id === m.decision?.zone_id && d.lifecycle_status === 'TRACKING') ? (
                    <span className="inline-block text-[10px] text-emerald-400 font-mono font-semibold">
                      ✓ Decision Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => m.decision && handleTrackFromChat(m.decision, m.id)}
                      disabled={trackingId === m.id}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg font-mono transition-all flex items-center gap-1 shadow-md"
                    >
                      {trackingId === m.id ? (
                        <span>Registering...</span>
                      ) : (
                        <span>📌 Track Decision</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-2xl rounded-bl-none max-w-[85%] text-xs text-slate-400">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
            <span>ORCA reasoning over marine conditions...</span>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(p)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 hover:border-cyan-600 text-slate-300 whitespace-nowrap transition-all flex-shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5 mt-1"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask in English, Hindi, or Hinglish..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-cyan-950 flex items-center justify-center"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
