import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  GitCompare,
  BookOpen,
  FolderCheck,
  HelpCircle,
  Sun,
  Moon,
  Sparkles,
  Network,
} from 'lucide-react';

import { NetworkLabPage } from './pages/NetworkLabPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProtocolComparisonPage } from './pages/ProtocolComparisonPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { HelpDeskDrawer } from './components/helpdesk/HelpDeskDrawer';
import { OnboardingModal } from './components/OnboardingModal';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<
    'lab' | 'overview' | 'compare' | 'scenarios' | 'experiments'
  >('lab');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    'scenario_27_sdn_udp_reroute'
  );

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Help Desk drawer
  const [helpDeskOpen, setHelpDeskOpen] = useState<boolean>(false);
  const [helpDeskKey, setHelpDeskKey] = useState<string | null>(null);

  // Onboarding modal
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem('netlab_visited');
    if (!hasVisited) {
      setShowOnboarding(true);
      localStorage.setItem('netlab_visited', 'true');
    }
  }, []);

  const handleOpenHelpDesk = (key?: string) => {
    setHelpDeskKey(key || null);
    setHelpDeskOpen(true);
  };

  const handleNavigate = (page: string, scenarioId?: string) => {
    if (scenarioId) setSelectedScenarioId(scenarioId);
    setCurrentPage(page as any);
  };

  const handleOnboardingSelect = (option: 'congestion' | 'compare' | 'build') => {
    setShowOnboarding(false);
    if (option === 'congestion') {
      setSelectedScenarioId('scenario_3_finite_buffer');
      setCurrentPage('lab');
    } else if (option === 'compare') {
      setCurrentPage('compare');
    } else {
      setSelectedScenarioId('scenario_1_flow_vs_congestion');
      setCurrentPage('lab');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Navigation Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between select-none z-30">
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentPage('lab')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-md shadow-blue-900/40 group-hover:bg-blue-500 transition-colors">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white group-hover:text-blue-400 transition-colors">
                NetLab
              </span>
              <span className="text-[10px] text-slate-400 font-mono ml-2 hidden sm:inline-block">
                v1.0 &bull; Congestion Simulator
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentPage === 'overview'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Overview
            </button>

            <button
              onClick={() => setCurrentPage('lab')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentPage === 'lab'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Network Lab</span>
            </button>

            <button
              onClick={() => setCurrentPage('compare')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentPage === 'compare'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-orange-400" />
              <span>Comparisons & SDN Benchmarks</span>
            </button>

            <button
              onClick={() => setCurrentPage('scenarios')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentPage === 'scenarios'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Scenarios</span>
            </button>

            <button
              onClick={() => setCurrentPage('experiments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentPage === 'experiments'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Experiments</span>
            </button>
          </nav>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenHelpDesk()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs border border-slate-700/80 transition-colors"
            title="Open Integrated Help Desk"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Help Desk</span>
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Welcome Guide"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={() => {
              setIsDarkMode(!isDarkMode);
              document.documentElement.classList.toggle('dark');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Toggle Light / Dark mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'overview' && (
          <OverviewPage
            onNavigate={handleNavigate}
            onOpenHelpDesk={handleOpenHelpDesk}
          />
        )}

        {currentPage === 'lab' && (
          <NetworkLabPage
            initialScenarioId={selectedScenarioId}
            onOpenHelpDesk={handleOpenHelpDesk}
          />
        )}

        {currentPage === 'compare' && (
          <ProtocolComparisonPage
            onOpenHelpDesk={handleOpenHelpDesk}
          />
        )}

        {currentPage === 'scenarios' && (
          <ScenariosPage
            onLoadScenario={(scId) => {
              setSelectedScenarioId(scId);
              setCurrentPage('lab');
            }}
            onOpenHelpDesk={handleOpenHelpDesk}
          />
        )}

        {currentPage === 'experiments' && (
          <ExperimentsPage
            onLoadScenario={(scId) => {
              setSelectedScenarioId(scId);
              setCurrentPage('lab');
            }}
          />
        )}
      </main>

      {/* Integrated Help Desk Slide-In Drawer */}
      <HelpDeskDrawer
        isOpen={helpDeskOpen}
        onClose={() => setHelpDeskOpen(false)}
        initialTopicKey={helpDeskKey}
      />

      {/* Beginner Welcome / Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onSelectOption={handleOnboardingSelect}
      />
    </div>
  );
};
