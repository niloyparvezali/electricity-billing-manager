import React, { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { loadAllData, saveCollection, saveSetting, seedDemoData } from "./data";
import { createRoot } from "react-dom/client";
import "./styles.css";

const seed = {
  properties: [
    { id: "p1", name: "Green View", type: "Flat", address: "Main Road", units: 5 },
    { id: "p2", name: "Nexa Market", type: "Market", address: "Station Road", units: 8 },
    { id: "p3", name: "Family House", type: "Half Building", address: "College Road", units: 4 }
  ],
  units: [
    { id:"u1", propertyId:"p1", number:"101", label:"Room 101", type:"Room", billingType:"Residential", tenant:"Rahim Uddin", meterId:"m1" },
    { id:"u2", propertyId:"p1", number:"102", label:"Room 102", type:"Room", billingType:"Residential", tenant:"Karim Hasan", meterId:"m2" },
    { id:"u3", propertyId:"p1", number:"103", label:"Room 103", type:"Room", billingType:"Residential", tenant:"Nila Akter", meterId:"m3" },
    { id:"u4", propertyId:"p1", number:"104", label:"Room 104", type:"Room", billingType:"Residential", tenant:"Empty", meterId:"m4" },
    { id:"u5", propertyId:"p1", number:"105", label:"Room 105", type:"Room", billingType:"Residential", tenant:"Sabbir Ahmed", meterId:"m5" },
    { id:"u6", propertyId:"p2", number:"S-01", label:"Shop 01", type:"Shop", billingType:"Commercial", tenant:"Nafis Store", meterId:"m6" },
    { id:"u7", propertyId:"p2", number:"S-02", label:"Shop 02", type:"Shop", billingType:"Commercial", tenant:"Mina Fashion", meterId:"m7" },
    { id:"u8", propertyId:"p2", number:"S-03", label:"Shop 03", type:"Shop", billingType:"Commercial", tenant:"Empty", meterId:"m8" }
  ],
  meters: [
    { id:"m1", unitId:"u1", serial:"M-1001", reading:248, installed:"2026-01-01", active:true },
    { id:"m2", unitId:"u2", serial:"M-1002", reading:317, installed:"2026-01-01", active:true },
    { id:"m3", unitId:"u3", serial:"M-1003", reading:192, installed:"2026-01-01", active:true },
    { id:"m4", unitId:"u4", serial:"M-1004", reading:0, installed:"2026-01-01", active:true },
    { id:"m5", unitId:"u5", serial:"M-1005", reading:285, installed:"2026-01-01", active:true },
    { id:"m6", unitId:"u6", serial:"CM-2001", reading:680, installed:"2026-01-01", active:true },
    { id:"m7", unitId:"u7", serial:"CM-2002", reading:510, installed:"2026-01-01", active:true },
    { id:"m8", unitId:"u8", serial:"CM-2003", reading:0, installed:"2026-01-01", active:true }
  ],
  readings: [
    { id:"r1", unitId:"u1", meterId:"m1", month:"2026-07", opening:180, closing:248, units:68, rate:10, billingType:"Residential" },
    { id:"r2", unitId:"u2", meterId:"m2", month:"2026-07", opening:245, closing:317, units:72, rate:10, billingType:"Residential" },
    { id:"r3", unitId:"u3", meterId:"m3", month:"2026-07", opening:120, closing:192, units:72, rate:10, billingType:"Residential" },
    { id:"r4", unitId:"u5", meterId:"m5", month:"2026-07", opening:220, closing:285, units:65, rate:10, billingType:"Residential" },
    { id:"r5", unitId:"u6", meterId:"m6", month:"2026-07", opening:590, closing:680, units:90, rate:15, billingType:"Commercial" },
    { id:"r6", unitId:"u7", meterId:"m7", month:"2026-07", opening:420, closing:510, units:90, rate:15, billingType:"Commercial" }
  ],
  tenants: [
    { id:"t1", name:"Rahim Uddin", phone:"01700000001", unitId:"u1", joined:"2026-01-01", left:null },
    { id:"t2", name:"Karim Hasan", phone:"01700000002", unitId:"u2", joined:"2026-02-01", left:null },
    { id:"t3", name:"Nila Akter", phone:"01700000003", unitId:"u3", joined:"2026-03-01", left:null },
    { id:"t4", name:"Sabbir Ahmed", phone:"01700000004", unitId:"u5", joined:"2026-01-15", left:null },
    { id:"t5", name:"Nafis Store", phone:"01800000001", unitId:"u6", joined:"2026-01-01", left:null },
    { id:"t6", name:"Mina Fashion", phone:"01800000002", unitId:"u7", joined:"2026-04-01", left:null }
  ],
  rates: { Residential: 10, Commercial: 15 }
};

const fmt = n => new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(n);
const money = n => `৳${fmt(n)}`;

function AuthScreen(){
  const {login,register}=useAuth();
  const [mode,setMode]=useState("login"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e){e.preventDefault();setBusy(true);setError("");try{if(mode==="login")await login(email,password);else await register(name,email,password);}catch(err){setError((err?.message||"Authentication failed.").replace("Firebase: ",""));}finally{setBusy(false)}}
  return <div className="auth-screen"><div className="auth-visual"><div className="auth-orbit"/><div className="auth-meter">⚡</div><p className="eyebrow">ELECTRICITY MANAGEMENT</p><h1>Your meters.<br/><em>Your data.</em></h1><p>Every account gets a separate private workspace for electricity records, meters, tenants and bills.</p></div><form className="auth-card" onSubmit={submit}><div className="brand auth-brand"><div className="brand-mark">⚡</div><div><b>CurrentFlow</b><small>Utility Manager</small></div></div><h2>{mode==="login"?"Welcome back":"Create your account"}</h2><p className="auth-sub">{mode==="login"?"Sign in to your private electricity workspace.":"Start your own electricity workspace."}</p>{mode==="register"&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required minLength="6" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{error&&<div className="auth-error-inline">{error}</div>}<button className="primary auth-submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}<span>→</span></button><button type="button" className="auth-switch" onClick={()=>{setMode(mode==="login"?"register":"login");setError("")}}>{mode==="login"?"Need an account? Create one":"Already have an account? Sign in"}</button></form></div>
}

function useFirebaseStore(){
  const {user}=useAuth(); const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let alive=true; (async()=>{if(!user){setData(null);setLoading(false);return;} setLoading(true);try{await seedDemoData(user.uid,seed);const d=await loadAllData(user.uid);if(alive)setData(d);}catch(e){console.error(e);if(alive)setError(e.message||"Unable to load your account data.");}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[user]);
  async function persist(next){setData(next); try{await Promise.all([saveCollection(user.uid,"properties",next.properties),saveCollection(user.uid,"units",next.units),saveCollection(user.uid,"meters",next.meters),saveCollection(user.uid,"readings",next.readings),saveCollection(user.uid,"tenants",next.tenants),saveSetting(user.uid,next.rates)]);}catch(e){console.error(e);setError(e.message||"Unable to save your data.");}}
  return {data,loading,error,persist};
}

function LoadingScreen() {
  return <div className="loading"><div className="loading-card">
    <div className="brand-mark"><span>⚡</span></div>
    <h1>CurrentFlow</h1><p>Electricity billing, simplified.</p>
    <div className="loader"><i/><i/><i/></div>
  </div></div>
}

function Badge({ children, tone="blue" }) { return <span className={`badge ${tone}`}>{children}</span> }

function Layout({ page, setPage, children, data }) { const {user,logout}=useAuth();
  const nav = [
    ["dashboard","Overview","⌂"], ["properties","Properties","▦"], ["units","Rooms & Shops","□"],
    ["tenants","Tenants","♙"], ["meters","Meters","⚡"], ["readings","Meter Readings","⌁"],
    ["bills","Monthly Bills","▤"], ["history","History","◷"], ["settings","Settings","⚙"]
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small">⚡</div><div><b>CurrentFlow</b><small>Utility Manager</small></div></div>
      <div className="property-mini"><span className="dot"/> All Properties <span className="chev">⌄</span></div>
      <nav>{nav.map(([id,label,icon]) => <button key={id} className={page===id?"active":""} onClick={()=>setPage(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="rate-box"><small>Current Rates</small><div><span>Residential</span><b>{money(data.rates.Residential)}/u</b></div><div><span>Commercial</span><b>{money(data.rates.Commercial)}/u</b></div></div><div className="user-mini"><div className="avatar">{(user?.displayName||user?.email||"A")[0].toUpperCase()}</div><div><b>{user?.displayName||"Account"}</b><small>{user?.email||"Signed in"}</small></div><button className="logout-mini" onClick={logout}>↪</button></div></div>
    </aside>
    <main className="main"><header><div><p className="eyebrow">ELECTRICITY MANAGEMENT</p><h2>{nav.find(x=>x[0]===page)?.[1] || "Overview"}</h2></div><div className="header-actions"><button className="icon-btn">⌕</button><button className="icon-btn">◔</button><div className="avatar">A</div></div></header>{children}</main>
  </div>
}

function Dashboard({data,setPage}) {
  const occupied=data.units.filter(u=>u.tenant!=="Empty").length;
  const totalUnits=data.readings.reduce((s,r)=>s+r.units,0);
  const totalBill=data.readings.reduce((s,r)=>s+r.units*r.rate,0);
  return <section>
    <div className="hero"><div><Badge tone="green">AUGUST 2026</Badge><h1>Keep every meter<br/><em>under control.</em></h1><p>Track readings, preserve history, and calculate electricity bills without losing a single record.</p><button className="primary" onClick={()=>setPage("readings")}>Enter Meter Reading <span>→</span></button></div><div className="hero-meter"><div className="meter-ring"><span>⚡</span></div><small>ACTIVE METERS</small><strong>{data.meters.filter(m=>m.active).length}</strong></div></div>
    <div className="stats"><div><span>Properties</span><strong>{data.properties.length}</strong><small>Across your portfolio</small></div><div><span>Occupied Units</span><strong>{occupied}<i>/{data.units.length}</i></strong><small>Rooms & shops occupied</small></div><div><span>Usage</span><strong>{fmt(totalUnits)} <i>units</i></strong><small>Recorded readings</small></div><div><span>Calculated Bills</span><strong>{money(totalBill)}</strong><small>From recorded readings</small></div></div>
    <div className="grid-2"><div className="panel"><div className="panel-head"><div><p className="eyebrow">PROPERTY SNAPSHOT</p><h3>Portfolio overview</h3></div><button className="text-btn" onClick={()=>setPage("properties")}>View all →</button></div>{data.properties.map(p=><div className="property-row" key={p.id}><div className="property-icon">▦</div><div><b>{p.name}</b><small>{p.type} · {p.address}</small></div><span>{data.units.filter(u=>u.propertyId===p.id&&u.tenant!=="Empty").length}/{data.units.filter(u=>u.propertyId===p.id).length} occupied</span></div>)}</div>
    <div className="panel"><div className="panel-head"><div><p className="eyebrow">RECENT READINGS</p><h3>Meter activity</h3></div><button className="text-btn" onClick={()=>setPage("history")}>History →</button></div>{data.readings.slice(-5).reverse().map(r=>{const u=data.units.find(x=>x.id===r.unitId); return <div className="reading-row" key={r.id}><div className="meter-dot">⚡</div><div><b>{u?.label}</b><small>{r.month} · {r.opening} → {r.closing}</small></div><strong>{r.units} <i>units</i></strong></div>})}</div></div>
  </section>
}

function Properties({data}) { return <section><div className="section-top"><div><p className="eyebrow">PROPERTY STRUCTURE</p><h1>Your properties</h1><p>Organize flats, buildings, half buildings and markets.</p></div><button className="primary">+ Add Property</button></div><div className="cards">{data.properties.map(p=><div className="property-card" key={p.id}><div className="card-icon">▦</div><Badge>{p.type}</Badge><h3>{p.name}</h3><p>{p.address}</p><div className="card-footer"><span>{data.units.filter(u=>u.propertyId===p.id).length} units</span><span>{data.units.filter(u=>u.propertyId===p.id&&u.tenant!=="Empty").length} occupied</span></div></div>)}</div></section> }

function Units({data}) { return <section><div className="section-top"><div><p className="eyebrow">UNITS</p><h1>Rooms & shops</h1><p>Every room or shop has its own billing identity and meter.</p></div><button className="primary">+ Add Unit</button></div><div className="table-panel"><table><thead><tr><th>UNIT</th><th>PROPERTY</th><th>TYPE</th><th>BILLING</th><th>TENANT</th><th>METER</th><th></th></tr></thead><tbody>{data.units.map(u=>{const p=data.properties.find(p=>p.id===u.propertyId),m=data.meters.find(m=>m.id===u.meterId);return <tr key={u.id}><td><b>{u.label}</b><small>{u.number}</small></td><td>{p?.name}</td><td>{u.type}</td><td><Badge tone={u.billingType==="Commercial"?"orange":"blue"}>{u.billingType}</Badge></td><td>{u.tenant}</td><td>{m?.serial}<small>{m?.reading ?? 0} units</small></td><td>•••</td></tr>})}</tbody></table></div></section> }

function Readings({data,setData}) {
  const [month,setMonth]=useState("2026-08");
  const [values,setValues]=useState({});
  const save=(u,m)=>{
    const v=Number(values[u.id]);
    if(!Number.isFinite(v)) return;
    const rate=data.rates[u.billingType];
    const previous=data.readings.filter(r=>r.unitId===u.id).sort((a,b)=>a.month.localeCompare(b.month)).at(-1);
    const opening=previous?.closing ?? m.reading ?? 0;
    const reading={id:"r"+Date.now()+u.id,unitId:u.id,meterId:m.id,month,opening,closing:v,units:Math.max(0,v-opening),rate,billingType:u.billingType};
    setData({...data,readings:[...data.readings.filter(r=>!(r.unitId===u.id&&r.month===month)),reading],meters:data.meters.map(x=>x.id===m.id?{...x,reading:v}:x)});
    setValues(x=>({...x,[u.id]:""}));
  };
  return <section><div className="section-top"><div><p className="eyebrow">MONTHLY INPUT</p><h1>Meter readings</h1><p>Enter the closing reading. Opening readings are carried forward automatically.</p></div><input className="month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="reading-grid">{data.units.map(u=>{const m=data.meters.find(m=>m.id===u.meterId);const prev=data.readings.filter(r=>r.unitId===u.id).sort((a,b)=>a.month.localeCompare(b.month)).at(-1);const opening=prev?.closing ?? m?.reading ?? 0;return <div className="reading-card" key={u.id}><div className="reading-card-top"><div><Badge tone={u.billingType==="Commercial"?"orange":"blue"}>{u.billingType}</Badge><h3>{u.label}</h3><small>{u.tenant} · {m?.serial}</small></div><div className="rate">{money(data.rates[u.billingType])}<small>/ unit</small></div></div><div className="reading-inputs"><div><label>Opening</label><strong>{opening}</strong></div><div className="arrow">→</div><div><label>Closing</label><input value={values[u.id]??""} placeholder={m?.reading} onChange={e=>setValues(v=>({...v,[u.id]:e.target.value}))}/></div></div><button className="save-btn" onClick={()=>save(u,m)}>Save reading</button></div>})}</div></section>
}

function Bills({data}) { const rows=data.readings.slice().sort((a,b)=>b.month.localeCompare(a.month)); return <section><div className="section-top"><div><p className="eyebrow">CALCULATED RECORDS</p><h1>Monthly electricity bills</h1><p>Bills are calculated from the recorded meter readings and the rate active at that time.</p></div></div><div className="table-panel"><table><thead><tr><th>MONTH</th><th>UNIT</th><th>BILLING</th><th>READING</th><th>USAGE</th><th>RATE</th><th>TOTAL</th></tr></thead><tbody>{rows.map(r=>{const u=data.units.find(x=>x.id===r.unitId);return <tr key={r.id}><td><b>{r.month}</b></td><td>{u?.label}<small>{u?.tenant}</small></td><td><Badge tone={r.billingType==="Commercial"?"orange":"blue"}>{r.billingType}</Badge></td><td>{r.opening} → {r.closing}</td><td><b>{r.units}</b> units</td><td>{money(r.rate)}</td><td><strong>{money(r.units*r.rate)}</strong></td></tr>})}</tbody></table></div></section> }

function History({data}) { return <section><div className="section-top"><div><p className="eyebrow">AUDITABLE HISTORY</p><h1>Meter history</h1><p>Every reading and meter replacement remains preserved.</p></div></div><div className="timeline">{data.meters.map(m=><div className="timeline-card" key={m.id}><div className="timeline-icon">⚡</div><div><Badge tone={m.active?"green":"gray"}>{m.active?"ACTIVE":"REPLACED"}</Badge><h3>{m.serial}</h3><p>Installed {m.installed} · Current reading <b>{m.reading}</b></p><div className="history-lines">{data.readings.filter(r=>r.meterId===m.id).map(r=><div key={r.id}><span>{r.month}</span><span>{r.opening} → {r.closing}</span><b>{r.units} units · {money(r.units*r.rate)}</b></div>)}</div></div></div>)}</div></section> }

function Tenants({data}) { return <section><div className="section-top"><div><p className="eyebrow">OCCUPANCY HISTORY</p><h1>Tenants</h1><p>Tenant changes never overwrite previous electricity records.</p></div><button className="primary">+ Add Tenant</button></div><div className="table-panel"><table><thead><tr><th>TENANT</th><th>UNIT</th><th>JOINED</th><th>LEFT</th><th>STATUS</th></tr></thead><tbody>{data.tenants.map(t=>{const u=data.units.find(u=>u.id===t.unitId);return <tr key={t.id}><td><div className="person"><div className="avatar">{t.name[0]}</div><b>{t.name}</b></div><small>{t.phone}</small></td><td>{u?.label}</td><td>{t.joined}</td><td>{t.left||"—"}</td><td><Badge tone={t.left?"gray":"green"}>{t.left?"LEFT":"ACTIVE"}</Badge></td></tr>})}</tbody></table></div></section> }

function Meters({data,setData}) { const [open,setOpen]=useState(null); const [serial,setSerial]=useState(""); const reset=()=>{if(!open)return; const old=data.meters.find(m=>m.id===open);const newMeter={id:"m"+Date.now(),unitId:old.unitId,serial:serial||`M-${Date.now().toString().slice(-5)}`,reading:0,installed:new Date().toISOString().slice(0,10),active:true};setData({...data,meters:data.meters.map(m=>m.id===old.id?{...m,active:false}:m).concat(newMeter),units:data.units.map(u=>u.id===old.unitId?{...u,meterId:newMeter.id}:u)});setOpen(null);setSerial("");};return <section><div className="section-top"><div><p className="eyebrow">METER CONTROL</p><h1>Electricity meters</h1><p>Replace a damaged meter without deleting its history.</p></div></div><div className="cards">{data.meters.filter(m=>m.active).map(m=>{const u=data.units.find(u=>u.id===m.unitId);return <div className="meter-card" key={m.id}><div className="meter-card-top"><div className="meter-symbol">⚡</div><Badge tone="green">ACTIVE</Badge></div><h3>{m.serial}</h3><p>{u?.label} · {u?.tenant}</p><div className="big-reading">{m.reading}<small>units</small></div><div className="card-footer"><span>Installed {m.installed}</span><button className="danger-btn" onClick={()=>setOpen(m.id)}>Reset / Replace</button></div></div>})}</div>{open&&<div className="modal-backdrop"><div className="modal"><p className="eyebrow">METER REPLACEMENT</p><h2>Reset this meter?</h2><p>The old meter will be closed and preserved. A new meter will start from <b>0</b>.</p><label>New meter serial<input autoFocus value={serial} onChange={e=>setSerial(e.target.value)} placeholder="e.g. M-2008"/></label><div className="modal-actions"><button className="secondary" onClick={()=>setOpen(null)}>Cancel</button><button className="primary" onClick={reset}>Create new meter</button></div></div></div>}</section> }

function Settings({data,setData}) { const [r,setR]=useState(data.rates); const save=()=>setData({...data,rates:{Residential:Number(r.Residential),Commercial:Number(r.Commercial)}});return <section><div className="section-top"><div><p className="eyebrow">SYSTEM SETTINGS</p><h1>Electricity rates</h1><p>Rates are stored by billing type. Existing bills keep their historical rate.</p></div></div><div className="settings-card"><div className="rate-setting"><div><Badge tone="blue">RESIDENTIAL</Badge><h3>Residential unit rate</h3><p>Used for rooms and residential units.</p></div><div className="rate-edit"><span>৳</span><input type="number" value={r.Residential} onChange={e=>setR({...r,Residential:e.target.value})}/><small>/ unit</small></div></div><div className="rate-setting"><div><Badge tone="orange">COMMERCIAL</Badge><h3>Commercial unit rate</h3><p>Used for shops and commercial units.</p></div><div className="rate-edit"><span>৳</span><input type="number" value={r.Commercial} onChange={e=>setR({...r,Commercial:e.target.value})}/><small>/ unit</small></div></div><button className="primary" onClick={save}>Save rates</button></div></section> }

function App(){
  const {user,initializing}=useAuth(); const {data,loading,error,persist}=useFirebaseStore(); const [page,setPage]=useState("dashboard");
  if(initializing || (user&&loading)) return <LoadingScreen/>;
  if(!user) return <AuthScreen/>;
  if(error) return <div className="auth-error"><h2>Data connection error</h2><p>{error}</p><button className="primary" onClick={()=>location.reload()}>Retry</button></div>;
  let content=page==="dashboard"?<Dashboard data={data} setPage={setPage}/>:page==="properties"?<Properties data={data}/>:page==="units"?<Units data={data}/>:page==="tenants"?<Tenants data={data}/>:page==="meters"?<Meters data={data} setData={persist}/>:page==="readings"?<Readings data={data} setData={persist}/>:page==="bills"?<Bills data={data}/>:page==="history"?<History data={data}/>:<Settings data={data} setData={persist}/>;
  return <Layout page={page} setPage={setPage} data={data}>{content}</Layout>;
}
createRoot(document.getElementById("root")).render(<AuthProvider><App/></AuthProvider>);
