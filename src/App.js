import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // PWA-asennuskutsun kappaus
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      alert("Asenna sovellus selaimen valikosta:\n\n• Safari (iOS): Paina 'Jaa' -> 'Lisää kotivalikkoon'\n• Chrome (Android): Paina '...' -> 'Asenna sovellus'");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-12">
      {/* Yläpalkki */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-blue-400">HuoltoPro</h1>
          <p className="text-xs text-slate-400">Työnohjaus & Tuntikirjaus</p>
        </div>
        
        {!isStandalone && (
          <button
            onClick={handleInstallClick}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow border border-blue-400 flex items-center gap-1"
          >
            📱 Asenna luuriin
          </button>
        )}
      </header>

      {/* Pääsisältö */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {/* Saldokortti */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 shadow flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Liukumasaldo</span>
            <span className="text-2xl font-mono font-bold text-green-400">+12.5 h</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Tämä viikko</span>
            <span className="text-xl font-mono font-semibold text-slate-200">32.0 / 40 h</span>
          </div>
        </div>

        {/* Työmääräykset */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Aktiiviset työmääräykset</h2>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs bg-blue-900 text-blue-300 font-bold px-2 py-0.5 rounded">TM-1042</span>
                  <h3 className="font-bold text-base mt-1 text-white">Kiinteistö Oy Valo - Huolto</h3>
                  <p className="text-xs text-slate-400">Teollisuustie 4, Kokkola</p>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">Kesken</span>
              </div>
              
              <div className="text-xs text-slate-300 bg-slate-900 p-2 rounded border border-slate-700">
                Laitteiston vuosihuolto ja öljynvaihto.
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button 
                  onClick={() => alert('Ajanotto käynnistetty!')}
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded-lg text-sm shadow flex justify-center items-center gap-1"
                >
                  ▶️ Aloita työ
                </button>
                <button 
                  onClick={() => alert('Kirjaa materiaaleja / Öljyä')}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg text-sm shadow"
                >
                  🛢️ Lisää tarvike
                </button>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow opacity-75">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded">TM-1041</span>
                  <h3 className="font-bold text-base mt-1 text-white">Asennusliike Korhonen</h3>
                  <p className="text-xs text-slate-400">Satamakatu 12</p>
                </div>
                <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">Odottaa</span>
              </div>
            </div>
          </div>
        )}

        {/* Tuntikirjaus */}
        {activeTab === 'time' && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-4">
            <h2 className="text-lg font-bold text-white">Manuaalinen tuntikirjaus</h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Työmääräys</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white">
                <option>TM-1042 - Kiinteistö Oy Valo</option>
                <option>TM-1041 - Asennusliike Korhonen</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tunnit (h)</label>
              <input type="number" defaultValue="7.5" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Selite</label>
              <textarea placeholder="Mitä tehtiin..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white h-20" />
            </div>
            <button 
              onClick={() => alert('Tunnit tallennettu saldopankkiin!')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg shadow"
            >
              Tallenna tuntikirjaus
            </button>
          </div>
        )}
      </main>

      {/* Alavalikko / Navigaatio */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-10">
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`flex-1 py-1 text-center text-xs font-semibold ${activeTab === 'orders' ? 'text-blue-400' : 'text-slate-400'}`}
        >
          📋 Työt
        </button>
        <button 
          onClick={() => setActiveTab('time')} 
          className={`flex-1 py-1 text-center text-xs font-semibold ${activeTab === 'time' ? 'text-blue-400' : 'text-slate-400'}`}
        >
          ⏱️ Tunnit
        </button>
      </nav>
    </div>
  );
}
