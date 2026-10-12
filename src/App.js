import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Työmääräykset
  const [orders, setOrders] = useState([
    {
      id: 'TM-1042',
      client: 'Kiinteistö Oy Valo',
      address: 'Teollisuustie 4, Kokkola',
      description: 'Ilmanvaihtokoneen vuosihuolto ja suodattimien vaihto',
      status: 'Kesken',
      usedMaterials: [{ name: 'F7 Suodatinsetti', qty: 1, unit: 'kpl' }],
      loggedKm: 15,
      signed: false
    },
    {
      id: 'TM-1041',
      client: 'Asennusliike Korhonen',
      address: 'Satamakatu 12, Kokkola',
      description: 'Pumppaamon hälytyskeskuksen tarkistus',
      status: 'Odottaa',
      usedMaterials: [],
      loggedKm: 0,
      signed: false
    }
  ]);

  // Ajanotto
  const [activeTimer, setActiveTimer] = useState(null); // { orderId, seconds }
  
  // Saldopankki
  const [saldoHours, setSaldoHours] = useState(12.5);

  // Lomaketilat (Uusi työ & tarvike)
  const [selectedOrder, setSelectedOrder] = useState('TM-1042');
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [kmAmount, setKmAmount] = useState('');
  const [manualHours, setManualHours] = useState('7.5');
  const [manualDesc, setManualDesc] = useState('');

  // Uusi työmääräys
  const [newClient, setNewClient] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // PWA-asennustuki
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }
  }, []);

  // Sekuntikello
  useEffect(() => {
    let interval = null;
    if (activeTimer) {
      interval = setInterval(() => {
        setActiveTimer((prev) => ({ ...prev, seconds: prev.seconds + 1 }));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  // Ajanoton alustus / lopetus
  const toggleTimer = (orderId) => {
    if (activeTimer && activeTimer.orderId === orderId) {
      // Lopetetaan ja kirjaataan tunnit
      const hoursLogged = +(activeTimer.seconds / 3600).toFixed(2);
      setSaldoHours((prev) => +(prev + hoursLogged).toFixed(2));
      alert(`Työ pysäytetty! Kirjattiin ${hoursLogged} h saldopankkiin.`);
      setActiveTimer(null);
    } else {
      setActiveTimer({ orderId, seconds: 0 });
    }
  };

  // Tarvikkeen lisääminen
  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!materialName) return;
    setOrders(orders.map(o => {
      if (o.id === selectedOrder) {
        return {
          ...o,
          usedMaterials: [...o.usedMaterials, { name: materialName, qty: Number(materialQty), unit: 'kpl' }]
        };
      }
      return o;
    }));
    setMaterialName('');
    setMaterialQty(1);
    alert('Tarvike lisätty työmääräykselle!');
  };

  // Kilometrien lisääminen
  const handleAddKm = (e) => {
    e.preventDefault();
    if (!kmAmount) return;
    setOrders(orders.map(o => {
      if (o.id === selectedOrder) {
        return { ...o, loggedKm: o.loggedKm + Number(kmAmount) };
      }
      return o;
    }));
    setKmAmount('');
    alert('Kilometrit kirjaantuneet!');
  };

  // Uuden työmääräyksen luonti
  const handleCreateOrder = (e) => {
    e.preventDefault();
    if (!newClient) return;
    const newId = `TM-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrderObj = {
      id: newId,
      client: newClient,
      address: newAddress || 'Ei osoitetta',
      description: newDesc || 'Ei kuvausta',
      status: 'Odottaa',
      usedMaterials: [],
      loggedKm: 0,
      signed: false
    };
    setOrders([newOrderObj, ...orders]);
    setNewClient('');
    setNewAddress('');
    setNewDesc('');
    setActiveTab('orders');
    alert(`Uusi työmääräys ${newId} luotu!`);
  };

  // Tuntien manuaalikirjaus
  const handleManualTimeSubmit = (e) => {
    e.preventDefault();
    const added = parseFloat(manualHours) || 0;
    setSaldoHours((prev) => +(prev + added).toFixed(2));
    setManualDesc('');
    alert(`Kirjattu ${added} h saldopankkiin!`);
  };

  // Kuittaus
  const handleSignOrder = (orderId) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, signed: true, status: 'Valmis' } : o));
    alert('Työmääräys kuitattu valmiiksi sähköisesti!');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-20">
      {/* Yläpalkki */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex justify-between items-center sticky top-0 z-20 shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-blue-400">HuoltoPro</h1>
          <p className="text-xs text-slate-400">Kenttätyö & Tuntikirjaus</p>
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
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        
        {/* Saldokortti */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Liukumasaldo</span>
            <span className={`text-2xl font-mono font-bold ${saldoHours >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {saldoHours >= 0 ? `+${saldoHours}` : saldoHours} h
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Käynnissä</span>
            <span className="text-sm font-mono text-blue-300">
              {activeTimer ? formatTime(activeTimer.seconds) : 'Ei käynnissä'}
            </span>
          </div>
        </div>

        {/* --- OSIONÄKYMÄT --- */}

        {/* 1. TYÖMÄÄRÄYKSET */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Työmääräykset</h2>
              <button 
                onClick={() => setActiveTab('newOrder')}
                className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg font-semibold"
              >
                + Uusi työ
              </button>
            </div>

            {orders.map((order) => {
              const isRunning = activeTimer && activeTimer.orderId === order.id;

              return (
                <div key={order.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs bg-blue-900 text-blue-300 font-bold px-2 py-0.5 rounded">{order.id}</span>
                      <h3 className="font-bold text-base mt-1 text-white">{order.client}</h3>
                      <p className="text-xs text-slate-400">📍 {order.address}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      order.status === 'Valmis' ? 'bg-green-900/40 text-green-300 border-green-500/30' :
                      order.status === 'Kesken' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                      'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
                    {order.description}
                  </p>

                  {/* Käytetyt tarvikkeet & kilometrit */}
                  {(order.usedMaterials.length > 0 || order.loggedKm > 0) && (
                    <div className="text-xs space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/50">
                      {order.loggedKm > 0 && (
                        <div className="text-slate-400">🚗 Matka: <span className="text-slate-200 font-bold">{order.loggedKm} km</span></div>
                      )}
                      {order.usedMaterials.length > 0 && (
                        <div className="text-slate-400">
                          🛢️ Tarvikkeet: {order.usedMaterials.map(m => `${m.name} (${m.qty} ${m.unit})`).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toimintopainikkeet */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={() => toggleTimer(order.id)}
                      className={`font-semibold py-2.5 rounded-lg text-xs shadow flex justify-center items-center gap-1 ${
                        isRunning 
                          ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' 
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                      {isRunning ? `⏸ Stop (${formatTime(activeTimer.seconds)})` : '▶️ Aloita työ'}
                    </button>

                    {!order.signed ? (
                      <button 
                        onClick={() => handleSignOrder(order.id)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-xs shadow"
                      >
                        ✍️ Kuittaa valmiiksi
                      </button>
                    ) : (
                      <div className="text-center py-2 text-xs text-green-400 font-bold">
                        ✓ Kuitattu
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. TARVIKKEET & MATKAT */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">🛢️ Lisää tarvike työlle</h2>
              <form onSubmit={handleAddMaterial} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Valitse työmääräys</label>
                  <select 
                    value={selectedOrder} 
                    onChange={(e) => setSelectedOrder(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    {orders.map(o => <option key={o.id} value={o.id}>{o.id} - {o.client}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Tarvikkeen nimi / nimike</label>
                  <input 
                    type="text" 
                    placeholder="esim. Moottoriöljy 5W-30" 
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Määrä (kpl / l / m)</label>
                  <input 
                    type="number" 
                    value={materialQty}
                    onChange={(e) => setMaterialQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                  Tallenna tarvike
                </button>
              </form>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">🚗 Kirjaa kilometrit</h2>
              <form onSubmit={handleAddKm} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Valitse työmääräys</label>
                  <select 
                    value={selectedOrder} 
                    onChange={(e) => setSelectedOrder(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    {orders.map(o => <option key={o.id} value={o.id}>{o.id} - {o.client}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Ajetut kilometrit (km)</label>
                  <input 
                    type="number" 
                    placeholder="esim. 25" 
                    value={kmAmount}
                    onChange={(e) => setKmAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                  Tallenna kilometrit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. TUNTIKIRJAUS (MANUAALINEN) */}
        {activeTab === 'time' && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">⏱️ Manuaalinen tuntikirjaus</h2>
            <form onSubmit={handleManualTimeSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Työmääräys</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                  {orders.map(o => <option key={o.id} value={o.id}>{o.id} - {o.client}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tunnit (h)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Työn kuvaus / Selite</label>
                <textarea 
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Mitä kohteessa tehtiin..." 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                Tallenna tuntikirjaus
              </button>
            </form>
          </div>
        )}

        {/* 4. UUSI TYÖMÄÄRÄYS */}
        {activeTab === 'newOrder' && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">📝 Luotava uusi työmääräys</h2>
            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Asiakkaan nimi *</label>
                <input 
                  type="text" 
                  required
                  placeholder="esim. Kokkolan Teollisuus Oy" 
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Osoite</label>
                <input 
                  type="text" 
                  placeholder="esim. Rantakatu 5" 
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Työn kuvaus</label>
                <textarea 
                  placeholder="Mitä kohteessa pitää tehdä..." 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20"
                />
              </div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                Luo työmääräys
              </button>
            </form>
          </div>
        )}

      </main>

      {/* Alavalikko / Navigaatio */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-20 shadow-2xl">
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'orders' ? 'text-blue-400' : 'text-slate-400'}`}
        >
          📋 <span>Työt</span>
        </button>
        <button 
          onClick={() => setActiveTab('materials')} 
          className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'materials' ? 'text-blue-400' : 'text-slate-400'}`}
        >
          🛢️ <span>Tarvikkeet</span>
        </button>
        <button 
          onClick={() => setActiveTab('time')} 
          className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'time' ? 'text-blue-400' : 'text-slate-400'}`}
        >
          ⏱️ <span>Tunnit</span>
        </button>
      </nav>
    </div>
  );
}
