import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext";
import { DEFAULT_PROPERTY_TYPES, emptyData, loadAll, recomputeCalculations, resetWorkspace, restoreWorkspace, save, saveRates, validateBackupPayload } from "./store";
import { fmt, localInputValue, money, prettyDate, prettyDateTime } from "./utils";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("CurrentFlow UI error", error, info); }
  render() {
    if (this.state.error) {
      return <div className="fatal-error">
        <div className="fatal-error-card">
          <div className="fatal-error-icon">!</div>
          <p className="eyebrow">CURRENTFLOW ERROR</p>
          <h1>Something needs attention</h1>
          <p>The workspace could not render this screen. Your Firebase data is not deleted by this error.</p>
          <button className="primary" onClick={() => window.location.reload()}>Reload CurrentFlow</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

function Loading({ text = "Loading your workspace…" }) {
  return <div className="loading"><div className="loading-card">
    <div className="brand-mark large">⚡</div><h1>CurrentFlow</h1><p>{text}</p>
    <div className="loader"><i /><i /><i /></div>
  </div></div>;
}

function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"), [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { if (mode === "login") await login(email, password); else await register(name, email, password); }
    catch (err) { setError(err?.message?.replace("Firebase: ", "") || "Authentication failed."); }
    finally { setBusy(false); }
  }
  return <div className="auth-screen"><div className="auth-visual"><div className="auth-orbit" /><div className="auth-meter">⚡</div><p className="eyebrow dark-eye">ELECTRICITY MANAGEMENT</p><h1>Room-by-room<br /><em>current records.</em></h1><p>Private account-based records for properties, meters, readings and electricity calculations.</p></div>
    <form className="auth-card" onSubmit={submit}><div className="brand auth-brand"><div className="brand-mark">⚡</div><div><b>CurrentFlow</b><small>Utility Manager</small></div></div>
      <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2><p className="auth-sub">{mode === "login" ? "Sign in to your private electricity workspace." : "Start with an empty workspace. Your records begin when you add them."}</p>
      {mode === "register" && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" /></label>}
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
      <label>Password<input type="password" minLength="6" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" /></label>
      {error && <div className="auth-error-inline">{error}</div>}
      <button className="primary wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button>
      <button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
    </form>
  </div>;
}

function Modal({ title, children, actions, onClose, wide = false }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.body.style.paddingRight = previousPadding;
    };
  }, []);

  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
    <div className={`modal ${wide ? "wide-modal" : ""}`}>
      <div className="modal-head">
        <div><p className="eyebrow">CURRENTFLOW</p><h2>{title}</h2></div>
        <button type="button" className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="modal-scroll-content">{children}</div>
      <div className="modal-actions">{actions}</div>
    </div>
  </div>;
}
function Badge({ children, tone = "blue" }) { return <span className={`badge ${tone}`}>{children}</span> }
function EmptyState({ icon = "⚡", title, text, action, onClick }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action && <button className="primary" onClick={onClick}>+ {action}</button>}</div> }

