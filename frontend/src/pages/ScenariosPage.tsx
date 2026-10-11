import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowRight, Play, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { ScenarioMeta } from '../types';
import { listScenarios } from '../services/api';

interface ScenariosPageProps {
  onLoadScenario: (scenarioId: string) => void;
  onOpenHelpDesk: (key?: string) => void;
}

export const ScenariosPage: React.FC<ScenariosPageProps> = ({ onLoadScenario, onOpenHelpDesk }) => {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>('scenario_1_flow_vs_congestion');

  useEffect(() => {
    listScenarios().then((data: ScenarioMeta[]) => {
      setScenarios(data);
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, []);

  const selectedScenario = scenarios.find((s) => s.id === selectedId) || scenarios[0];

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-950">
      {/* Left List of Scenarios */}
      <div className="w-full md:w-80 border-r border-slate-800 bg-slate-900/60 overflow-y-auto p-4 space-y-2">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span>Guided Scenario Library</span>
        </div>

        {scenarios.map((sc) => (
          <button
            key={sc.id}
            onClick={() => setSelectedId(sc.id)}
            className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
              selectedId === sc.id
                ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {sc.category}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="font-bold truncate text-slate-100">{sc.title}</div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">{sc.subtitle}</div>
          </button>
        ))}
      </div>

      {/* Right Detailed Walkthrough */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {selectedScenario && (
          <div className="max-w-3xl space-y-6">
            <div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 uppercase font-semibold">
                {selectedScenario.category}
              </span>
              <h1 className="text-2xl font-bold text-white mt-2">{selectedScenario.title}</h1>
              <p className="text-sm text-slate-300 mt-1 font-medium">{selectedScenario.subtitle}</p>
              <div className="text-xs text-slate-400 mt-1">
                Slide Reference: <strong className="text-slate-200">{selectedScenario.slides_reference}</strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs leading-relaxed text-slate-300">
              <div className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                Educational Background & Objective
              </div>
              <p>{selectedScenario.description}</p>
            </div>

            {/* Guided Step-by-Step Instructions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Guided Experiment Steps
              </h3>
              <div className="space-y-2">
                {selectedScenario.guided_steps.map((step: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-800 flex items-center gap-4">
              <button
                onClick={() => onLoadScenario(selectedScenario.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-900/40"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Load Scenario into Network Lab</span>
              </button>

              <button
                onClick={() => onOpenHelpDesk(selectedScenario.category)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors"
              >
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>Read Help Desk Notes</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
