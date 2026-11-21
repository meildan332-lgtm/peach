import{initializeApp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import{getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,browserSessionPersistence}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import{getFirestore,doc,setDoc,onSnapshot,collection,getDocs,getDoc,writeBatch,deleteDoc}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyAmBmSFCgaFd-yE2vsLItLWKtU0Z8U_bSg',authDomain:'nyachyo-97f7d.firebaseapp.com',projectId:'nyachyo-97f7d',storageBucket:'nyachyo-97f7d.firebasestorage.app',messagingSenderId:'892799826403',appId:'1:892799826403:web:efbffa3ff82921746c88d6',measurementId:'G-5WYFR3YCLB'};
const ADMIN_EMAILS=new Set(['nslah830@gmail.com']);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const errorText=document.querySelector('#loginError'),rememberInput=document.querySelector('#rememberLogin');

const normalizeEmail=value=>{const login=String(value||'').trim().toLowerCase();return login.includes('@')?login:`${login}@gmail.com`};
const ensureAdmin=async user=>{if(ADMIN_EMAILS.has(user?.email?.toLowerCase()||''))return user;await signOut(auth);const error=new Error('관리자로 등록된 계정이 아닙니다.');error.code='auth/not-admin';throw error};
const authErrorMessage=error=>{if(error.code==='auth/not-admin')return'관리자로 등록된 계정이 아닙니다.';if(error.code==='auth/unauthorized-domain')return'현재 주소가 Firebase 승인 도메인에 등록되지 않았습니다.';if(error.code==='auth/popup-blocked')return'브라우저에서 로그인 팝업을 허용해 주세요.';if(error.code==='auth/popup-closed-by-user')return'Google 로그인 창이 닫혔습니다.';if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/invalid-login-credentials'].includes(error.code))return'아이디 또는 비밀번호가 올바르지 않습니다.';if(error.code==='auth/operation-not-allowed')return'Firebase Authentication에서 해당 로그인 방식을 활성화해 주세요.';if(error.code==='auth/too-many-requests')return'로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';return`로그인에 실패했습니다. (${error.code||'unknown'})`};
window.nyachoFirebasePasswordLogin=async(id,password,remember)=>{const email=normalizeEmail(id);if(!id||!password)throw new Error('아이디와 비밀번호를 입력해 주세요.');localStorage.setItem('nyacho-auth-remember',String(remember));try{await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);const result=await signInWithEmailAndPassword(auth,email,password);await ensureAdmin(result.user);return result.user}catch(error){const wrapped=new Error(authErrorMessage(error));wrapped.code=error.code;throw wrapped}};
window.nyachoFirebaseSignOut=()=>signOut(auth).catch(()=>{});
window.nyachoGetFirebaseToken=()=>auth.currentUser?.getIdToken(false)||Promise.resolve('');
// Store all site data as JSON text.  Firestore then only receives primitive fields,
// which prevents invalid-argument errors caused by undefined or browser-only values.
const encodeFirestoreValue=value=>JSON.stringify(value,(_key,item)=>{
  if(item===undefined||typeof item==='function'||typeof item==='symbol')return null;
  if(typeof item==='bigint')return String(item);
  return item;
});
const decodeFirestoreValue=value=>{
  if(typeof value!=='string')return value;
  try{return JSON.parse(value)}catch{return value}
};
window.nyachoFirebaseSave=async(name,value)=>{const user=auth.currentUser;if(!ADMIN_EMAILS.has(user?.email?.toLowerCase()||'')){console.warn('Firestore save skipped: no authenticated administrator');alert('Firebase 관리자 로그인 후 다시 저장해 주세요.');return false}try{const payload=encodeFirestoreValue(value);if(payload===undefined)throw new Error('저장할 데이터가 없습니다.');const target=doc(db,'siteData',name);await setDoc(target,{payload,updatedAt:Date.now(),updatedBy:user.email});return true}catch(error){const code=String(error?.code||'unknown').replace(/^firestore\//,'');console.warn('Firestore save failed',code,error);const message=code==='permission-denied'?'Firestore 보안 규칙에서 저장이 허용되지 않았습니다. siteData 쓰기 권한을 관리자 이메일에 허용해 주세요.':`Firebase 저장에 실패했습니다. 오류 코드: ${code}`;alert(message);return false}};

// 일정 문서: 일정이 저장될 때마다 scheduleDocs 컬렉션에 "문서 제목 = 날짜"로 동기화합니다.
// 일정은 이 컬렉션에서만 읽고 씁니다. 보기용 필드(일정제목, 날짜, 시간, 유형, 참여멤버, 상세내용)와
// 불러오기용 필드(eventId, typeId, timeValue, membersRaw, startDate, endDate, order)를 함께 저장합니다.
const SCHEDULE_DOC_FIELDS=['일정제목','날짜','시간','유형','참여멤버','상세내용','eventId','typeId','timeValue','membersRaw','startDate','endDate','order'];
let scheduleDocsQueue=Promise.resolve();
window.nyachoFirebaseSyncScheduleDocs=docs=>{scheduleDocsQueue=scheduleDocsQueue.then(async()=>{const user=auth.currentUser;if(!ADMIN_EMAILS.has(user?.email?.toLowerCase()||''))return false;try{const existing=await getDocs(collection(db,'scheduleDocs')),current=new Map();existing.forEach(item=>current.set(item.id,item.data()));const ops=[];Object.entries(docs||{}).forEach(([id,fields])=>{const old=current.get(id);if(!old||SCHEDULE_DOC_FIELDS.some(name=>old[name]!==fields[name]))ops.push(batch=>batch.set(doc(db,'scheduleDocs',id),fields))});current.forEach((_data,id)=>{if(!(id in (docs||{})))ops.push(batch=>batch.delete(doc(db,'scheduleDocs',id)))});for(let i=0;i<ops.length;i+=400){const batch=writeBatch(db);ops.slice(i,i+400).forEach(op=>op(batch));await batch.commit()}return true}catch(error){const code=String(error?.code||'unknown').replace(/^firestore\//,'');console.warn('Firestore scheduleDocs sync failed',code,error);if(code==='permission-denied')alert('Firestore 보안 규칙에서 scheduleDocs 쓰기가 허용되지 않았습니다. scheduleDocs 컬렉션 쓰기 권한을 관리자 이메일에 허용해 주세요.');return false}});return scheduleDocsQueue};

const snapshotValue=snapshot=>{const data=snapshot.data()||{};return decodeFirestoreValue(data.payload??data.value)};
// 메모: 모두 읽을 수 있고(siteData/memo 구독), 쓰기는 관리자만 가능합니다.
let memoUnsubscribe=null;
const startMemoSync=()=>{if(memoUnsubscribe)return;memoUnsubscribe=onSnapshot(doc(db,'siteData','memo'),snapshot=>{if(!snapshot.exists())return;window.dispatchEvent(new CustomEvent('nyachoMemoRemote',{detail:snapshotValue(snapshot)}))},error=>{console.warn('Firestore memo sync failed',error);memoUnsubscribe=null})};
startMemoSync();
// 일정 불러오기: scheduleDocs 컬렉션만 구독합니다.
const isAdminUser=()=>ADMIN_EMAILS.has(auth.currentUser?.email?.toLowerCase()||'');
let scheduleDocsLoaded=false,hasNewScheduleDocs=false,legacyChecked=false;
const migrateLegacySchedules=async()=>{
  // scheduleDocs에 새 형식 문서가 하나도 없을 때, 관리자 로그인 상태에서 딱 한 번 예전 events/calendar를 옮겨 담습니다.
  if(legacyChecked||!scheduleDocsLoaded||hasNewScheduleDocs||!isAdminUser())return;
  legacyChecked=true;
  try{const snap=await getDoc(doc(db,'events','calendar'));if(!snap.exists())return;const legacy=snapshotValue(snap);if(legacy&&typeof legacy==='object'&&Object.keys(legacy).length)window.nyachoImportLegacySchedules?.(legacy)}catch(error){console.warn('Legacy schedule migration skipped',error)}
};
const dateRangeKeys=(start,end)=>{if(!start||!end||start>end)return[];const dates=[],last=new Date(`${end}T00:00:00Z`);for(let cursor=new Date(`${start}T00:00:00Z`);cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+1))dates.push(cursor.toISOString().slice(0,10));return dates};
// eventId 등 불러오기용 필드가 없는 문서(예: 콘솔에서 직접 만든 문서)도 한글 필드(날짜/시간/유형/참여멤버)로 복원합니다.
const DEFAULT_TYPE_IDS={'개인':'personal','합방':'work','휴방':'live'};
const timeTextToValue=text=>{const match=String(text||'').match(/^(오전|오후)?\s*(\d{1,2}):(\d{2})$/);if(!match)return'';let hour=Number(match[2]);if(match[1]==='오후')hour=hour%12+12;else if(match[1]==='오전')hour%=12;return`${String(hour).padStart(2,'0')}:${match[3]}`};
const normalizeScheduleDoc=(id,data)=>{const dates=String(data['날짜']||'').match(/\d{4}-\d{2}-\d{2}/g)||[],idDate=(id.match(/^\d{4}-\d{2}-\d{2}/)||[])[0]||'',start=data.startDate||dates[0]||idDate,end=data.endDate||dates[1]||start;if(!start)return null;const label=data['유형'];return{...data,eventId:data.eventId||id,startDate:start,endDate:end,typeId:data.typeId||window.nyachoTypeIdFromLabel?.(label)||DEFAULT_TYPE_IDS[label]||label||'personal',timeValue:data.timeValue??timeTextToValue(data['시간']),membersRaw:data.membersRaw??(data['참여멤버']||''),order:data.order||0}};
const scheduleDocsToMap=items=>{const map={};items.map(item=>normalizeScheduleDoc(item.id,item.data())).filter(Boolean).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.order-b.order||String(a.eventId).localeCompare(String(b.eventId))).forEach(data=>{const event=[data['일정제목']||'',data.typeId,data.timeValue,data['상세내용']||'',data.membersRaw,data.startDate,data.endDate,data.eventId];dateRangeKeys(data.startDate,data.endDate).forEach(date=>{(map[date]=map[date]||[]).push([...event])})});return map};
onSnapshot(collection(db,'scheduleDocs'),snapshot=>{
  scheduleDocsLoaded=true;
  hasNewScheduleDocs=!snapshot.empty;
  // 예전 형식 문서만 남아 있는 동안(이전 전)에는 화면을 비우지 않고 이전 단계로 넘어갑니다.
  window.dispatchEvent(new CustomEvent('nyachoSchedulesRemote',{detail:scheduleDocsToMap(snapshot.docs)}));
  migrateLegacySchedules();
},error=>console.warn('Firestore scheduleDocs read failed',error));
onAuthStateChanged(auth,user=>{if(ADMIN_EMAILS.has(user?.email?.toLowerCase()||'')){const remember=localStorage.getItem('nyacho-auth-remember')==='true';window.nyachoSetAdmin?.(true,remember);startMemoSync();migrateLegacySchedules();deleteDoc(doc(db,'siteData','contents')).catch(()=>{})}else{window.nyachoSetAdmin?.(false,false);if(user)signOut(auth)}});
for(const [name,eventName]of[['requests','nyachoRequestsRemote'],['settings','nyachoSettingsRemote'],['memberGroups','nyachoMemberGroupsRemote'],['dayStatus','nyachoDayStatusRemote']]){onSnapshot(doc(db,'siteData',name),snapshot=>{if(!snapshot.exists())return;window.dispatchEvent(new CustomEvent(eventName,{detail:snapshotValue(snapshot)}))},error=>console.warn(`Firestore ${name} sync failed`,error))}