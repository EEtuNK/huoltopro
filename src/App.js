import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Firebase-määritelmät
const firebaseConfig = {
  apiKey: "AIzaSyCrliSXqRQkh2-QPBIr-nfHMj4HjsMeIWI",
  authDomain: "huoltopro-87e70.firebaseapp.com",
  projectId: "huoltopro-87e70",
  storageBucket: "huoltopro-87e70.firebasestorage.app",
  messagingSenderId: "774512549775",
  appId: "1:774512549775:web:23cdfe0c35b403285775fa",
  measurementId: "G-CQ036ZFPSX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [role, setRole] = useState('tech'); // 'tech' = Asentaja, 'admin' = Työnjohto
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Ajanotto
  const [activeTimer, setActiveTimer] = useState(null);
  const [saldoHours, setSaldoHours] = useState(12.5);

  // Modalit
  const [startModalOrder, setStartModalOrder] = useState(null);
  const [stopModalOrder, setStopModalOrder] = useState(null);

  // Lomaketilat (Aloitus & Lopetus)
  const [workType, setWorkType] = useState('Kenttätyö');
  const [startNote, setStartNote] = useState('');
  const [endNote, setEndNote] = useState('');
  const [stopMaterials, setStopMaterials] = useState([{ name: '', qty: 1 }]);

  // Uusi työ (Luonti)
  const [newClient, setNewClient] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Reaaliaikainen Firestore-kuuntelija
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const fetchedOrders = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, []);

  // PWA-tuki
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
    } else {
      alert("Asenna sovellus selaimen valikosta:\n\n• Safari (iOS): Paina 'Jaa' -> 'Lisää kotivalikkoon'\n• Chrome (Android): Paina '...' -> 'Asenna sovellus'");
    }
  };

  // --- ALOITA TYÖ ---
  const openStartModal = (orderId) => {
    if (activeTimer) {
      alert("Sinulla on jo toinen työ käynnissä! Pysäytä se ennen uuden aloittamista.");
      return;
    }
    setStartModalOrder(orderId);
    setWorkType('Kenttätyö');
    setStartNote('');
  };

  const confirmStartWork = async (e) => {
    e.preventDefault();
    setActiveTimer({
      orderId: startModalOrder,
      seconds: 0,
      workType,
      startNote,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    await updateDoc(doc(db, 'orders', startModalOrder), { status: 'Kesken' });
    setStartModalOrder(null);
  };

  // --- LOPETA TYÖ ---
  const openStopModal = (orderId) => {
    setStopModalOrder(orderId);
    setEndNote('');
    setStopMaterials([{ name: '', qty: 1 }]);
  };

  const confirmStopWork = async (e) => {
    e.preventDefault();
    const hoursLogged = +(activeTimer.seconds / 3600).toFixed(2);
    const finalHours = hoursLogged < 0.05 ? 0.25 : hoursLogged;

    const logEntry = {
      workType: activeTimer.workType,
      startNote: activeTimer.startNote,
      endNote,
      hours: finalHours,
      timeString: formatTime(activeTimer.seconds),
      createdAt: new Date().toISOString()
    };

    const validNewMaterials = stopMaterials
      .filter(m => m.name.trim() !== '')
      .map(m => ({ name: m.name.trim(), qty: Number(m.qty) || 1, unit: 'kpl' }));

    const orderRef = doc(db, 'orders', stopModalOrder);
    const targetOrder = orders.find(o => o.id === stopModalOrder);
    const updatedMaterials = [...(targetOrder?.usedMaterials || []), ...validNewMaterials];

    await updateDoc(orderRef, {
      workLogs: arrayUnion(logEntry),
      usedMaterials: updatedMaterials
    });

    setSaldoHours((prev) => +(prev + finalHours).toFixed(2));
    setActiveTimer(null);
    setStopModalOrder(null);
  };

  // Kuvan lisäys
  const handlePhotoUpload = (orderId, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await updateDoc(doc(db, 'orders', orderId), {
          photos: arrayUnion(reader.result)
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Uuden työn luonti (Pilveen)
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newClient) return;
    
    const newId = `TM-${Math.floor(1000 + Math.random() * 9000)}`;
    await setDoc(doc(db, 'orders', newId), {
      client: newClient,
      address: newAddress || 'Ei osoitetta',
      description: newDesc || 'Ei kuvausta',
      status: 'Odottaa',
      usedMaterials: [],
      loggedKm: 0,
      photos: [],
      workLogs: [],
      signed: false,
      createdAt: serverTimestamp()
    });

    setNewClient('');
    setNewAddress('');
    setNewDesc('');
    setActiveTab('orders');
    alert(`Uusi työmääräys ${newId} luotu tietokantaan!`);
  };

  // Sähköinen kuittaus
  const handleSignOrder = async (orderId) => {
    await updateDoc(doc(db, 'orders', orderId), {
      signed: true,
      status: 'Valmis'
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-20">
      
      {/* YLÄPALKKI & ROOLINKYTKIN */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-20 shadow-lg">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-blue-400">HuoltoPro Cloud</h1>
            <p className="text-xs text-slate-400">Reaaliaikainen työnohjaus</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Roolin vaihto */}
            <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex text-xs">
              <button 
                onClick={() => setRole('tech')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${role === 'tech' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                👷 Asentaja
              </button>
              <button 
                onClick={() => setRole('admin')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${role === 'admin' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                👨‍💼 Työnjohto
              </button>
            </div>

            {!isStandalone && role === 'tech' && (
              <button onClick={handleInstallClick} className="hidden sm:block bg-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 font-semibold">
                📱 Asenna
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- NÄKYMÄ 1: ASENTAJA (MOBIILINÄKYMÄ) --- */}
      {role === 'tech' && (
        <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
          
          {/* Saldokortti */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Liukumasaldo</span>
              <span className="text-2xl font-mono font-bold text-green-400">+{saldoHours} h</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                {activeTimer ? `⏱️ ${activeTimer.workType}` : 'Kello'}
              </span>
              <span className={`text-sm font-mono ${activeTimer ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                {activeTimer ? formatTime(activeTimer.seconds) : 'Ei käynnissä'}
              </span>
            </div>
          </div>

          {/* TYÖMÄÄRÄYKSET */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Työmääräykset (Pilvessä)</h2>
                <button onClick={() => setActiveTab('newOrder')} className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg font-semibold">
                  + Uusi työ
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">Ei työmääräyksiä tietokannassa. Luota uusi painamalla "+ Uusi työ".</div>
              ) : (
                orders.map((order) => {
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

                      {/* Kirjatut työt */}
                      {order.workLogs?.length > 0 && (
                        <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/80 text-xs">
                          <span className="text-slate-400 font-bold block mb-1">📋 Tehdyt kirjaukset:</span>
                          {order.workLogs.map((log, idx) => (
                            <div key={idx} className="border-b border-slate-800 pb-1 last:border-0">
                              <span className="text-blue-300 font-bold">{log.workType}</span> ({log.hours} h):
                              {log.endNote && <span className="text-slate-200 block"> Tehty: {log.endNote}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tarvikkeet */}
                      {order.usedMaterials?.length > 0 && (
                        <div className="text-xs bg-slate-900/40 p-2 rounded border border-slate-700/50 text-slate-400">
                          🛢️ Tarvikkeet: {order.usedMaterials.map(m => `${m.name} (${m.qty} ${m.unit})`).join(', ')}
                        </div>
                      )}

                      {/* Kuvat */}
                      <div className="space-y-2 pt-1 border-t border-slate-700/60">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-semibold">📸 Kuvat ({(order.photos || []).length})</span>
                          <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-600 font-semibold flex items-center gap-1">
                            📷 Ota kuva
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(order.id, e)} className="hidden" />
                          </label>
                        </div>

                        {order.photos?.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {order.photos.map((imgSrc, idx) => (
                              <img key={idx} src={imgSrc} alt="Kohdekuva" className="w-full h-20 object-cover rounded-lg border border-slate-700 shadow" />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Toimintopainikkeet */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                        {!isRunning ? (
                          <button onClick={() => openStartModal(order.id)} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                            ▶️ Aloita työ
                          </button>
                        ) : (
                          <button onClick={() => openStopModal(order.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow animate-pulse">
                            ⏹ Lopeta ({formatTime(activeTimer.seconds)})
                          </button>
                        )}

                        {!order.signed ? (
                          <button onClick={() => handleSignOrder(order.id)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-xs shadow">
                            ✍️ Kuittaa valmiiksi
                          </button>
                        ) : (
                          <div className="text-center py-2 text-xs text-green-400 font-bold">✓ Kuitattu</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* UUSI TYÖ -VÄLILEHTI */}
          {activeTab === 'newOrder' && (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">📝 Luotava uusi työmääräys</h2>
              <form onSubmit={handleCreateOrder} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Asiakkaan nimi *</label>
                  <input type="text" required placeholder="esim. Kokkolan Teollisuus Oy" value={newClient} onChange={(e) => setNewClient(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Osoite</label>
                  <input type="text" placeholder="esim. Rantakatu 5" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Työn kuvaus</label>
                  <textarea placeholder="Mitä kohteessa pitää tehdä..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20" />
                </div>
                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">
                  Tallenna pilveen
                </button>
              </form>
            </div>
          )}
        </main>
      )}

      {/* --- NÄKYMÄ 2: TYÖNJOHTO (DASHBOARD TYÖPÖYDÄLLE) --- */}
      {role === 'admin' && (
        <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Työnjohdon valvomo</h2>
              <p className="text-xs text-slate-400">Reaaliaikainen tilannekuva kentältä</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Töitä yhteensä</span>
              <span className="text-2xl font-mono font-bold text-purple-400">{orders.length} kpl</span>
            </div>
          </div>

          {/* TAULUKKO TÖISTÄ */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                  <th className="p-3">ID</th>
                  <th className="p-3">Asiakas & Osoite</th>
                  <th className="p-3">Tila</th>
                  <th className="p-3">Kirjatut tunnit</th>
                  <th className="p-3">Tarvikkeet</th>
                  <th className="p-3">Kuvat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-xs">
                {orders.map((o) => {
                  const totalHours = (o.workLogs || []).reduce((sum, l) => sum + (l.hours || 0), 0);

                  return (
                    <tr key={o.id} className="hover:bg-slate-750">
                      <td className="p-3 font-mono font-bold text-blue-400">{o.id}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{o.client}</div>
                        <div className="text-slate-400 text-[11px]">📍 {o.address}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded border ${
                          o.status === 'Valmis' ? 'bg-green-900/40 text-green-300 border-green-500/30' :
                          o.status === 'Kesken' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          'bg-slate-700 text-slate-400 border-slate-600'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-300">
                        {totalHours > 0 ? `${totalHours} h` : '0 h'}
                      </td>
                      <td className="p-3 text-slate-300">
                        {o.usedMaterials?.length > 0 ? (
                          o.usedMaterials.map(m => `${m.name} (${m.qty}kpl)`).join(', ')
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        {o.photos?.length > 0 ? (
                          <div className="flex gap-1">
                            {o.photos.map((img, i) => (
                              <img key={i} src={img} alt="Thumb" className="w-8 h-8 object-cover rounded border border-slate-600" />
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* --- MODAL 1: ALOITA TYÖ --- */}
      {startModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">▶️ Aloita työ: {startModalOrder}</h3>
            <form onSubmit={confirmStartWork} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Valitse työn laatu *</label>
                <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-semibold">
                  <option value="Kenttätyö">🛠️ Kenttätyö</option>
                  <option value="Korjaamotyö">🔧 Korjaamotyö</option>
                  <option value="Matka / Ajo">🚗 Matka / Ajo</option>
                  <option value="Huolto">🛢️ Huolto</option>
                  <option value="Vianetsintä">🔍 Vianetsintä</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStartModalOrder(null)} className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-semibold">Peruuta</button>
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-xs font-semibold shadow">Käynnistä kello</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: LOPETA TYÖ --- */}
      {stopModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">⏹ Lopeta työ: {stopModalOrder}</h3>
            <form onSubmit={confirmStopWork} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Selite tehdystä työstä *</label>
                <textarea required value={endNote} onChange={(e) => setEndNote(e.target.value)} placeholder="Mitä kohteessa tehtiin..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20" />
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-300 font-semibold">🛢️ Käytetyt tarvikkeet</span>
                  <button type="button" onClick={() => setStopMaterials([...stopMaterials, { name: '', qty: 1 }])} className="text-[11px] bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-bold">+ Lisää rivi</button>
                </div>
                {stopMaterials.map((mat, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <input type="text" placeholder="Tarvike" value={mat.name} onChange={(e) => {
                      const updated = [...stopMaterials];
                      updated[idx].name = e.target.value;
                      setStopMaterials(updated);
                    }} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                    <input type="number" placeholder="Määrä" value={mat.qty} onChange={(e) => {
                      const updated = [...stopMaterials];
                      updated[idx].qty = e.target.value;
                      setStopMaterials(updated);
                    }} className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono text-center" />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStopModalOrder(null)} className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-semibold">Takaisin</button>
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-xs font-semibold shadow">Päätä ja tallenna</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVIGAATIO (MOBIILI) */}
      {role === 'tech' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-20 shadow-2xl">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'orders' ? 'text-blue-400' : 'text-slate-400'}`}>📋 Työt</button>
          <button onClick={() => setActiveTab('newOrder')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'newOrder' ? 'text-blue-400' : 'text-slate-400'}`}>📝 Uusi työ</button>
        </nav>
      )}
    </div>
  );
}
