import React from 'react';
import { PlayCircle, GitCompare, Network, X, BookOpen, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'congestion' | 'compare' | 'build') => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onSelectOption,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Welcome to NetLab</h2>
            <p className="text-xs text-slate-400">
              Interactive Congestion Detection & Traffic Rerouting Simulator
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-6 leading-relaxed">
          NetLab simulates discrete packet events across computer networks. Explore how router buffers fill, how TCP Tahoe, Reno, and CUBIC react to loss, and how dynamic routing diverts traffic away from congested bottlenecks.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => onSelectOption('congestion')}
            className="flex flex-col items-start p-4 rounded-xl bg-slate-950/60 hover:bg-blue-600/10 border border-slate-800 hover:border-blue-500/50 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 mb-3 group-hover:scale-110 transition-transform">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div className="font-semibold text-xs text-slate-200 mb-1">See Congestion Happen</div>
            <div className="text-[11px] text-slate-400">
              Launch shared bottleneck with buffer overflow and timeouts.
            </div>
          </button>

          <button
            onClick={() => onSelectOption('compare')}
            className="flex flex-col items-start p-4 rounded-xl bg-slate-950/60 hover:bg-blue-600/10 border border-slate-800 hover:border-blue-500/50 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 mb-3 group-hover:scale-110 transition-transform">
              <GitCompare className="w-5 h-5" />
            </div>
            <div className="font-semibold text-xs text-slate-200 mb-1">Compare Protocols</div>
            <div className="text-[11px] text-slate-400">
              Run Tahoe vs Reno vs CUBIC under identical network conditions.
            </div>
          </button>

          <button
            onClick={() => onSelectOption('build')}
            className="flex flex-col items-start p-4 rounded-xl bg-slate-950/60 hover:bg-blue-600/10 border border-slate-800 hover:border-blue-500/50 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
              <Network className="w-5 h-5" />
            </div>
            <div className="font-semibold text-xs text-slate-200 mb-1">Build My Own Network</div>
            <div className="text-[11px] text-slate-400">
              Start with empty canvas and create custom nodes and links.
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            Based on Unit 3 Lecture Slides
          </span>
          <button
            onClick={onClose}
            className="text-blue-400 hover:underline font-medium"
          >
            Skip to simulator ➔
          </button>
        </div>
      </div>
    </div>
  );
};
