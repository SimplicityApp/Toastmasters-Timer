import { useState, lazy, Suspense } from 'react';
import { TimerProvider } from './context/TimerContext';
import { ToastProvider } from './context/ToastContext';
import NavTabs from './components/NavTabs';
import Footer from './components/Footer';
import './App.css';

const LiveTab = lazy(() => import('./components/LiveTab'));
const AgendaTab = lazy(() => import('./components/AgendaTab'));
const ReportTab = lazy(() => import('./components/ReportTab'));

function App() {
  const [activeTab, setActiveTab] = useState('live');

  return (
    <ToastProvider>
      <TimerProvider>
        <div className="app-container w-full h-screen flex flex-col bg-white">
          <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <Suspense fallback={<div className="flex-1" />}>
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'live' && <LiveTab />}
              {activeTab === 'agenda' && <AgendaTab onSwitchToLive={() => setActiveTab('live')} />}
              {activeTab === 'report' && <ReportTab />}
            </div>
          </Suspense>

          <Footer />
        </div>
      </TimerProvider>
    </ToastProvider>
  );
}

export default App;