function Layout({ page, setPage, children, data }) {
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("currentflow-theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("currentflow-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setProfileOpen(false);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const locked = searchOpen || profileOpen;
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [searchOpen, profileOpen]);

  const nav = [
    ["dashboard", "Overview", "⌂"],
    ["properties", "Properties", "▦"],
    ["tenants", "Tenants", "♙"],
    ["meters", "Meters", "⚡"],
    ["readings", "Meter Readings", "⌁"],
    ["calculations", "Calculations", "▤"],
    ["settings", "Settings", "⚙"]
  ];

  const searchItems = [
    ...data.properties.map(p => ({ type: "Property", label: p.name, sub: `${p.type} · property`, page: "properties", id: p.id })),
    ...data.units.map(u => ({ type: u.type, label: u.label, sub: `${data.properties.find(p => p.id === u.propertyId)?.name || "Property"} · ${u.billingType}`, page: "properties", id: u.propertyId })),
    ...data.tenants.filter(t => t.active && !t.deletedAt).map(t => ({ type: "Tenant", label: t.name, sub: `${data.units.find(u => u.id === t.unitId)?.label || "Unit"}`, page: "tenants", id: t.id })),
    ...data.meters.filter(m => m.active).map(m => ({ type: "Meter", label: m.serial, sub: `${data.units.find(u => u.id === m.unitId)?.label || "Unit"}`, page: "meters", id: m.id }))
  ];

  const [searchText, setSearchText] = useState("");
  const matches = searchText.trim()
    ? searchItems.filter(x => `${x.label} ${x.sub} ${x.type}`.toLowerCase().includes(searchText.toLowerCase())).slice(0, 8)
    : [];

  function go(item) {
    setSearchOpen(false);
    setSearchText("");
    setPage(item.page);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small">⚡</div><div><b>CurrentFlow</b><small>Utility Manager</small></div></div>
      <nav>{nav.map(([id, label, icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><span>{icon}</span><em>{label}</em></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="rate-box"><small>Current Rates</small><div><span>Residential</span><b>{money(data.rates.Residential)}/u</b></div><div><span>Commercial</span><b>{money(data.rates.Commercial)}/u</b></div></div>
        <div className="user-mini"><div className="avatar">{(user?.displayName || user?.email || "A")[0].toUpperCase()}</div><div className="user-text"><b>{user?.displayName || "Account"}</b><small>{user?.email}</small></div><button className="logout-mini" title="Sign out" onClick={logout}>↪</button></div>
      </div>
    </aside>

    <main className="main">
      <header>
        <div><p className="eyebrow">ELECTRICITY MANAGEMENT</p><h2>{nav.find(x => x[0] === page)?.[1] || "Overview"}</h2></div>
        <div className="header-actions">
          <button className="icon-btn" type="button" title="Search" aria-label="Search" onClick={() => { setSearchOpen(true); setProfileOpen(false) }}>⌕</button>
          <button className="icon-btn" type="button" title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme" onClick={() => { setDark(v => !v); setProfileOpen(false) }}>{dark ? "☀" : "◔"}</button>
          <div className="profile-wrap">
            <button className="avatar header-avatar" type="button" title="Account" onClick={() => setProfileOpen(v => !v)}>{(user?.displayName || user?.email || "A")[0].toUpperCase()}</button>
            {profileOpen && <div className="profile-menu">
              <div className="profile-menu-head"><div className="avatar">{(user?.displayName || user?.email || "A")[0].toUpperCase()}</div><div><b>{user?.displayName || "Account"}</b><small>{user?.email}</small></div></div>
              <button onClick={() => { setPage("settings"); setProfileOpen(false) }}>⚙ Settings</button>
              <button onClick={() => { logout(); setProfileOpen(false) }}>↪ Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      {children}
    </main>

    {searchOpen && <div className="search-overlay" onMouseDown={e => e.target === e.currentTarget && setSearchOpen(false)}>
      <div className="global-search-v2" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="global-search-v2-top">
          <div className="global-search-brand">
            <div className="global-search-icon">⌕</div>
            <div>
              <p className="eyebrow">GLOBAL SEARCH</p>
              <h3>Find anything</h3>
            </div>
          </div>
          <button className="global-search-close" type="button" onClick={() => setSearchOpen(false)}>Esc <span>×</span></button>
        </div>

        <div className="global-search-v2-input-wrap">
          <span className="global-search-v2-input-icon">⌕</span>
          <input
            autoFocus
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search properties, rooms, tenants, or meters..."
          />
          <span className="global-search-kbd">Ctrl K</span>
          {searchText && <button type="button" className="global-search-clear" onClick={() => setSearchText("")}>×</button>}
        </div>

        {!searchText ? <div className="global-search-home">
          <div className="search-quick-row">
            <button type="button" onClick={() => setPage("properties")}><span className="search-quick-icon blue">▦</span><span><b>Properties</b><small>Open your property workspace</small></span><strong>→</strong></button>
            <button type="button" onClick={() => setPage("tenants")}><span className="search-quick-icon green">♙</span><span><b>Tenants</b><small>Find active occupants</small></span><strong>→</strong></button>
            <button type="button" onClick={() => setPage("readings")}><span className="search-quick-icon yellow">⚡</span><span><b>Meter readings</b><small>Record a new meter check</small></span><strong>→</strong></button>
          </div>
          <div className="search-tip">
            <span>⌘</span><span>K</span><p>Search by tenant name, room number, shop number, property name, or meter serial.</p>
          </div>
        </div> : matches.length === 0 ? <div className="global-search-empty-v2">
          <div className="search-empty-orb">⌕</div>
          <h4>No matches found</h4>
          <p>Try a property, room number, tenant name, or meter serial.</p>
        </div> :
          <div className="global-results-v2">
            <div className="global-results-head">
              <span>{matches.length} result{matches.length === 1 ? "" : "s"}</span>
              <span>Press Enter to open</span>
            </div>
            {matches.map((item, i) => <button type="button" key={`${item.type}-${item.id}-${i}`} className="global-result-v2" onClick={() => go(item)}>
              <span className={`result-icon-v2 ${item.type.toLowerCase()}`}>{item.type === "Meter" ? "⚡" : item.type === "Tenant" ? "♙" : item.type === "Property" ? "▦" : "□"}</span>
              <span className="result-main-v2"><b>{item.label}</b><small>{item.type} · {item.sub}</small></span>
              <span className="result-open-v2">Open <b>→</b></span>
            </button>)}
          </div>}
      </div>
    </div>}
  </div>;
}

function Dashboard({ data, setPage }) {
  const occupied = data.units.filter(u => u.currentTenantId).length, total = data.units.length;
  const totalUnits = data.calculations.reduce((s, c) => s + (c.units || 0), 0), totalAmount = data.calculations.reduce((s, c) => s + (c.amount || 0), 0);
  return <section>
    <div className="hero"><div><Badge tone="green">{total ? "WORKSPACE ACTIVE" : "READY TO START"}</Badge><h1>Keep every meter<br /><em>under control.</em></h1><p>{total ? "Track readings across your real properties and calculate electricity from actual meter-reading periods." : "Start by adding a property, then create rooms or shops inside it."}</p><button className="primary" onClick={() => setPage(total ? "readings" : "properties")}>{total ? "Enter Meter Reading" : "Add your first property"}<span>→</span></button></div><div className="hero-meter"><div className="meter-ring"><span>⚡</span></div><small>ACTIVE METERS</small><strong>{data.meters.filter(m => m.active).length}</strong></div></div>
    <div className="stats"><div><span>Properties</span><strong>{data.properties.length}</strong><small>Your workspace</small></div><div><span>Occupied Units</span><strong>{occupied}<i>/{total}</i></strong><small>Rooms & shops</small></div><div><span>Calculated Usage</span><strong>{fmt(totalUnits)} <i>units</i></strong><small>Across all reading periods</small></div><div><span>Calculated Amount</span><strong>{money(totalAmount)}</strong><small>Real saved calculations</small></div></div>
    {data.properties.length === 0 ? <EmptyState icon="▦" title="No property added yet" text="Create your first property to start." action="Add Property" onClick={() => setPage("properties")} /> : <div className="grid-2">
      <div className="panel"><div className="panel-head"><div><p className="eyebrow">PROPERTY SNAPSHOT</p><h3>Portfolio overview</h3></div><button className="text-btn" onClick={() => setPage("properties")}>View all →</button></div>{data.properties.slice(0, 6).map(p => <div className="property-row" key={p.id} onClick={() => setPage("properties")}><div className="property-icon">▦</div><div><b>{p.name}</b><small>{p.type} · {p.address || "No address"}</small></div><span>{data.units.filter(u => u.propertyId === p.id && u.currentTenantId).length}/{data.units.filter(u => u.propertyId === p.id).length} occupied</span></div>)}</div>
      <div className="panel"><div className="panel-head"><div><p className="eyebrow">RECENT CALCULATIONS</p><h3>Latest records</h3></div><button className="text-btn" onClick={() => setPage("calculations")}>View all →</button></div>{data.calculations.slice().sort((a, b) => new Date(b.calculationAt) - new Date(a.calculationAt)).slice(0, 5).map(c => <div className="reading-row" key={c.basedOnReadingId}><div className="meter-dot">⚡</div><div><b>{c.unitLabel}</b><small>{prettyDate(c.fromReadingAt)} → {prettyDate(c.toReadingAt)} · {c.days} days · {c.tenantName || "Vacant at reading"}</small></div><strong>{money(c.amount)}</strong></div>)}{data.calculations.length === 0 && <p className="muted">No calculations yet.</p>}</div>
    </div>}
  </section>;
}

function Properties({ data, onSaved }) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(data.properties[0]?.id || "");
  const [propertyModal, setPropertyModal] = useState(null);
  const [unitModal, setUnitModal] = useState(null);
  useEffect(() => { if (!selectedId && data.properties[0]) setSelectedId(data.properties[0].id); if (selectedId && !data.properties.some(p => p.id === selectedId)) setSelectedId(data.properties[0]?.id || "") }, [data.properties, selectedId]);
  const property = data.properties.find(p => p.id === selectedId);
  const propertyTypes = data.propertyTypes || DEFAULT_PROPERTY_TYPES;

  async function saveProperty(e) {
    e.preventDefault();
    const id = propertyModal?.id || crypto.randomUUID();
    await save(user.uid, "properties", id, { name: propertyModal.name.trim(), type: propertyModal.type, address: propertyModal.address.trim(), updatedAt: new Date().toISOString(), createdAt: propertyModal.createdAt || new Date().toISOString() });
    setPropertyModal(null); await onSaved(); setSelectedId(id);
  }
  async function saveUnit(e) {
    e.preventDefault();
    if (unitModal.mode === "edit") {
      const old = data.units.find(u => u.id === unitModal.id);
      await save(user.uid, "units", unitModal.id, { number: unitModal.number.trim(), label: `${unitModal.unitType} ${unitModal.number.trim()}`, updatedAt: new Date().toISOString() });
      setUnitModal(null); await onSaved(); return;
    }
    const unitId = crypto.randomUUID(), meterId = crypto.randomUUID();
    const startAt = new Date(unitModal.initialAt).toISOString();
    await save(user.uid, "units", unitId, { propertyId: property.id, number: unitModal.number.trim(), label: `${unitModal.unitType} ${unitModal.number.trim()}`, type: unitModal.unitType, billingType: unitModal.billingType, meterId, currentTenantId: null, createdAt: new Date().toISOString() });
    await save(user.uid, "meters", meterId, { unitId, serial: unitModal.meterSerial.trim(), initialReading: Number(unitModal.initialReading || 0), initialAt: startAt, installedAt: startAt, active: true, createdAt: new Date().toISOString() });
    setUnitModal(null); await onSaved();
  }
  if (data.properties.length === 0) return <section><div className="section-top"><div><p className="eyebrow">PROPERTY STRUCTURE</p><h1>Your properties</h1><p>Create the property first. Rooms and shops live inside each property.</p></div><button className="primary" onClick={() => setPropertyModal({ name: "", type: propertyTypes[0] || "Flat", address: "", createdAt: new Date().toISOString() })}>+ Add Property</button></div><EmptyState icon="▦" title="No properties" text="Add a flat, building, half building, market, or your own property type." action="Add Property" onClick={() => setPropertyModal({ name: "", type: propertyTypes[0] || "Flat", address: "", createdAt: new Date().toISOString() })} />{propertyModal && <PropertyModal property={propertyModal} propertyTypes={propertyTypes} onChange={setPropertyModal} onClose={() => setPropertyModal(null)} onSubmit={saveProperty} />}</section>;

  return <section>
    <div className="section-top"><div><p className="eyebrow">PROPERTY STRUCTURE</p><h1>Your properties</h1><p>Select a property to manage its rooms, shops, tenants and meters.</p></div><button className="primary" onClick={() => setPropertyModal({ name: "", type: propertyTypes[0] || "Flat", address: "", createdAt: new Date().toISOString() })}>+ Add Property</button></div>
    <div className="property-tabs">{data.properties.map(p => <button key={p.id} className={selectedId === p.id ? "active" : ""} onClick={() => setSelectedId(p.id)}><span>{p.name}</span><small>{p.type}</small></button>)}</div>
    {property && <div className="property-detail">
      <div className="property-detail-head"><div><Badge>{property.type}</Badge><h2>{property.name}</h2><p>{property.address || "No address"}</p></div><div className="property-head-actions"><button className="secondary" onClick={() => setPropertyModal({ ...property })}>Edit property</button><button className="primary" onClick={() => setUnitModal({ mode: "add", unitType: property.type === "Market" ? "Shop" : "Room", number: "", billingType: property.type === "Market" ? "Commercial" : "Residential", meterSerial: "", initialReading: "0", initialAt: localInputValue() })}>+ Add {property.type === "Market" ? "Shop" : "Room"}</button></div></div>
      <div className="property-unit-grid">
        {data.units.filter(u => u.propertyId === property.id).length === 0 ? <EmptyState icon="□" title="No rooms or shops yet" text="Create the first room or shop inside this property." action={property.type === "Market" ? "Add Shop" : "Add Room"} onClick={() => setUnitModal({ mode: "add", unitType: property.type === "Market" ? "Shop" : "Room", number: "", billingType: property.type === "Market" ? "Commercial" : "Residential", meterSerial: "", initialReading: "0", initialAt: localInputValue() })} /> : data.units.filter(u => u.propertyId === property.id).map(u => {
          const meter = data.meters.find(m => m.id === u.meterId), tenant = data.tenants.find(t => t.id === u.currentTenantId);
          return <div className="unit-card" key={u.id}><div className="unit-card-top"><div className="unit-icon">{u.type === "Shop" ? "▤" : "□"}</div><Badge tone={u.billingType === "Commercial" ? "orange" : "blue"}>{u.billingType}</Badge></div><div className="unit-name-row"><div><h3>{u.label}</h3><p>{tenant?.name || "Vacant"}</p></div><button className="text-btn" onClick={() => setUnitModal({ mode: "edit", id: u.id, unitType: u.type, number: u.number })}>Edit name</button></div><div className="unit-meta"><div><small>METER</small><b>{meter?.serial || "—"}</b></div><div><small>READING START</small><b>{fmt(meter?.initialReading || 0)}</b></div><div><small>STATUS</small><b>{tenant ? "Occupied" : "Vacant"}</b></div></div></div>;
        })}
      </div>
    </div>}
    {propertyModal && <PropertyModal property={propertyModal} propertyTypes={propertyTypes} onChange={setPropertyModal} onClose={() => setPropertyModal(null)} onSubmit={saveProperty} />}
    {unitModal && <UnitModal data={data} mode={unitModal.mode} unit={unitModal} onChange={setUnitModal} onClose={() => setUnitModal(null)} onSubmit={saveUnit} />}
  </section>;
}

function PropertyModal({ property, propertyTypes, onChange, onClose, onSubmit }) {
  return <Modal title={property.id ? "Edit property" : "Add property"} onClose={onClose} actions={<><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit" form="property-form">Save property</button></>}><form id="property-form" onSubmit={onSubmit}><div className="form-grid"><label>Property name<input required value={property.name} onChange={e => onChange({ ...property, name: e.target.value })} placeholder="e.g. Main Road Building" /></label><label>Property type<select value={property.type} onChange={e => onChange({ ...property, type: e.target.value })}>{propertyTypes.map(t => <option key={t}>{t}</option>)}</select></label><label className="full">Address<input value={property.address || ""} onChange={e => onChange({ ...property, address: e.target.value })} placeholder="Street / area" /></label></div></form></Modal>;
}

function UnitModal({ data, mode, unit, onChange, onClose, onSubmit }) {
  return <Modal wide title={mode === "edit" ? "Edit room / shop name" : "Add room / shop"} onClose={onClose} actions={<><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" form="unit-form" className="primary">{mode === "edit" ? "Save name" : "Create unit"}</button></>}>
    <form id="unit-form" onSubmit={onSubmit}>
      <div className="form-grid">
        {mode === "edit" ? <><label>Unit type<input value={unit.unitType} readOnly /></label><label>Room / shop no.<input required value={unit.number} onChange={e => onChange({ ...unit, number: e.target.value })} /></label><div className="full edit-warning">Only the room/shop name is editable here. The meter, readings, calculations and history remain unchanged.</div></> : <><label>Unit type<select value={unit.unitType} onChange={e => onChange({ ...unit, unitType: e.target.value })}><option>Room</option><option>Shop</option></select></label><label>Room / shop no.<input required value={unit.number} onChange={e => onChange({ ...unit, number: e.target.value })} placeholder="e.g. 101 / S-01" /></label><label>Billing type<select value={unit.billingType} onChange={e => onChange({ ...unit, billingType: e.target.value })}><option>Residential</option><option>Commercial</option></select></label><label>Meter serial<input required value={unit.meterSerial} onChange={e => onChange({ ...unit, meterSerial: e.target.value })} placeholder="e.g. M-1001" /></label><label>Initial meter reading<input type="number" min="0" required value={unit.initialReading} onChange={e => onChange({ ...unit, initialReading: e.target.value })} /></label><label>Meter start date & time<input type="datetime-local" required value={unit.initialAt} onChange={e => onChange({ ...unit, initialAt: e.target.value })} /></label></>}
      </div>
    </form>
  </Modal>;
}

function Tenants({ data, onSaved }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [markLeftTarget, setMarkLeftTarget] = useState(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const [view, setView] = useState("active");
  const [historyTenantId, setHistoryTenantId] = useState(null);

  const activeTenants = data.tenants.filter(t => t.active && !t.deletedAt);
  const leftTenants = data.tenants.filter(t => !t.active && !t.deletedAt);
  const vacantUnits = data.units.filter(u => !u.currentTenantId);

  const filteredTenants = data.tenants
    .filter(t => view === "active" ? (t.active && !t.deletedAt) : (!t.active && !t.deletedAt))
    .filter(t => propertyFilter === "all" || data.units.find(u => u.id === t.unitId)?.propertyId === propertyFilter)
    .filter(t => {
      const u = data.units.find(x => x.id === t.unitId);
      const p = data.properties.find(x => x.id === u?.propertyId);
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return [t.name, t.phone || "", u?.label || "", u?.number || "", p?.name || ""]
        .join(" ").toLowerCase().includes(needle);
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const historyTenant = data.tenants.find(t => t.id === historyTenantId) || null;
  const historyUnit = historyTenant ? data.units.find(u => u.id === historyTenant.unitId) : null;
  const historyProperty = historyUnit ? data.properties.find(p => p.id === historyUnit.propertyId) : null;

  const tenantReadings = historyTenant
    ? data.readings
      .filter(r => r.tenantId === historyTenant.id || r.unitId === historyTenant.unitId && new Date(r.readingAt) >= new Date(historyTenant.joinedAt) && (!historyTenant.leftAt || new Date(r.readingAt) <= new Date(historyTenant.leftAt)))
      .slice()
      .sort((a, b) => new Date(a.readingAt) - new Date(b.readingAt))
    : [];

  const tenantCalculations = historyTenant
    ? data.calculations
      .filter(c => c.tenantId === historyTenant.id || c.unitId === historyTenant.unitId && new Date(c.toReadingAt) >= new Date(historyTenant.joinedAt) && (!historyTenant.leftAt || new Date(c.toReadingAt) <= new Date(historyTenant.leftAt)))
      .slice()
      .sort((a, b) => new Date(b.toReadingAt) - new Date(a.toReadingAt))
    : [];

  const totalUnits = tenantCalculations.reduce((sum, c) => sum + Number(c.units || 0), 0);
  const totalAmount = tenantCalculations.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  async function addTenant(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const unitId = fd.get("unitId");
    const unit = data.units.find(u => u.id === unitId);
    if (!name || !unit) return;
    if (unit.currentTenantId) {
      alert("This room/shop already has an active tenant. Mark the current tenant left first.");
      return;
    }
    const id = crypto.randomUUID();
    const joinedAt = new Date(fd.get("joinedAt") || Date.now()).toISOString();

    await save(user.uid, "tenants", id, {
      name, phone, unitId, joinedAt, leftAt: null, active: true, deletedAt: null, createdAt: new Date().toISOString()
    });
    await save(user.uid, "units", unitId, { currentTenantId: id });
    setOpen(false);
    await onSaved();
  }

  async function markLeft() {
    if (!markLeftTarget) return;
    const now = new Date().toISOString();
    await save(user.uid, "tenants", markLeftTarget.id, { active: false, leftAt: now, updatedAt: now });
    const unit = data.units.find(u => u.id === markLeftTarget.unitId);
    if (unit?.currentTenantId === markLeftTarget.id) {
      await save(user.uid, "units", unit.id, { currentTenantId: null });
    }
    setMarkLeftTarget(null);
    setView("left");
    await onSaved();
  }

  if (historyTenant) {
    const latestReading = tenantReadings[tenantReadings.length - 1];
    return <section className="tenant-history-page">
      <div className="tenant-history-topbar">
        <button className="secondary tenant-back-btn" onClick={() => setHistoryTenantId(null)}>← Back to tenants</button>
        <span className={historyTenant.active && !historyTenant.deletedAt ? "history-status active" : "history-status left"}>
          {historyTenant.active && !historyTenant.deletedAt ? "ACTIVE TENANT" : "FORMER TENANT"}
        </span>
      </div>

      <div className="tenant-history-hero">
        <div className="tenant-history-identity">
          <div className="tenant-history-avatar">{(historyTenant.name || "?")[0].toUpperCase()}</div>
          <div>
            <p className="eyebrow">TENANT ELECTRICITY HISTORY</p>
            <h1>{historyTenant.name}</h1>
            <p>{historyProperty?.name || "Property"} · {historyUnit?.label || "Unit"} · {historyUnit?.billingType || "—"}</p>
          </div>
        </div>
        <div className="tenant-history-dates">
          <div><small>JOINED</small><strong>{prettyDate(historyTenant.joinedAt)}</strong></div>
          <div><small>{historyTenant.leftAt ? "LEFT" : "STATUS"}</small><strong>{historyTenant.leftAt ? prettyDate(historyTenant.leftAt) : "Present"}</strong></div>
        </div>
      </div>

      <div className="tenant-history-stats">
        <div><small>READINGS</small><strong>{tenantReadings.length}</strong><span>meter checks</span></div>
        <div><small>CALCULATIONS</small><strong>{tenantCalculations.length}</strong><span>electricity records</span></div>
        <div><small>USAGE</small><strong>{fmt(totalUnits)}</strong><span>units</span></div>
        <div><small>CALCULATED AMOUNT</small><strong>{money(totalAmount)}</strong><span>recorded value</span></div>
      </div>

      <div className="tenant-history-grid">
        <div className="tenant-history-panel">
          <div className="tenant-history-panel-head"><div><p className="eyebrow">METER READINGS</p><h3>Reading timeline</h3></div><span>{tenantReadings.length} records</span></div>
          {tenantReadings.length === 0
            ? <div className="history-empty">No meter readings were recorded during this tenant period.</div>
            : <div className="tenant-history-timeline">
              {tenantReadings.slice().reverse().map((r, idx) => {
                const calc = data.calculations.find(c => c.basedOnReadingId === r.id);
                return <div className="tenant-history-event" key={r.id}>
                  <div className="tenant-history-event-dot">{idx === 0 ? "●" : "○"}</div>
                  <div className="tenant-history-event-main">
                    <div className="tenant-history-event-top"><strong>{fmt(r.reading)} units</strong><span>{prettyDateTime(r.readingAt)}</span></div>
                    <small>Tenant at reading: {r.tenantName || historyTenant.name}</small>
                    {calc && <small className="history-green">Linked calculation: {fmt(calc.units)} units · {money(calc.amount)}</small>}
                  </div>
                </div>;
              })}
            </div>}
        </div>

        <div className="tenant-history-panel">
          <div className="tenant-history-panel-head"><div><p className="eyebrow">CALCULATIONS</p><h3>Electricity history</h3></div><span>{tenantCalculations.length} records</span></div>
          {tenantCalculations.length === 0
            ? <div className="history-empty">No electricity calculations were recorded during this tenant period.</div>
            : <div className="tenant-calculation-list">
              {tenantCalculations.map(c => {
                const ending = data.readings.find(r => r.id === c.basedOnReadingId);
                return <div className="tenant-calculation-card" key={c.basedOnReadingId}>
                  <div className="tenant-calculation-top">
                    <div><Badge tone="green">CALCULATION</Badge><h4>{money(c.amount)}</h4><p>{fmt(c.units)} units used</p></div>
                    <span>{prettyDate(c.toReadingAt)}</span>
                  </div>
                  <div className="tenant-calculation-period"><span>{prettyDate(c.fromReadingAt)} · {fmt(c.fromReading)}</span><b>→</b><span>{prettyDate(c.toReadingAt)} · {fmt(c.toReading)}</span></div>
                  <div className="tenant-calculation-meta"><span>{c.days} days</span><span>{money(c.rate)}/unit</span><span>Ending reading {fmt(ending?.reading || c.toReading)}</span><span>Calculated {prettyDateTime(c.calculationAt)}</span></div>
                </div>;
              })}
            </div>}
        </div>
      </div>

      {latestReading && <div className="tenant-history-footer-note">Latest recorded meter reading: <strong>{fmt(latestReading.reading)} units</strong> on {prettyDateTime(latestReading.readingAt)}.</div>}
    </section>;
  }

  const listCount = filteredTenants.length;
  const listTitle = view === "active" ? "Active tenants" : "Former tenants";
  const emptyTitle = view === "active"
    ? (data.tenants.length ? "No active tenants match your search" : "No active tenants yet")
    : (leftTenants.length ? "No former tenants match your search" : "No tenant has been marked left yet");

  return <section className="tenants-page">
    <div className="tenant-hero-head">
      <div>
        <p className="eyebrow">OCCUPANCY MANAGEMENT</p>
        <div className="tenant-title-row">
          <div><h1>Tenants</h1><p>Manage occupancy while preserving every tenant's electricity history.</p></div>
          <div className="tenant-overview-stats">
            <div><strong>{activeTenants.length}</strong><span>active tenants</span></div>
            <div><strong>{leftTenants.length}</strong><span>former tenants</span></div>
          </div>
        </div>
      </div>
      <button className="primary tenant-add-btn" onClick={() => setOpen(true)}>+ Add Tenant</button>
    </div>

    <div className="tenant-view-switch">
      <button className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Active <span>{activeTenants.length}</span></button>
      <button className={view === "left" ? "active" : ""} onClick={() => setView("left")}>Left / History <span>{leftTenants.length}</span></button>
    </div>

    <div className="tenant-toolbar">
      <div className={`tenant-search ${searchFocus ? "focus" : ""}`}>
        <span>⌕</span>
        <input value={search} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 100)} onChange={e => setSearch(e.target.value)} placeholder="Search tenant, room, shop or property" />
        {search && <button type="button" onClick={() => setSearch("")}>×</button>}
      </div>
      <div className="tenant-filter"><span>PROPERTY</span><select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}><option value="all">All properties</option>{data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="tenant-sort-pill">A–Z <span>{view === "active" ? "ACTIVE" : "FORMER"}</span></div>
    </div>

    <div className="tenant-context-row"><div><strong>{listCount}</strong> {listTitle.toLowerCase()}</div><div>{propertyFilter === "all" ? "All properties" : data.properties.find(p => p.id === propertyFilter)?.name} · {view === "active" ? "Current occupants" : "Preserved history"}</div></div>

    {filteredTenants.length === 0
      ? <div className="tenant-empty-state"><div className="tenant-empty-icon">{view === "active" ? "♙" : "◷"}</div><p className="eyebrow">{view === "active" ? "ACTIVE LIST" : "LEFT / HISTORY"}</p><h2>{emptyTitle}</h2><p>{view === "active" ? (data.tenants.length ? "Try another name or property filter." : "Add a tenant and assign a vacant room or shop.") : (leftTenants.length ? "Try another name or property filter." : "When you mark a tenant left, they will remain here so their full history can be checked.")}</p>{view === "active" && !data.tenants.length && <button className="primary" onClick={() => setOpen(true)}>+ Add Tenant</button>}</div>
      : <div className="tenant-list-shell">
        <div className="tenant-table">
          <div className="tenant-table-head"><span>TENANT</span><span>PROPERTY</span><span>UNIT</span><span>{view === "active" ? "JOINED" : "LEFT"}</span><span>STATUS</span><span>ACTIONS</span></div>
          {filteredTenants.map(t => {
            const u = data.units.find(x => x.id === t.unitId);
            const p = data.properties.find(x => x.id === u?.propertyId);
            return <div className="tenant-row" key={t.id}>
              <div className="tenant-cell tenant-person-cell"><div className="tenant-avatar">{(t.name || "?")[0].toUpperCase()}</div><div className="tenant-person-copy"><strong>{t.name}</strong><small className={t.phone?.trim() ? "" : "muted-phone"}>{t.phone?.trim() || "No phone number"}</small></div></div>
              <div className="tenant-cell"><span className="mobile-label">PROPERTY</span><strong>{p?.name || "—"}</strong><small>{p?.type || ""}</small></div>
              <div className="tenant-cell"><span className="mobile-label">UNIT</span><strong>{u?.label || "—"}</strong><small>{u?.billingType || ""}</small></div>
              <div className="tenant-cell"><span className="mobile-label">{view === "active" ? "JOINED" : "LEFT"}</span><strong>{prettyDate(view === "active" ? t.joinedAt : t.leftAt)}</strong><small>{prettyDateTime(view === "active" ? t.joinedAt : t.leftAt || t.updatedAt).split(", ").slice(1).join(", ")}</small></div>
              <div className="tenant-cell">{view === "active" ? <span className="status-badge"><i /> ACTIVE</span> : <span className="status-badge left-status"><i /> LEFT</span>}</div>
              <div className="tenant-cell tenant-action-cell">
                <button className="tenant-history-btn" onClick={() => setHistoryTenantId(t.id)} title={`View ${t.name}'s electricity history`}>History →</button>
                {view === "active" && <button className="danger-btn" onClick={() => setMarkLeftTarget(t)}>Mark left</button>}
                {view === "left" && <span className="history-only-badge">HISTORY</span>}
              </div>
            </div>;
          })}
        </div>
      </div>}

    {open && <Modal title="Add tenant" onClose={() => setOpen(false)} actions={<><button className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" form="tenant-form">Add tenant</button></>}>
      <form id="tenant-form" onSubmit={addTenant}>
        <div className="form-grid">
          <label className="full">Tenant name<input name="name" required placeholder="e.g. Tenant name" /></label>
          <label>Phone<input name="phone" placeholder="01XXXXXXXXX" /></label>
          <label>Assign room / shop<select name="unitId" required defaultValue=""><option value="" disabled>Select a vacant unit</option>{vacantUnits.map(u => { const p = data.properties.find(p => p.id === u.propertyId); return <option key={u.id} value={u.id}>{p?.name} · {u.label}</option> })}</select></label>
          <label>Joined date & time<input name="joinedAt" type="datetime-local" defaultValue={localInputValue()} required /></label>
        </div>
      </form>
    </Modal>}

    {markLeftTarget && <Modal title="Move tenant to history" onClose={() => setMarkLeftTarget(null)} actions={<><button className="secondary" onClick={() => setMarkLeftTarget(null)}>Cancel</button><button className="danger-primary" onClick={markLeft}>Mark left</button></>}>
      <div className="tenant-leave-confirm"><div className="tenant-leave-avatar">{(markLeftTarget.name || "?")[0].toUpperCase()}</div><h3>{markLeftTarget.name}</h3><p>Mark this tenant as left? They will be removed from the Active list, the room will become vacant, and the tenant will remain permanently available in Left / History. Nothing is deleted.</p><div className="tenant-leave-summary"><span><small>UNIT</small><b>{data.units.find(u => u.id === markLeftTarget.unitId)?.label || "—"}</b></span><span><small>JOINED</small><b>{prettyDate(markLeftTarget.joinedAt)}</b></span></div></div>
    </Modal>}
  </section>;
}

function Meters({ data, onSaved }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [editMeter, setEditMeter] = useState(null);
  const [replaceMeterId, setReplaceMeterId] = useState(null);
  const [form, setForm] = useState({ serial: "", replacementReading: "0", replacementAt: localInputValue() });

  const activeMeters = data.meters.filter(m => m.active).filter(m => {
    if (propertyFilter !== "all") {
      const u = data.units.find(x => x.id === m.unitId);
      if (u?.propertyId !== propertyFilter) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const u = data.units.find(x => x.id === m.unitId);
    const p = data.properties.find(x => x.id === u?.propertyId);
    const t = data.tenants.find(x => x.id === u?.currentTenantId && x.active && !x.deletedAt);
    return [m.serial, u?.label, u?.number, p?.name, t?.name, u?.billingType].join(" ").toLowerCase().includes(q);
  }).sort((a, b) => String(a.serial).localeCompare(String(b.serial), undefined, { numeric: true }));

  async function saveMeterName(e) {
    e.preventDefault();
    if (!editMeter) return;
    const serial = String(new FormData(e.currentTarget).get("serial") || "").trim();
    if (!serial) return;
    await save(user.uid, "meters", editMeter.id, { serial, updatedAt: new Date().toISOString() });
    setEditMeter(null);
    await onSaved(false);
  }

  async function replaceCurrentMeter(e) {
    e.preventDefault();
    if (!replaceMeterId) return;
    const old = data.meters.find(m => m.id === replaceMeterId);
    if (!old) return;
    if (!form.serial.trim()) return;
    const atISO = new Date(form.replacementAt).toISOString();
    const newId = crypto.randomUUID();

    await save(user.uid, "meters", old.id, {
      active: false,
      replacedAt: atISO,
      replacementReason: "Meter replaced/reset",
      updatedAt: new Date().toISOString()
    });

    await save(user.uid, "meters", newId, {
      unitId: old.unitId,
      serial: form.serial.trim(),
      initialReading: Number(form.replacementReading || 0),
      initialAt: atISO,
      installedAt: atISO,
      active: true,
      replacedFromMeterId: old.id
    });

    await save(user.uid, "units", old.unitId, { meterId: newId });
    setReplaceMeterId(null);
    setForm({ serial: "", replacementReading: "0", replacementAt: localInputValue() });
    await onSaved(false);
  }

  return <section className="meters-page">
    <div className="meters-page-head">
      <div>
        <p className="eyebrow">METER MANAGEMENT</p>
        <h1>Electricity meters</h1>
        <p>One meter per room/shop. Edit the serial without affecting history, or replace a damaged meter to start a new meter chain.</p>
      </div>
      <div className="meters-total"><strong>{activeMeters.length}</strong><span>active meters</span></div>
    </div>

    <div className="meters-toolbar">
      <div className="meter-search">
        <span>⌕</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meter, room, shop, tenant or property" />
        {search && <button type="button" onClick={() => setSearch("")}>×</button>}
      </div>
      <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
        <option value="all">All properties</option>
        {data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>

    <div className="meters-context">
      <span><b>{activeMeters.length}</b> active meters</span>
      <span>{propertyFilter === "all" ? "All properties" : data.properties.find(p => p.id === propertyFilter)?.name}</span>
    </div>

    {activeMeters.length === 0
      ? <div className="meters-empty"><div className="meters-empty-icon">⚡</div><h3>No active meters</h3><p>When you create a room or shop, CurrentFlow will create its meter here.</p></div>
      : <div className="meters-grid">
        {activeMeters.map(m => {
          const u = data.units.find(x => x.id === m.unitId);
          const p = data.properties.find(x => x.id === u?.propertyId);
          const t = data.tenants.find(x => x.id === u?.currentTenantId && x.active && !x.deletedAt);
          const reads = data.readings.filter(r => r.meterId === m.id).slice().sort((a, b) => new Date(b.readingAt) - new Date(a.readingAt));
          const latest = reads[0];
          return <article className="meter-card-v13" key={m.id}>
            <div className="meter-card-v13-head">
              <div className="meter-electric-icon">⚡</div>
              <div className="meter-person">
                <strong>{t?.name || "Vacant"}</strong>
                <span>{u?.label || "No unit"}</span>
              </div>
            </div>

            <div className="meter-status-line">
              <Badge tone="green">ACTIVE</Badge>
              <span>{u?.billingType || "—"}</span>
            </div>

            <div className="meter-serial-row">
              <div><small>METER SERIAL</small><h3>{m.serial || "—"}</h3></div>
              <button type="button" className="text-btn" onClick={() => setEditMeter(m)}>Edit</button>
            </div>

            <div className="meter-card-stats">
              <div><small>START READING</small><strong>{fmt(m.initialReading || 0)}</strong></div>
              <div><small>STARTED</small><strong>{prettyDate(m.initialAt)}</strong><span>{prettyDateTime(m.initialAt).split(", ").slice(1).join(", ")}</span></div>
            </div>

            <div className="meter-latest-reading">
              <div><span>Latest reading</span><strong>{latest ? fmt(latest.reading) : fmt(m.initialReading || 0)} units</strong></div>
              <small>{latest ? prettyDateTime(latest.readingAt) : "No reading recorded yet"}</small>
            </div>

            <div className="meter-card-footer">
              <span>{p?.name || "Property"} · {u?.type || "Unit"}</span>
              <button type="button" className="danger-btn" onClick={() => {
                setReplaceMeterId(m.id);
                setForm({ serial: "", replacementReading: "0", replacementAt: localInputValue() });
              }}>Reset / Replace</button>
            </div>
          </article>
        })}
      </div>}

    {editMeter && <Modal title="Edit meter serial" onClose={() => setEditMeter(null)} actions={<>
      <button className="secondary" onClick={() => setEditMeter(null)}>Cancel</button>
      <button className="primary" form="edit-meter-form">Save changes</button>
    </>}>
      <form id="edit-meter-form" onSubmit={saveMeterName}>
        <div className="meter-edit-context"><span>Unit</span><strong>{data.units.find(u => u.id === editMeter.unitId)?.label || "—"}</strong></div>
        <div className="form-grid">
          <label className="full">Meter serial<input name="serial" required defaultValue={editMeter.serial || ""} /></label>
        </div>
        <div className="edit-warning">Changing the serial number does not create a new meter and does not change any reading, calculation, tenant history, or start value.</div>
      </form>
    </Modal>}

    {replaceMeterId && <Modal title="Reset / replace meter" onClose={() => setReplaceMeterId(null)} actions={<>
      <button className="secondary" onClick={() => setReplaceMeterId(null)}>Cancel</button>
      <button className="primary" form="replace-meter-form">Create new meter</button>
    </>}>
      <form id="replace-meter-form" onSubmit={replaceCurrentMeter}>
        <div className="meter-replace-warning"><strong>Old meter stays in history.</strong><span>The replacement starts a new meter chain from the reading you enter.</span></div>
        <div className="form-grid">
          <label>New meter serial<input required value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} placeholder="e.g. M-2004" /></label>
          <label>New start reading<input type="number" min="0" required value={form.replacementReading} onChange={e => setForm({ ...form, replacementReading: e.target.value })} /></label>
          <label className="full">Replacement date & time<input type="datetime-local" required value={form.replacementAt} onChange={e => setForm({ ...form, replacementAt: e.target.value })} /></label>
        </div>
      </form>
    </Modal>}
  </section>
}

function Readings({ data, onSaved }) {
  const { user } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState("");
  const [reading, setReading] = useState("");
  const [at, setAt] = useState(localInputValue());
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [showUnits, setShowUnits] = useState(true);
  const [saving, setSaving] = useState(false);

  const allUnits = data.units
    .filter(u => propertyFilter === "all" || u.propertyId === propertyFilter)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  const q = search.trim().toLowerCase();
  const filteredUnits = allUnits.filter(u => {
    if (!q) return true;
    const property = data.properties.find(p => p.id === u.propertyId);
    const currentTenant = data.tenants.find(t => t.id === u.currentTenantId);
    const meter = data.meters.find(m => m.id === u.meterId);
    return [u.label, u.number, u.type, u.billingType, property?.name || "", currentTenant?.name || "", meter?.serial || ""]
      .join(" ").toLowerCase().includes(q);
  });

  const unit = data.units.find(u => u.id === selectedUnit);
  const meter = unit && data.meters.find(m => m.id === unit.meterId);
  const property = unit && data.properties.find(p => p.id === unit.propertyId);

  const unitReads = data.readings
    .filter(r => r.unitId === selectedUnit)
    .slice()
    .sort((a, b) => new Date(b.readingAt) - new Date(a.readingAt));

  const targetAt = new Date(at);
  const chronologicalReads = data.readings
    .filter(r => r.meterId === meter?.id && r.id !== editing?.id)
    .slice()
    .sort((a, b) => new Date(a.readingAt) - new Date(b.readingAt));

  const previousReading = chronologicalReads
    .filter(r => new Date(r.readingAt) < targetAt)
    .slice(-1)[0];

  const nextReading = chronologicalReads
    .find(r => new Date(r.readingAt) > targetAt);

  const opening = previousReading?.reading ?? meter?.initialReading ?? 0;

  const readingTenant = unit
    ? data.tenants.find(t => {
      const joined = new Date(t.joinedAt);
      const left = t.leftAt ? new Date(t.leftAt) : null;
      return joined <= targetAt && (!left || targetAt < left) && t.unitId === unit.id && !t.deletedAt;
    })
    : null;

  async function saveReading(e) {
    e.preventDefault();
    if (!unit || !meter || saving) return;

    const value = Number(reading);
    if (!Number.isFinite(value) || value < 0) return alert("Enter a valid meter reading.");
    if (value < opening) return alert(`Reading cannot be lower than the opening value (${opening}).`);
    if (nextReading && value > Number(nextReading.reading)) {
      return alert(`This reading cannot be higher than the next recorded reading (${nextReading.reading}).`);
    }
    if (Number.isNaN(targetAt.getTime())) return alert("Please enter a valid reading date and time.");

    setSaving(true);
    try {
      const readingId = editing?.id || crypto.randomUUID();
      const record = {
        unitId: unit.id,
        meterId: meter.id,
        reading: value,
        readingAt: targetAt.toISOString(),
        rate: Number(editing?.rate ?? data.rates[unit.billingType] ?? 0),
        billingType: unit.billingType,
        tenantId: readingTenant?.id || null,
        tenantName: readingTenant?.name || null,
        createdAt: editing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await save(user.uid, "readings", readingId, record);

      const nextData = {
        ...data,
        readings: [...data.readings.filter(r => r.id !== readingId), { id: readingId, ...record }]
      };

      await recomputeCalculations(user.uid, nextData, meter.id);

      setEditing(null);
      setReading("");
      setAt(localInputValue());
      await onSaved(false);
    } finally {
      setSaving(false);
    }
  }

  function selectUnit(id) {
    setSelectedUnit(id);
    setEditing(null);
    setReading("");
    setAt(localInputValue());
    setShowUnits(false);
    setSearch("");
  }

  function startEdit(r) {
    setEditing(r);
    setReading(String(r.reading));
    setAt(localInputValue(r.readingAt));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearSelection() {
    setSelectedUnit("");
    setEditing(null);
    setReading("");
    setAt(localInputValue());
    setSearch("");
    setShowUnits(true);
  }

  return <section className="reading-workspace">
    <div className="section-top reading-page-head">
      <div>
        <p className="eyebrow">METER READING CENTER</p>
        <h1>Record electricity reading</h1>
        <p>Fast, focused entry for any room or shop — even when your property has hundreds of units.</p>
      </div>
      <div className="reading-head-stat"><span>{data.units.length}</span><small>units</small></div>
    </div>

    <div className={`reading-shell ${unit ? "has-selection" : ""}`}>
      <div className="reading-selector-panel">
        <div className="selector-kicker"><span className="step-pill">01</span><div><small>FIND YOUR UNIT</small><h3>Which room or shop?</h3></div></div>

        <div className="reading-filter-row">
          <div className="reading-search-input">
            <span>⌕</span>
            <input autoComplete="off" value={search} onFocus={() => setShowUnits(true)} onChange={e => { setSearch(e.target.value); setShowUnits(true) }} placeholder="Room, shop, tenant or meter..." />
            {search && <button type="button" onClick={() => setSearch("")}>×</button>}
          </div>
          <select value={propertyFilter} onChange={e => { setPropertyFilter(e.target.value); setShowUnits(true); setSelectedUnit("") }}>
            <option value="all">All properties</option>
            {data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {showUnits && <div className="unit-browser">
          <div className="unit-browser-head"><span>{filteredUnits.length} matching units</span>{selectedUnit && <button type="button" className="text-btn" onClick={clearSelection}>Clear selection</button>}</div>
          {filteredUnits.length === 0
            ? <div className="unit-browser-empty"><div className="empty-icon small">⌕</div><p>No room, shop, tenant or meter matches this search.</p></div>
            : <div className="unit-browser-list">
              {filteredUnits.slice(0, 80).map(u => {
                const p = data.properties.find(x => x.id === u.propertyId);
                const t = data.tenants.find(x => x.id === u.currentTenantId && x.active && !x.deletedAt);
                const m = data.meters.find(x => x.id === u.meterId);
                return <button type="button" key={u.id} className={`unit-browser-item ${u.id === selectedUnit ? "selected" : ""}`} onClick={() => selectUnit(u.id)}>
                  <div className="unit-browser-icon">{u.type === "Shop" ? "▤" : "□"}</div>
                  <div className="unit-browser-copy"><strong>{u.label}</strong><span>{p?.name || "Property"} · {t?.name || "Vacant"} · {m?.serial || "No meter"}</span></div>
                  <span className="unit-browser-rate">{u.billingType}</span>
                </button>
              })}
            </div>}
          {filteredUnits.length > 80 && <div className="unit-browser-foot">Showing the first 80 matches. Refine the search for a faster result.</div>}
        </div>}

        {!showUnits && unit && <button type="button" className="selected-unit-summary" onClick={() => setShowUnits(true)}><span className="summary-check">✓</span><span><strong>{unit.label}</strong><small>{property?.name} · {readingTenant?.name || "No tenant at selected time"}</small></span><span>Change</span></button>}
      </div>

      {!unit ? <div className="reading-start-panel"><div className="reading-start-orb">⚡</div><p className="eyebrow">READY</p><h2>Select a unit to begin</h2><p>Search above and choose the room or shop you are checking. The reading form will appear here.</p></div> :
        <div className="reading-active-area">
          <div className="reading-unit-banner">
            <div className="reading-unit-banner-main"><div className="unit-energy-icon">⚡</div><div><Badge tone={unit.billingType === "Commercial" ? "orange" : "blue"}>{unit.billingType}</Badge><h2>{unit.label}</h2><p>{property?.name} · Meter {meter?.serial || "—"}</p></div></div>
            <div className="reading-unit-person"><small>TENANT AT READING TIME</small><strong>{readingTenant?.name || "Vacant"}</strong><span>{readingTenant?.joinedAt ? `Since ${prettyDate(readingTenant.joinedAt)}` : "No matching tenant for this date"}</span></div>
          </div>

          <div className="reading-entry-panel">
            <div className="selector-kicker"><span className="step-pill">02</span><div><small>{editing ? "EDIT READING" : "ENTER READING"}</small><h3>{editing ? "Update this meter record" : "What is the meter reading now?"}</h3></div></div>
            <form onSubmit={saveReading}>
              <div className="reading-big-input">
                <div className="reading-side-value"><small>OPENING</small><strong>{fmt(opening)}</strong><span>Previous reading</span></div>
                <div className="reading-flow-arrow">→</div>
                <div className="reading-side-value input-side"><small>CLOSING</small><input inputMode="numeric" type="number" min={opening} value={reading} onChange={e => setReading(e.target.value)} placeholder={String(opening)} aria-label="Closing meter reading" /><span>Current meter value</span></div>
              </div>

              <div className="reading-date-card"><div><span className="date-icon">◷</span><div><small>METER CHECKED</small><strong>Reading date & time</strong></div></div><input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} required /></div>

              <div className="reading-smart-summary">
                <div><small>RATE</small><strong>{money(data.rates[unit.billingType] || 0)} / unit</strong></div>
                <div><small>OPENING SOURCE</small><strong>{previousReading ? prettyDate(previousReading.readingAt) : "Meter start"}</strong></div>
                <div><small>TENANT AT READING</small><strong>{readingTenant?.name || "Vacant"}</strong></div>
              </div>

              <button className="primary wide reading-primary-action" disabled={saving}><span>{saving ? (editing ? "Updating…" : "Saving…") : (editing ? "Update meter reading" : "Save meter reading")}</span><b>→</b></button>
              {editing && <button type="button" className="secondary wide reading-cancel-action" onClick={() => { setEditing(null); setReading(""); setAt(localInputValue()) }}>Cancel edit</button>}
            </form>
          </div>

          <div className="reading-live-panel">
            <div className="live-panel-head"><div className="selector-kicker"><span className="step-pill">03</span><div><small>LIVE HISTORY</small><h3>{unit.label}</h3></div></div><Badge tone="green">{unitReads.length} readings</Badge></div>
            {unitReads.length === 0 ? <div className="live-empty"><div className="empty-icon small">⌁</div><p>No meter readings for this unit yet.</p></div> :
              <div className="live-reading-list">{unitReads.map((r, index) => {
                const rTenant = r.tenantName || data.tenants.find(t => t.id === r.tenantId)?.name || "Vacant";
                const calc = data.calculations.find(c => c.basedOnReadingId === r.id);
                return <div className={`live-reading-row ${index === 0 ? "latest" : ""}`} key={r.id}>
                  <div className="live-reading-marker">{index === 0 ? "●" : "○"}</div>
                  <div className="live-reading-copy"><strong>{fmt(r.reading)} units</strong><span>{prettyDateTime(r.readingAt)}</span><small>Tenant: {rTenant}</small>{calc && <small className="reading-calc-link">Calculation {fmt(calc.units)} units · {money(calc.amount)}</small>}</div>
                  <button type="button" className="text-btn" onClick={() => startEdit(r)}>Edit</button>
                </div>
              })}</div>}
          </div>
        </div>}
    </div>
  </section>
}

function Calculations({ data }) {
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");

  const property = data.properties.find(p => p.id === propertyId);
  const units = data.units.filter(u => u.propertyId === propertyId);
  const unit = data.units.find(u => u.id === unitId);
  const unitTenants = data.tenants.filter(t => t.unitId === unitId).slice().sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  const selectedTenant = data.tenants.find(t => t.id === tenantId);
  const meter = unit && data.meters.find(m => m.id === unit.meterId);
  const readings = unitId ? data.readings.filter(r => r.unitId === unitId).sort((a, b) => new Date(b.readingAt) - new Date(a.readingAt)) : [];
  const calculations = (unitId ? data.calculations.filter(c => c.unitId === unitId && (!tenantId || c.tenantId === tenantId)) : []).slice().sort((a, b) => new Date(b.toReadingAt) - new Date(a.toReadingAt));

  if (!propertyId) return <section className="calculations-page">
    <div className="section-top"><div><p className="eyebrow">ELECTRICITY HISTORY</p><h1>Calculations</h1><p>Choose a property first. Everything after this is room-specific.</p></div></div>
    {data.properties.length === 0 ? <EmptyState icon="▤" title="No properties yet" text="Add a property first." /> :
      <div className="calc-mobile-property-list">{data.properties.map(p => <button key={p.id} className="calc-mobile-property-card" onClick={() => { setPropertyId(p.id); setUnitId(""); setTenantId("") }}>
        <div className="calc-mobile-property-icon">▦</div>
        <div className="calc-mobile-property-info"><Badge>{p.type}</Badge><h3>{p.name}</h3><p>{data.units.filter(u => u.propertyId === p.id).length} rooms / shops · {p.address || "No address"}</p></div>
        <span className="calc-chevron">→</span>
      </button>)}</div>}
  </section>;

  if (!unitId) return <section className="calculations-page">
    <div className="section-top"><div><p className="eyebrow">PROPERTY</p><h1>{property.name}</h1><p>Select a room/shop to open its electricity timeline.</p></div><button className="secondary" onClick={() => setPropertyId("")}>← Properties</button></div>
    {units.length === 0 ? <EmptyState icon="□" title="No rooms or shops" text="Create one inside Properties." /> :
      <div className="calc-mobile-room-list">{units.map(u => {
        const m = data.meters.find(x => x.id === u.meterId), t = data.tenants.find(x => x.id === u.currentTenantId && x.active && !x.deletedAt);
        const count = data.calculations.filter(c => c.unitId === u.id).length;
        return <button className="calc-mobile-room-card" key={u.id} onClick={() => { setUnitId(u.id); setTenantId("") }}>
          <div className="calc-room-card-main"><Badge tone={u.billingType === "Commercial" ? "orange" : "blue"}>{u.billingType}</Badge><h3>{u.label}</h3><p>{t?.name || "Vacant"} · Meter {m?.serial || "—"}</p></div>
          <div className="calc-room-card-side"><strong>{count}</strong><small>calculations</small><span>Open →</span></div>
        </button>
      })}</div>}
  </section>;

  return <section className="calculations-page">
    <div className="section-top calc-detail-top"><div><p className="eyebrow">ROOM / SHOP</p><h1>{unit.label}</h1><p>{property?.name} · {unit.billingType} · Meter {meter?.serial || "—"}</p></div><button className="secondary" onClick={() => { setUnitId(""); setTenantId("") }}>← Rooms</button></div>

    <div className="calc-detail-hero">
      <div><Badge tone={unit.billingType === "Commercial" ? "orange" : "blue"}>{unit.billingType}</Badge><h2>{unit.label}</h2><p>Follow the room from first meter reading to the latest calculation.</p></div>
      <div className="calc-current-box"><small>CURRENT READING</small><strong>{fmt(readings[0]?.reading ?? meter?.initialReading ?? 0)}</strong><span>units</span></div>
    </div>

    <div className="calc-tenant-card">
      <div className="calc-section-title"><div><p className="eyebrow">TENANT HISTORY</p><h3>Who lived here?</h3></div><span>{unitTenants.length} tenants</span></div>
      {unitTenants.length === 0 ? <p className="muted">No tenant history for this room.</p> :
        <div className="tenant-scroll-row">{unitTenants.map(t => <button className={`calc-tenant-pill ${tenantId === t.id ? "selected" : ""}`} key={t.id} onClick={() => setTenantId(tenantId === t.id ? "" : t.id)}>
          <div className="avatar">{(t.name || "?")[0]}</div><div><b>{t.name}</b><small>{prettyDate(t.joinedAt)} → {t.leftAt ? prettyDate(t.leftAt) : "Present"}</small></div><span>{t.active && !t.deletedAt ? "ACTIVE" : "LEFT"}</span>
        </button>)}</div>}
    </div>

    {tenantId && selectedTenant && <div className="calc-filter-banner"><div><small>FILTERED TO TENANT</small><strong>{selectedTenant.name}</strong><span>{prettyDate(selectedTenant.joinedAt)} → {selectedTenant.leftAt ? prettyDate(selectedTenant.leftAt) : "Present"}</span></div><button className="text-btn" onClick={() => setTenantId("")}>Clear</button></div>}

    <div className="calc-timeline-card">
      <div className="calc-section-title"><div><p className="eyebrow">ELECTRICITY CALCULATIONS</p><h3>{tenantId ? `${selectedTenant?.name} history` : "Room calculation timeline"}</h3></div><span>{calculations.length} records</span></div>
      {calculations.length === 0 ? <div className="empty-inline">No calculation records for this selection.</div> :
        <div className="calc-timeline">
          {calculations.map(c => {
            const ending = data.readings.find(r => r.id === c.basedOnReadingId);
            const tenantAtReading = ending?.tenantName || c.tenantName || "Vacant";
            return <div className="calc-record-card" key={c.basedOnReadingId}>
              <div className="calc-record-top"><div className="calc-record-icon">▤</div><div><Badge tone="green">CALCULATION</Badge><h3>{money(c.amount)}</h3><p>{fmt(c.units)} units used</p></div><span className="calc-record-date">{prettyDate(c.toReadingAt)}</span></div>
              <div className="calc-record-period"><div><small>FROM</small><b>{prettyDate(c.fromReadingAt)}</b><span>{fmt(c.fromReading)}</span></div><div className="period-arrow">→</div><div><small>TO</small><b>{prettyDate(c.toReadingAt)}</b><span>{fmt(c.toReading)}</span></div></div>
              <div className="calc-record-meta"><span>{c.days} days</span><span>{money(c.rate)}/unit</span><span>Reading by: {tenantAtReading}</span><span>Calculated {prettyDateTime(c.calculationAt)}</span></div>
              <div className="calc-record-link">↳ Ending meter reading: {fmt(c.toReading)} units · {prettyDateTime(ending?.readingAt || c.toReadingAt)}</div>
            </div>
          })}
        </div>}
    </div>
  </section>;
}


function Settings({ data, onSaved }) {
  const { user } = useAuth();
  const [rates, setRates] = useState(data.rates);
  const [propertyTypes, setPropertyTypes] = useState(data.propertyTypes || DEFAULT_PROPERTY_TYPES);
  const [newType, setNewType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [restoreError, setRestoreError] = useState("");
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    setRates(data.rates);
    setPropertyTypes(data.propertyTypes || DEFAULT_PROPERTY_TYPES);
  }, [data.rates, data.propertyTypes]);

  async function saveSettings() {
    const clean = Array.from(new Set(propertyTypes.map(x => x.trim()).filter(Boolean)));
    await saveRates(
      user.uid,
      { Residential: Number(rates.Residential || 0), Commercial: Number(rates.Commercial || 0) },
      clean.length ? clean : DEFAULT_PROPERTY_TYPES
    );
    await onSaved();
  }

  function addType() {
    const value = newType.trim();
    if (!value || propertyTypes.some(x => x.toLowerCase() === value.toLowerCase())) return;
    setPropertyTypes([...propertyTypes, value]);
    setNewType("");
  }

  function exportBackup() {
    const payload = {
      app: "CurrentFlow",
      version: 6,
      exportedAt: new Date().toISOString(),
      account: { uid: user.uid, email: user.email || "", displayName: user.displayName || "" },
      workspace: {
        properties: data.properties,
        units: data.units,
        tenants: data.tenants,
        meters: data.meters,
        readings: data.readings,
        calculations: data.calculations,
        rateHistory: data.rateHistory,
        rates: data.rates,
        propertyTypes: data.propertyTypes || DEFAULT_PROPERTY_TYPES
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `currentflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function selectBackupFile(file) {
    setRestoreError("");
    if (!file) {
      setBackupFile(null);
      return;
    }
    if (file.type && file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) {
      setBackupFile(null);
      setRestoreError("Please select a CurrentFlow JSON backup file.");
      return;
    }
    setBackupFile(file);
  }

  async function restoreFromBackup() {
    if (!backupFile || restoring) return;

    setRestoreError("");
    setRestoring(true);

    try {
      const text = await backupFile.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("This backup file is not valid JSON.");
      }

      const validation = validateBackupPayload(payload);
      if (!validation.ok) throw new Error(validation.error);

      const counts = [
        ["properties", payload.workspace.properties.length],
        ["units", payload.workspace.units.length],
        ["tenants", payload.workspace.tenants.length],
        ["meters", payload.workspace.meters.length],
        ["readings", payload.workspace.readings.length],
        ["calculations", payload.workspace.calculations.length]
      ];

      const summary = counts.filter(([, n]) => n > 0).map(([name, n]) => `${n} ${name}`).join(", ") || "no records";
      const confirmed = confirm(
        `Restore this CurrentFlow backup?\n\n` +
        `Backup date: ${payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : "Unknown"}\n` +
        `Contains: ${summary}.\n\n` +
        `IMPORTANT: Your current workspace data will be replaced by this backup.`
      );

      if (!confirmed) return;

      await restoreWorkspace(user.uid, payload);
      setBackupFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onSaved();
      alert("Backup restored successfully.");
    } catch (err) {
      console.error(err);
      setRestoreError(err?.message || "Unable to restore this backup.");
    } finally {
      setRestoring(false);
    }
  }

  async function resetAll() {
    const phrase = "RESET CURRENTFLOW";
    const typed = prompt(
      `This permanently removes all workspace records for this account while keeping your login.\n\nType ${phrase} to continue.`
    );
    if (typed !== phrase) return;

    setResetting(true);
    try {
      await resetWorkspace(user.uid);
      await onSaved();
    } finally {
      setResetting(false);
    }
  }

  return <section>
    <div className="section-top">
      <div>
        <p className="eyebrow">WORKSPACE SETTINGS</p>
        <h1>Settings</h1>
        <p>Manage rates, property types, backup, restore, and account data.</p>
      </div>
    </div>

    <div className="settings-stack">
      <div className="settings-card">
        <div className="settings-card-head">
          <div><p className="eyebrow">ELECTRICITY RATES</p><h3>Billing rates</h3><p>Existing calculations keep the rate used when they were created.</p></div>
        </div>
        <div className="rate-setting">
          <div><Badge tone="blue">RESIDENTIAL</Badge><h3>Residential rate</h3><p>Applied to residential rooms.</p></div>
          <div className="rate-edit"><span>৳</span><input type="number" min="0" value={rates.Residential} onChange={e => setRates({ ...rates, Residential: e.target.value })} /><small>/ unit</small></div>
        </div>
        <div className="rate-setting">
          <div><Badge tone="orange">COMMERCIAL</Badge><h3>Commercial rate</h3><p>Applied to commercial shops.</p></div>
          <div className="rate-edit"><span>৳</span><input type="number" min="0" value={rates.Commercial} onChange={e => setRates({ ...rates, Commercial: e.target.value })} /><small>/ unit</small></div>
        </div>
        <button className="primary" onClick={saveSettings}>Save settings</button>
      </div>

      <div className="settings-card">
        <div className="settings-card-head">
          <div><p className="eyebrow">PROPERTY TYPES</p><h3>Your property categories</h3><p>Add your own property type and use it in Add Property.</p></div>
        </div>
        <div className="type-list">{propertyTypes.map(type => <div className="type-chip" key={type}><span>{type}</span>{propertyTypes.length > 1 && <button type="button" onClick={() => setPropertyTypes(propertyTypes.filter(x => x !== type))}>×</button>}</div>)}</div>
        <div className="type-add-row"><input value={newType} onChange={e => setNewType(e.target.value)} placeholder="e.g. Hostel, Office, Warehouse" /><button className="secondary" onClick={addType}>Add type</button></div>
        <button className="text-btn save-types-inline" onClick={saveSettings}>Save property types</button>
      </div>

      <div className="settings-card backup-card">
        <div className="settings-card-head">
          <div><p className="eyebrow">BACKUP & RESTORE</p><h3>Protect your workspace</h3><p>Export a complete JSON backup or restore this account from a previous CurrentFlow backup.</p></div>
          <div className="backup-icon">⇩</div>
        </div>

        <div className="backup-actions">
          <button className="primary backup-action" onClick={exportBackup}>Export backup <span>↓</span></button>
          <button className="secondary backup-action" onClick={() => fileInputRef.current?.click()}>Choose backup file</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={e => selectBackupFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className={`restore-dropzone ${backupFile ? "ready" : ""}`} onClick={() => fileInputRef.current?.click()}>
          <div className="restore-file-icon">{backupFile ? "✓" : "↑"}</div>
          {backupFile
            ? <><strong>{backupFile.name}</strong><span>Ready to restore · Click to choose another file</span></>
            : <><strong>Restore from backup file</strong><span>Choose a .json backup exported by CurrentFlow</span></>}
        </div>

        {restoreError && <div className="backup-error">{restoreError}</div>}

        <button
          className="restore-primary"
          disabled={!backupFile || restoring}
          onClick={restoreFromBackup}
        >
          {restoring ? "Restoring workspace…" : "Restore selected backup"}
        </button>

        <div className="settings-note">
          Restoring replaces the current workspace data for this signed-in account. Your Firebase login is not changed.
          The backup keeps record IDs so room, meter, reading, tenant, and calculation relationships stay connected.
        </div>
      </div>

      <div className="settings-card danger-card">
        <div className="settings-card-head">
          <div><p className="eyebrow danger-eye">DANGER ZONE</p><h3>Reset all workspace data</h3><p>Deletes properties, rooms, shops, tenants, meters, readings and calculations. Your login stays active.</p></div>
        </div>
        <button className="danger-primary" disabled={resetting} onClick={resetAll}>{resetting ? "Resetting…" : "Reset account data"}</button>
      </div>
    </div>
  </section>;
}

function App() {
  const { user, initializing } = useAuth();
  const [data, setData] = useState(emptyData), [loading, setLoading] = useState(true), [error, setError] = useState(""), [page, setPage] = useState("dashboard");
  async function refresh(showLoading = true) { if (!user) return; if (showLoading) setLoading(true); try { setData(await loadAll(user.uid)); setError("") } catch (e) { setError(e?.message || "Unable to load data.") } finally { if (showLoading) setLoading(false) } }
  useEffect(() => { if (user) refresh(); else { setData(emptyData); setLoading(false) } }, [user]);
  if (initializing || loading) return <Loading />; if (!user) return <Auth />; if (error) return <div className="auth-error"><h2>Could not load workspace</h2><p>{error}</p><button className="primary" onClick={refresh}>Retry</button></div>;
  const common = { data, onSaved: (showLoading = true) => refresh(showLoading) };
  const content = { dashboard: <Dashboard data={data} setPage={setPage} />, properties: <Properties {...common} />, tenants: <Tenants {...common} />, meters: <Meters {...common} />, readings: <Readings {...common} />, calculations: <Calculations data={data} />, settings: <Settings {...common} /> }[page];
  return <Layout page={page} setPage={setPage} data={data}>{content}</Layout>;
}

createRoot(document.getElementById("root")).render(<AppErrorBoundary><AuthProvider><App /></AuthProvider></AppErrorBoundary>);
