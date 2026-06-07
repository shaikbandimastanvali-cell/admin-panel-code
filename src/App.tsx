import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, enableIndexedDbPersistence, query, orderBy, limit, where, getDoc } from 'firebase/firestore';
import { Home, Trophy, User as UIcon, Wallet, Settings, LogOut, Users, Gamepad2, Plus, Edit, Trash2, Check, X, Search, Menu, ShieldAlert, Clock, ArrowUpRight, ArrowDownLeft, Info, PlayCircle, ChevronRight, CheckCircle2, Loader2, Link as LinkIcon, XCircle, Bell, Copy } from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyB1WhNWUsZ2CmZHMa_7DpP4_vx_AnN9g2E",
  authDomain: "ff-tournament-app-bd64e.firebaseapp.com",
  projectId: "ff-tournament-app-bd64e",
  storageBucket: "ff-tournament-app-bd64e.appspot.com",
  messagingSenderId: "577573646786",
  appId: "1:577573646786:web:f59e6ee9d3d7ed8182e65b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 🔥 OPTIMIZATION: ENABLE OFFLINE CACHE (SAVES MASSIVE READ COSTS) 🔥
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one open tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
} catch (e) {
  console.warn("Persistence catch error:", e);
}

const appId = 'ff-tournament-live-db';

const fDate = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleString();
};

// --- MODERN ASYNC CLIPBOARD API ---
const copyText = async (text, successCallback) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(text));
      successCallback?.();
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = String(text);
    textarea.style.position = "fixed";
    textarea.style.left = "-999999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (success) successCallback?.();
    else alert("Copy failed");
  } catch (err) {
    console.error(err);
    alert("Copy failed");
  }
};

