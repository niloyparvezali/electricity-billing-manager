import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const col = (uid,name) => collection(db,"users",uid,name);
export async function loadCollection(uid,name){ const s=await getDocs(col(uid,name)); return s.docs.map(d=>({id:d.id,...d.data()})); }
export async function saveCollection(uid,name,rows){ await Promise.all(rows.map(r=>setDoc(doc(db,"users",uid,name,r.id),r,{merge:true}))); }
export async function saveSetting(uid,rates){ await setDoc(doc(db,"users",uid,"settings","main"),{id:"main",rates},{merge:true}); }

export async function loadAllData(uid){
  const [properties,units,meters,readings,tenants,settings]=await Promise.all([
    loadCollection(uid,"properties"),loadCollection(uid,"units"),loadCollection(uid,"meters"),loadCollection(uid,"readings"),loadCollection(uid,"tenants"),loadCollection(uid,"settings")
  ]);
  return {properties,units,meters,readings,tenants,rates:settings.find(x=>x.id==="main")?.rates||{Residential:10,Commercial:15}};
}

export async function seedDemoData(uid,seed){
  const properties=await loadCollection(uid,"properties");
  if(properties.length) return false;
  await Promise.all([
    saveCollection(uid,"properties",seed.properties),saveCollection(uid,"units",seed.units),saveCollection(uid,"meters",seed.meters),saveCollection(uid,"readings",seed.readings),saveCollection(uid,"tenants",seed.tenants),saveSetting(uid,seed.rates)
  ]);
  return true;
}
