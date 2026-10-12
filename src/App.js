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

// Esimerkkiasentajat
const TECHS = ['Matti Meikäläinen', 'Pekka Päällikkö', 'Juho Asentaja'];

export default function App() {
  const [role, setRole] = useState('tech'); // 'tech' = Asentaja, 'admin' = Työnjohto
  const [selectedTech, setSelectedTech] = useState('Matti Meikäläinen'); // Kirjautunut asentaja
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'materials', 'newOrder'
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

  // Erilliset tarvike & km -kirjaukset
  const [selectedOrderForMat, setSelectedOrderForMat] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState(1);
  const [kmVal, setKmVal] = useState('');

  // Uusi työ (Luonti)
  const [newClient, setNewClient] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('Matti Meikäläinen');
  const [newScheduleDate, setNewScheduleDate] = useState(new Date().toISOString().split('T')[0]);

  // Kalenterin valittu päivä (Työnjohto)
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);

  // Reaaliaikainen Firestore-kuuntelija
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const fetchedOrders = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setOrders(fetchedOrders);
      if (fetchedOrders.length > 0 && !selectedOrderForMat) {
        setSelectedOrderForMat(fetchedOrders[0].id);
      }
    });

    return () => unsubscribe();
  }, [selectedOrderForMat]);

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

  // ALOITA TYÖ
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

  // LOPETA TYÖ
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
      techName: selectedTech,
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

  // Erillinen Tarvikkeen Tallenus
  const handleAddSeparateMaterial = async (e) => {
    e.preventDefault();
    if (!matName || !selectedOrderForMat) return;

    const orderRef = doc(db, 'orders', selectedOrderForMat);
    await updateDoc(orderRef, {
      usedMaterials: arrayUnion({ name: matName.trim(), qty: Number(matQty) || 1, unit: 'kpl' })
    });

    setMatName('');
    setMatQty(1);
    alert('Tarvike lisätty työmääräykselle!');
  };

  // Erillinen Kilometrien Tallenus
  const handleAddSeparateKm = async (e) => {
    e.preventDefault();
    if (!kmVal || !selectedOrderForMat) return;

    const targetOrder = orders.find(o => o.id === selectedOrderForMat);
    const currentKm = targetOrder?.loggedKm || 0;

    await updateDoc(doc(db, 'orders', selectedOrderForMat), {
      loggedKm: currentKm + Number(kmVal)
    });

    setKmVal('');
    alert('Kilometrit tallennettu!');
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
      assignedTo: newAssignedTo,
      scheduledDate: newScheduleDate,
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
    alert(`Uusi työmääräys ${newId} osoitettu asentajalle ${newAssignedTo} (${newScheduleDate})!`);
  };

  // Sähköinen kuittaus
  const handleSignOrder = async (orderId) => {
    await updateDoc(doc(db, 'orders', orderId), {
      signed: true,
      status: 'Valmis'
    });
  };

  // Asentajakohtaiset työt
  const myOrders = orders.filter(o => o.assignedTo === selectedTech || !o.assignedTo);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-20">
      
      {/* YLÄPALKKI & ROOLINKYTKIN */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-20 shadow-lg">
        <div className="flex justify-between items-center max-w-5xl mx-auto flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-blue-400">HuoltoPro Cloud</h1>
            <p className="text-xs text-slate-400">Työnohjaus & Kalenteri</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Valitse asentaja jos asentajaroolissa */}
            {role === 'tech' && (
              <select 
                value={selectedTech} 
                onChange={(e) => setSelectedTech(e.target.value)}
                className="bg-slate-900 text-xs border border-slate-700 rounded-lg p-1.5 text-blue-300 font-semibold"
              >
                {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

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
          </div>
        </div>
      </header>

      {/* --- NÄKYMÄ 1: ASENTAJA --- */}
      {role === 'tech' && (
        <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
          
          {/* Saldokortti */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Liukumasaldo ({selectedTech.split(' ')[0]})</span>
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

          {/* 1. TYÖMÄÄRÄYKSET */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Omat työt ({myOrders.length})</h2>
                <button onClick={() => setActiveTab('newOrder')} className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg font-semibold">
                  + Luoda uusi työ
                </button>
              </div>

              {myOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">Ei osoitettuja töitä. Luo uusi tai pyydä työnjohtajaa lisäämään.</div>
              ) : (
                myOrders.map((order) => {
                  const isRunning = activeTimer && activeTimer.orderId === order.id;

                  return (
                    <div key={order.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-blue-900 text-blue-300 font-bold px-2 py-0.5 rounded">{order.id}</span>
                            {order.scheduledDate && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">📅 {order.scheduledDate}</span>}
                          </div>
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
                              <span className="text-blue-300 font-bold">{log.workType}</span> ({log.hours} h) - <span className="text-slate-400">{log.techName || 'Asentaja'}</span>:
                              {log.endNote && <span className="text-slate-200 block"> Tehty: {log.endNote}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tarvikkeet & Km */}
                      {(order.usedMaterials?.length > 0 || order.loggedKm > 0) && (
                        <div className="text-xs space-y-1 bg-slate-900/40 p-2 rounded border border-slate-700/50 text-slate-400">
                          {order.loggedKm > 0 && <div>🚗 Matka: <span className="text-slate-200 font-bold">{order.loggedKm} km</span></div>}
                          {order.usedMaterials?.length > 0 && <div>🛢️ Tarvikkeet: {order.usedMaterials.map(m => `${m.name} (${m.qty} ${m.unit})`).join(', ')}</div>}
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

                      {/* Painikkeet */}
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

          {/* 2. TARVIKKEET & MATKAT (PALAUTETTU VÄLILEHTI) */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">🛢️ Lisää tarvike työlle</h2>
                <form onSubmit={handleAddSeparateMaterial} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valitse työmääräys</label>
                    <select value={selectedOrderForMat} onChange={(e) => setSelectedOrderForMat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                      {orders.map(o => <option key={o.id} value={o.id}>{o.id} - {o.client}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Tarvikkeen nimi</label>
                    <input type="text" placeholder="esim. Suodatin F7" value={matName} onChange={(e) => setMatName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Määrä (kpl)</label>
                    <input type="number" value={matQty} onChange={(e) => setMatQty(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">Tallenna tarvike</button>
                </form>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">🚗 Kirjaa kilometrit</h2>
                <form onSubmit={handleAddSeparateKm} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Valitse työmääräys</label>
                    <select value={selectedOrderForMat} onChange={(e) => setSelectedOrderForMat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                      {orders.map(o => <option key={o.id} value={o.id}>{o.id} - {o.client}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Ajetut kilometrit (km)</label>
                    <input type="number" placeholder="esim. 30" value={kmVal} onChange={(e) => setKmVal(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">Tallenna kilometrit</button>
                </form>
              </div>
            </div>
          )}

          {/* 3. UUSI TYÖMÄÄRÄYS (ASENTAJA VOI MYÖS LUODA) */}
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
                  <label className="text-xs text-slate-400 block mb-1">Osoitetaan asentajalle</label>
                  <select value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                    {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Päivämäärä / Suunniteltu aika</label>
                  <input type="date" value={newScheduleDate} onChange={(e) => setNewScheduleDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
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

      {/* --- NÄKYMÄ 2: TYÖNJOHTO (KALENTERI & NÄKYMÄ) --- */}
      {role === 'admin' && (
        <main className="flex-1 p-4 max-w-5xl mx-auto w-full space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-white">Työnjohdon kalenteri & Valvomo</h2>
              <p className="text-xs text-slate-400">Aja töitä asentajille ja seuraa edistymistä</p>
            </div>

            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-300 font-bold">📅 Valitse päivä:</span>
              <input 
                type="date" 
                value={calendarDate} 
                onChange={(e) => setCalendarDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
              />
            </div>
          </div>

          {/* KALENTERISUUNNITTELU / ASENTAJIEN SARAKKEET */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Töiden jakautuma asentajittain ({calendarDate})</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TECHS.map((tech) => {
                const techOrdersForDate = orders.filter(o => o.assignedTo === tech && o.scheduledDate === calendarDate);

                return (
                  <div key={tech} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                      <span className="font-bold text-white text-sm">👷 {tech}</span>
                      <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded font-bold">{techOrdersForDate.length} työtä</span>
                    </div>

                    {techOrdersForDate.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500">Ei töitä tälle päivälle.</div>
                    ) : (
                      techOrdersForDate.map(o => (
                        <div key={o.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-blue-400">{o.id}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              o.status === 'Valmis' ? 'bg-green-900/40 text-green-300 border-green-500/30' :
                              o.status === 'Kesken' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>{o.status}</span>
                          </div>
                          <div className="font-bold text-xs text-white">{o.client}</div>
                          <div className="text-[11px] text-slate-400">📍 {o.address}</div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TAULUKKO KAIKISTA TÖISTÄ */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow overflow-hidden space-y-3 p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Kaikki tietokannan työmääräykset</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                    <th className="p-2.5">ID & Pvm</th>
                    <th className="p-2.5">Asiakas</th>
                    <th className="p-2.5">Asentaja</th>
                    <th className="p-2.5">Tila</th>
                    <th className="p-2.5">Tunnit</th>
                    <th className="p-2.5">Tarvikkeet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-xs">
                  {orders.map((o) => {
                    const totalHours = (o.workLogs || []).reduce((sum, l) => sum + (l.hours || 0), 0);

                    return (
                      <tr key={o.id} className="hover:bg-slate-750">
                        <td className="p-2.5 font-mono">
                          <span className="font-bold text-blue-400 block">{o.id}</span>
                          <span className="text-[10px] text-slate-400">{o.scheduledDate || 'Ei pvm'}</span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-white">{o.client}</div>
                          <div className="text-slate-400 text-[11px]">📍 {o.address}</div>
                        </td>
                        <td className="p-2.5 text-slate-300 font-semibold">{o.assignedTo || 'Ei osoitettu'}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded border ${
                            o.status === 'Valmis' ? 'bg-green-900/40 text-green-300 border-green-500/30' :
                            o.status === 'Kesken' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            'bg-slate-700 text-slate-400 border-slate-600'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono font-bold text-amber-300">{totalHours} h</td>
                        <td className="p-2.5 text-slate-300">
                          {o.usedMaterials?.length > 0 ? o.usedMaterials.map(m => `${m.name} (${m.qty}kpl)`).join(', ') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      {/* NAVIGAATIO (ASENTAJA-MOBIILI) */}
      {role === 'tech' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-20 shadow-2xl">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'orders' ? 'text-blue-400' : 'text-slate-400'}`}>📋 Työt</button>
          <button onClick={() => setActiveTab('materials')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'materials' ? 'text-blue-400' : 'text-slate-400'}`}>🛢️ Tarvikkeet</button>
          <button onClick={() => setActiveTab('newOrder')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'newOrder' ? 'text-blue-400' : 'text-slate-400'}`}>📝 Uusi työ</button>
        </nav>
      )}
    </div>
  );
}