const sendPushNotification = async ({ title, body, targetUids, data = {}, users }) => {
  let fcmTokens = [];
  if (targetUids[0] === 'all') {
    fcmTokens = users.filter(u => u.fcmToken && u.role === 'user').map(u => u.fcmToken);
  } else {
    fcmTokens = targetUids.map(uid => users.find(u => u.uid === uid)?.fcmToken).filter(Boolean);
  }

  const payload = {
    title, body, targetUids, fcmTokens,
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    android: { priority: 'high', notification: { sound: 'default', channel_id: 'tournament_alerts' } },
    apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default', 'content-available': 1 } } },
  };

  const res = await fetch('https://esports-tournament-app-beta.vercel.app/api/sendNotification', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Notification API returned ${res.status}: ${errText}`);
  }
  return res.json().catch(() => ({}));
};

export default function AdminApp() {
  const [fbUser, setFbUser] = useState(null); const [admin, setAdmin] = useState(null); const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ users: [], games: [], modes: [], tournaments: [], transactions: [], bannedDevices: [], messages: [] });
  const [settings, setSettings] = useState({ appName: 'Elite Esports', currencySymbol: '🪙', currencyName: 'Coins', upiId: '', referralBonusPercent: 10, minWithdraw: 10, minReferralWithdraw: 300, termsAndConditions: 'Play fair.', maintenance: false, maintenanceMsg: 'Updating app...', externalSupportLink: 'https://customer-support-six-ashy.vercel.app/' });

  // 🔥 ANTI-INSPECT / SOURCE CODE PROTECTION 🔥
  useEffect(() => {
    const handleContext = (e) => e.preventDefault();
    const handleKey = (e) => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('contextmenu', handleContext); document.removeEventListener('keydown', handleKey); };
  }, []);

  useEffect(() => {
    const init = async () => { try { if (typeof window !== 'undefined' && window.__initial_auth_token) await signInWithCustomToken(auth, window.__initial_auth_token); else await signInAnonymously(auth); } catch(e) { try { await signInAnonymously(auth); } catch(err) {} } };
    init(); return onAuthStateChanged(auth, u => { setFbUser(u); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    // 🔥 LOAD LIGHTWEIGHT COLLECTIONS GLOBALLY 🔥
    const unsubs = ['games','modes'].map(c => onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', c), s => setData(p => ({ ...p, [c]: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), d => { if (d.exists()) setSettings(p => ({...p, ...d.data()})); }));
    return () => unsubs.forEach(u => u());
  }, [fbUser]);

  useEffect(() => {
    const sid = localStorage.getItem('admin_uid');
    // Temporarily fetch admin user to verify login state if sid exists
    if (sid) {
      getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', sid)).then(snap => {
        if (snap.exists() && (snap.data().role === 'admin' || snap.data().role === 'staff')) {
          setAdmin({ id: snap.id, ...snap.data() });
        } else {
          localStorage.removeItem('admin_uid'); setAdmin(null);
        }
      });
    }
  }, []);

  const login = async (e) => {
    e.preventDefault();
    const em = e.target.em.value; const pw = e.target.pw.value;
    // Query db directly for login to bypass lazy loading limit
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', em), where('password', '==', pw));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const u = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (u.role === 'admin' || u.role === 'staff') {
        localStorage.setItem('admin_uid', u.uid);
        setAdmin(u);
        return;
      }
    }
    alert("Access Denied/Invalid");
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900"><Loader2 className="w-10 h-10 text-blue-500 animate-spin"/></div>;
  if (!admin) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4"><div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-xl overflow-hidden"><div className="p-6 bg-slate-950 text-center"><ShieldAlert className="w-12 h-12 text-blue-500 mx-auto mb-2"/><h2 className="text-xl font-black text-white uppercase tracking-widest">Admin Access</h2></div><form onSubmit={login} className="p-6 space-y-4"><input type="email" name="em" placeholder="Email" required className="w-full p-3 rounded-lg bg-slate-900 text-white border border-slate-700 outline-none focus:border-blue-500"/><input type="password" name="pw" placeholder="Password" required className="w-full p-3 rounded-lg bg-slate-900 text-white border border-slate-700 outline-none focus:border-blue-500"/><button className="w-full bg-blue-600 text-white font-black py-3 rounded-lg hover:bg-blue-700 uppercase tracking-widest cursor-pointer select-none">Login</button></form></div></div>
  );
  return <AdminLayout u={admin} data={data} setData={setData} sets={settings} out={() => {localStorage.removeItem('admin_uid'); setAdmin(null);}} />;
}

function AdminLayout({ u, data, setData, sets, out }) {
  const [view, setView] = useState('dashboard'); const [md, setMd] = useState(null);
  const acc = (s) => u.role === 'admin' || (u.permissions||[]).includes(s);
  const navs = [{i:'dashboard',ic:Home,l:'Dashboard'},{i:'users',ic:Users,l:'Users'},{i:'games',ic:Gamepad2,l:'Games & Modes'},{i:'tournaments',ic:Trophy,l:'Tournaments'},{i:'deposits',ic:ArrowDownLeft,l:'Deposits'},{i:'withdraws',ic:ArrowUpRight,l:'Withdraws'},{i:'messages',ic:Bell,l:'Messages'},{i:'staff',ic:ShieldAlert,l:'Staff'},{i:'deviceBans',ic:ShieldAlert,l:'Device Bans'},{i:'settings',ic:Settings,l:'Settings'}];

  // 🔥 LAZY LOADING LOGIC: EXTREMELY PRECISE QUERIES 🔥
  useEffect(() => {
    const baseRef = (col) => collection(db, 'artifacts', appId, 'public', 'data', col);
    let unsubs = [];

    if (view === 'dashboard' || view === 'deposits' || view === 'withdraws') {
      // 1. GUARANTEE WE ALWAYS GET PENDING TRANSACTIONS
      unsubs.push(onSnapshot(query(baseRef('transactions'), where('status', '==', 'pending')), snap => {
        setData(p => {
           const pend = snap.docs.map(d => ({ id: d.id, ...d.data() }));
           const hist = p.transactions.filter(x => x.status !== 'pending');
           const merged = [...hist.filter(h => !pend.find(x => x.id === h.id)), ...pend].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           return { ...p, transactions: merged };
        });
      }));
      // 2. GET RECENT HISTORY (Capped to save reads)
      unsubs.push(onSnapshot(query(baseRef('transactions'), orderBy('date', 'desc'), limit(150)), snap => {
        setData(p => {
           const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
           const pend = p.transactions.filter(x => x.status === 'pending');
           const merged = [...hist, ...pend.filter(x => !hist.find(h => h.id === x.id))].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           return { ...p, transactions: merged };
        });
      }));
    }

    if (view === 'users') {
      unsubs.push(onSnapshot(query(baseRef('users'), orderBy('joinedDate', 'desc'), limit(100)), s => setData(p => ({ ...p, users: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    }
    if (view === 'staff') {
      unsubs.push(onSnapshot(query(baseRef('users'), where('role', '==', 'staff')), s => setData(p => ({ ...p, users: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    }
    if (view === 'tournaments') {
      unsubs.push(onSnapshot(query(baseRef('tournaments'), orderBy('dateTime', 'desc'), limit(100)), s => setData(p => ({ ...p, tournaments: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    }
    if (view === 'messages') {
      unsubs.push(onSnapshot(query(baseRef('messages'), orderBy('createdAt', 'desc'), limit(100)), s => setData(p => ({ ...p, messages: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    }
    if (view === 'deviceBans') {
      unsubs.push(onSnapshot(query(baseRef('bannedDevices'), limit(100)), s => setData(p => ({ ...p, bannedDevices: s.docs.map(d => ({ id: d.id, ...d.data() })) }))));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [view, setData]);

  const vMap = {
    dashboard: <Dash d={data} s={sets}/>, users: <UserMgr d={data} md={setMd} s={sets} u={u}/>, games: <GamesMgr d={data} md={setMd} u={u}/>, tournaments: <TourneyMgr d={data} md={setMd} u={u} s={sets}/>,
    deposits: <FinMgr t="deposit" d={data} md={setMd} s={sets} u={u}/>, withdraws: <FinMgr t="withdraw" d={data} md={setMd} s={sets} u={u}/>, messages: <MessageMgr d={data} md={setMd} u={u}/>, staff: <StaffMgr d={data} md={setMd} u={u}/>, deviceBans: <DeviceBanMgr d={data} md={setMd} u={u}/>, settings: <SetMgr s={sets} md={setMd} u={u}/>
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden select-none">
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 z-20"><div className="p-5 bg-slate-950 flex items-center gap-3"><ShieldAlert className="text-blue-500 w-6 h-6"/><div><div className="font-black text-white tracking-widest">ADMIN PANEL</div><div className="text-[10px] text-blue-400 uppercase font-bold">{u.role}</div></div></div><div className="flex-1 overflow-y-auto p-3 space-y-1">{navs.map(n => acc(n.i==='deposits'||n.i==='withdraws'?'finance':n.i) && <button key={n.i} onClick={()=>setView(n.i)} className={`w-full flex items-center gap-3 p-3 rounded-lg font-bold text-xs uppercase tracking-widest cursor-pointer ${view===n.i?'bg-blue-600 text-white':'hover:bg-slate-800'}`}><n.ic className="w-4 h-4"/> {n.l}</button>)}</div><div className="p-4 bg-slate-950"><button onClick={out} className="w-full p-3 bg-rose-500/10 text-rose-500 font-bold rounded-lg text-xs uppercase hover:bg-rose-500 hover:text-white cursor-pointer"><LogOut className="inline w-4 h-4 mr-2"/> Logout</button></div></div>
      <div className="flex-1 flex flex-col h-full"><div className="bg-white p-5 shadow-sm hidden md:flex justify-between items-center"><h1 className="text-xl font-black uppercase text-slate-800 flex items-center gap-2"><Settings className="text-blue-600 w-5 h-5"/> {view.replace('_',' ')}</h1></div><div className="flex-1 overflow-y-auto p-4 md:p-6"><div className="max-w-6xl mx-auto">{!acc(view==='deposits'||view==='withdraws'?'finance':view)&&u.role!=='admin' ? <div className="p-10 text-center font-bold text-rose-500 bg-white rounded-xl">Restricted.</div> : vMap[view]}</div></div></div>
      {md && <UniModal m={md} sm={setMd} />}
    </div>
  );
}

function UniModal({ m, sm }) {
  const [i1, s1]=useState(m.d1||''); const [i2, s2]=useState(m.d2||''); const [i3, s3]=useState(m.d3||''); const [i4, s4]=useState(m.d4||''); const [i5, s5]=useState(m.d5||[]); 
  const [i6, s6]=useState(m.d6||0); const [i7, s7]=useState(m.d7||0); 
  const [prm, setP] = useState(m.dp||{dashboard:1,users:0,games:0,tournaments:0,finance:0});
  const [cd, setCd] = useState(m.reqTimer ? 5 : 0);

  useEffect(() => {
    if (cd > 0) { const timer = setTimeout(() => setCd(cd - 1), 1000); return () => clearTimeout(timer); }
  }, [cd]);

  const toggleUserSelection = (uid) => { s5(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]); };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95"><div className={`p-4 font-black uppercase text-white ${m.t==='err'?'bg-rose-500':m.t==='confirm'?'bg-amber-500':'bg-blue-600'}`}>{m.title}</div><div className="p-6 space-y-4 font-medium text-slate-700">{m.msg&&<p>{m.msg}</p>}
      {m.t==='estats'&&<div className="grid grid-cols-2 gap-4">
        <div><label className="text-[10px] font-black uppercase text-slate-400">Total Bal</label><input type="number" value={i1} onChange={e=>s1(e.target.value)} className="w-full p-2 border rounded font-black outline-none"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Win Bal</label><input type="number" value={i5} onChange={e=>s5(e.target.value)} className="w-full p-2 border rounded font-black outline-none"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Total Matches</label><input type="number" value={i6} onChange={e=>s6(e.target.value)} className="w-full p-2 border rounded font-black outline-none text-indigo-600"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Total Deposits</label><input type="number" value={i7} onChange={e=>s7(e.target.value)} className="w-full p-2 border rounded font-black outline-none text-blue-600"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Total Wins</label><input type="number" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-2 border rounded font-black outline-none"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Kills</label><input type="number" value={i3} onChange={e=>s3(e.target.value)} className="w-full p-2 border rounded font-black outline-none"/></div>
        <div><label className="text-[10px] font-black uppercase text-slate-400">Refers</label><input type="number" value={i4} onChange={e=>s4(e.target.value)} className="w-full p-2 border rounded font-black outline-none"/></div>
      </div>}

      {m.t==='message'&&<div className="space-y-3">
        <select value={i3||'all'} onChange={e=>s3(e.target.value)} className="w-full p-3 border rounded-lg font-bold outline-none cursor-pointer">
          <option value="all">Broadcast to All Users</option>
          <option value="specific">Send to Specific Users</option>
        </select>
        {i3 === 'specific' && <input type="text" placeholder="Search Email, Name, or UID..." value={i4} onChange={e=>{s4(e.target.value);}} className="w-full p-3 border rounded-lg font-bold outline-none border-blue-300"/>}
        {i3 === 'specific' && i4.length > 0 && (
          <div className="max-h-32 overflow-y-auto border rounded-lg bg-slate-50 p-2 text-xs space-y-1 shadow-inner">
            {m.ul.filter(u => u.email?.toLowerCase().includes(i4.toLowerCase()) || u.uid?.includes(i4) || u.name?.toLowerCase().includes(i4.toLowerCase())).map(u => (
              <div key={u.uid} onClick={()=>toggleUserSelection(u.uid)} className={`p-2 rounded cursor-pointer font-bold flex justify-between items-center ${i5.includes(u.uid)?'bg-blue-500 text-white shadow-sm':'bg-white border hover:bg-blue-50'}`}>
                <span>{u.name} ({u.email})</span>
                {i5.includes(u.uid) && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            ))}
          </div>
        )}
        {i3 === 'specific' && i5.length > 0 && <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{i5.length} Users Selected</div>}
        <input type="text" placeholder="Message Title" value={i1} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-bold outline-none"/>
        <textarea placeholder="Message Body" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-3 border rounded-lg h-32 font-bold outline-none"/>
      </div>}

      {m.t==='game'&&<><input type="text" placeholder="Game Name" value={i1} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-bold"/><input type="text" placeholder="Banner URL" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-3 border rounded-lg"/></>}
      {m.t==='mode'&&<><select value={i1} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-bold"><option value="">Select Game</option>{m.gl.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><input type="text" placeholder="Mode Name" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-3 border rounded-lg font-bold"/><input type="number" placeholder="Priority Number (e.g. 1, 2, 3)" value={i4} onChange={e=>s4(e.target.value)} className="w-full p-3 border rounded-lg font-bold"/><input type="text" placeholder="Banner URL" value={i3} onChange={e=>s3(e.target.value)} className="w-full p-3 border rounded-lg"/></>}
      {m.t==='room'&&<><input type="text" placeholder="Room ID" value={i1} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-black text-xl"/><input type="text" placeholder="Password" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-3 border rounded-lg font-black text-xl"/></>}
      {m.t==='staff'&&<><input type="email" placeholder="User Email" value={i1} disabled={m.ed} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-bold disabled:bg-slate-100"/><div className="grid grid-cols-2 gap-2">{['dashboard','users','games','tournaments','finance'].map(k=><button key={k} onClick={()=>setP({...prm,[k]:!prm[k]})} className={`p-2 rounded border text-xs font-bold uppercase flex justify-between cursor-pointer ${prm[k]?'bg-blue-50 border-blue-500 text-blue-700':''}`}>{k} {prm[k]&&<CheckCircle2 className="w-4 h-4"/>}</button>)}</div></>}
      {m.t==='social'&&<><input type="text" placeholder="Platform Name" value={i1} onChange={e=>s1(e.target.value)} className="w-full p-3 border rounded-lg font-bold"/><input type="text" placeholder="Profile URL" value={i2} onChange={e=>s2(e.target.value)} className="w-full p-3 border rounded-lg font-medium"/><input type="text" placeholder="Icon URL (Optional)" value={i3} onChange={e=>s3(e.target.value)} className="w-full p-3 border rounded-lg font-medium"/></>}
    </div><div className="p-4 bg-slate-50 border-t flex justify-end gap-2">{m.onC&&<button onClick={()=>sm(null)} className="px-4 font-bold text-slate-500 cursor-pointer">Cancel</button>}<button disabled={cd>0} onClick={()=>{if(m.onC){m.t==='staff'?m.onC(i1,Object.keys(prm).filter(x=>prm[x])) : m.t==='message'?m.onC(i1,i2,i3||'all',i4,i5) : m.t==='estats'?m.onC(i1,i2,i3,i4,i5,i6,i7) : m.onC(i1,i2,i3,i4,i5);} sm(null);}} className={`px-6 py-2 text-white font-black rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${m.t==='err'||m.reqTimer?'bg-rose-500':m.t==='confirm'?'bg-amber-600':'bg-blue-600'}`}>{cd>0?`Wait ${cd}s`:'OK'}</button></div></div></div>
  );
}

function Dash({ d, s }) {
  const td = new Date().toISOString().split('T')[0];
  const ttx = d.transactions.filter(t=>t.date.startsWith(td) && t.status==='completed');
  const atx = d.transactions.filter(t=>t.status==='completed');
  const d_t = ttx.filter(x=>x.type.includes('deposit')).reduce((a,c)=>a+Number(c.amount),0);
  const d_a = atx.filter(x=>x.type.includes('deposit')).reduce((a,c)=>a+Number(c.amount),0);
  const w_t = Math.abs(ttx.filter(x=>x.type.includes('withdraw')).reduce((a,c)=>a+Number(c.amount),0));
  const w_a = Math.abs(atx.filter(x=>x.type.includes('withdraw')).reduce((a,c)=>a+Number(c.amount),0));
  const p_d = d.transactions.filter(t=>t.type==='deposit_pending'&&t.status==='pending').length;

  // The Dashboard is visually clear about its limits now.
  const bx = (l, tv, av, c) => <div className="bg-white p-6 rounded-2xl border shadow-sm relative"><div className="text-sm font-black uppercase text-slate-400 mb-4">{l}</div><div className="grid grid-cols-2 gap-2"><div className="border-r pr-2"><div className="text-[10px] font-bold text-slate-400 uppercase">Today</div><div className={`text-2xl font-black ${c}`}>{tv}</div></div><div><div className="text-[10px] font-bold text-slate-400 uppercase">All Time</div><div className={`text-2xl font-black ${c}`}>{av}</div></div></div><div className="absolute top-4 right-4 text-[8px] bg-rose-100 text-rose-600 px-2 py-1 rounded font-black uppercase tracking-widest">Requires Stats Doc</div></div>;

  return <div className="space-y-6">
    <div className="grid md:grid-cols-3 gap-4">{bx("Registered Users", d.users.filter(u=>u.joinedDate&&u.joinedDate.startsWith(td)&&u.role==='user').length, d.users.filter(u=>u.role==='user').length, "text-blue-600")} {bx("Deposits", d_t, d_a, "text-emerald-600")} {bx("Withdraws", w_t, w_a, "text-rose-600")}</div>
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 flex justify-between"><div className="font-black text-amber-800"><div className="text-xs uppercase tracking-widest text-amber-600">Pending Deposits</div><div className="text-3xl mt-1">{p_d} Actions Required</div></div><Clock className="w-12 h-12 text-amber-500 opacity-50"/></div>
      <div className={`p-6 rounded-2xl border flex justify-between bg-blue-50 border-blue-200`}>
        <div className={`font-black text-blue-800`}>
          <div className={`text-xs uppercase tracking-widest text-blue-600`}>Cost Saving Mode</div>
          <div className="text-sm mt-2 font-medium opacity-80 max-w-[200px]">Dashboard totals are capped to save Firebase billing reads.</div>
        </div>
        <ShieldAlert className={`w-12 h-12 opacity-50 text-blue-500`}/>
      </div>
    </div>
  </div>;
}

function UserMgr({ d, md, s, u: adminUser }) {
  const [q, sq] = useState(''); const [srt, setSrt] = useState('joinedDate'); const [su, setSu] = useState(null); const [sp, setSp] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [cMsg, setCMsg] = useState('');

  const cT = (text) => { copyText(text); setCMsg('Copied!'); setTimeout(()=>setCMsg(''), 2000); };

  let f = d.users.filter(u => {
    if (u.role !== 'user') return false;
    if (q) {
      const searchStr = q.toLowerCase();
      const nMatch = (u.name || '').toLowerCase().includes(searchStr);
      const eMatch = (u.email || '').toLowerCase().includes(searchStr);
      const uMatch = String(u.uid || '').toLowerCase().includes(searchStr);
      const guMatch = String(u.gameUid || '').toLowerCase().includes(searchStr);
      if (!(nMatch || eMatch || uMatch || guMatch)) return false;
    }
    if (filterType === 'banned') return u.isBanned;
    if (filterType === 'bannedDevice') return d.bannedDevices.some(b => b.deviceId === u.deviceId);
    if (filterType === 'rooted') return u.isRooted;
    return true;
  }).sort((a,b)=>{if(srt==='joinedDate')return new Date(b.joinedDate)-new Date(a.joinedDate); return (Number(b[srt])||0)-(Number(a[srt])||0);});

  if (su) {
    const invWithDeps = d.users.filter(u=>u.referredBy===su.uid).map(i => {
      const deps = d.transactions.filter(tx => tx.uid === i.uid && tx.type.includes('deposit') && tx.status === 'completed').reduce((sum, tx) => sum + Number(tx.amount), 0);
      return { ...i, totalDeposited: deps };
    }).sort((a,b) => b.totalDeposited - a.totalDeposited);

    const totalDepositedByRefers = invWithDeps.reduce((sum, i) => sum + i.totalDeposited, 0);

    return (
      <div className="bg-white p-6 rounded-2xl border shadow-sm animate-in slide-in-from-right-8"><button onClick={()=>setSu(null)} className="mb-4 bg-slate-100 px-4 py-2 rounded-lg font-bold text-xs uppercase cursor-pointer">Back</button>
      {cMsg && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-xl z-50 font-black shadow-lg animate-in fade-in zoom-in">{cMsg}</div>}
      <div className="grid md:grid-cols-2 gap-6">
        <div><h3 className="font-black text-xl mb-4">Profile</h3><div className="bg-slate-50 p-5 rounded-xl border space-y-3"><div><div className="text-[10px] font-bold text-slate-400 uppercase">Name & IGN</div><div onClick={()=>cT(su.name)} className="font-black text-lg cursor-pointer hover:text-blue-600 transition-colors" title="Click to copy">{su.name} <span className="text-blue-600 text-sm">({su.gameName||'N/A'})</span></div></div><div><div className="text-[10px] font-bold text-slate-400 uppercase">UID & Email</div><div className="font-mono font-bold text-sm cursor-pointer hover:text-blue-600 transition-colors" title="Click to copy" onClick={()=>cT(`${su.gameUid || su.uid} | ${su.email}`)}>{su.gameUid || su.uid} | {su.email}</div></div><div><div className="text-[10px] font-bold text-slate-400 uppercase">Password</div><div className="flex gap-2 items-center font-mono font-bold bg-white p-2 rounded border w-max">{sp?su.password:'••••••••'} <button onClick={()=>setSp(!sp)} className="text-blue-600 text-xs ml-2 underline cursor-pointer">{sp?'Hide':'Show'}</button></div></div>
          <div><div className="text-[10px] font-bold text-slate-400 uppercase">Push Notifications</div><div className={`text-xs font-black px-2 py-1 rounded w-max ${su.fcmToken ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{su.fcmToken ? '✓ FCM Token Registered' : '✗ No FCM Token (won\'t get push)'}</div></div>
        </div><div className="mt-4 flex gap-2"><button onClick={async ()=>{ try { await updateDoc(doc(db,'artifacts',appId,'public','data','users',su.uid),{isBanned:!su.isBanned}); md({t:'alert',title:'Success',msg:`User ${su.isBanned ? 'unbanned' : 'banned'} successfully`}); } catch(err){ md({t:'err',title:'Error',msg:err.message}); } }} className={`flex-1 py-3 rounded-lg font-black uppercase text-xs text-white cursor-pointer ${su.isBanned?'bg-emerald-500':'bg-rose-500'}`}>{su.isBanned?'Unban':'Ban'} User</button>
        {adminUser.role === 'admin' && <button onClick={()=>md({t:'confirm', title:'Delete User', msg:'Permanently delete this user?', onC:()=>{deleteDoc(doc(db,'artifacts',appId,'public','data','users',su.uid)); setSu(null);}})} className="flex-1 py-3 rounded-lg font-black uppercase text-xs bg-rose-100 text-rose-700 cursor-pointer">Delete</button>}
        </div>
        <button onClick={async ()=>{ if(!su.deviceId) return md({t:'err',title:'Error',msg:"No device ID recorded for this user yet. User must log in first."}); try { await setDoc(doc(db,'artifacts',appId,'public','data','bannedDevices',su.uid),{deviceId:su.deviceId, bannedAt:new Date().toISOString()}); md({t:'alert',title:'Success',msg:'Hardware Device Banned Successfully'}); } catch(err){ md({t:'err',title:'Error',msg:err.message}); } }} className="w-full mt-2 py-3 rounded-lg font-black uppercase text-xs bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-colors">Ban Hardware Device</button>
        </div>
        <div><div className="flex justify-between items-center mb-4"><h3 className="font-black text-xl">Stats</h3><button onClick={()=>md({t:'estats',title:'Edit Stats',d1:su.balance,d2:su.totalWinnings,d3:su.totalKills,d4:su.totalRefers,d5:su.winningBalance,d6:su.totalMatches,d7:su.depositBalance,onC:(b,w,k,r,wb,tm,td)=>{updateDoc(doc(db,'artifacts',appId,'public','data','users',su.uid),{balance:Number(b),winningBalance:Number(wb),totalWinnings:Number(w),totalKills:Number(k),totalRefers:Number(r),totalMatches:Number(tm),depositBalance:Number(td)}); setSu({...su,balance:Number(b),winningBalance:Number(wb),totalWinnings:Number(w),totalKills:Number(k),totalRefers:Number(r),totalMatches:Number(tm),depositBalance:Number(td)});}})} className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold uppercase cursor-pointer"><Edit className="w-3 h-3 inline"/> Edit</button></div>
        <div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100"><div className="text-[10px] font-black uppercase text-emerald-700">Balance</div><div className="text-2xl font-black text-emerald-600">{su.balance}</div></div><div className="bg-purple-50 p-3 rounded-lg border border-purple-100"><div className="text-[10px] font-black uppercase text-purple-700">Winnings</div><div className="text-2xl font-black text-purple-600">{su.totalWinnings||0}</div></div><div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><div className="text-[10px] font-black uppercase text-blue-700">Kills</div><div className="text-2xl font-black text-blue-600">{su.totalKills||0}</div></div><div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100"><div className="text-[10px] font-black uppercase text-indigo-700">Refers</div><div className="text-2xl font-black text-indigo-600">{su.totalRefers||0}</div></div><div className="bg-slate-100 p-3 rounded-lg border border-slate-200"><div className="text-[10px] font-black uppercase text-slate-700">Total Matches</div><div className="text-2xl font-black text-slate-800">{su.totalMatches||0}</div></div><div className="bg-slate-100 p-3 rounded-lg border border-slate-200"><div className="text-[10px] font-black uppercase text-slate-700">Deposit Bal</div><div className="text-2xl font-black text-slate-800">{su.depositBalance||0}</div></div>
        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 col-span-full"><div className="text-[10px] font-black uppercase text-orange-700">Total Deposited by Referrals</div><div className="text-2xl font-black text-orange-600">{totalDepositedByRefers} {s.currencySymbol}</div></div>
        </div>
        <div className="bg-slate-50 border rounded-xl p-4"><h4 className="font-black text-xs uppercase mb-3">Invited Users ({invWithDeps.length})</h4>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {invWithDeps.map(i=>(
            <div key={i.uid} className="bg-white p-3 border rounded flex flex-col gap-1">
              <div className="flex justify-between items-center"><div className="font-black text-sm uppercase">{i.name}</div><div className="text-emerald-600 font-black text-xs text-right">Deposited: {i.totalDeposited} {s.currencySymbol}</div></div>
              <div className="text-[10px] font-bold text-slate-500">{i.email} | UID: {i.gameUid || i.uid}</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Joined: {fDate(i.joinedDate)}</div>
            </div>
          ))}
        </div></div></div>
      </div></div>
    );
  }

  return <div className="bg-white rounded-2xl border flex flex-col h-[80vh]">
    <div className="p-4 bg-slate-50 border-b flex justify-between items-center flex-wrap gap-3">
      <div className="flex gap-3 flex-1 min-w-[300px]">
        <input type="text" placeholder="Search by UID, Name, Email..." value={q} onChange={e=>sq(e.target.value)} className="p-2 border rounded-lg font-bold text-sm flex-1 outline-none"/>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="p-2 border rounded-lg font-bold text-sm uppercase text-slate-600 outline-none cursor-pointer">
          <option value="all">All Users</option><option value="banned">Banned Users</option><option value="bannedDevice">Banned Devices</option><option value="rooted">Rooted Devices</option>
        </select>
        <select value={srt} onChange={e=>setSrt(e.target.value)} className="p-2 border rounded-lg font-bold text-sm uppercase text-slate-600 outline-none cursor-pointer"><option value="joinedDate">Date Joined</option><option value="totalKills">Kills</option><option value="totalWinnings">Earned</option><option value="totalRefers">Refers</option><option value="balance">Balance</option></select>
      </div>
    </div>
    <div className="flex-1 overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10"><tr><th className="p-4">User</th><th className="p-4">Game Info</th><th className="p-4">Stats</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y">{f.map(u=><tr key={u.uid} onClick={()=>setSu(u)} className="hover:bg-blue-50 cursor-pointer transition-colors"><td className="p-4"><div className="font-black text-base">{u.name}</div><div className="text-[10px] font-bold text-slate-400">{u.email}</div></td><td className="p-4"><div className="font-bold text-blue-600">{u.gameName||'N/A'}</div><div className="text-[10px] font-mono">{u.gameUid || u.uid}</div></td><td className="p-4 font-black text-xs space-x-2"><span className="text-emerald-600">{u.balance}B</span><span className="text-blue-600">{u.totalKills||0}K</span><span className="text-purple-600">{u.totalWinnings||0}W</span></td><td className="p-4">{u.isBanned?<span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[9px] font-black uppercase mr-1">Banned</span>:<span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-black uppercase mr-1">Active</span>}{u.isRooted && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[9px] font-black uppercase mr-1">Rooted</span>}{!u.fcmToken && <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[9px] font-black uppercase">No Push</span>}</td></tr>)}</tbody></table></div></div>;
}

