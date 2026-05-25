import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { 
  Home, Trophy, User as UserIcon, Wallet, Settings, LogOut, Gamepad2, 
  Plus, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft, Info, PlayCircle, 
  ChevronRight, Loader2, Copy, Bell, Link as LinkIcon, ShieldAlert, Clock
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
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

// STRICTLY HARDCODED TO MATCH ADMIN PANEL
const appId = 'ff-tournament-live-db'; 

const generateId = () => Math.random().toString(36).substr(2, 9);
const generateReferralCode = (name) => (name?.substring(0, 4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString();
};

const isDeviceRooted = () => false; 

// --- UNIVERSAL COPY FUNCTION (WEBVIEW SAFE) ---
const copyText = (text, successCallback) => {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = String(text);
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (copied) {
      if (successCallback) successCallback();
    } else {
      alert("Copy failed");
    }
  } catch (err) {
    alert("Copy failed");
  }
};

// --- MAIN ENTRY POINT ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [modes, setModes] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [bannedDevices, setBannedDevices] = useState([]);
  
  const [settings, setSettings] = useState({ 
    appName: 'Elite Esports', currencySymbol: '🪙', currencyName: 'Coins', minWithdraw: 10, minReferralWithdraw: 300,
    referralBonusPercent: 10, inviteLinkBase: 'https://esports-tournament-app-beta.vercel.app/?ref=', supportChannels: [], upiId: '', 
    termsAndConditions: 'Terms & Conditions:\n\n1. Play fair and do not cheat.',
    maintenance: false, maintenanceMsg: 'We are currently updating our app. Please check back later.',
    leaderboardVisible: true, globalAnnouncement: '', depositQrUrl: 'https://postimg.cc/21k4b8Q7'
  });

  useEffect(() => {
    // Generate secure persistent device ID
    if (!localStorage.getItem("device_id")) {
      localStorage.setItem("device_id", crypto.randomUUID());
    }

    const initAuth = async () => {
      try {
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { 
        try {
          await signInAnonymously(auth);
        } catch (fallbackError) {
          console.error("Anonymous auth fallback failed:", fallbackError);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false); 
      if (!user) setAppUser(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const cols = {
      users: collection(db, 'artifacts', appId, 'public', 'data', 'users'),
      games: collection(db, 'artifacts', appId, 'public', 'data', 'games'),
      modes: collection(db, 'artifacts', appId, 'public', 'data', 'modes'),
      tournaments: collection(db, 'artifacts', appId, 'public', 'data', 'tournaments'),
      transactions: collection(db, 'artifacts', appId, 'public', 'data', 'transactions'),
      messages: collection(db, 'artifacts', appId, 'public', 'data', 'messages'),
      bannedDevices: collection(db, 'artifacts', appId, 'public', 'data', 'bannedDevices')
    };

    const unsubscribers = Object.keys(cols).map(key => 
      onSnapshot(cols[key], 
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if(key === 'users') setUsers(data); if(key === 'games') setGames(data);
          if(key === 'modes') setModes(data); if(key === 'tournaments') setTournaments(data);
          if(key === 'transactions') setTransactions(data);
          if(key === 'messages') setMessages(data);
          if(key === 'bannedDevices') setBannedDevices(data);
        },
        (error) => console.error(`Firestore Error [${key}]:`, error)
      )
    );
    
    unsubscribers.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), 
      (doc) => { if (doc.exists()) setSettings(prev => ({...prev, ...doc.data()})); }
    ));

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firebaseUser]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('esports_player_id');
    if (savedUserId && users.length > 0) {
      const currentUserProfile = users.find(u => u.uid === savedUserId);
      if (currentUserProfile) {
        setAppUser(currentUserProfile);
      } else {
        localStorage.removeItem('esports_player_id');
        setAppUser(null);
      }
    }
  }, [users]);

  const login = (email, password) => {
    const isDeviceBanned = bannedDevices.find(x => x.deviceId === localStorage.getItem("device_id"));
    if (isDeviceBanned) {
      throw new Error("This device has been permanently banned.");
    }

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      if (user.role === 'admin' || user.role === 'staff') throw new Error("Admins must use the Admin Panel.");
      if (user.isBanned) throw new Error(`Account Banned.`);
      localStorage.setItem('esports_player_id', user.uid);
      setAppUser(user);
      return true;
    }
    throw new Error("Invalid email or password");
  };

  const signup = async (userData) => {
    const isDeviceBanned = bannedDevices.find(x => x.deviceId === localStorage.getItem("device_id"));
    if (isDeviceBanned) {
      throw new Error("This device has been permanently banned.");
    }

    if (users.find(u => u.email === userData.email)) throw new Error("Email already registered");
    if (users.find(u => u.gameUid === userData.gameUid)) throw new Error("Game UID already registered");

    const newUid = generateId();
    let referredBy = null;
    if (userData.referralCode) {
      const referrer = users.find(u => u.referralCode === userData.referralCode);
      if (referrer) referredBy = referrer.uid;
    }

    const newUser = {
      uid: newUid, ...userData, balance: 0, depositBalance: 0, winningBalance: 0, referralBalance: 0, totalReferralAmount: 0, referralCode: generateReferralCode(userData.name), 
      referredBy: referredBy, totalMatches: 0, totalKills: 0, totalWinnings: 0, totalRefers: 0, 
      role: 'user', joinedDate: new Date().toISOString(), isBanned: false,
      notificationsEnabled: true, lastSeenMessage: '', deviceId: localStorage.getItem("device_id"), ipAddress: ''
    };

    localStorage.setItem('esports_player_id', newUid);
    setAppUser(newUser);

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', newUid), newUser);
    if (referredBy) {
       await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', referredBy), { 
         totalRefers: (users.find(u => u.uid === referredBy)?.totalRefers || 0) + 1 
       });
    }
  };

  const logout = () => { localStorage.removeItem('esports_player_id'); setAppUser(null); };

  const createTransaction = async (uid, type, amount, description, status = 'completed') => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
      uid, type, amount, description, status, date: new Date().toISOString()
    });
  };

  const updateUserBalance = async (uid, amountChange) => {
    const userToUpdate = users.find(u => u.uid === uid);
    if (userToUpdate) {
       await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), {
         balance: Number(userToUpdate.balance || 0) + Number(amountChange)
       });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-orange-50"><Loader2 className="w-12 h-12 text-orange-500 animate-spin" /></div>;
  if (!appUser) return <AuthScreen onLogin={login} onSignup={signup} settings={settings} />;

  if (appUser.isBanned) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-900 p-6 text-center text-white">
        <XCircle className="w-24 h-24 text-rose-500 mb-6" />
        <h1 className="text-3xl font-black text-rose-500 mb-3 uppercase">Account Banned</h1>
        <p className="text-slate-300">Your account has been suspended.</p>
        <button onClick={logout} className="mt-8 px-8 py-3 bg-slate-800 text-white rounded-xl font-bold cursor-pointer select-none">Logout</button>
      </div>
    );
  }

  if (settings.maintenance) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-orange-50 p-6 text-center">
        <Settings className="w-16 h-16 text-orange-500 mb-4 animate-spin-slow" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2 uppercase">Maintenance Break</h1>
        <p className="text-slate-600 mb-6">{settings.maintenanceMsg}</p>
        <button onClick={logout} className="px-6 py-2 bg-orange-600 text-white rounded-lg font-bold cursor-pointer select-none">Logout</button>
      </div>
    );
  }

  return (
    <UserPanel 
      user={appUser} allUsers={users} games={games} modes={modes} 
      tournaments={tournaments} transactions={transactions.filter(t => t.uid === appUser.uid)} messages={messages}
      allTransactions={transactions} settings={settings} onLogout={logout} 
      updateUserBalance={updateUserBalance} createTransaction={createTransaction}
    />
  );
}

