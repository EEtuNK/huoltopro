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

const TECHS = ['Matti Meikäläinen', 'Pekka Päällikkö', 'Juho Asentaja'];

function getWeekDays(startDateStr) {
  const start = new Date(startDateStr);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(start.setDate(diff));
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// Apufunktio: Pakataan kuva automaattisesti ennen tallennusta, jotta Firestore ei hylkää sitä!
const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
    };
  });
};

export default function App() {
  const [role, setRole] = useState('tech');
  const [selectedTech, setSelectedTech] = useState('Matti Meikäläinen');
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);

  // Ajanotto & Saldo
  const [activeTimer, setActiveTimer] = useState(null);
  const [saldoHours, setSaldoHours] = useState(12.5);

  // Modalit
  const [startModalOrder, setStartModalOrder] = useState(null);
  const [stopModalOrder, setStopModalOrder] = useState(null);
  const [pdfOrder, setPdfOrder] = useState(null);

  // Formit
  const [workType, setWorkType] = useState('Kenttätyö');
  const [startNote, setStartNote] = useState('');
  const [endNote, setEndNote] = useState('');
  const [stopMaterials, setStopMaterials] = useState([{ name: '', qty: 1 }]);

  // Tarvikkeet & Km
  const [selectedOrderForMat, setSelectedOrderForMat] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState(1);
  const [kmVal, setKmVal] = useState('');

  // Uusi työ
  const [newClient, setNewClient] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('Matti Meikäläinen');
  const [newScheduleDate, setNewScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [newIsWarranty, setNewIsWarranty] = useState(false);

  // Viikkokalenteri
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const weekDays = getWeekDays(selectedWeekDate);

  // Drag & Drop
  const [draggedOrderId, setDraggedOrderId] = useState(null);

  // Firestore-kuuntelija
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

  // Aloita työ
  const openStartModal = (orderId) => {
    if (activeTimer) {
      alert("Sinulla on jo työ käynnissä!");
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

  // Lopeta työ
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

  // Erillinen tarvike / km
  const handleAddSeparateMaterial = async (e) => {
    e.preventDefault();
    if (!matName || !selectedOrderForMat) return;
    await updateDoc(doc(db, 'orders', selectedOrderForMat), {
      usedMaterials: arrayUnion({ name: matName.trim(), qty: Number(matQty) || 1, unit: 'kpl' })
    });
    setMatName('');
    setMatQty(1);
    alert('Tarvike lisätty!');
  };

  const handleAddSeparateKm = async (e) => {
    e.preventDefault();
    if (!kmVal || !selectedOrderForMat) return;
    const targetOrder = orders.find(o => o.id === selectedOrderForMat);
    await updateDoc(doc(db, 'orders', selectedOrderForMat), {
      loggedKm: (targetOrder?.loggedKm || 0) + Number(kmVal)
    });
    setKmVal('');
    alert('Kilometrit tallennettu!');
  };

  // KUVAN LÄHETYS JA AUTOMAATTINEN PAKKAUS (PYSYVÄ SÄILYTYS)
  const handlePhotoUpload = async (orderId, e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedImageBase64 = await compressImage(file, 1200, 0.7);
        await updateDoc(doc(db, 'orders', orderId), {
          photos: arrayUnion(compressedImageBase64)
        });
        alert("Valokuva tallennettu onnistuneesti tietokantaan!");
      } catch (err) {
        alert("Virhe kuvan tallennuksessa: " + err.message);
      }
    }
  };

  // Luonti
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
      isWarranty: newIsWarranty,
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
    setNewIsWarranty(false);
    setActiveTab('orders');
    alert(`Uusi työmääräys ${newId} luotu!`);
  };

  // Drag & Drop
  const handleDragStart = (e, orderId) => {
    e.dataTransfer.setData('text/plain', orderId);
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, techName, targetDate) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (!orderId) return;

    await updateDoc(doc(db, 'orders', orderId), {
      assignedTo: techName,
      scheduledDate: targetDate
    });

    setDraggedOrderId(null);
  };

  const myOrders = orders.filter(o => o.assignedTo === selectedTech || !o.assignedTo);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-20 print:bg-white print:text-black print:pb-0">
      
      {/* YLÄPALKKI */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-20 shadow-lg print:hidden">
        <div className="flex justify-between items-center max-w-6xl mx-auto flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-blue-400">HuoltoPro Cloud</h1>
            <p className="text-xs text-slate-400">Työnohjaus & Viikkosuunnittelu</p>
          </div>

          <div className="flex items-center gap-2">
            {role === 'tech' && (
              <select 
                value={selectedTech} 
                onChange={(e) => setSelectedTech(e.target.value)}
                className="bg-slate-900 text-xs border border-slate-700 rounded-lg p-1.5 text-blue-300 font-semibold"
              >
                {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

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
        <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 print:hidden">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Saldo ({selectedTech.split(' ')[0]})</span>
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

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Omat työt ({myOrders.length})</h2>
                <button onClick={() => setActiveTab('newOrder')} className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-lg font-semibold">
                  + Uusi työ
                </button>
              </div>

              {myOrders.map((order) => {
                const isRunning = activeTimer && activeTimer.orderId === order.id;

                return (
                  <div key={order.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs bg-blue-900 text-blue-300 font-bold px-2 py-0.5 rounded">{order.id}</span>
                          {order.isWarranty && <span className="text-[10px] bg-red-900/80 text-red-200 border border-red-500/50 font-bold px-1.5 py-0.5 rounded">🛡️ TAKUUTYÖ</span>}
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

                      <button onClick={() => setPdfOrder(order)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg text-xs shadow">
                        📄 Avaa raportti
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg border border-slate-700">
                  <input type="checkbox" id="warrantyCheck" checked={newIsWarranty} onChange={(e) => setNewIsWarranty(e.target.checked)} className="w-4 h-4 text-red-600 rounded" />
                  <label htmlFor="warrantyCheck" className="text-xs font-bold text-red-300 cursor-pointer">🛡️ Kyseessä on takuutyö</label>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Osoitetaan asentajalle</label>
                  <select value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                    {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Päivämäärä</label>
                  <input type="date" value={newScheduleDate} onChange={(e) => setNewScheduleDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Työn kuvaus</label>
                  <textarea placeholder="Mitä kohteessa pitää tehdä..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20" />
                </div>
                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg text-xs shadow">Tallenna pilveen</button>
              </form>
            </div>
          )}
        </main>
      )}

      {/* --- NÄKYMÄ 2: TYÖNJOHTO --- */}
      {role === 'admin' && (
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full space-y-6 print:hidden">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-white">Työnjohdon viikkosuunnittelu (Drag & Drop)</h2>
              <p className="text-xs text-slate-400">Rahaa/vedä työmääräyksiä hiirellä haluamallesi asentajalle ja päivälle</p>
            </div>

            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-300 font-bold">📅 Viikko alkaen:</span>
              <input 
                type="date" 
                value={selectedWeekDate} 
                onChange={(e) => setSelectedWeekDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-700">
                  <th className="p-3 w-40 border-r border-slate-700">Asentaja</th>
                  {weekDays.map((dayStr) => (
                    <th key={dayStr} className="p-2 border-r border-slate-700/60 text-center last:border-0">
                      <div className="font-bold text-slate-200">{new Date(dayStr).toLocaleDateString('fi-FI', { weekday: 'short' })}</div>
                      <div className="text-[10px] text-slate-500">{dayStr}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-xs">
                {TECHS.map((tech) => (
                  <tr key={tech} className="min-h-[100px]">
                    <td className="p-3 font-bold text-white bg-slate-850 border-r border-slate-700 align-top">
                      👷 {tech}
                    </td>

                    {weekDays.map((dayStr) => {
                      const dayOrders = orders.filter(o => o.assignedTo === tech && o.scheduledDate === dayStr);

                      return (
                        <td 
                          key={dayStr} 
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, tech, dayStr)}
                          className="p-1.5 border-r border-slate-700/60 align-top hover:bg-slate-750/50 transition min-h-[100px] last:border-0"
                        >
                          <div className="space-y-1.5 min-h-[80px]">
                            {dayOrders.map((o) => (
                              <div
                                key={o.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, o.id)}
                                onClick={() => setPdfOrder(o)}
                                className={`p-2 rounded-lg border cursor-grab active:cursor-grabbing shadow space-y-1 ${
                                  o.isWarranty ? 'bg-red-950/60 border-red-700/80 hover:bg-red-900/80' : 'bg-slate-900 border-slate-700 hover:bg-slate-950'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-mono font-bold text-blue-400 text-[10px]">{o.id}</span>
                                  {o.isWarranty && <span className="text-[8px] bg-red-800 text-red-100 font-bold px-1 rounded">TAKUU</span>}
                                </div>
                                <div className="font-bold text-white text-[11px] truncate">{o.client}</div>
                                <div className="text-[10px] text-slate-400 truncate">📍 {o.address}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow p-4 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Kaikki työmääräykset (Klikkaa avataksesi PDF-raportin)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-700">
                    <th className="p-2.5">ID & Pvm</th>
                    <th className="p-2.5">Asiakas</th>
                    <th className="p-2.5">Tyyppi</th>
                    <th className="p-2.5">Asentaja</th>
                    <th className="p-2.5">Tila</th>
                    <th className="p-2.5">Tunnit</th>
                    <th className="p-2.5">Toiminto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-xs">
                  {orders.map((o) => {
                    const totalHours = (o.workLogs || []).reduce((sum, l) => sum + (l.hours || 0), 0);

                    return (
                      <tr key={o.id} className="hover:bg-slate-700/50 cursor-pointer" onClick={() => setPdfOrder(o)}>
                        <td className="p-2.5 font-mono">
                          <span className="font-bold text-blue-400 block">{o.id}</span>
                          <span className="text-[10px] text-slate-400">{o.scheduledDate || 'Ei pvm'}</span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-white">{o.client}</div>
                          <div className="text-slate-400 text-[11px]">📍 {o.address}</div>
                        </td>
                        <td className="p-2.5">
                          {o.isWarranty ? <span className="text-red-400 font-bold">🛡️ Takuutyö</span> : <span className="text-slate-400">Normaali</span>}
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
                        <td className="p-2.5">
                          <button onClick={(e) => { e.stopPropagation(); setPdfOrder(o); }} className="bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded text-[11px] font-semibold">
                            📄 Avaa PDF
                          </button>
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

      {/* --- MODAL 3: TÄYDELLINEN TAKUURAPORTTI & KORKEALAATUINEN KUVAN LATAUS/TULOSTA --- */}
      {pdfOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static print:block">
          <div className="bg-white text-slate-900 rounded-xl p-6 max-w-3xl w-full space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] print:max-h-none print:shadow-none print:border-0 print:w-full print:p-0">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-blue-900">HUOLTOPRO - TYÖRAPORTTI</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-slate-600">TyömääräysID: <span className="font-mono font-bold text-slate-900">{pdfOrder.id}</span></p>
                  {pdfOrder.isWarranty && (
                    <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-300">
                      🛡️ TAKUUTYÖ
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Päivämäärä</span>
                <span className="font-bold text-sm text-slate-800">{pdfOrder.scheduledDate || new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>

            {/* Asiakas- ja Asentajatiedot */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 font-bold block uppercase">Asiakas / Kohde</span>
                <strong className="text-slate-900 text-sm block">{pdfOrder.client}</strong>
                <span className="text-slate-600">{pdfOrder.address}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block uppercase">Vastuuhenkilö / Asentaja</span>
                <strong className="text-slate-900 text-sm block">{pdfOrder.assignedTo || 'Ei osoitettu'}</strong>
                <span className="text-slate-600">Tila: {pdfOrder.status}</span>
              </div>
            </div>

            {/* Työn kuvaus */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Työtehtävä / Kuvaus</h4>
              <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">{pdfOrder.description}</p>
            </div>

            {/* Tehdyt työt ja tunnit */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Tehdyt kirjaukset ja tunnit</h4>
              {pdfOrder.workLogs?.length > 0 ? (
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 border-b">Laatu</th>
                      <th className="p-2 border-b">Selite</th>
                      <th className="p-2 border-b text-right">Tunnit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfOrder.workLogs.map((log, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-2 font-bold">{log.workType}</td>
                        <td className="p-2">{log.endNote || log.startNote || '-'}</td>
                        <td className="p-2 text-right font-mono font-bold">{log.hours} h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-xs text-slate-400 italic">Ei kirjattuja tunteja.</p>}
            </div>

            {/* Tarvikkeet & Kilometrit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Käytetyt tarvikkeet</h4>
                {pdfOrder.usedMaterials?.length > 0 ? (
                  <ul className="text-xs list-disc list-inside bg-slate-50 p-2 rounded border border-slate-200">
                    {pdfOrder.usedMaterials.map((m, i) => <li key={i}>{m.name} - <strong>{m.qty} {m.unit}</strong></li>)}
                  </ul>
                ) : <p className="text-xs text-slate-400 italic">Ei tarvikkeita.</p>}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Matkat</h4>
                <p className="text-xs bg-slate-50 p-2 rounded border border-slate-200 font-bold">
                  🚗 Ajetut kilometrit: {pdfOrder.loggedKm || 0} km
                </p>
              </div>
            </div>

            {/* VALOKUVAT KORKEALAATUINAPAPERILLE + SUORA LATAUSLINKKI VASTAANOTTAJALLE */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                📸 Valokuvat ja takuutodisteet ({pdfOrder.photos?.length || 0} kpl)
              </h4>
              
              {pdfOrder.photos?.length > 0 ? (
                <div className="space-y-4">
                  {pdfOrder.photos.map((img, i) => (
                    <div key={i} className="border border-slate-300 rounded-lg p-2 bg-slate-50 print:border-slate-400 print:bg-white page-break-inside-avoid">
                      <img 
                        src={img} 
                        alt={`Takuutyökuva ${i + 1}`} 
                        className="w-full max-h-[500px] object-contain rounded bg-black/5" 
                      />
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 print:hidden">
                        <span className="text-xs text-slate-600 font-bold">Kuva {i + 1} / {pdfOrder.photos.length}</span>
                        <a 
                          href={img} 
                          download={`Takuukuva_${pdfOrder.id}_${i + 1}.jpg`}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-bold shadow flex items-center gap-1"
                        >
                          ⏬ Lataa alkuperäinen kuva (Täysi laatu)
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-slate-200">
                  Työmääräykselle ei ole liitetty valokuvia.
                </p>
              )}
            </div>

            {/* Painikkeet (Piilotetaan tulostettaessa) */}
            <div className="flex gap-2 pt-4 border-t border-slate-200 print:hidden">
              <button onClick={() => setPdfOrder(null)} className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg text-xs font-bold">
                Sulje
              </button>
              <button onClick={() => window.print()} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow">
                🖨️ Tulosta / Tallenna PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1 & 2 (Aloita/Lopeta) */}
      {startModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
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

      {stopModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
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
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-20 shadow-2xl print:hidden">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'orders' ? 'text-blue-400' : 'text-slate-400'}`}>📋 Työt</button>
          <button onClick={() => setActiveTab('materials')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'materials' ? 'text-blue-400' : 'text-slate-400'}`}>🛢️ Tarvikkeet</button>
          <button onClick={() => setActiveTab('newOrder')} className={`flex-1 py-1.5 text-center text-xs font-semibold flex flex-col items-center ${activeTab === 'newOrder' ? 'text-blue-400' : 'text-slate-400'}`}>📝 Uusi työ</button>
        </nav>
      )}
    </div>
  );
}
