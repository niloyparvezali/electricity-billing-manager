import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

const names = ["properties","units","tenants","meters","readings","calculations","rateHistory"];

export const DEFAULT_PROPERTY_TYPES = ["Flat", "Building", "Half Building", "Market"];

export const emptyData = {
  properties: [],
  units: [],
  tenants: [],
  meters: [],
  readings: [],
  calculations: [],
  rateHistory: [],
  rates: { Residential: 0, Commercial: 0 },
  propertyTypes: DEFAULT_PROPERTY_TYPES
};

const col = (uid, name) => collection(db, "users", uid, name);
const settingsRef = uid => doc(db, "users", uid, "settings", "main");

export async function loadAll(uid) {
  const refs = names.map(name => [name, query(col(uid, name))]);
  const { getDoc } = await import("firebase/firestore");

  const [snapshots, settingsSnap] = await Promise.all([
    Promise.all(refs.map(([, q]) => getDocs(q))),
    getDoc(settingsRef(uid))
  ]);

  const result = {};
  refs.forEach(([name], index) => {
    result[name] = snapshots[index].docs.map(d => ({ id: d.id, ...d.data() }));
  });

  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  result.rates = settings.rates || { Residential: 0, Commercial: 0 };
  result.propertyTypes = Array.isArray(settings.propertyTypes) && settings.propertyTypes.length
    ? settings.propertyTypes
    : DEFAULT_PROPERTY_TYPES;

  return { ...emptyData, ...result };
}

export async function save(uid, name, id, data) {
  await setDoc(doc(db, "users", uid, name, id), data, { merge: true });
}

export async function add(uid, name, data) {
  const ref = await addDoc(col(uid, name), data);
  return ref.id;
}

export async function remove(uid, name, id) {
  await deleteDoc(doc(db, "users", uid, name, id));
}

export async function saveRates(uid, rates, propertyTypes) {
  await setDoc(settingsRef(uid), {
    rates,
    propertyTypes,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function resetWorkspace(uid) {
  const collections = [...names];
  for (const name of collections) {
    const snap = await getDocs(query(col(uid, name)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(settingsRef(uid));
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object") return { ok:false, error:"Backup file is not a valid JSON object." };
  if (payload.app !== "CurrentFlow") return { ok:false, error:"This file is not a CurrentFlow backup." };
  if (!payload.workspace || typeof payload.workspace !== "object") return { ok:false, error:"The backup workspace is missing." };

  const required = ["properties","units","tenants","meters","readings","calculations","rateHistory","rates","propertyTypes"];
  const missing = required.filter(key => !(key in payload.workspace));
  if (missing.length) return { ok:false, error:`Backup is missing: ${missing.join(", ")}.` };

  for (const key of required.slice(0,7)) {
    if (!Array.isArray(payload.workspace[key])) {
      return { ok:false, error:`Backup field "${key}" must be an array.` };
    }
  }

  if (typeof payload.workspace.rates !== "object" || !payload.workspace.rates) {
    return { ok:false, error:"Backup rates are invalid." };
  }
  if (!Array.isArray(payload.workspace.propertyTypes) || !payload.workspace.propertyTypes.length) {
    return { ok:false, error:"Backup property types are invalid." };
  }
  return { ok:true };
}

export async function restoreWorkspace(uid, payload) {
  const validation = validateBackupPayload(payload);
  if (!validation.ok) throw new Error(validation.error);

  // Restore only into the currently signed-in user's namespace.
  // IDs are preserved so relationships between units/meters/readings/calculations remain intact.
  const restoreCollections = ["properties","units","tenants","meters","readings","calculations","rateHistory"];
  const workspace = payload.workspace;

  const operations = [];

  for (const name of restoreCollections) {
    const snap = await getDocs(query(col(uid, name)));
    for (const d of snap.docs) operations.push({ type:"delete", ref:d.ref });
  }

  // Remove the old settings document as well.
  operations.push({ type:"delete", ref:settingsRef(uid) });

  // Add restored records.
  for (const name of restoreCollections) {
    for (const record of workspace[name]) {
      if (!record || typeof record !== "object") continue;
      if (!record.id) throw new Error(`A ${name} record is missing its id.`);
      operations.push({ type:"set", ref:doc(db, "users", uid, name, record.id), data:record });
    }
  }

  operations.push({
    type:"set",
    ref:settingsRef(uid),
    data:{
      rates:{
        Residential:Number(workspace.rates.Residential||0),
        Commercial:Number(workspace.rates.Commercial||0)
      },
      propertyTypes:Array.from(new Set(workspace.propertyTypes.map(x=>String(x).trim()).filter(Boolean))),
      restoredAt:serverTimestamp()
    }
  });

  // Firestore batches are limited in size; stay safely below the limit.
  const chunkSize = 400;
  for (let i=0; i<operations.length; i+=chunkSize) {
    const batch = writeBatch(db);
    for (const op of operations.slice(i, i+chunkSize)) {
      if (op.type==="delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data, { merge:true });
    }
    await batch.commit();
  }

  return true;
}

export async function removeAllCalculations(uid, meterId) {
  const snap = await getDocs(query(col(uid, "calculations"), where("meterId", "==", meterId)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function recomputeCalculations(uid, data, meterId) {
  const meter = data.meters.find(m => m.id === meterId);
  if (!meter) return;
  const unit = data.units.find(u => u.id === meter.unitId);
  if (!unit) return;
  const property = data.properties.find(p => p.id === unit.propertyId);
  const readings = data.readings
    .filter(r => r.meterId === meterId)
    .slice()
    .sort((a,b) => new Date(a.readingAt) - new Date(b.readingAt));

  const existingSnap = await getDocs(query(col(uid, "calculations"), where("meterId", "==", meterId)));
  const existing = new Map(existingSnap.docs.map(d => [d.id, d.data()]));
  const activeIds = new Set();

  let baselineReading = Number(meter.initialReading || 0);
  let baselineAt = meter.initialAt;
  let baselineKind = "Meter start";

  for (const current of readings) {
    const opening = baselineReading;
    const to = new Date(current.readingAt);
    const from = new Date(baselineAt);
    const units = Math.max(0, Number(current.reading) - opening);
    const days = Math.max(0, Math.ceil((to - from) / 86400000));
    const rate = Number(current.rate ?? data.rates[unit.billingType] ?? 0);
    const tenantId = current.tenantId || null;
    const tenantName = current.tenantName || null;
    const id = `calc_${current.id}`;
    activeIds.add(id);
    const old = existing.get(id);

    const core = {
      meterId,
      unitId: unit.id,
      propertyId: property?.id || null,
      tenantId,
      tenantName,
      unitLabel: unit.label,
      propertyName: property?.name || null,
      billingType: current.billingType || unit.billingType,
      fromReading: opening,
      toReading: Number(current.reading),
      fromReadingAt: baselineAt,
      toReadingAt: current.readingAt,
      fromSource: baselineKind,
      days,
      units,
      rate,
      amount: units * rate,
      basedOnReadingId: current.id
    };

    await save(uid, "calculations", id, {
      ...core,
      calculationAt: old ? old.calculationAt : new Date().toISOString()
    });

    baselineReading = Number(current.reading);
    baselineAt = current.readingAt;
    baselineKind = "Previous reading";
  }

  for (const id of existing.keys()) {
    if (!activeIds.has(id)) await remove(uid, "calculations", id);
  }
}