// --- AUTH SCREEN ---
function AuthScreen({ onLogin, onSignup, settings }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Auto-fill referral code from URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCodeFromUrl = urlParams.get('ref') || '';
  
  const [formData, setFormData] = useState({ email: '', password: '', name: '', gameName: '', gameUid: '', referralCode: refCodeFromUrl });
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setErrorMsg('');
    try {
      if (isLogin) {
        onLogin(formData.email, formData.password);
      } else {
        if (!formData.name || !formData.email || !formData.password || !formData.gameName || !formData.gameUid) {
          setErrorMsg("Please fill all required fields"); setIsSubmitting(false); return;
        }
        await onSignup(formData);
      }
    } catch (error) { setErrorMsg(String(error.message || "An error occurred")); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-8 text-center relative overflow-hidden">
          <Gamepad2 className="w-16 h-16 text-white mx-auto mb-3 relative z-10" />
          <h2 className="text-3xl font-black text-white relative z-10 tracking-tight">{String(settings.appName)}</h2>
        </div>
        <div className="p-8">
          <div className="flex mb-6 border-b border-slate-200">
            <button type="button" className={`flex-1 pb-3 font-bold text-sm uppercase transition-colors cursor-pointer select-none ${isLogin ? 'text-orange-600 border-b-2 border-orange-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => {setIsLogin(true); setErrorMsg('');}}>Login</button>
            <button type="button" className={`flex-1 pb-3 font-bold text-sm uppercase transition-colors cursor-pointer select-none ${!isLogin ? 'text-orange-600 border-b-2 border-orange-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => {setIsLogin(false); setErrorMsg('');}}>Sign Up</button>
          </div>
          
          {errorMsg && <div className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-sm font-bold rounded-lg text-center whitespace-pre-wrap">{String(errorMsg)}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && <input type="text" placeholder="Full Name" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-medium" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input type="email" placeholder="Email Address" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-medium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            <input type="password" placeholder="Password" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-medium" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
            
            {!isLogin && (
              <>
                <input type="text" placeholder="In-Game Name" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-medium" value={formData.gameName} onChange={e => setFormData({...formData, gameName: e.target.value})} />
                <input type="text" placeholder="Game UID" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-medium" value={formData.gameUid} onChange={e => setFormData({...formData, gameUid: e.target.value})} />
                <input type="text" placeholder="Referral Code (Optional)" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-orange-500 font-bold tracking-widest uppercase" value={formData.referralCode} onChange={e => setFormData({...formData, referralCode: e.target.value})} />
              </>
            )}
            
            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 text-white font-black py-4 rounded-xl shadow-[0_4px_14px_0_rgb(234,88,12,0.39)] hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-70 flex justify-center items-center gap-2 mt-6 text-lg tracking-wider cursor-pointer select-none">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isSubmitting ? 'PROCESSING...' : (isLogin ? 'SECURE LOGIN' : 'CREATE ACCOUNT')}
            </button>
            
            {isLogin && (
              <button
                type="button"
                onClick={() => {
                  const channels = (settings.supportChannels || []).map(c => `${c.name}: ${c.url}`).join('\n');
                  setErrorMsg(channels ? `Please contact support to reset your password:\n${channels}` : 'Please contact admin to reset your password.');
                }}
                className="w-full mt-3 text-sm font-bold text-orange-600 uppercase cursor-pointer select-none"
              >
                Forgot Password?
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function UserDetailBox({label, value, color="text-slate-800"}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">{label}</div>
      <div className={`font-black text-lg ${color}`}>{value}</div>
    </div>
  );
}

// --- USER PANEL MAIN CONTROLLER ---
function UserPanel({ user, allUsers, games, modes, tournaments, transactions, messages, allTransactions, settings, onLogout, updateUserBalance, createTransaction }) {
  const [activeTab, setActiveTab] = useState('home');
  const [viewState, setViewState] = useState({ view: 'main' }); 
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, inputs: false });
  const [cinematicRoom, setCinematicRoom] = useState(null);

  const unreadCount = (messages || []).filter(m => !(m.readBy || []).includes(user.uid)).length;

  const showModal = (title, message, type = 'info', onConfirm = null, inputs = false) => {
    setModal({ isOpen: true, title: String(title), message: String(message), type, onConfirm, inputs });
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setViewState({ view: 'main' });
  };

  const executeAction = async (actionType, payload) => {
    try {
      if (actionType === 'transaction') {
        await createTransaction(
          user.uid,
          payload.type,
          payload.amount,
          payload.description,
          payload.status
        );
      }
      if (actionType === 'update_balance') {
        await updateUserBalance(user.uid, payload);
      }
      if (actionType === 'withdraw_winnings') {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
          winningBalance: Number(user.winningBalance || 0) - Number(payload),
          balance: Number(user.balance || 0) - Number(payload)
        });
      }
      if (actionType === 'join_match') {
        const tournamentRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournaments', payload.tid);

        if ((payload.joined || []).some(x => x.uid === user.uid)) {
          throw new Error("You have already joined this match.");
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
          balance: Number(user.balance || 0) - Number(payload.fee),
          depositBalance: Number(user.depositBalance || 0) - Number(payload.fee)
        });
        
        await updateDoc(tournamentRef, { 
          joinedUsers: arrayUnion({ uid: user.uid, joinedAt: new Date().toISOString() }) 
        });
        
        await createTransaction(user.uid, 'join', -Number(payload.fee), `Joined Match`, 'completed');
        
        showModal("Success", "Successfully joined the match!", "info");
      }
    } catch (e) {
      console.error(e);
      showModal("Error", e.message || "Action failed to execute.", "error");
    }
  };

  // GLOBAL CINEMATIC ROOM LISTENER
  useEffect(() => {
    const liveMatch = tournaments.find(t => 
      t.status === 'ongoing' && t.roomId && (t.joinedUsers || []).some(x => x.uid === user.uid) && !sessionStorage.getItem(`seen_room_${t.id}_${t.roomId}`)
    );
    if (liveMatch) {
      setCinematicRoom(liveMatch);
      sessionStorage.setItem(`seen_room_${liveMatch.id}_${liveMatch.roomId}`, 'true');
    }
  }, [tournaments, user.uid]);

  const renderContent = () => {
    if (activeTab === 'leaderboard') return <UserLeaderboardView users={allUsers} transactions={allTransactions} settings={settings} />;
    
    if (viewState.view === 'messages') {
      return <UserMessagesView messages={messages} user={user} onBack={() => setViewState({view: 'main'})} />;
    }

    if (viewState.view === 'deposit') {
      return (
        <UserDepositView
          user={user}
          settings={settings}
          onBack={() => setViewState({ view: 'main' })}
          executeAction={executeAction}
          showModal={showModal}
          setViewState={setViewState}
        />
      );
    }

    if (viewState.view === 'withdraw') {
      return (
        <UserWithdrawView
          user={user}
          settings={settings}
          onBack={() => setViewState({ view: 'main' })}
          executeAction={executeAction}
          showModal={showModal}
          setViewState={setViewState}
        />
      );
    }

    if (activeTab === 'about') {
      if (viewState.view === 'transactions')
        return (
          <UserTransactionsView
            transactions={transactions}
            settings={settings}
            onBack={() => setViewState({ view: 'main' })}
          />
        );

      if (viewState.view === 'edit_profile')
        return (
          <UserEditProfileView
            user={user}
            onBack={() => setViewState({ view: 'main' })}
            showModal={showModal}
          />
        );

      if (viewState.view === 'support')
        return (
          <UserSupportView
            settings={settings}
            onBack={() => setViewState({ view: 'main' })}
          />
        );

      return (
        <UserAboutView
          user={user}
          settings={settings}
          setViewState={setViewState}
          setActiveTab={setActiveTab}
          onLogout={onLogout}
          showModal={showModal}
          executeAction={executeAction}
        />
      );
    }

    switch (viewState.view) {
      case 'game': return <UserGameModesView game={viewState.data} modes={modes} onSelect={(m) => setViewState({ view: 'mode', data: { game: viewState.data, mode: m } })} onBack={() => setViewState({ view: 'main' })} />;
      case 'mode': return <UserModeTournamentsView mode={viewState.data?.mode} tournaments={tournaments} user={user} settings={settings} onSelect={(t) => setViewState({ view: 'tournament', data: t })} onBack={() => setViewState({ view: 'game', data: viewState.data?.game })} />;
      case 'joined_matches': return <UserJoinedMatchesView tournaments={tournaments} user={user} settings={settings} onSelect={(t) => setViewState({ view: 'tournament', data: t })} onBack={() => setViewState({ view: 'main' })} />;
      case 'tournament': {
        const liveTournament =
          tournaments.find(x => x.id === viewState.data?.id) || viewState.data;

        return (
          <UserTournamentDetailView
            t={liveTournament}
            allUsers={allUsers}
            user={user}
            settings={settings}
            onBack={() => {
              if (!liveTournament?.modeId) {
                setViewState({ view: 'main' });
                return;
              }

              const foundMode = modes.find(
                m => m.id === liveTournament.modeId
              );

              if (!foundMode) {
                setViewState({ view: 'main' });
                return;
              }

              const foundGame = games.find(
                g => g.id === foundMode.gameId
              );

              setViewState({
                view: 'mode',
                data: {
                  mode: foundMode,
                  game: foundGame || null
                }
              });
            }}
            executeAction={executeAction}
            showModal={showModal}
            setCinematicRoom={setCinematicRoom}
          />
        );
      }
      case 'deposit': return <UserDepositView user={user} settings={settings} onBack={() => setViewState({ view: 'main' })} executeAction={executeAction} showModal={showModal} setViewState={setViewState} />;
      case 'withdraw': return <UserWithdrawView user={user} settings={settings} onBack={() => setViewState({ view: 'main' })} executeAction={executeAction} showModal={showModal} setViewState={setViewState} />;
      default: return <UserHomeMainView games={games} onSelectGame={(g) => setViewState({ view: 'game', data: g })} onSelectJoined={() => setViewState({ view: 'joined_matches' })} settings={settings} />;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative font-sans select-none">
      <div className="sticky top-0 z-20 bg-gradient-to-r from-orange-600 to-orange-500 text-white px-5 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold border-2 border-orange-300 text-orange-600">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div><div className="text-[10px] text-orange-200 font-bold uppercase tracking-widest">Welcome,</div><div className="font-bold text-lg leading-none mt-0.5">{String(user.name)}</div></div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => { setActiveTab('home'); setViewState({view: 'messages'}); }} className="relative cursor-pointer hover:opacity-80 transition-opacity">
             <Bell className="w-6 h-6 text-white" />
             {unreadCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-black shadow-sm">
                   {unreadCount}
                </div>
             )}
          </button>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 font-bold text-yellow-300 text-lg leading-none"><Wallet className="w-4 h-4" /> {Number(user.balance || 0)}</div>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => { setActiveTab('home'); setViewState({view: 'deposit'}); }} className="text-[10px] bg-white text-orange-600 px-2.5 py-1 rounded font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-transform cursor-pointer select-none">Deposit</button>
              <button type="button" onClick={() => { setActiveTab('home'); setViewState({view: 'withdraw'}); }} className="text-[10px] bg-orange-700 text-white px-2.5 py-1 rounded font-bold uppercase tracking-widest border border-orange-500 shadow-inner active:scale-95 transition-transform cursor-pointer select-none">Withdraw</button>
            </div>
          </div>
        </div>
      </div>
      
      {isDeviceRooted() && <div className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest text-center py-1.5"><ShieldAlert className="w-3 h-3 inline mb-0.5"/> Warning: Rooted Device Detected</div>}
      
      <div className="flex-1 overflow-y-auto pb-24">{renderContent()}</div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex justify-around py-3 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <UserNavButton icon={Home} label="Home" active={activeTab === 'home' && !['deposit','withdraw','messages'].includes(viewState.view)} onClick={() => {setActiveTab('home'); setViewState({view:'main'});}} />
        <UserNavButton icon={Trophy} label="Rank" active={activeTab === 'leaderboard'} onClick={() => {setActiveTab('leaderboard'); setViewState({view:'main'});}} />
        <UserNavButton icon={UserIcon} label="Profile" active={activeTab === 'about' || ['transactions', 'edit_profile', 'support'].includes(viewState.view)} onClick={() => {setActiveTab('about'); setViewState({view:'main'});}} />
      </div>

      {/* Cinematic Room ID Popup */}
      {cinematicRoom && (
         <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col animate-in fade-in duration-300 text-white">
           <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              <div className="text-center mb-8 mt-10"><ShieldAlert className="w-16 h-16 mx-auto mb-4 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"/><h2 className="text-4xl font-black uppercase tracking-widest text-emerald-400">Match is Live!</h2><p className="text-slate-400 mt-2 font-bold uppercase tracking-widest">Admin provided room details.</p></div>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex-1 max-h-max">
                 <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-4"><img src={cinematicRoom.bannerUrl || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-lg object-cover" alt="match"/><div><div className="font-black text-xl leading-tight">{String(cinematicRoom.title)}</div><div className="text-xs text-orange-400 font-black uppercase tracking-widest mt-1">{String(cinematicRoom.type)} MATCH</div></div></div>
                 <div className="space-y-4">
                    <div className="bg-black/50 p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Room ID</div>
                      <div className="text-3xl font-mono font-black text-white relative z-10">{String(cinematicRoom.roomId)}</div>
                      <button type="button" onClick={() => copyText(cinematicRoom.roomId, () => showModal("Copied", "Room ID copied successfully.", "info"))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-600 p-4 rounded-xl cursor-pointer active:scale-95 select-none touch-manipulation z-50">
                        <Copy className="w-6 h-6"/>
                      </button>
                    </div>
                    <div className="bg-black/50 p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Password</div>
                      <div className="text-3xl font-mono font-black text-white relative z-10">{String(cinematicRoom.password)}</div>
                      <button type="button" onClick={() => copyText(cinematicRoom.password, () => showModal("Copied", "Password copied successfully.", "info"))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-600 p-4 rounded-xl cursor-pointer active:scale-95 select-none touch-manipulation z-50">
                        <Copy className="w-6 h-6"/>
                      </button>
                    </div>
                 </div>
                 <div className="mt-8 text-center text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Open your game immediately and enter these details to join the custom room. Do not share this password.</div>
              </div>
              <div className="mt-8"><button onClick={()=>setCinematicRoom(null)} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl active:scale-95 transition-transform cursor-pointer select-none">Back to App</button></div>
           </div>
         </div>
      )}

      {/* Main App Modal */}
      {modal.isOpen && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 shadow-2xl">
            <div className={`p-5 text-white font-black uppercase tracking-wider flex items-center gap-3 shadow-sm ${modal.type==='error'?'bg-rose-500':modal.type==='confirm'?'bg-orange-500':'bg-emerald-500'}`}>
              {modal.type==='error'?<XCircle className="w-6 h-6"/>:modal.type==='confirm'?<Info className="w-6 h-6"/>:<CheckCircle2 className="w-6 h-6"/>} 
              <span className="text-lg">{String(modal.title)}</span>
            </div>
            <div className="p-6 text-slate-700 font-bold whitespace-pre-wrap text-lg leading-snug">{String(modal.message)}</div>
            
            {modal.inputs && (
              <div className="px-6 pb-6 space-y-4">
                 <input type="text" id="modal_upi" placeholder="Your UPI ID" className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-orange-500 outline-none font-bold text-lg" />
                 <input type="number" id="modal_amount" placeholder="Amount" className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-orange-500 outline-none font-black text-2xl" />
              </div>
            )}
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              {(modal.type==='confirm' || modal.inputs) && <button onClick={()=>setModal({isOpen:false})} className="px-6 py-3 text-slate-600 font-black tracking-widest uppercase hover:bg-slate-200 rounded-xl transition-colors cursor-pointer select-none text-sm">Cancel</button>}
              <button onClick={()=>{
                 if(modal.onConfirm) {
                    if(modal.inputs) {
                       const uVal = document.getElementById('modal_upi')?.value;
                       const aVal = document.getElementById('modal_amount')?.value;
                       modal.onConfirm(uVal, aVal);
                    }
                    else modal.onConfirm();
                 }
                 setModal({isOpen:false});
              }} className={`px-8 py-3 rounded-xl text-white font-black uppercase tracking-widest text-sm shadow-md active:scale-95 transition-transform cursor-pointer select-none ${modal.type==='error'?'bg-rose-500':'bg-orange-600 hover:bg-orange-700'}`}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserNavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors cursor-pointer select-none ${active ? 'text-orange-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
      <Icon className={`w-6 h-6 transition-all ${active ? 'fill-orange-100 text-orange-600' : ''}`} />
      <span className="text-[10px] font-black tracking-widest uppercase">{String(label)}</span>
    </button>
  );
}

// --- SUBVIEWS ---
function UserHomeMainView({ games, onSelectGame, onSelectJoined, settings }) {
  return (
    <div className="p-5 space-y-6">
      {settings.globalAnnouncement && <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-sm flex items-start gap-3 animate-in slide-in-from-top-4"><Bell className="w-6 h-6 text-blue-500 shrink-0 mt-0.5 animate-bounce"/><div><div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Announcement</div><div className="text-sm font-bold text-slate-700 leading-snug">{String(settings.globalAnnouncement)}</div></div></div>}
      <div>
        <h3 className="font-black text-slate-800 mb-4 uppercase text-sm border-b-2 border-orange-500 inline-block pb-1 tracking-widest"><Gamepad2 className="w-5 h-5 text-orange-500 inline mr-2"/>Select Category</h3>
        {games.length === 0 ? (
          <div className="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center shadow-sm"><Gamepad2 className="w-12 h-12 mb-3 text-slate-300" /><p className="font-bold uppercase tracking-widest text-xs text-slate-400">No games available yet</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {games.map(game => (
              <div key={game.id} onClick={() => onSelectGame(game)} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 active:scale-95 transition-transform cursor-pointer select-none hover:shadow-md">
                <div className="w-full h-32 bg-slate-900 flex items-center justify-center relative overflow-hidden">{game.bannerUrl ? <img src={game.bannerUrl} className="w-full h-full object-cover opacity-80 scale-105 hover:scale-100 transition-transform duration-500" alt=""/> : <span className="text-white opacity-20 font-black tracking-widest uppercase text-xl">{String(game.name)}</span>}<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div></div>
                <div className="p-4 text-center font-black text-sm uppercase tracking-wider">{String(game.name)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onSelectJoined} className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex items-center justify-between active:scale-95 transition-transform hover:shadow-md cursor-pointer select-none">
        <div className="flex items-center gap-4"><div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-3.5 rounded-xl text-white shadow-lg"><PlayCircle className="w-6 h-6" /></div><div className="text-left"><div className="font-black text-lg uppercase tracking-wide">My Matches</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">View joined tournaments</div></div></div><ChevronRight className="text-slate-300 w-6 h-6" />
      </button>
    </div>
  );
}

function UserGameModesView({ game, modes, onSelect, onBack }) {
  if (!game) return null;
  const gameModes = modes.filter(m => m.gameId === game.id);
  return (
    <div className="animate-in slide-in-from-right-8 duration-200">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 sticky top-0 z-10 shadow-sm"><button onClick={onBack} className="p-2.5 bg-slate-100 rounded-full active:scale-95 transition-transform cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button><h2 className="font-black text-xl uppercase tracking-wider">{String(game.name)}</h2></div>
      <div className="p-4 space-y-4">
        {gameModes.length === 0 ? <div className="text-center text-slate-400 font-bold py-12 bg-white rounded-3xl border border-slate-200 shadow-sm uppercase tracking-widest text-xs">No modes available yet.</div> : null}
        {gameModes.map(mode => (
          <div key={mode.id} onClick={() => onSelect(mode)} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 flex items-center cursor-pointer select-none active:scale-95 transition-transform hover:shadow-md p-2.5 gap-4">
            <div className="w-28 h-28 bg-slate-900 rounded-2xl flex shrink-0 items-center justify-center relative overflow-hidden shadow-inner">{mode.bannerUrl ? <img src={mode.bannerUrl} alt={mode.name} className="w-full h-full object-cover opacity-80" /> : <Trophy className="text-white/20 w-10 h-10"/>}</div>
            <div className="flex-1 py-2 pr-3"><h3 className="font-black text-xl text-slate-800 uppercase tracking-wide leading-tight">{String(mode.name)}</h3><div className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 font-black px-3 py-2 rounded-lg inline-flex items-center gap-1.5 mt-3 uppercase tracking-widest shadow-sm">View Matches <ChevronRight className="w-3 h-3"/></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserModeTournamentsView({ mode, tournaments, user, settings, onSelect, onBack }) {
  const [tab, setTab] = useState('upcoming');
  if (!mode) return null;
  const mt = tournaments.filter(t => t.modeId === mode.id && (tab === 'result' ? (t.status === 'result' || t.status === 'cancelled') : t.status === tab)).sort((a,b) => new Date(a.dateTime || 0) - new Date(b.dateTime || 0));

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-200">
       <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 sticky top-0 z-10 shadow-sm"><button onClick={onBack} className="p-2.5 bg-slate-100 rounded-full active:scale-95 transition-transform cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45" /></button><h2 className="font-black text-xl uppercase tracking-wider truncate">{String(mode.name)}</h2></div>
       <div className="flex bg-white border-b sticky top-[76px] z-10 shadow-sm">
        {['upcoming','ongoing','result'].map(k => <button key={k} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer select-none ${tab === k ? 'text-orange-600 border-b-4 border-orange-600 bg-orange-50' : 'text-slate-400 hover:bg-slate-50'}`} onClick={()=>setTab(k)}>{k}</button>)}
       </div>
       <div className="p-4 space-y-5">
        {mt.length === 0 ? <div className="text-center text-slate-400 font-bold py-12 bg-white rounded-3xl border border-slate-200 shadow-sm uppercase tracking-widest text-xs">No {tab} matches found.</div> : mt.map(t => <UserTournamentCard key={t.id} t={t} user={user} settings={settings} onClick={() => onSelect(t)} />)}
       </div>
    </div>
  );
}

function UserJoinedMatchesView({ tournaments, user, settings, onSelect, onBack }) {
  const [tab, setTab] = useState('upcoming');
  const joined = tournaments.filter(t => (t.joinedUsers || []).some(x => x.uid === user.uid) && (tab === 'result' ? (t.status === 'result' || t.status === 'cancelled') : t.status === tab)).sort((a,b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));

  return (
     <div className="flex flex-col h-full animate-in slide-in-from-bottom-8 duration-200">
       <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 sticky top-0 z-10 shadow-sm"><button onClick={onBack} className="p-2.5 bg-slate-100 rounded-full active:scale-95 transition-transform cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45" /></button><h2 className="font-black text-xl uppercase tracking-wider">My Matches</h2></div>
       <div className="flex bg-white border-b sticky top-[76px] z-10 shadow-sm">
        {['upcoming','ongoing','result'].map(k => <button key={k} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer select-none ${tab === k ? 'text-orange-600 border-b-4 border-orange-600 bg-orange-50' : 'text-slate-400 hover:bg-slate-50'}`} onClick={()=>setTab(k)}>{k}</button>)}
       </div>
       <div className="p-4 space-y-5">
        {joined.length === 0 ? <div className="text-center text-slate-400 font-bold py-12 bg-white rounded-3xl border border-slate-200 shadow-sm uppercase tracking-widest text-xs">You haven't joined any {tab} matches.</div> : joined.map(t => <UserTournamentCard key={t.id} t={t} user={user} settings={settings} onClick={() => onSelect(t)} />)}
       </div>
    </div>
  );
}

function UserTournamentCard({ t, user, settings, onClick }) {
  const isJoined = (t.joinedUsers || []).some(x => x.uid === user.uid);
  const slotsFilled = (t.joinedUsers || []).length;
  const isFull = slotsFilled >= t.totalSlots;
  const slotPercent = t.totalSlots > 0 ? ((slotsFilled / t.totalSlots) * 100) : 0;
  
  return (
    <div onClick={onClick} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer select-none active:scale-[0.98] transition-transform hover:shadow-lg">
      <div className="relative h-40 bg-slate-900">
        {t.bannerUrl ? <img src={t.bannerUrl} className="w-full h-full object-cover opacity-70" alt="banner" /> : <div className="w-full h-full flex items-center justify-center text-slate-700"><Trophy className="w-12 h-12"/></div>}
        <div className="absolute top-3 right-3 bg-black/80 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-sm shadow border border-white/10"><Clock className="w-3 h-3 text-orange-400" /> {formatDate(t.dateTime)}</div>
        {isJoined && <div className="absolute top-3 left-3 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 border border-emerald-400"><CheckCircle2 className="w-3 h-3"/> JOINED</div>}
      </div>
      <div className="p-5">
        <h3 className="font-black text-xl mb-4 text-slate-800 leading-tight uppercase tracking-wide">{String(t.title)}</h3>
        <div className="grid grid-cols-3 gap-3 text-center mb-5">
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 shadow-sm"><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Entry</div><div className="font-black text-blue-600 text-xl leading-none">{String(t.entryFee)} <span className="text-[10px]">{String(settings.currencySymbol)}</span></div></div>
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 shadow-sm"><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Per Kill</div><div className="font-black text-emerald-600 text-xl leading-none">{String(t.perKill)} <span className="text-[10px]">{String(settings.currencySymbol)}</span></div></div>
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 shadow-sm"><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Type</div><div className="font-black text-slate-700 text-sm mt-1.5 uppercase tracking-widest">{String(t.type)}</div></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="w-1/2 bg-slate-200 rounded-full h-3 mr-4 overflow-hidden shadow-inner"><div className={`h-3 rounded-full transition-all ${isFull ? 'bg-rose-500' : 'bg-orange-500'}`} style={{width: `${slotPercent}%`}}></div></div>
          <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${isFull ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{isFull ? 'FULL' : `${slotsFilled} / ${t.totalSlots} Slots`}</div>
        </div>
      </div>
    </div>
  );
}

function UserTournamentDetailView({ t, user, allUsers, settings, onBack, executeAction, showModal, setCinematicRoom }) {
  if (!t) return null;
  const isJoined = (t.joinedUsers || []).some(x => x.uid === user.uid);
  const slotsFilled = (t.joinedUsers || []).length;
  const isFull = slotsFilled >= t.totalSlots;
  const jp = (t.joinedUsers || []).map(ju => {
    const uid = ju.uid || ju;
    return { uid, name: allUsers.find(u => u.uid === uid)?.gameName || allUsers.find(u => u.uid === uid)?.name || 'Player' };
  });

  const onJoin = () => {
    if (Number(user.depositBalance || 0) < Number(t.entryFee)) return showModal("Insufficient Balance", "Please deposit to join this match.", "error");
    if (isFull) return showModal("Match Full", "No slots available.", "error");
    if ((t.joinedUsers || []).some(x => x.uid === user.uid)) return showModal("Already Joined", "You already joined.", "error");

    showModal("Confirm Join", `Join for ${t.entryFee} ${settings.currencyName}?`, "confirm", () => executeAction('join_match', {tid: t.id, fee: Number(t.entryFee), joined: t.joinedUsers||[]}));
  };

  return (
    <div className="bg-white min-h-full pb-10 animate-in slide-in-from-right-8 duration-200">
      <div className="relative h-64 bg-slate-900">
        <button onClick={onBack} className="absolute top-5 left-5 z-10 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors shadow-lg active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-6 h-6 rotate-45" /></button>
        {t.bannerUrl && <img src={t.bannerUrl} className="w-full h-full object-cover opacity-50" alt="banner" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg mb-3 shadow-md border ${t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : t.status === 'ongoing' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : t.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'}`}>{String(t.status)} MATCH</span>
          <h2 className="text-3xl font-black leading-tight drop-shadow-md uppercase tracking-wide">{String(t.title)}</h2>
          <div className="flex items-center gap-2 text-sm opacity-90 mt-2 font-bold uppercase tracking-widest text-orange-400"><Clock className="w-4 h-4"/> {formatDate(t.dateTime)}</div>
        </div>
      </div>

      <div className="p-5 space-y-6 -mt-3 relative z-10 bg-white rounded-t-3xl">
        {t.status === 'upcoming' && !isJoined && (
           <button onClick={onJoin} disabled={isFull} className={`w-full py-5 rounded-2xl font-black text-xl tracking-wider shadow-lg active:scale-95 transition-transform cursor-pointer select-none ${isFull ? 'bg-slate-300 text-slate-500' : 'bg-orange-600 text-white hover:bg-orange-700'}`}>
             {isFull ? 'MATCH FULL' : `JOIN NOW (${t.entryFee} ${settings.currencyName})`}
           </button>
        )}
        
        {isJoined && t.status === 'upcoming' && (
          <div className="bg-emerald-50 text-emerald-700 p-6 rounded-3xl border border-emerald-200 text-center font-bold shadow-sm">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <p className="text-xl mb-1 font-black uppercase tracking-wider">You are registered!</p>
            <p className="text-sm font-medium opacity-80">Room details will appear here when the match goes ongoing.</p>
          </div>
        )}

        {(t.status === 'ongoing' || t.status === 'result') && isJoined && (
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95">
            <h3 className="font-black text-orange-500 mb-5 text-center tracking-widest text-sm uppercase flex items-center justify-center gap-2"><Gamepad2 className="w-5 h-5"/> ROOM CREDENTIALS</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800 p-5 rounded-2xl border border-slate-600 shadow-inner">
                <div><div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Room ID</div><div className="font-mono font-black text-2xl tracking-widest text-white">{String(t.roomId || 'Waiting...')}</div></div>
                {t.roomId && <button type="button" onClick={() => copyText(String(t.roomId), () => showModal("Copied", "Room ID copied successfully.", "info"))} className="p-4 bg-orange-600 text-white rounded-xl cursor-pointer active:scale-95 select-none touch-manipulation z-50"><Copy className="w-5 h-5"/></button>}
              </div>
              <div className="flex justify-between items-center bg-slate-800 p-5 rounded-2xl border border-slate-600 shadow-inner">
                <div><div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Password</div><div className="font-mono font-black text-2xl tracking-widest text-white">{String(t.password || 'Waiting...')}</div></div>
                {t.password && <button type="button" onClick={() => copyText(String(t.password), () => showModal("Copied", "Password copied successfully.", "info"))} className="p-4 bg-orange-600 text-white rounded-xl cursor-pointer active:scale-95 select-none touch-manipulation z-50"><Copy className="w-5 h-5"/></button>}
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-6 text-center bg-slate-800/50 p-3 rounded-xl border border-slate-800 uppercase tracking-widest leading-relaxed">Open your game and enter these details to join the custom room.</p>
          </div>
        )}

        {t.status === 'result' && t.results && Array.isArray(t.results) && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in">
            <div className="bg-slate-50 p-5 border-b border-slate-200 font-black text-slate-800 flex items-center gap-3 uppercase tracking-widest text-lg">
              <Trophy className="w-6 h-6 text-amber-500" /> FINAL RESULTS
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <tr><th className="p-4 text-left">Player</th><th className="p-4 text-center">Kills</th><th className="p-4 text-right">Earned</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {t.results.sort((a,b)=>(Number(b.earned||0))-Number(a.earned||0)).map((r, i) => (
                    <tr key={r.uid || i} className={r.uid === user.uid ? 'bg-orange-50/80' : 'hover:bg-slate-50'}>
                      <td className="p-4 font-black text-slate-800 text-lg uppercase tracking-wide">{String(r.gameName)} {r.uid === user.uid && <span className="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded-md ml-2 shadow-sm font-black tracking-widest uppercase align-middle">You</span>}</td>
                      <td className="p-4 text-center font-black text-slate-600 text-xl">{String(r.kills)}</td>
                      <td className="p-4 text-right font-black text-emerald-600 text-xl">{String(r.earned)} <span className="text-[10px]">{settings.currencySymbol}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {t.status === 'cancelled' && (
           <div className="bg-rose-50 text-rose-700 p-6 rounded-3xl border border-rose-200 text-center font-bold shadow-sm">
             <XCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
             <p className="text-xl font-black uppercase tracking-wider">Match Cancelled</p>
             <p className="text-sm font-medium mt-1">Entry fees have been refunded to all joined players.</p>
           </div>
        )}

        <div className="grid grid-cols-2 gap-4">
           <UserDetailBox label="Match Type" value={String(t.type).toUpperCase()} />
           <UserDetailBox label="Entry Fee" value={`${t.entryFee} ${settings.currencySymbol}`} color="text-orange-600" />
           <UserDetailBox label="Per Kill" value={`${t.perKill} ${settings.currencySymbol}`} color="text-emerald-600" />
           <UserDetailBox label="Slots Filled" value={`${slotsFilled}/${t.totalSlots}`} />
        </div>

        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-inner">
          <h3 className="font-black text-slate-800 mb-3 uppercase text-xs tracking-widest flex items-center gap-2"><Info className="w-4 h-4 text-blue-500"/> Instructions</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium leading-relaxed">{String(t.customText || 'Play fair and respect others.')}</p>
        </div>

        <div className="py-5 border-t border-slate-200">
           <div className="flex justify-between items-center mb-4">
             <div className="font-black text-slate-800 uppercase tracking-widest text-sm">Joined Players</div>
             <div className="text-sm font-black bg-blue-100 text-blue-700 px-4 py-1.5 rounded-lg shadow-sm tracking-widest">{slotsFilled} / {t.totalSlots}</div>
           </div>
           
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
             {jp.length === 0 ? <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-4">No players joined yet.</p> : (
               <div className="flex flex-wrap gap-2">
                 {jp.map((p, i) => (
                   <span key={i} className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border shadow-sm select-none cursor-default ${p.uid===user.uid?'bg-orange-100 text-orange-700 border-orange-200':'bg-white text-slate-600 border-slate-200'}`}>
                     {String(p.name)} {p.uid===user.uid&&'(YOU)'}
                   </span>
                 ))}
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

function UserMessagesView({ messages, user, onBack }) {
  const sorted = [...(messages || [])].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
  
  const markRead = async (msg) => {
    if (!(msg.readBy || []).includes(user.uid)) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msg.id), {
        readBy: arrayUnion(user.uid)
      });
    }
  };

  return (
    <div className="bg-white min-h-full animate-in slide-in-from-right-8 duration-200">
      <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center gap-4 shadow-sm">
        <button onClick={onBack} className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-xl font-black uppercase tracking-wider">Messages</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {sorted.length === 0 && <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No messages yet.</div>}
        {sorted.map(m => {
          const isRead = (m.readBy || []).includes(user.uid);
          return (
            <details key={m.id} className="p-5 group bg-white cursor-pointer" onClick={() => markRead(m)}>
              <summary className="list-none flex justify-between items-center outline-none">
                <div className="flex items-center gap-3">
                  {!isRead ? <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]"></div> : <div className="w-2 h-2"></div>}
                  <div>
                    <div className={`font-black text-sm uppercase ${!isRead ? 'text-slate-800' : 'text-slate-500'}`}>{String(m.title)}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{formatDate(m.createdAt)}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="mt-4 pl-5 text-sm font-bold text-slate-600 whitespace-pre-wrap leading-relaxed border-l-2 border-slate-100 ml-1">
                {String(m.body)}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function UserDepositView({ user, settings, onBack, executeAction, showModal, setViewState }) {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(1);

  const submitDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      return showModal("Invalid Amount", "Enter valid amount", "error");
    }
    if (Number(amount) < 10) {
      return showModal("Minimum Deposit", "Minimum deposit is ₹10", "error");
    }

    try {
      await executeAction('transaction', {
        type: 'deposit_pending',
        amount: Number(amount),
        description: 'Manual QR Deposit',
        status: 'pending'
      });

      showModal("Request Sent", "Your deposit request has been submitted to admins. Once verified, it will be added to your balance.", "info", () => setViewState({view: 'main'}));
    } catch (e) {
      showModal("Error", "Failed to initiate deposit.", "error");
    }
  };

  const upiString = `upi://pay?pa=${settings.upiId}&pn=${settings.appName}&am=${amount}&cu=INR`;
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${upiString}`;

  return (
    <div className="p-4 min-h-full overflow-y-auto bg-white animate-in slide-in-from-bottom-8 duration-200">
       <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <button onClick={onBack} className="p-2.5 mr-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-2xl font-black uppercase tracking-wider">Add {String(settings.currencyName)}</h2>
      </div>

      {step === 1 ? (
        <div className="space-y-8 pb-32">
          <div className="bg-orange-50 p-8 rounded-3xl text-center shadow-inner border border-orange-100">
            <div className="text-xs text-orange-600 font-black uppercase tracking-widest mb-2">Total Balance</div>
            <div className="text-5xl font-black text-orange-700">{Number(user.balance || 0)} <span className="text-2xl">{String(settings.currencySymbol)}</span></div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Enter Amount (Min ₹10)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e)=>{
                const val = e.target.value;
                setAmount(val === '' ? '' : Number(val));
              }} 
              placeholder="e.g. 100" 
              className="w-full text-center text-4xl font-black p-5 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none shadow-sm text-slate-800" 
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
             {[50, 100, 200, 500].map(val => (
               <button key={val} onClick={()=>setAmount(Number(val))} className="py-4 bg-slate-50 text-slate-700 font-black text-lg rounded-xl border border-slate-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 active:scale-95 transition-all shadow-sm cursor-pointer select-none">+{val}</button>
             ))}
          </div>
          <button 
            disabled={
              amount === '' ||
              isNaN(amount) ||
              Number(amount) <= 0
            }
            onClick={() => setStep(2)}
            className="w-full bg-emerald-500 text-white font-black text-xl tracking-widest uppercase py-5 rounded-2xl shadow-[0_4px_14px_0_rgb(16,185,129,0.39)] hover:bg-emerald-600 disabled:opacity-50 mt-10 active:scale-95 transition-transform cursor-pointer select-none block"
          >
            SHOW QR CODE
          </button>
        </div>
      ) : (
        <div className="space-y-6 text-center animate-in fade-in">
           <h3 className="font-black text-2xl text-slate-800 uppercase tracking-wider">Scan to Pay ₹{amount}</h3>
           
           <div className="bg-slate-50 p-5 inline-block rounded-3xl shadow-lg border border-slate-200 w-full max-w-[280px] aspect-square relative">
             <img 
               src={dynamicQrUrl}
               alt="Deposit QR" 
               className="w-full h-full object-contain rounded-xl"
               onError={(e) => { e.target.src = settings.depositQrUrl }} 
             />
           </div>
           
           <div className="bg-amber-50 text-amber-700 p-6 rounded-2xl text-sm font-medium border border-amber-200 shadow-sm text-left">
             <ul className="list-disc pl-5 space-y-2">
               <li>Scan the QR code above using any UPI App (GPay, PhonePe, Paytm).</li>
               <li>Pay exactly <b className="font-black">₹{amount}</b>.</li>
               <li>After successful payment, click the button below.</li>
             </ul>
           </div>
           
           <button onClick={submitDeposit} className="w-full bg-blue-600 text-white font-black text-lg tracking-wider py-5 rounded-2xl shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] mt-4 flex justify-center items-center gap-3 active:scale-95 transition-transform cursor-pointer select-none">
             <CheckCircle2 className="w-6 h-6"/> I HAVE PAID ₹{amount}
           </button>
           
           <button onClick={()=>setStep(1)} className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs hover:text-slate-800 transition block w-full py-4 cursor-pointer select-none">Cancel / Change Amount</button>
        </div>
      )}
    </div>
  );
}

function UserWithdrawView({ user, settings, onBack, executeAction, showModal, setViewState }) {
   const [amount, setAmount] = useState(''); 
   const [upi, setUpi] = useState('');
   
   const submitWithdraw = async () => {
     if (!upi) return showModal("Invalid UPI", "Enter UPI ID", "error");
     if (Number(amount) < settings.minWithdraw) return showModal("Minimum Withdraw", `Minimum is ${settings.minWithdraw}`, "error");
     if (Number(amount) > Number(user.winningBalance || 0)) return showModal("Insufficient Winnings", "Not enough winning balance to withdraw.", "error");
     
     try { 
        await executeAction('withdraw_winnings', Number(amount)); 
        await executeAction('transaction', {type: 'withdraw_pending', amount: -Number(amount), description: `Withdraw to ${upi}`, status: 'pending'}); 
        showModal("Withdraw Requested", "Request sent to admin.", "info", () => setViewState({view: 'main'})); 
     } catch(err){
        showModal("Error", "Withdraw failed.", "error");
     }
   };

   return (
    <div className="p-4 min-h-full overflow-y-auto bg-white animate-in slide-in-from-bottom-8 duration-200">
       <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <button onClick={onBack} className="p-2.5 mr-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-2xl font-black uppercase tracking-wider">Withdraw Winnings</h2>
      </div>
      <div className="space-y-6 pb-32">
        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner text-center">
          <div className="text-xs text-slate-500 font-black uppercase tracking-widest mb-2">Withdrawable Balance</div>
          <div className="text-5xl font-black text-emerald-600">{Number(user.winningBalance || 0)} <span className="text-2xl">{String(settings.currencySymbol)}</span></div>
        </div>
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Your UPI ID</label>
          <input type="text" value={upi} onChange={e=>setUpi(e.target.value)} placeholder="yourname@upi" className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none shadow-sm font-bold text-lg" />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Amount (Min. {settings.minWithdraw})</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none shadow-sm font-black text-3xl" />
        </div>
        <button onClick={submitWithdraw} disabled={!amount || !upi} className="w-full bg-orange-600 text-white font-black tracking-widest text-lg uppercase py-5 rounded-2xl shadow-[0_4px_14px_0_rgb(234,88,12,0.39)] mt-6 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer select-none">SUBMIT REQUEST</button>
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 text-center mt-4">Withdrawals are securely processed within 24 hours.</p>
      </div>
    </div>
   );
}

function UserTransactionsView({ transactions, settings, onBack }) {
  const sorted = [...transactions].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
  return (
    <div className="bg-white min-h-full animate-in slide-in-from-right-8 duration-200">
      <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center gap-4 shadow-sm">
        <button onClick={onBack} className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-xl font-black uppercase tracking-wider">Transaction History</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {sorted.length === 0 && <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No transactions found.</div>}
        {sorted.map(t => {
          // Hide referral withdraws from normal history view unless it's explicitly a referral withdraw type (to match admin mapping)
          const isWithdraw = t.type === 'withdraw_pending' || t.type === 'withdraw_failed' || t.type === 'withdraw_completed';
          return (
            <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer select-none">
              <div>
                 <div className="font-black text-slate-800 uppercase tracking-wide text-sm">{String(t.type).replace('_pending', '').replace('_', ' ')}</div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{formatDate(t.date)}</div>
                 <div className="text-xs text-slate-600 font-bold mt-1.5">{String(t.description)}</div>
                 {t.status === 'pending' && <span className="text-[9px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md mt-2 inline-block font-black uppercase tracking-widest">Pending</span>}
                 {t.status === 'failed' && <span className="text-[9px] bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md mt-2 inline-block font-black uppercase tracking-widest">Failed</span>}
                 {t.status === 'completed' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md mt-2 inline-block font-black uppercase tracking-widest">Completed</span>}
              </div>
              <div className={`font-black text-xl ${t.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t.amount > 0 ? '+' : ''}{String(t.amount)} <span className="text-xs">{String(settings.currencySymbol)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function UserEditProfileView({ user, onBack, showModal }) {
  const [gameName, setGameName] = useState(user.gameName || '');
  const [gameUid, setGameUid] = useState(user.gameUid || '');
  
  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { gameName, gameUid });
      showModal("Success", "Profile updated successfully!", "info", () => onBack());
    } catch(e) {
      showModal("Error", "Could not update profile.", "error");
    }
  };

  return (
    <div className="bg-white min-h-full p-4 animate-in slide-in-from-right-8 duration-200">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <button onClick={onBack} className="p-2.5 mr-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-2xl font-black uppercase tracking-wider">Edit Game Info</h2>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">In-Game Name</label>
          <input type="text" value={gameName} onChange={e=>setGameName(e.target.value)} className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none shadow-sm font-bold text-lg" />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Game UID</label>
          <input type="text" value={gameUid} onChange={e=>setGameUid(e.target.value)} className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none shadow-sm font-mono tracking-widest text-lg" />
        </div>
        <button onClick={handleSave} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl shadow-[0_4px_14px_0_rgb(234,88,12,0.39)] mt-8 hover:bg-orange-700 active:scale-95 transition-transform text-lg uppercase tracking-widest cursor-pointer select-none">SAVE PROFILE</button>
      </div>
    </div>
  );
}

function UserSupportView({ settings, onBack }) {
  const channels = settings.supportChannels || [];
  return (
    <div className="bg-white min-h-full p-4 animate-in slide-in-from-right-8 duration-200">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <button onClick={onBack} className="p-2.5 mr-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer select-none"><ArrowDownLeft className="w-5 h-5 rotate-45 text-slate-600" /></button>
        <h2 className="text-2xl font-black uppercase tracking-wider">Help & Support</h2>
      </div>
      <div className="space-y-4 mt-6">
        <p className="text-sm font-bold text-slate-500 mb-6 px-2">Need help? Reach out to us via any of the channels below.</p>
        {channels.length === 0 && <div className="text-center text-slate-400 font-bold uppercase tracking-widest p-10 border-2 border-dashed border-slate-200 rounded-2xl">No channels added yet.</div>}
        {channels.map((c, i) => (
          <button key={i} onClick={() => window.open(c.url, '_blank')} className="w-full bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm active:scale-95 transition-transform hover:shadow-md group cursor-pointer select-none">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                {c.iconUrl ? <img src={c.iconUrl} className="w-full h-full object-contain" alt="icon" /> : <LinkIcon className="text-slate-400"/>}
              </div>
              <span className="font-black text-lg text-slate-800 uppercase tracking-wide">{String(c.name)}</span>
            </div>
            <ArrowUpRight className="text-slate-400 group-hover:text-blue-500 transition-colors"/>
          </button>
        ))}
      </div>
    </div>
  );
}

function UserLeaderboardView({ users, transactions, settings }) {
  if (!settings.leaderboardVisible) {
     return <div className="flex h-full items-center justify-center p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">Leaderboard is hidden by admin.</div>;
  }

  const [metric, setMetric] = useState('winnings'); 
  const [timeFilter, setTimeFilter] = useState('all_time'); 
  const [myRank, setMyRank] = useState(null);

  const calculateRanking = () => {
    let rankedUsers = [...users].filter(u => !u.isBanned);
    if (timeFilter === 'all_time') {
      rankedUsers.sort((a,b) => metric === 'winnings' ? (Number(b.totalWinnings) || 0) - (Number(a.totalWinnings) || 0) : (Number(b.totalKills) || 0) - (Number(a.totalKills) || 0));
    } else {
      const now = new Date();
      rankedUsers = rankedUsers.map(u => {
        let sum = 0;
        const uTxs = (transactions || []).filter(t => t.uid === u.uid && t.type === 'winnings');
        uTxs.forEach(t => {
          const tDate = new Date(t.date);
          if (timeFilter === 'today') {
            if (tDate.toDateString() === now.toDateString()) sum += Number(t.amount);
          } else if (timeFilter === 'month') {
            if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) sum += Number(t.amount);
          }
        });
        return { ...u, periodScore: sum };
      });
      rankedUsers.sort((a,b) => Number(b.periodScore) - Number(a.periodScore));
    }
    return rankedUsers;
  };

  const sortedUsers = calculateRanking();
  const top20 = sortedUsers.slice(0, 20);

  useEffect(() => {
    const myId = localStorage.getItem('esports_player_id');
    const index = sortedUsers.findIndex(u => u.uid === myId);
    setMyRank(index >= 0 ? index + 1 : 'Unranked');
  }, [sortedUsers, metric, timeFilter]);

  const getScore = (p) => timeFilter === 'all_time' ? (metric === 'winnings' ? Number(p.totalWinnings||0) : Number(p.totalKills||0)) : Number(p.periodScore||0);

  return (
    <div className="p-4 h-full animate-in slide-in-from-bottom-4 duration-300 flex flex-col relative">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-3xl p-8 text-white text-center mb-6 shadow-lg relative overflow-hidden shrink-0">
        <div className="relative z-10">
          <Trophy className="w-16 h-16 mx-auto mb-3 text-yellow-300 drop-shadow-lg" />
          <h2 className="text-4xl font-black tracking-tight uppercase">Top Players</h2>
          <p className="text-orange-200 text-xs font-black uppercase tracking-widest mt-2">Hall of Fame (Top 20)</p>
        </div>
        <Trophy className="absolute -right-8 -bottom-8 w-56 h-56 text-white opacity-10 rotate-12" />
      </div>

      <div className="flex bg-white rounded-2xl p-1.5 mb-3 border border-slate-200 shadow-sm shrink-0">
        <button onClick={()=>setMetric('winnings')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer select-none ${metric === 'winnings' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Top Earners</button>
        <button onClick={()=>setMetric('kills')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer select-none ${metric === 'kills' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Top Fraggers</button>
      </div>

      <div className="flex bg-slate-200 rounded-xl p-1 mb-4 shrink-0">
        <button onClick={()=>setTimeFilter('today')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer select-none ${timeFilter === 'today' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Today</button>
        <button onClick={()=>setTimeFilter('month')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer select-none ${timeFilter === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Month</button>
        <button onClick={()=>setTimeFilter('all_time')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer select-none ${timeFilter === 'all_time' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>All Time</button>
      </div>

      <div className="bg-slate-900 text-white p-4 rounded-2xl mb-4 flex items-center justify-between shadow-md shrink-0 border border-slate-800">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">Your Current Position</div>
        <div className="text-2xl font-black text-orange-400">#{myRank}</div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex-1 overflow-y-auto mb-4">
         {top20.length === 0 && <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No players ranked yet.</div>}
         {top20.map((p, i) => (
           <div key={p.uid} className={`flex items-center p-5 border-b border-slate-100 last:border-0 transition-colors cursor-pointer select-none ${p.isBanned ? 'opacity-50 grayscale' : 'hover:bg-slate-50'}`}>
             <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center font-black text-lg mr-4 ${i===0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white shadow-lg' : i===1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md' : i===2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
               {i + 1}
             </div>
             <div className="flex-1 min-w-0 pr-2">
               <div className="font-black text-slate-800 text-base truncate flex items-center gap-2">
                 {String(p.gameName || p.name)}
                 {p.isBanned && <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">Banned</span>}
               </div>
               <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-widest uppercase truncate">{p.isBanned ? String(p.banMessage) : `UID: ${p.gameUid || 'Not Set'}`}</div>
             </div>
             <div className="text-right shrink-0">
               {metric === 'winnings' ? (
                 <><div className="font-black text-emerald-600 text-xl leading-none">{getScore(p)}</div><div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1.5">{String(settings.currencyName)}</div></>
               ) : (
                 <><div className="font-black text-blue-600 text-xl leading-none">{getScore(p)}</div><div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1.5">Kills</div></>
               )}
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}

function UserMenuAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left active:bg-slate-100 border-b border-slate-100 last:border-0 cursor-pointer select-none">
      <div className="flex items-center gap-3 font-bold text-slate-700 uppercase text-xs tracking-wider"><Icon className="w-5 h-5 text-slate-400" /> {label}</div>
      <ChevronRight className="w-5 h-5 text-slate-300" />
    </button>
  );
}

function UserAboutView({ user, settings, setViewState, onLogout, showModal, executeAction }) {
  const handleCopyLink = async () => {
    const link = `https://esports-tournament-app-beta.vercel.app/?ref=${user.referralCode}`;
    
    // Try Native Share API First (Great for Mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: settings.appName,
          text: 'Join me and play tournaments!',
          url: link
        });
        return;
      } catch (e) {
        // Fallback to copy if user closes the share sheet
      }
    }
    
    // Fallback Universal Copy
    copyText(link, () => showModal("Copied", "Referral link copied.", "info"));
  };

  const triggerReferralWithdraw = () => {
     showModal(
       "Withdraw Referral Funds", 
       `You have ${user.referralBalance} ${settings.currencySymbol} to withdraw. Enter details below.`, 
       "prompt_withdraw_ref", 
       async (upi, amount) => {
         if (!amount || !upi) return showModal("Error", "Please fill all fields.", "error");
         if (Number(amount) < settings.minReferralWithdraw) return showModal("Error", `Minimum is ${settings.minReferralWithdraw}.`, "error");
         if (Number(amount) > user.referralBalance) return showModal("Error", "Insufficient referral balance.", "error");
         
         try {
           await executeAction('update_balance', 0); // No regular balance change
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
             referralBalance: Number(user.referralBalance) - Number(amount)
           });
           await executeAction('transaction', {type: 'referral_withdraw_pending', amount: -Number(amount), description: `Referral Withdraw to ${upi}`, status: 'pending'});
           showModal("Success", "Withdrawal request submitted successfully.", "info");
         } catch(e) {
           showModal("Error", "Failed to submit request.", "error");
         }
       }, true
     );
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center border-[6px] border-orange-100 shadow-lg relative z-10">
          <span className="text-5xl font-black text-orange-600">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        <h2 className="text-2xl font-black text-slate-800 relative z-10 leading-tight tracking-wide">{user.name}</h2>
        <div className="text-xs font-bold text-slate-500 mb-3 relative z-10 uppercase tracking-widest mt-1">UID: <span className="font-mono text-slate-700">{user.gameUid || 'Not Set'}</span></div>
        <div className="text-[10px] font-black text-orange-600 relative z-10 bg-orange-50 inline-block px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm border border-orange-100">IGN: {user.gameName || 'Not Set'}</div>
        
        <div className="grid grid-cols-2 gap-4 mt-8 relative z-10 border-t pt-6 border-slate-100">
           <UserDetailBox label="Total Kills" value={Number(user.totalKills || 0)} />
           <UserDetailBox label="Winnings" value={`${Number(user.totalWinnings || 0)} ${settings.currencySymbol}`} color="text-emerald-600" />
           <UserDetailBox label="Total Refers" value={Number(user.totalRefers || 0)} color="text-blue-600" />
           <UserDetailBox label="Referral Earnings" value={`${Number(user.totalReferralAmount || 0)} ${settings.currencySymbol}`} color="text-orange-600" />
        </div>
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-orange-500 to-orange-700"></div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">My Wallet</h3>
         <div className="flex gap-3">
           <button onClick={() => setViewState({view: 'deposit'})} className="flex-1 bg-orange-50 border border-orange-200 text-orange-600 p-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-transform cursor-pointer select-none"><Plus className="w-5 h-5 mx-auto mb-1"/> Deposit</button>
           <button onClick={() => setViewState({view: 'withdraw'})} className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-transform cursor-pointer select-none"><ArrowUpRight className="w-5 h-5 mx-auto mb-1"/> Withdraw</button>
           <button onClick={() => setViewState({view: 'transactions'})} className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 p-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-transform cursor-pointer select-none"><Clock className="w-5 h-5 mx-auto mb-1"/> History</button>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <UserMenuAction icon={Gamepad2} label="Edit Game Profile" onClick={() => setViewState({view: 'edit_profile'})} />
        <UserMenuAction icon={Info} label="Customer Support" onClick={() => setViewState({view: 'support'})} />
        <UserMenuAction icon={ShieldAlert} label="Terms & Conditions" onClick={() => showModal("Terms & Conditions", settings.termsAndConditions, "info")} />
        <button onClick={onLogout} className="w-full flex items-center justify-between p-5 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors border-t border-slate-100 cursor-pointer select-none">
          <div className="flex items-center gap-3 font-black text-sm uppercase tracking-widest"><LogOut className="w-5 h-5" /> LOGOUT</div>
        </button>
      </div>

      <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
         <div className="relative z-10">
           <h3 className="font-black text-xl mb-1 tracking-wide uppercase">Refer & Earn {settings.referralBonusPercent}%</h3>
           <p className="text-orange-200 text-xs mb-6 font-bold tracking-wider uppercase">Get {settings.referralBonusPercent}% of your friends' first deposit!</p>
           
           <div className="bg-black/20 rounded-2xl p-5 mb-6 border border-white/10 shadow-inner">
             <div className="text-[10px] uppercase font-black text-orange-300 tracking-widest mb-2">Your Link/Code</div>
             <div className="flex justify-between items-center">
               <div className="font-mono text-2xl font-black tracking-widest drop-shadow-md">{user.referralCode}</div>
               <button onClick={handleCopyLink} className="px-4 py-2 bg-white text-orange-700 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer select-none"><Copy className="w-4 h-4"/> SHARE</button>
             </div>
           </div>
           
           <div className="flex gap-4">
             <div className="flex-1 bg-black/20 rounded-2xl p-4 text-center border border-white/10 shadow-inner">
               <div className="text-[10px] text-orange-300 font-black uppercase tracking-widest mb-1.5">Total Refers</div>
               <div className="font-black text-2xl drop-shadow-md">{user.totalRefers || 0}</div>
             </div>
             <div className="flex-1 bg-black/20 rounded-2xl p-4 text-center border border-white/10 shadow-inner">
               <div className="text-[10px] text-orange-300 font-black uppercase tracking-widest mb-1.5">Referral Wallet</div>
               <div className="font-black text-2xl text-yellow-300 drop-shadow-md">{user.referralBalance || 0} <span className="text-sm">{settings.currencySymbol}</span></div>
             </div>
           </div>
           {user.referralBalance >= settings.minReferralWithdraw && (
             <button onClick={triggerReferralWithdraw} className="w-full mt-6 py-4 bg-white text-orange-700 font-black tracking-widest rounded-xl shadow-lg active:scale-95 transition-transform text-sm uppercase cursor-pointer select-none">Withdraw Referral Funds</button>
           )}
           {user.referralBalance < settings.minReferralWithdraw && (
             <p className="text-[10px] text-orange-200 text-center mt-4 font-black uppercase tracking-widest">Min withdraw: {settings.minReferralWithdraw} {settings.currencySymbol}</p>
           )}
         </div>
         <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}
