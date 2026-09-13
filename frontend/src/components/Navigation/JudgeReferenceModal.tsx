'use client';

interface JudgeReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JudgeReferenceModal({ isOpen, onClose }: JudgeReferenceModalProps) {
  if (!isOpen) return null;

  const DEFENSE_QA = [
    {
      q: 'Is this real marine data?',
      a: 'Weather and wave telemetry utilize real Open-Meteo Marine API endpoints and NOAA ERDDAP SST datasets when online. PFZ zones and maritime boundaries use high-resolution Kerala coastal GeoJSON. System seamlessly falls back to local cache if disconnected.'
    },
    {
      q: 'Why not use Gemini / LLM to make the safety decisions?',
      a: 'Safety-critical maritime decisions must be 100% deterministic, auditable, and mathematically reproducible. Python code calculates rules, boundary geofences, and safety scores. Gemini is strictly utilized for natural language understanding and translating complex telemetry into intuitive explanations.'
    },
    {
      q: 'What makes ORCA fundamentally different from an AI chatbot?',
      a: 'A chatbot produces static text and forgets context. ORCA transforms advice into a persistent "Living Decision Object" with an immutable baseline snapshot, watches the justification conditions over time, alerts when personalized safety limits are crossed, and computes verified repair alternatives.'
    },
    {
      q: 'Why SQLite instead of PostgreSQL/PostGIS in this prototype?',
      a: 'SQLite with WAL mode delivers zero-setup, self-contained, lightning-fast persistence ideal for an edge prototype with zero server operational overhead. Production architecture includes a direct migration path to PostgreSQL/PostGIS.'
    },
    {
      q: 'How does ORCA protect against AI hallucinations?',
      a: 'ORCA implements strict prompt grounding: Gemini prompt templates receive exact numerical floats (wave, wind, score, verdict) and are constrained by strict system prompts never to alter the deterministic safety status.'
    }
  ];

  return (
    <div className="fixed inset-0 z-[4500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl text-xs font-sans text-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
              <span>🏛️</span> System Architecture & Technical Specifications
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enterprise architectural verification & safety guarantees (Section 30)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        {/* Core Principles Callout */}
        <div className="p-3 bg-blue-950/60 border border-blue-800/80 rounded-lg text-blue-200 text-xs shrink-0 space-y-1 font-mono">
          <div className="text-cyan-300 font-bold">CORE ARCHITECTURAL PRINCIPLE:</div>
          <div>&ldquo;AI understands and explains. Code calculates and decides.&rdquo;</div>
          <div>&ldquo;ORCA is not a chatbot with marine data — it is a decision system with an AI layer.&rdquo;</div>
        </div>

        {/* Q&A List */}
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          {DEFENSE_QA.map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
              <strong className="text-cyan-300 block text-xs font-semibold">
                Q{idx + 1}: &ldquo;{item.q}&rdquo;
              </strong>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
}