function DeviceBanMgr({ d, md, u: adminUser }) {
  return (
    <div className="bg-white p-6 rounded-2xl border">
      <h2 className="text-xl font-black uppercase mb-6 flex justify-between items-center">Banned Devices</h2>
      <div className="space-y-3">
        {d.bannedDevices.length === 0 && <div className="text-slate-500 font-bold p-6 bg-slate-50 text-center rounded-xl">No banned devices found.</div>}
        {d.bannedDevices.map(b => (
          <div key={b.id} className="p-4 border rounded-xl flex justify-between items-center">
            <div><div className="font-black">{b.deviceId}</div><div className="text-xs text-slate-400">{fDate(b.bannedAt)}</div></div>
            {adminUser.role === 'admin' && <button onClick={() => md({t:'confirm',title:'Unban Device?',msg:'Confirm unban',onC:async()=>{try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bannedDevices', b.id)); md({t:'alert',title:'Success',msg:'Device unbanned successfully'}); } catch (err) { md({t:'err',title:'Error',msg:err.message}); }}})} className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-black text-xs cursor-pointer">UNBAN</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageMgr({ d, md, u: adminUser }) {
  const sorted = [...(d.messages || [])].sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border">
        <h2 className="text-xl font-black uppercase">Messages & Notifications</h2>
        <div className="flex gap-2">
          <button onClick={() => md({t:'message', title:'New Message', ul: d.users, onC: async (title, body, targetType, searchTxt, targetUids) => {
            if(!title || !body) return;
            if(targetType === 'specific' && (!targetUids || targetUids.length === 0)) return md({t:'err', title:'Error', msg:'Please select at least one user.'});
            try {
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), { title, body, createdAt: new Date().toISOString(), readBy: [], targetUids: targetType === 'specific' ? targetUids : ['all'] });
              await sendPushNotification({ title, body, targetUids: targetType === 'specific' ? targetUids : ['all'], users: d.users });
              md({t:'alert', title:'Success', msg:'Message pushed successfully'});
            } catch(e) { md({t:'err', title:'Notification Error', msg:e.message}); }
          }})} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer"><Plus className="w-4 h-4 inline"/> Create</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="divide-y">
          {sorted.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No messages found.</div>}
          {sorted.map(m => (
            <div key={m.id} className="p-5 hover:bg-slate-50 transition-colors flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="font-black text-lg text-slate-800 uppercase">{m.title} {m.targetUids && m.targetUids[0] !== 'all' && <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded ml-2 align-middle">PRIVATE MESSAGE</span>}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-2">{fDate(m.createdAt)}</div>
                <div className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{m.body}</div>
                <div className="text-[10px] text-blue-500 font-bold uppercase mt-3 tracking-widest">Read by: {(m.readBy || []).length} users</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => md({t:'message', title:'Edit Message', d1: m.title, d2: m.body, ul: d.users, onC: async (title, body) => {
                  if(!title || !body) return;
                  try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', m.id), { title, body }); md({t:'alert', title:'Success', msg:'Message updated successfully'}); } catch(e) { md({t:'err', title:'Error', msg:e.message}); }
                }})} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer"><Edit className="w-4 h-4"/></button>
                {adminUser.role === 'admin' && <button onClick={() => md({t:'confirm', title:'Delete Message', msg:'Permanently delete this message for all users?', onC: async () => {
                  try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', m.id)); md({t:'alert', title:'Success', msg:'Message deleted'}); } catch(e) { md({t:'err', title:'Error', msg:e.message}); }
                }})} className="p-2 bg-rose-50 text-rose-600 rounded hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><Trash2 className="w-4 h-4"/></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamesMgr({ d, md, u }) {
  return <div className="space-y-6"><div className="flex justify-between items-center bg-white p-6 rounded-2xl border"><h2 className="font-black text-xl uppercase">Games & Modes</h2><div className="flex gap-2">
    <button onClick={()=>md({t:'mode',title:'Add Mode',gl:d.games,onC:(g,n,b,p)=>{if(g&&n)addDoc(collection(db,'artifacts',appId,'public','data','modes'),{gameId:g,name:n,bannerUrl:b,priority:Number(p||0),createdBy:u.name})}})} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-black text-xs uppercase cursor-pointer">Add Mode</button><button onClick={()=>md({t:'game',title:'Add Game',onC:(n,b)=>{if(n)addDoc(collection(db,'artifacts',appId,'public','data','games'),{name:n,bannerUrl:b,createdBy:u.name})}})} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-xs uppercase cursor-pointer">Add Game</button></div></div><div className="grid md:grid-cols-2 gap-6">{d.games.map(g=><div key={g.id} className="bg-white rounded-2xl border overflow-hidden"><div className="h-32 bg-slate-900 relative">{g.bannerUrl?<img src={g.bannerUrl} className="w-full h-full object-cover opacity-60"/>:<Gamepad2 className="m-auto mt-8 text-white/20 w-12 h-12"/>}<div className="absolute bottom-2 left-4 text-white font-black text-2xl uppercase">{g.name}</div><div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[8px] font-bold text-white uppercase">By: {g.createdBy||'Admin'}</div>
    {u.role === 'admin' && <button onClick={()=>{const hasModes = d.modes.some(m => m.gameId === g.id); if (hasModes) return md({t: 'err', title: 'Cannot Delete', msg: 'Please delete all modes inside this game first.'}); md({t: 'confirm', title: 'Delete Game', msg: `Are you sure you want to delete ${g.name}?`, onC: () => deleteDoc(doc(db,'artifacts',appId,'public','data','games',g.id))})}} className="absolute top-2 right-2 p-1.5 bg-rose-500 rounded text-white cursor-pointer hover:bg-rose-600 transition-colors"><Trash2 className="w-4 h-4"/></button>}
    </div><div className="p-4 bg-slate-50 space-y-2">{d.modes.filter(m=>m.gameId===g.id).sort((a,b)=>(a.priority||0)-(b.priority||0)).map(m=><div key={m.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center"><div className="font-bold text-sm uppercase">{m.name} <span className="text-[9px] text-slate-400 block normal-case">By: {m.createdBy||'Admin'} | Priority: {m.priority||0}</span></div>
    <div className="flex gap-2">
      {u.role === 'admin' && <button onClick={()=>md({t:'mode', title:'Edit Mode', gl:d.games, d1:m.gameId, d2:m.name, d3:m.bannerUrl, d4:m.priority, onC:(ga,na,ba,pr)=>{updateDoc(doc(db,'artifacts',appId,'public','data','modes',m.id), {gameId:ga, name:na, bannerUrl:ba, priority:Number(pr||0)})}})} className="text-blue-500 cursor-pointer p-2 hover:bg-blue-50 rounded"><Edit className="w-4 h-4"/></button>}
      {u.role === 'admin' && <button onClick={()=>md({t: 'confirm', title: 'Delete Mode', msg: `Delete ${m.name}?`, onC: () => deleteDoc(doc(db,'artifacts',appId,'public','data','modes',m.id))})} className="text-rose-500 cursor-pointer p-2 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4"/></button>}
    </div>
    </div>)}</div></div>)}</div></div>;
}

// 🔥 TOURNEY MGR: FIXED PAYOUTS DUE TO LAZY LOADING 🔥
function TourneyMgr({ d, md, u, s }) {
  const [fo, setFo] = useState(false); const [fd, setFd] = useState({gameId:'',modeId:'',title:'',bannerUrl:'',customText:'',dateTime:'',type:'solo',perKill:0,entryFee:0,totalSlots:48,status:'upcoming'}); const [tb, setTb] = useState('active');
  const [isPublishing, setIsPublishing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const sv = async (e) => {
    e.preventDefault();
    if(!fd.modeId)return;
    try {
      if (editId) {
        await updateDoc(doc(db,'artifacts',appId,'public','data','tournaments',editId), {...fd});
        setEditId(null);
      } else {
        await addDoc(collection(db,'artifacts',appId,'public','data','tournaments'),{...fd,joinedUsers:[],results:[],createdBy:u.name});
      }
      setFo(false);
      md({t:'alert',title:'Success',msg:'Updated successfully'});
    } catch(err) {
      md({t:'err',title:'Error',msg:err.message});
    }
  };

  const st = (t, ns) => {
    if(ns==='cancelled'){
      if(t.status === 'cancelled') return;
      md({
        t:'confirm',title:'Cancel Match?',msg:'This moves to History and refunds players.',
        onC:async ()=>{
          try {
            await Promise.all((t.joinedUsers||[]).map(async ju=>{
              const uid = ju.uid || ju;
              const uuSnap = await getDoc(doc(db,'artifacts',appId,'public','data','users',uid));
              if(uuSnap.exists()) {
                const uu = uuSnap.data();
                await updateDoc(doc(db,'artifacts',appId,'public','data','users',uid), { balance: Number(uu.balance||0)+Number(t.entryFee), depositBalance: Number(uu.depositBalance||0)+Number(t.entryFee) });
                await addDoc(collection(db,'artifacts',appId,'public','data','transactions'),{uid,type:'refund',amount:t.entryFee,description:`Refund: ${t.title}`,status:'completed',date:new Date().toISOString()});
              }
            }));
            await updateDoc(doc(db,'artifacts',appId,'public','data','tournaments',t.id),{status:ns});
            md({t:'alert',title:'Success',msg:'Updated successfully'});
          } catch (err) {
            md({t:'err',title:'Error',msg:err.message});
          }
        }
      });
    } else {
      try {
        updateDoc(doc(db,'artifacts',appId,'public','data','tournaments',t.id),{status:ns});
        md({t:'alert',title:'Success',msg:'Updated successfully'});
      } catch(err) {
        md({t:'err',title:'Error',msg:err.message});
      }
    }
  };

  const [rt, setRt] = useState(null); const [rd, setRd] = useState({}); const [rn, setRn] = useState('');
  
  // DYNAMIC USER FETCH FOR RESULTS
  const oR = async (t) => { 
     setIsLoadingResults(true);
     const o={}; 
     try {
         await Promise.all((t.joinedUsers||[]).map(async ju => {
            const id = ju.uid || ju;
            const uSnap = await getDoc(doc(db,'artifacts',appId,'public','data','users',id));
            const uName = uSnap.exists() ? (uSnap.data().gameName || uSnap.data().name) : 'Player';
            o[id] = { gameName: uName, kills: 0, earned: 0, uid: id };
         }));
         setRd(o); setRn(t.customText||''); setRt(t); 
     } catch(e) {
         md({t:'err', title:'Error', msg: 'Failed to load players.'});
     }
     setIsLoadingResults(false);
  };

  const sR = () => {
    const a=Object.values(rd);
    md({
      t:'confirm',title:'Publish Results?',msg:`Pay ${a.filter(x=>x.earned>0).length} winners?`,
      onC:async ()=>{
        setIsPublishing(true);
        try {
          await updateDoc(doc(db,'artifacts',appId,'public','data','tournaments',rt.id),{status:'result',results:a,customText:rn});
          await Promise.all(a.map(async r=>{
            if(r.earned>0||r.kills>0){
              const xuSnap = await getDoc(doc(db,'artifacts',appId,'public','data','users',r.uid));
              if (xuSnap.exists()) {
                 const xu = xuSnap.data();
                 const up={};
                 if(r.earned>0){
                   up.balance=Number(xu.balance||0)+Number(r.earned);
                   up.winningBalance=Number(xu.winningBalance||0)+Number(r.earned);
                   up.totalWinnings=Number(xu.totalWinnings||0)+Number(r.earned);
                   await addDoc(collection(db,'artifacts',appId,'public','data','transactions'),{uid:r.uid,type:'winnings',amount:r.earned,description:`Won: ${rt.title}`,status:'completed',date:new Date().toISOString()});
                 }
                 if(r.kills>0) up.totalKills=Number(xu.totalKills||0)+Number(r.kills);
                 await updateDoc(doc(db,'artifacts',appId,'public','data','users',r.uid),up);
              }
            }
          }));
          setRt(null);
          md({t:'alert',title:'Success',msg:'Updated successfully'});
        } catch(err) {
          md({t:'err',title:'Error',msg:err.message});
        } finally {
          setIsPublishing(false);
        }
      }
    });
  };

  if(rt) return <div className="bg-white p-6 rounded-2xl border"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black uppercase">Results: {rt.title}</h2><div className="flex gap-2"><button disabled={isPublishing} onClick={()=>setRt(null)} className="px-4 py-2 bg-slate-100 font-bold rounded-lg cursor-pointer disabled:opacity-50">Cancel</button><button disabled={isPublishing} onClick={sR} className="px-4 py-2 bg-emerald-600 text-white font-black rounded-lg uppercase cursor-pointer disabled:opacity-50">{isPublishing ? 'Publishing...' : 'Publish'}</button></div></div><textarea value={rn} onChange={e=>setRn(e.target.value)} placeholder="Custom instructions/notes for this match..." className="w-full p-3 border rounded-lg mb-4 outline-none font-bold"/><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-[10px] uppercase font-black"><tr><th className="p-3">Player</th><th className="p-3 text-center">Kills</th><th className="p-3 text-right">Earned</th></tr></thead><tbody>{Object.values(rd).map(r=><tr key={r.uid}><td className="p-3 font-bold uppercase">{r.gameName}</td><td className="p-3 text-center"><input type="number" min="0" value={r.kills} onChange={e=>setRd({...rd,[r.uid]:{...r,kills:Number(e.target.value)}})} className="w-20 p-2 border rounded font-black text-center outline-none"/></td><td className="p-3 text-right"><input type="number" min="0" value={r.earned} onChange={e=>setRd({...rd,[r.uid]:{...r,earned:Number(e.target.value)}})} className="w-24 p-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded font-black text-right outline-none"/></td></tr>)}</tbody></table></div>;

  return <div className="space-y-6"><div className="flex justify-between items-center bg-white p-6 rounded-2xl border"><h2 className="text-xl font-black uppercase">Tournaments</h2><button onClick={()=>{setFd({gameId:'',modeId:'',title:'',bannerUrl:'',customText:'',dateTime:'',type:'solo',perKill:0,entryFee:0,totalSlots:48,status:'upcoming'}); setEditId(null); setFo(!fo);}} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer"><Plus className="w-4 h-4 inline"/> Create</button></div>
    {fo&&<form onSubmit={sv} className="bg-white p-6 rounded-2xl border-2 border-blue-200 grid md:grid-cols-2 gap-4"><select required value={fd.gameId} onChange={e=>setFd({...fd,gameId:e.target.value,modeId:''})} className="p-3 border rounded-xl font-bold outline-none cursor-pointer"><option value="">Game...</option>{d.games.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select required disabled={!fd.gameId} value={fd.modeId} onChange={e=>setFd({...fd,modeId:e.target.value})} className="p-3 border rounded-xl font-bold outline-none cursor-pointer"><option value="">Mode...</option>{d.modes.filter(m=>m.gameId===fd.gameId).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><input required type="text" placeholder="Title" value={fd.title} onChange={e=>setFd({...fd,title:e.target.value})} className="p-3 border rounded-xl font-bold"/><input type="datetime-local" required value={fd.dateTime} onChange={e=>setFd({...fd,dateTime:e.target.value})} className="p-3 border rounded-xl font-bold"/><div className="flex gap-2 col-span-full"><input required type="number" placeholder="Fee" value={fd.entryFee} onChange={e=>setFd({...fd,entryFee:Number(e.target.value)})} className="flex-1 p-3 border rounded-xl font-black text-blue-600"/><input required type="number" placeholder="Per Kill" value={fd.perKill} onChange={e=>setFd({...fd,perKill:Number(e.target.value)})} className="flex-1 p-3 border rounded-xl font-black text-emerald-600"/><input required type="number" placeholder="Slots" value={fd.totalSlots} onChange={e=>setFd({...fd,totalSlots:Number(e.target.value)})} className="flex-1 p-3 border rounded-xl font-black"/></div><input type="text" placeholder="Banner URL" value={fd.bannerUrl} onChange={e=>setFd({...fd,bannerUrl:e.target.value})} className="col-span-full p-3 border rounded-xl font-bold"/><textarea value={fd.customText} onChange={e=>setFd({...fd,customText:e.target.value})} placeholder="Custom Instructions/Rules" className="col-span-full p-3 border rounded-xl font-bold outline-none h-24"/><button className="col-span-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase cursor-pointer">{editId ? 'UPDATE MATCH' : 'SAVE MATCH'}</button></form>}
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex bg-slate-50 border-b justify-between items-center pr-4">
        <div className="flex flex-1">
          <button onClick={()=>setTb('active')} className={`flex-1 py-4 font-black uppercase text-xs cursor-pointer ${tb==='active'?'text-blue-600 border-b-2 border-blue-600':'text-slate-500'}`}>Active</button>
          <button onClick={()=>setTb('history')} className={`flex-1 py-4 font-black uppercase text-xs cursor-pointer ${tb==='history'?'text-emerald-600 border-b-2 border-emerald-600':'text-slate-500'}`}>History</button>
        </div>
      </div>
      <div className="divide-y">
      {d.tournaments.filter(t=>tb==='active'?t.status!=='result'&&t.status!=='cancelled':(t.status==='result'||t.status==='cancelled')).sort((a,b)=>new Date(b.dateTime).getTime()-new Date(a.dateTime).getTime()).map(t=>{
        if(tb==='history') return <details key={t.id} className="p-5 bg-white group cursor-pointer"><summary className="list-none font-black text-lg uppercase outline-none flex justify-between items-center"><div className="flex items-center gap-3">{t.status==='cancelled'?<XCircle className="text-rose-500 w-5 h-5"/>:<Trophy className="text-emerald-500 w-5 h-5"/>}{t.title}</div><div className="flex gap-4">
          {u.role === 'admin' && <button onClick={(e)=>{e.preventDefault(); md({t:'confirm',title:'Delete Match',msg:'Delete completely from history?',onC:async ()=>{ try { await deleteDoc(doc(db,'artifacts',appId,'public','data','tournaments',t.id)); md({t:'alert',title:'Success',msg:'Updated successfully'}); } catch(err){ md({t:'err',title:'Error',msg:err.message}); } }})}} className="text-rose-500 bg-rose-50 p-2 rounded cursor-pointer"><Trash2 className="w-4 h-4"/></button>}
          <ChevronRight className="w-5 h-5 text-slate-400 group-open:rotate-90 m-auto"/></div></summary><div className="pt-4 mt-4 border-t space-y-4 cursor-default"><div className="flex gap-4"><div className="bg-slate-50 p-3 rounded border flex-1"><div className="text-[10px] font-black text-slate-400 uppercase">Room ID</div><div className="font-mono font-bold text-lg">{t.roomId||'N/A'}</div></div><div className="bg-slate-50 p-3 rounded border flex-1"><div className="text-[10px] font-black text-slate-400 uppercase">Pass</div><div className="font-mono font-bold text-lg">{t.password||'N/A'}</div></div></div><div className="bg-blue-50 p-3 rounded border border-blue-100 text-sm font-bold">{t.customText||'No custom text.'}</div>{t.status==='result'&&<div className="border rounded-xl overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-[10px] uppercase font-black"><tr><th className="p-3">Player</th><th className="p-3">Kills</th><th className="p-3">Earned</th></tr></thead><tbody>{(t.results||[]).map(r=><tr key={r.uid}><td className="p-3 font-bold uppercase">{r.gameName}</td><td className="p-3 font-bold">{r.kills}</td><td className="p-3 font-black text-emerald-600">{r.earned}</td></tr>)}</tbody></table></div>}</div></details>;
        return <div key={t.id} className="p-5 flex flex-col md:flex-row justify-between items-center gap-4"><div className="flex items-center gap-4"><div className="w-20 h-20 bg-slate-900 rounded-xl relative overflow-hidden">{t.bannerUrl?<img src={t.bannerUrl} className="w-full h-full object-cover opacity-80"/>:<Trophy className="m-auto mt-6 text-white/30"/>}{t.createdBy&&<span className="absolute bottom-1 left-1 bg-black/66 text-white text-[8px] px-1 rounded uppercase font-bold">By: {t.createdBy}</span>}</div><div><div className="font-black text-xl uppercase mb-1">{t.title} <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{t.status}</span></div><div className="text-[10px] font-bold text-slate-500 uppercase">{fDate(t.dateTime)} | Fee: {t.entryFee} | PK: {t.perKill} | Joined: {(t.joinedUsers||[]).length}/{t.totalSlots}</div></div></div>
        <div className="flex gap-2 flex-wrap bg-slate-50 p-2 rounded-xl border">
          {t.status==='upcoming'&&<>
            {u.role === 'admin' && <button onClick={() => { setFd({gameId: t.gameId, modeId: t.modeId, title: t.title, bannerUrl: t.bannerUrl || '', customText: t.customText || '', dateTime: t.dateTime, type: t.type || 'solo', perKill: t.perKill, entryFee: t.entryFee, totalSlots: t.totalSlots, status: t.status }); setEditId(t.id); setFo(true); window.scrollTo(0,0); }} className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 font-black text-[10px] uppercase rounded-lg cursor-pointer">EDIT</button>}
            <button onClick={()=>md({t:'room',title:'Set Room & Start',onC: async (r,p)=>{
              if(!r || !p){ alert('Room ID and Password required!'); return; }
              try {
                await updateDoc(doc(db,'artifacts',appId,'public','data','tournaments',t.id),{roomId:r,password:p,status:'ongoing'});

                const targetUids = (t.joinedUsers||[]).map(ju => ju.uid || ju);

                if (targetUids.length > 0) {
                  const notifTitle = `🎮 ${t.title} — Room is LIVE!`;
                  const notifBody  = `Room ID: ${r}\nPassword: ${p}`;

                  await sendPushNotification({
                    title: notifTitle,
                    body:  notifBody,
                    targetUids,
                    users: d.users,
                    data: {
                      type:       'room_live',
                      roomId:     String(r),
                      password:   String(p),
                      matchTitle: String(t.title),
                      matchId:    String(t.id),
                    },
                  });
                }

                md({t:'alert',title:'Success',msg:'Room updated & push notification sent!'});
              } catch(err) {
                md({t:'err',title:'Error',msg:err.message});
              }
            }})} className="px-4 py-2 bg-amber-500 text-white font-black text-[10px] uppercase rounded-lg cursor-pointer">START</button>
          </>}
          {t.status==='ongoing'&&<>
             {u.role === 'admin' && <button onClick={() => { setFd({gameId: t.gameId, modeId: t.modeId, title: t.title, bannerUrl: t.bannerUrl || '', customText: t.customText || '', dateTime: t.dateTime, type: t.type || 'solo', perKill: t.perKill, entryFee: t.entryFee, totalSlots: t.totalSlots, status: t.status }); setEditId(t.id); setFo(true); window.scrollTo(0,0); }} className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 font-black text-[10px] uppercase rounded-lg cursor-pointer">EDIT</button>}
             <button disabled={isLoadingResults} onClick={()=>oR(t)} className="px-4 py-2 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg cursor-pointer disabled:opacity-50">{isLoadingResults ? 'LOADING...' : 'RESULTS'}</button>
          </>}
          {(t.status==='upcoming'||t.status==='ongoing')&&<button onClick={()=>st(t,'cancelled')} className="px-4 py-2 bg-white text-rose-500 border font-black text-[10px] uppercase rounded-lg cursor-pointer">CANCEL</button>}
        </div>

        <div className="w-full mt-4 bg-slate-50 p-3 rounded-lg border text-xs">
          <div className="font-black text-slate-400 uppercase mb-2">Joined Players ({(t.joinedUsers||[]).length})</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {(t.joinedUsers||[]).map((ju, i) => {
              const uid = ju.uid || ju;
              const joinedAt = ju.joinedAt;
              const uData = d.users.find(x=>x.uid===uid);
              const uName = uData?.name || 'Player';
              const hasFcm = !!uData?.fcmToken;
              return (
                <div key={i} className="flex justify-between items-center bg-white p-2 border rounded">
                  <div className="font-bold uppercase flex items-center gap-2">
                    {uName}
                    {!hasFcm && <span title="No FCM token — won't get push" className="text-[8px] bg-orange-100 text-orange-600 px-1 rounded font-black">NO PUSH</span>}
                  </div>
                  {joinedAt && <div className="text-[9px] text-slate-400 font-bold uppercase">{fDate(joinedAt)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        </div>;
      })}
    </div></div>
  </div>;
}

// 🔥 FIN MGR: DYNAMIC USER FETCH FOR SAFE APPROVALS 🔥
function FinMgr({ t, d, md, s, u: adminUser }) {
  const [cMsg, setCMsg] = useState('');
  const p = d.transactions.filter(x=> (t==='withdraw' ? (x.type==='withdraw_pending' || x.type==='referral_withdraw_pending') : x.type===`${t}_pending`) && x.status==='pending');

  const cT = (text) => { copyText(text); setCMsg('Copied!'); setTimeout(()=>setCMsg(''), 2000); };

  const act = (tx, st) => md({
    t:'confirm',title:'Confirm',msg:`${st} request?`,
    onC:async ()=>{
      try {
        if(st==='approve') {
          const userSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', tx.uid));
          const uu = userSnap.exists() ? userSnap.data() : null;

          if(t==='deposit') {
            if (uu) {
              await updateDoc(doc(db,'artifacts',appId,'public','data','users',tx.uid), {
                balance: Number(uu.balance || 0) + Number(tx.amount),
                depositBalance: Number(uu.depositBalance || 0) + Number(tx.amount)
              });
              if (uu.referredBy && s.referralBonusPercent > 0) {
                const refSnap = await getDoc(doc(db,'artifacts',appId,'public','data','users',uu.referredBy));
                if (refSnap.exists()) {
                  const refUser = refSnap.data();
                  const bonus = (Number(tx.amount) * Number(s.referralBonusPercent)) / 100;
                  await updateDoc(doc(db,'artifacts',appId,'public','data','users',uu.referredBy), { referralBalance: Number(refUser.referralBalance||0) + bonus });
                }
              }
            }
          } else if (t==='withdraw') {
            if (tx.type==='referral_withdraw_pending') {
              if(uu) await updateDoc(doc(db,'artifacts',appId,'public','data','users',tx.uid), { referralBalance: Number(uu.referralBalance||0) + Math.abs(tx.amount) });
            } else {
              if (uu) {
                await updateDoc(doc(db,'artifacts',appId,'public','data','users',tx.uid), {
                  balance: Number(uu.balance || 0) + Math.abs(tx.amount),
                  winningBalance: Number(uu.winningBalance || 0) + Math.abs(tx.amount)
                });
              }
            }
          }
          await updateDoc(doc(db,'artifacts',appId,'public','data','transactions',tx.id),{status:'completed'});
        } else {
           await updateDoc(doc(db,'artifacts',appId,'public','data','transactions',tx.id),{status:'failed'});
        }
        md({t:'alert',title:'Success',msg:'Updated successfully'});
      } catch(err) {
        md({t:'err',title:'Error',msg:err.message});
      }
    }
  });

  const hT = d.transactions.filter(x => !x.adminDeleted && (t === 'withdraw' ? (x.type === 'withdraw_pending' || x.type === 'referral_withdraw_pending') : x.type === 'deposit_pending') && x.status !== 'pending').sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,50);

  return <div className="bg-white p-6 rounded-2xl border">
  {cMsg && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-xl z-50 font-black shadow-lg animate-in fade-in zoom-in">{cMsg}</div>}
  <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Clock className="text-amber-500"/> Pending {t}s ({p.length})</h2><div className="space-y-4 mb-8">
  
  {p.length===0?<div className="p-8 text-center font-bold text-slate-400 bg-slate-50 rounded-xl">All caught up!</div>:p.map(x=>{
    const upi = x.description?.includes('to ') ? x.description.split('to ')[1] : '';
    const uu = d.users.find(u=>u.uid===x.uid) || {};

    const userTxs = d.transactions.filter(tx => tx.uid === x.uid && !tx.adminDeleted);
    const compDeps = userTxs.filter(tx => tx.type === 'deposit_pending' && tx.status === 'completed');
    const totalDepAmt = compDeps.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalDepCount = compDeps.length;
    const rejDeps = userTxs.filter(tx => tx.type === 'deposit_pending' && tx.status === 'failed').length;

    const compWids = userTxs.filter(tx => (tx.type === 'withdraw_pending' || tx.type === 'referral_withdraw_pending') && tx.status === 'completed');
    const totalWidAmt = Math.abs(compWids.reduce((sum, tx) => sum + Number(tx.amount), 0));
    const totalWidCount = compWids.length;
    const rejWids = userTxs.filter(tx => (tx.type === 'withdraw_pending' || tx.type === 'referral_withdraw_pending') && tx.status === 'failed').length;

    return <div key={x.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl flex justify-between items-start">
      <div className="flex-1 pr-4">
        <div className="font-black text-3xl mb-1">{Math.abs(x.amount)}</div>
        <div className="text-sm font-bold text-blue-600 uppercase">{uu.name || `UID: ${x.uid}`} {x.type==='referral_withdraw_pending'&&<span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] ml-2 tracking-widest">REFERRAL WITHDRAW</span>}</div>
        <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-2">{x.description} {upi && <button onClick={()=>cT(upi)} className="bg-blue-100 text-blue-700 p-1 rounded hover:bg-blue-200 cursor-pointer"><Copy className="w-3 h-3"/></button>}</div>
        <div className="text-[10px] font-bold text-slate-500 mt-1 mb-3">{fDate(x.date)}</div>

        {/* 🔥 NEW DETAILED USER STATS BLOCK 🔥 */}
        <div className="bg-white/60 border border-amber-200 rounded-lg p-2.5 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
          {t === 'deposit' ? (
             <>
               <div>Total Deposits: <span className="text-emerald-600">{totalDepCount}</span></div>
               <div>Total Amount: <span className="text-emerald-600">{totalDepAmt} {s.currencySymbol}</span></div>
               <div className="col-span-2">Rejected Deposits: <span className="text-rose-600">{rejDeps}</span></div>
             </>
          ) : (
             <>
               <div>Deps: <span className="text-emerald-600">{totalDepCount} ({totalDepAmt} {s.currencySymbol})</span></div>
               <div>Wids: <span className="text-blue-600">{totalWidCount} ({totalWidAmt} {s.currencySymbol})</span></div>
               <div>Rej Deps: <span className="text-rose-600">{rejDeps}</span></div>
               <div>Rej Wids: <span className="text-rose-600">{rejWids}</span></div>
               <div className="col-span-2">Games Played: <span className="text-indigo-600">{uu.totalMatches || 0}</span></div>
             </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button onClick={()=>act(x,'reject')} className="px-5 py-3 bg-white text-rose-600 font-black uppercase text-xs rounded-lg border border-rose-200 cursor-pointer hover:bg-rose-50">Reject</button>
        <button onClick={()=>act(x,'approve')} className="px-5 py-3 bg-emerald-500 text-white font-black uppercase text-xs rounded-lg cursor-pointer hover:bg-emerald-600">Approve</button>
      </div>
    </div>
  })}</div>

  <div className="flex justify-between items-center mb-4 border-b pb-2">
    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Recent History</h3>
  </div>
  <table className="w-full text-sm text-left"><thead className="bg-slate-100 text-[10px] uppercase font-black"><tr><th className="p-3">User</th><th className="p-3">Details</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{hT.map(x=>{
    const upi = x.description?.includes('to ') ? x.description.split('to ')[1] : '';
    return <tr key={x.id}><td className="p-3 font-bold">{(d.users.find(u=>u.uid===x.uid)||{}).name || x.uid} {x.type==='referral_withdraw_pending'&&<span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[8px] ml-2">REF</span>}</td>
    <td className="p-3 text-xs font-bold text-slate-600 flex items-center gap-2">{x.description} {upi && <button onClick={()=>cT(upi)} className="text-blue-500 hover:text-blue-700 cursor-pointer"><Copy className="w-3 h-3"/></button>}</td>
    <td className="p-3 font-black">{Math.abs(x.amount)}</td><td className="p-3"><span className={`text-[9px] px-2 py-1 uppercase font-black rounded ${x.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{x.status}</span></td><td className="p-3 text-[11px] font-bold text-slate-500">{fDate(x.date)}</td><td className="p-3">
      {adminUser.role === 'admin' && <button onClick={()=> md({t:'confirm',title:'Delete History',msg:'Remove from panel?',onC:async()=>{try{await updateDoc(doc(db,'artifacts',appId,'public','data','transactions',x.id),{adminDeleted:true}); md({t:'alert',title:'Success',msg:'Updated successfully'})}catch(err){md({t:'err',title:'Error',msg:err.message})}}}) } className="bg-rose-100 text-rose-600 px-3 py-1 rounded text-xs font-black cursor-pointer">DELETE</button>}
    </td></tr>
  })}</tbody></table>
  </div>;
}

function StaffMgr({ d, md, u }) {
  if (u.role!=='admin') return <div className="p-8 text-center text-rose-500 font-bold bg-white rounded-xl">Super Admins Only.</div>;
  const sList = d.users.filter(x=>x.role==='staff');
  return <div className="bg-white p-6 rounded-2xl border"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black uppercase">Staff Panel</h2><button onClick={()=>md({t:'staff',title:'Add Staff',onC:(e,p)=>{const uu=d.users.find(x=>x.email===e); if(uu){ if(uu.role==='admin') return md({t:'err',title:'Error',msg:'Cannot modify Super Admin.'}); updateDoc(doc(db,'artifacts',appId,'public','data','users',uu.uid),{role:'staff',permissions:p}); } else md({t:'err',title:'Error',msg:'User not found.'});}})} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-black text-xs uppercase cursor-pointer"><Plus className="w-4 h-4 inline"/> Add Staff</button></div><div className="space-y-3">{sList.length===0&&<div className="p-6 text-center text-slate-400 font-bold bg-slate-50 rounded-xl">No staff.</div>}{sList.map(s=><div key={s.uid} className="p-5 border rounded-xl flex justify-between items-center bg-white shadow-sm"><div><div className="font-black text-2xl uppercase">{s.name}</div><div className="text-sm font-bold text-slate-500 mb-2">{s.email}</div><div className="flex gap-1">{s.permissions.map(p=><span key={p} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded border uppercase font-bold">{p}</span>)}</div></div><div className="flex gap-2"><button onClick={()=>{const po={dashboard:0,users:0,games:0,tournaments:0,finance:0,staff:0,settings:0}; s.permissions.forEach(x=>po[x]=1); md({t:'staff',title:'Edit Staff',ed:true,d1:s.email,dp:po,onC:(e,p)=>updateDoc(doc(db,'artifacts',appId,'public','data','users',s.uid),{permissions:p})});}} className="px-4 py-2 bg-slate-100 font-black text-xs uppercase rounded cursor-pointer"><Edit className="w-4 h-4"/></button><button onClick={()=>md({t:'confirm',title:'Remove Staff',msg:'Demote to regular user?',onC:()=>updateDoc(doc(db,'artifacts',appId,'public','data','users',s.uid),{role:'user',permissions:[]})})} className="px-4 py-2 bg-rose-50 text-rose-600 font-black text-xs uppercase rounded border border-rose-100 cursor-pointer"><Trash2 className="w-4 h-4"/></button></div></div>)}</div></div>;
}

function SetMgr({ s, md, u: adminUser }) {
  const [ls, sls] = useState(s || {}); const [sv, setSv] = useState(false);

  const save = async (newState = null) => {
    setSv(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), newState || ls, { merge: true });
      if(!newState) md({t:'alert',title:'Success',msg:'Updated successfully'});
    } catch (e) {
      md({t:'err',title:'Error',msg:e.message});
    }
    setSv(false);
  };
  return <div className="bg-white p-6 rounded-2xl border space-y-6"><div className="flex justify-between border-b pb-4"><h2 className="text-xl font-black uppercase">Settings</h2><button onClick={()=>save(null)} disabled={sv} className="px-6 py-2 bg-blue-600 text-white font-black rounded-lg uppercase cursor-pointer">{sv?'Saving...':'Save'}</button></div><div className="grid md:grid-cols-2 gap-6"><div className="bg-slate-50 p-4 rounded-xl border"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">App Name</label><input value={ls.appName||''} onChange={e=>sls({...ls,appName:e.target.value})} className="w-full p-3 border rounded font-bold outline-none"/></div><div className="bg-slate-50 p-4 rounded-xl border"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Currency Name</label><input value={ls.currencyName||''} onChange={e=>sls({...ls,currencyName:e.target.value})} className="w-full p-3 border rounded font-bold outline-none"/></div><div className="bg-slate-50 p-4 rounded-xl border"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Min Withdraw</label><input type="number" value={ls.minWithdraw||0} onChange={e=>sls({...ls,minWithdraw:Number(e.target.value)})} className="w-full p-3 border rounded font-bold outline-none"/></div><div className="bg-slate-50 p-4 rounded-xl border"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Referral Bonus %</label><input type="number" value={ls.referralBonusPercent||0} onChange={e=>sls({...ls,referralBonusPercent:Number(e.target.value)})} className="w-full p-3 border rounded font-bold outline-none"/></div>
  <div className="bg-slate-50 p-4 rounded-xl border col-span-full"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">UPI ID</label><input value={ls.upiId||''} onChange={e=>sls({...ls,upiId:e.target.value})} placeholder="example@okicici" className="w-full p-3 border rounded font-bold outline-none"/></div>
  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 col-span-full"><label className="text-[10px] font-black uppercase text-blue-700 block mb-2">External Support Link (User Panel Button)</label><input value={ls.externalSupportLink||''} onChange={e=>sls({...ls,externalSupportLink:e.target.value})} placeholder="https://..." className="w-full p-3 border rounded font-bold outline-none"/></div>
  <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 col-span-full"><div className="flex justify-between items-center mb-4"><span className="text-sm font-black uppercase text-rose-700">Maintenance Mode</span><input type="checkbox" checked={ls.maintenance||false} onChange={e=>sls({...ls,maintenance:e.target.checked})} className="w-6 h-6 cursor-pointer"/></div>{ls.maintenance&&<input type="text" value={ls.maintenanceMsg||''} onChange={e=>sls({...ls,maintenanceMsg:e.target.value})} placeholder="Maintenance Text" className="w-full p-3 border rounded font-bold outline-none"/>}</div><div className="bg-slate-50 p-4 rounded-xl border col-span-full"><label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Terms & Conditions</label><textarea value={ls.termsAndConditions||''} onChange={e=>sls({...ls,termsAndConditions:e.target.value})} className="w-full p-3 border rounded font-bold outline-none h-32"/></div></div>
  <div className="bg-slate-50 p-4 rounded-xl border"><div className="flex justify-between items-center mb-4"><h3 className="font-black uppercase text-sm">Support Channels</h3><button onClick={()=>md({t:'social',title:'Add Social Media',onC:(n,u,i)=>{const updated = [...(ls.supportChannels||[]), {name:n,url:u,iconUrl:i}]; sls({...ls, supportChannels: updated}); save({...ls, supportChannels: updated}); }})} className="px-3 py-1 bg-indigo-100 text-indigo-700 font-black text-[10px] uppercase rounded cursor-pointer">+ Add</button></div><div className="space-y-2">{(ls.supportChannels||[]).map((c,i)=><div key={i} className="flex justify-between items-center bg-white p-3 border rounded font-bold text-sm"><div>{c.name} <span className="text-[10px] text-slate-400 font-mono block">{c.url}</span></div><button onClick={()=>{const arr=[...(ls.supportChannels||[])]; arr.splice(i,1); sls({...ls,supportChannels:arr}); save({...ls, supportChannels: arr}); }} className="text-rose-500 p-2 cursor-pointer"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>
  </div>;
}
