import React, { useState, useEffect } from 'react';
import { X, Search, BookOpen, ChevronRight, HelpCircle, Table } from 'lucide-react';
import { HelpDeskTopic } from '../../types';
import { searchHelpDesk } from '../../services/api';

interface HelpDeskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopicKey?: string | null;
}

export const HelpDeskDrawer: React.FC<HelpDeskDrawerProps> = ({
  isOpen,
  onClose,
  initialTopicKey,
}) => {
  const [topics, setTopics] = useState<HelpDeskTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpDeskTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTopics(searchQuery);
    }
  }, [isOpen, searchQuery]);

  const loadTopics = async (q: string) => {
    setIsLoading(true);
    try {
      const results = await searchHelpDesk(q);
      setTopics(results);
      if (initialTopicKey && !selectedTopic) {
        const found = results.find(
          (t) =>
            t.id.toLowerCase().includes(initialTopicKey.toLowerCase()) ||
            t.title.toLowerCase().includes(initialTopicKey.toLowerCase())
        );
        if (found) setSelectedTopic(found);
      } else if (!selectedTopic && results.length > 0) {
        setSelectedTopic(results[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Integrated Help Desk</h2>
            <p className="text-[11px] text-slate-400">Searchable Networking Manual & Mechanism Tables</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search & Level Bar */}
      <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search topics (e.g. Tahoe, Reno, CUBIC, cwnd, ECN, drops)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 3 Difficulty Levels Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Explanation Depth:</span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setDifficulty('beginner')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                difficulty === 'beginner'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Beginner
            </button>
            <button
              onClick={() => setDifficulty('intermediate')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                difficulty === 'intermediate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Intermediate
            </button>
            <button
              onClick={() => setDifficulty('advanced')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                difficulty === 'advanced'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      {/* Main Body: Topic List & Detail View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Topic List (35%) */}
        <div className="w-2/5 border-r border-slate-800 overflow-y-auto p-2 space-y-1">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(t)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                selectedTopic?.id === t.id
                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="truncate pr-1">
                <div className="truncate">{t.title}</div>
                <div className="text-[10px] text-slate-500 truncate">{t.category}</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Right Topic Detail (65%) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-950/40">
          {selectedTopic ? (
            <>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 uppercase font-bold">
                  {selectedTopic.category}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-2">{selectedTopic.title}</h3>
                <div className="text-[11px] text-slate-400 mt-1">
                  Reference: <em>{selectedTopic.slides_ref}</em>
                </div>
              </div>

              {/* Explanations according to difficulty level */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs leading-relaxed text-slate-200 space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{difficulty.toUpperCase()} EXPLANATION</span>
                </div>
                <p>
                  {difficulty === 'beginner' && selectedTopic.beginner}
                  {difficulty === 'intermediate' && selectedTopic.intermediate}
                  {difficulty === 'advanced' && selectedTopic.advanced}
                </p>
              </div>

              {/* 6-Column Mechanism Explanation Table */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span>Mechanism Execution Table</span>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs">
                  <div className="divide-y divide-slate-800">
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Mechanism:</span>
                      <span className="col-span-2 text-slate-200 font-semibold">{selectedTopic.table.mechanism}</span>
                    </div>
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Trigger:</span>
                      <span className="col-span-2 text-amber-300 font-mono">{selectedTopic.table.trigger}</span>
                    </div>
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Internal State:</span>
                      <span className="col-span-2 text-blue-300 font-mono">{selectedTopic.table.internal_state}</span>
                    </div>
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Action:</span>
                      <span className="col-span-2 text-slate-200">{selectedTopic.table.action}</span>
                    </div>
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Observable Effect:</span>
                      <span className="col-span-2 text-emerald-300">{selectedTopic.table.observable_effect}</span>
                    </div>
                    <div className="p-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Why it matters:</span>
                      <span className="col-span-2 text-slate-300">{selectedTopic.table.why_it_matters}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Select a topic on the left to inspect its mechanisms and explanations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
