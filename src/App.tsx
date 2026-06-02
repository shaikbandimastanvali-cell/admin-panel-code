g'&&t.status==='pending').length;
  
  return <div className="bg-white rounded-2xl border flex flex-col h-[80vh]"><div className="p-4 bg-slate-50 border-b flex gap-3"><input type="text" placeholder="Search..." value={q} onChange={e=>sq(e.target.value)} className="p-2 border rounded-lg font-bold text-sm flex-1 outline-none"/><select value={srt} onChange={e=>setSrt(e.target.value)} className="p-2 border rounded-lg font-bold text-sm uppercase text-slate-600 outline-none cursor-pointer"><option value="joinedDate">Date Joined</option><option value="totalKills">Kills</option><option value="totalWinnings">Earned</option><option value="totalRefers">Refers</option><option value="balance">Balance</option></select></div><div className="flex-1 overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10"><tr><th className="p-4">User</th><th className="p-4">Game Info</th><th className="p-4">Stats</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y">{f.map(u=><tr key={u.uid} onClick={()=>setSu(u)} className="hover:bg-blue-50 cursor-pointer transition-colors"><td className="p-4"><div className="font-black text-base">{u.name}</div><div className="text-[10px] font-bold text-slate-400">{u.email}</div></td><td className="p-4"><div className="font-bold text-blue-600">{u.gameName||'N/A'}</div><div className="text-[10px] font-mono">{u.gameUid || u.uid}</div></td><td className="p-4 font-black text-xs space-x-2"><span className="text-emerald-600">{u.balance}B</span><span className="text-blue-600">{u.totalKills||0}K</span><span className="text-purple-600">{u.totalWinnings||0}W</span></td><td className="p-4">{u.isBanned?<span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[9px] font-black uppercase">Banned</span>:<span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-black uppercase">Active</span>}</td></tr>)}</tbody></table></div></div>;
}

function DeviceBanMgr({ d, md }) {
  return (
    <div className="bg-white p-6 rounded-2xl border">
      <h2 className="text-xl font-black uppercase mb-6">
         Banned Devices
      </h2>
      <div className="space-y-3">
        {d.bannedDevices.length === 0 && <div className="text-slate-500 font-bold p-6 bg-slate-50 text-center rounded-xl">No banned devices found.</div>}
        {d.bannedDevices.map(b => (
          <div key={b.id} className="p-4 border rounded-xl flex justify-between items-center">
            <div>
              <div className="font-black">
                 {b.deviceId}
              </div>
              <div className="text-xs text-slate-400">
                 {fDate(b.bannedAt)}
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bannedDevices', b.id));
                  md({t:'alert',title:'Success',msg:'Device unbanned successfully'});
                } catch (err) {
                  md({t:'err',title:'Error',msg:err.message});
                }
              }}
              className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-black text-xs cursor-pointer"
            >
              UNBAN
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageMgr({ d, md }) {
  const sorted = [...(d.messages || [])].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border">
        <h2 className="text-xl font-black uppercase">Messages & Notifications</h2>
        <button onClick={() => md({t:'message', title:'New Message', onC: async (title, body) => {
          if(!title || !body) return;
          try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), { title, body, createdAt: new Date().toISOString(), readBy: [] });
            await fetch('https://esports-tournament-app-beta.vercel.app/api/sendNotification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, body })
            }).catch(e => console.error("API Ping Failed:", e));
            md({t:'alert', title:'Success', msg:'Message pushed successfully'});
          } catch(e) { md({t:'err', title:'Error', msg:e.message}); }
        }})} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer"><Plus className="w-4 h-4 inline"/> Create</button>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="divide-y">
          {sorted.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No messages found.</div>}
          {sorted.map(m => (
            <div key={m.id} className="p-5 hover:bg-slate-50 transition-colors flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="font-black text-lg text-slate-800 uppercase">{m.title}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-2">{fDate(m.createdAt)}</div>
                <div className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{m.body}</div>
                <div className="text-[10px] text-blue-500 font-bold uppercase mt-3 tracking-widest">Read by: {(m.readBy || []).length} users</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => md({t:'message', title:'Edit Message', d1: m.title, d2: m.body, onC: async (title, body) => {
                  if(!title || !body) return;
                  try {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', m.id), { title, body });
                    md({t:'alert', title:'Success', msg:'Message updated successfully'});
                  } catch(e) { md({t:'err', title:'Error', msg:e.message}); }
                }})} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer"><Edit className="w-4 h-4"/></button>
                <button onClick={() => md({t:'confirm', title:'Delete Message', msg:'Permanently delete this message for all users?', onC: async () => {
                  try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', m.id));
                    md({t:'alert', title:'Success', msg:'Message deleted'});
                  } catch(e) { md({t:'err', title:'Error', msg:e.message}); }
                }})} className="p-2 bg-rose-50 text-rose-600 rounded hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GamesMgr({ d, md, u }) {
  return <div className="space-y-6"><div className="flex justify-between items-center bg-white p-6 rounded-2xl border"><h2 className="font-black text-xl uppercase">Games & Modes</h2><div className="flex gap-2"><button onClick={()=>md({t:'mode',title:'Add Mode',gl:d.games,onC:(g,n,b)=>{if(g&&n)addDoc(collection(db,'artifacts',appId,'public','data','modes'),{gameId:g,name:n,bannerUrl:b,createdBy:u.name})}})} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-black text-xs uppercase cursor-pointer">Add Mode</button><button onClick={()=>md({t:'game',title:'Add Game',onC:(n,b)=>{if(n)addDoc(collection(db,'artifacts',appId,'public','data','games'),{name:n,bannerUrl:b,createdBy:u.name})}})} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-black text-xs uppercase cursor-pointer">Add Game</button></div></div><div className="grid md:grid-cols-2 gap-6">{d.games.map(g=><div key={g.id} className="bg-white rounded-2xl border overflow-hidden"><div className="h-32 bg-slate-900 relative">{g.bannerUrl?<img src={g.bannerUrl} className="w-full h-full object-cover opacity-60"/>:<Gamepad2 className="m-auto mt-8 text-white/20 w-12 h-12"/>}<div className="absolute bottom-2 left-4 text-white font-black text-2xl uppercase">{g.name}</div><div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[8px] font-bold text-white uppercase">By: {g.createdBy||'Admin'}</div><button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data','games',g.id))} className="absolute top-2 right-2 p-1.5 bg-rose-500 rounded text-white cursor-pointer"><Trash2 className="w-4 h-4"/></button></div><div className="p-4 bg-slate-50 space-y-2">{d.modes.filter(m=>m.gameId===g.id).map(m=><div key={m.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center"><div className="font-bold text-sm uppercase">{m.name} <span className="text-[9px] text-slate-400 block normal-case">By: {m.createdBy||'Admin'}</span></div><button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data','modes',m.id))} className="text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>)}</div></div>;
}

function TourneyMgr({ d, md, u, s }) {
  const [fo, setFo] = useState(false); const [fd, setFd] = useState({gameId:'',modeId:'',title:'',bannerUrl:'',customText:'',dateTime:'',type:'solo',perKill:0,entryFee:0,totalSlots:48,status:'upcoming'}); const [tb, setTb] = useState('active');
  const [isPublishing, setIsPublishing] = useState(false);
  const sv = async (e) => { 
    e.preventDefault(); 
    if(!fd.modeId)return; 
    try {
      await addDoc(collection(db,'artifacts',appId,'public','data','tournaments'),{...fd,joinedUsers:[],results:[],createdBy:u.name}); 
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
        t:'confirm',title:'Cancel Match?',msg:'This moves to History and refunds players.
