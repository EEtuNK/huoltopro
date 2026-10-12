import React, { useState } from 'react';

export default function App() {
  const [hours, setHours] = useState(0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
      <div className="max-w-md mx-auto bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 mt-10">
        <h1 className="text-2xl font-bold text-blue-400 mb-1">HuoltoPro</h1>
        <p className="text-slate-400 text-sm mb-6">Työnohjaus & Tuntikirjaus</p>
        
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4 text-center">
          <span className="text-slate-400 text-xs block uppercase tracking-wider mb-1">Kertynyt liukumasaldo</span>
          <span className="text-3xl font-mono font-bold text-green-400">+12.5 h</span>
        </div>

        <button 
          onClick={() => setHours(hours + 1)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg shadow-lg mb-3"
        >
          Kirjaa 1h Työmääräykselle
        </button>

        <p className="text-center text-slate-400 text-xs">
          Kirjatut tunnit tänään: <span className="text-white font-bold">{hours} h</span>
        </p>
      </div>
    </div>
  );
}
