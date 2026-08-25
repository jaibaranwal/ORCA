'use client';

import { useState } from 'react';
import { ChatMessage, DecisionResult, GeoLocation, ZoneInfo, DecisionObject } from '@/lib/types';
import { sendQuery, trackDecision } from '@/lib/api';

interface AskOrcaModalProps {
  userOrigin: GeoLocation;
  zones: ZoneInfo[];
  trackedDecisions: DecisionObject[];
  onClose: () => void;
  onDecisionReceived: (decision: DecisionResult, zoneId: string) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
}

const QUICK_PROMPTS = [
  'Kal subah fishing ke liye kahan jaana chahiye?',
  'Is Zone B safe tomorrow morning?',
  'Zone B kab suitable hoga?',
  'What are the wave conditions right now?',
];

export default function AskOrcaModal({
  userOrigin,
  zones,
  trackedDecisions,
  onClose,
  onDecisionReceived,
  onDecisionTracked,
}: AskOrcaModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'orca',
      text: 'Namaste Raju! I am ORCA — your marine decision intelligence assistant. Ask me where to fish tomorrow, check if a specific sector is safe, or inquire in Hindi, Hinglish, or English.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendQuery(textToSend, undefined, userOrigin);

      const orcaMsgId = `orca-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const orcaMsg: ChatMessage = {
        id: orcaMsgId,
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
        text: 'Natural-language intelligence query failed. Please select a sector on the map to evaluate directly.',
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
    } catch (err) {
      console.error('Failed to track decision from chat:', err);
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full h-[600px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider">
                Ask ORCA (Marine Intelligence)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Multilingual Conversational Interface • English / Hindi / Hinglish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl ${
                  m.sender === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-950/40'
                    : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
                }`}
              >
                {m.sender === 'orca' && m.intent && (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[9px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-mono">
                      Intent: {m.intent.intent} ({m.intent.language})
                    </span>
                  </div>
                )}

                <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.text}</p>

                {m.decision && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white font-mono">
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onDecisionReceived(m.decision!, m.decision!.zone_id);
                          onClose();
                        }}
                        className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-[10px] font-bold rounded-lg font-mono transition-all"
                      >
                        🗺️ View on Map
                      </button>

                      {trackedDecisions.some((d) => d.mission.zone_id === m.decision?.zone_id && d.lifecycle_status !== 'CANCELLED') ? (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          ✓ Tracking Active
                        </span>
                      ) : (
                        <button
                          onClick={() => m.decision && handleTrackFromChat(m.decision, m.id)}
                          disabled={trackingId === m.id}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg font-mono transition-all"
                        >
                          {trackingId === m.id ? 'Registering...' : '📌 Track Decision'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">{m.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl rounded-bl-none max-w-[80%] text-xs text-slate-400 font-mono">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
              <span>ORCA reasoning over marine observations...</span>
            </div>
          )}
        </div>

        {/* Quick Prompts & Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSend(p)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-cyan-600 text-slate-300 whitespace-nowrap transition-all font-mono"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English, Hindi, or Hinglish..."
              disabled={loading}
              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all shadow-md font-mono"
            >
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
