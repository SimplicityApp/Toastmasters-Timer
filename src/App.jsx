import { useState } from 'react';
import { TimerProvider } from './context/TimerContext';
import { ToastProvider } from './context/ToastContext';
import NavTabs from './components/NavTabs';
import LiveTab from './components/LiveTab';
import AgendaTab from './components/AgendaTab';
import ReportTab from './components/ReportTab';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('live');

  return (
    <ToastProvider>
      <TimerProvider>
        <div className="app-container w-full h-screen flex flex-col bg-white">
          <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'live' && <LiveTab />}
            {activeTab === 'agenda' && <AgendaTab onSwitchToLive={() => setActiveTab('live')} />}
            {activeTab === 'report' && <ReportTab />}
          </div>
          
          <Footer />
        </div>
      </TimerProvider>
    </ToastProvider>
  );
}

export default App;
