const NOTICE_BOARD='https://www.sooplive.com/station/natty09/board/122887767';
const LIVE_API='https://live.sooplive.co.kr/afreeca/player_live_api.php';
const OFFLINE_IMAGE='https://stimg.sooplive.com/NORMAL_BBS/0/28759400/64461790229649438.png';
const now=new Date();
const seoulParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
const part=t=>seoulParts.find(p=>p.type===t).value;
const TODAY_KEY=`${part('year')}-${part('month')}-${part('day')}`;
const grid=document.querySelector('#calendarGrid');
const title=document.querySelector('#monthTitle');
const manageDialog=document.querySelector('#manageDialog');
const manageList=document.querySelector('#manageList');
const loginDialog=document.querySelector('#loginDialog');
const loginBtn=document.querySelector('#adminLoginBtn');
const darkModeBtn=document.querySelector('#darkModeBtn');
const todaySchedule=document.querySelector('#todaySchedule');
const dayDialog=document.querySelector('#dayDialog');
const dayScheduleList=document.querySelector('#dayScheduleList');
const mobileWeekMedia=window.matchMedia('(max-width:640px)');
let view=new Date(Number(part('year')),Number(part('month'))-1,Number(part('day')));
let isAdmin=false;
let isDark=localStorage.getItem('nyacho-theme')==='dark';
let manageDate='';
const seed={};
let custom=JSON.parse(localStorage.getItem('nyacho-events')||'{}');
const key=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
// 예전 기본 색(노랑/하늘색/분홍)으로 저장된 일정 유형 색을 새 기본 색으로 옮깁니다. 직접 고른 다른 색은 그대로 둡니다.
window.nyachoMigrateSettings=settings=>{const LEGACY={personal:['#ffd83d','#ffc83d','#ffd84a','#ff6384'],work:['#a9d9f7'],live:['#ffb4cb']},NEXT={personal:'#ffb3c6',work:'#ffb89c',live:'#c9c4c5'};const fix=(id,color)=>LEGACY[id]&&LEGACY[id].includes(String(color||'').toLowerCase())?NEXT[id]:color;const next={...(settings||{})};['personal','work','live'].forEach(id=>{if(next[id+'Color'])next[id+'Color']=fix(id,next[id+'Color'])});if(Array.isArray(next.scheduleTypes))next.scheduleTypes=next.scheduleTypes.map(type=>({...type,color:fix(type.id,type.color)}));return next};
const savedSettings=(()=>{const raw=JSON.parse(localStorage.getItem('nyacho-settings')||'{}'),fixed=window.nyachoMigrateSettings(raw);if(JSON.stringify(raw)!==JSON.stringify(fixed))localStorage.setItem('nyacho-settings',JSON.stringify(fixed));return fixed})();
const scheduleTypes=Array.isArray(savedSettings.scheduleTypes)&&savedSettings.scheduleTypes.length?savedSettings.scheduleTypes:[{id:'personal',label:savedSettings.personalLabel||'개인',color:savedSettings.personalColor||'#ffb3c6'},{id:'work',label:savedSettings.workLabel||'합방',color:savedSettings.workColor||'#ffb89c'},{id:'live',label:savedSettings.liveLabel||'휴방',color:savedSettings.liveColor||'#c9c4c5'}];
const typeLabel=Object.fromEntries(scheduleTypes.map(type=>[type.id,type.label]));
const typeColor=Object.fromEntries(scheduleTypes.map(type=>[type.id,type.color]));
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const typeOptions=()=>scheduleTypes.map(type=>`<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('');
const formatTime=value=>{if(!value)return'';const [hour,minute]=value.split(':').map(Number),period=hour<12?'오전':'오후',displayHour=hour%12||12;return`${period} ${displayHour}:${String(minute).padStart(2,'0')}`};
const createId=()=>globalThis.crypto?.randomUUID?.()||`event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizeEvent=(event,date='')=>[event[0]||'',event[1]||'personal',event[2]||'',event[3]||'',event[4]||'',event[5]||date,event[6]||event[5]||date,event[7]||''];

function setAdmin(value){isAdmin=value;localStorage.removeItem('nyacho-admin');sessionStorage.removeItem('nyacho-admin');localStorage.removeItem('nyacho-admin-token');sessionStorage.removeItem('nyacho-admin-token');document.body.classList.toggle('admin-mode',value);loginBtn.classList.toggle('logged-in',value);loginBtn.title=value?'관리자 메뉴':'관리자 로그인';loginBtn.setAttribute('aria-label',loginBtn.title)}
function setDark(value){isDark=value;localStorage.setItem('nyacho-theme',value?'dark':'light');document.body.classList.toggle('dark-mode',value);document.querySelector('#siteFavicon').href=value?'nyacho-dark-logo.png':'nyacho-uploaded-logo.png';darkModeBtn.title=value?'라이트모드 켜기':'다크모드 켜기';darkModeBtn.setAttribute('aria-label',darkModeBtn.title)}
function buildScheduleDocs(){
  const seen=new Set(),list=[];
  Object.keys(custom).sort().forEach(date=>{(custom[date]||[]).forEach(event=>{
    const [name='',type='personal',time='',description='',members='',startDate='',endDate='',id='']=event;
    const start=startDate||date,end=endDate||start,eventId=id||`${start}-${name}-${time}`;
    if(seen.has(eventId))return;seen.add(eventId);
    const names=window.nyachoMemberNames?window.nyachoMemberNames(members):String(members).split(',').map(n=>n.trim()).filter(Boolean);
    list.push({start,fields:{'일정제목':name,'날짜':end>start?`${start} ~ ${end}`:start,'시간':formatTime(time),'유형':typeLabel[type]||type,'참여멤버':names.join(', '),'상세내용':description,eventId,typeId:type,timeValue:time,membersRaw:members,startDate:start,endDate:end}});
  })});
  const count={},docs={};
  list.forEach(({start,fields})=>{count[start]=(count[start]||0)+1;fields.order=count[start];docs[count[start]===1?start:`${start}-${count[start]}`]=fields});
  return docs;
}
/* 일정은 scheduleDocs 컬렉션에만 저장/로드합니다 (events 컬렉션 사용 안 함) */
function save(){localStorage.setItem('nyacho-events',JSON.stringify(custom));window.nyachoFirebaseSyncScheduleDocs?.(buildScheduleDocs())}
/* 최초 1회: 예전 events/calendar 데이터를 scheduleDocs로 옮깁니다 (관리자 로그인 시 자동 실행) */
window.nyachoImportLegacySchedules=data=>{const migrated={};Object.keys(data||{}).forEach(date=>{migrated[date]=(data[date]||[]).map(event=>{const normalized=normalizeEvent(event,date);if(!normalized[7])normalized[7]=createId();return normalized})});custom=migrated;localStorage.setItem('nyacho-events',JSON.stringify(custom));window.nyachoFirebaseSyncScheduleDocs?.(buildScheduleDocs());render()};
function dateRange(start,end){if(!start||!end||start>end)return[];const dates=[];let cursor=new Date(`${start}T00:00:00Z`),last=new Date(`${end}T00:00:00Z`);while(cursor<=last){dates.push(cursor.toISOString().slice(0,10));cursor.setUTCDate(cursor.getUTCDate()+1)}return dates}
function timePickerMarkup(){return`<div class="manual-time-picker" data-period="am"><div class="period-buttons"><button type="button" class="period-button active" data-period="am">오전</button><button type="button" class="period-button" data-period="pm">오후</button></div><div class="time-number-fields"><input class="manage-hour" type="number" inputmode="numeric" min="1" max="12" placeholder="시" aria-label="시"><span>:</span><input class="manage-minute" type="number" inputmode="numeric" min="0" max="59" placeholder="분" aria-label="분"></div></div>`}
function setPickerTime(item,value){const picker=item.querySelector('.manual-time-picker'),hourInput=item.querySelector('.manage-hour'),minuteInput=item.querySelector('.manage-minute');let period='am';if(value){const [hour,minute]=value.split(':').map(Number);period=hour>=12?'pm':'am';hourInput.value=hour%12||12;minuteInput.value=String(minute).padStart(2,'0')}picker.dataset.period=period;picker.querySelectorAll('.period-button').forEach(button=>button.classList.toggle('active',button.dataset.period===period))}
function readPickerTime(item){const hourValue=item.querySelector('.manage-hour').value.trim(),minuteValue=item.querySelector('.manage-minute').value.trim();if(!hourValue&&!minuteValue)return'';const hour=Number(hourValue),minute=minuteValue===''?0:Number(minuteValue);if(!Number.isInteger(hour)||hour<1||hour>12){item.querySelector('.manage-hour').focus();return null}if(!Number.isInteger(minute)||minute<0||minute>59){item.querySelector('.manage-minute').focus();return null}const period=item.querySelector('.manual-time-picker').dataset.period;const hour24=period==='pm'?(hour%12)+12:hour%12;return`${String(hour24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`}
function addEventToRange(event){dateRange(event[5],event[6]).forEach(date=>{custom[date]=custom[date]||[];custom[date].push([...event])})}
function removeEventOccurrences(event,date,index){const id=event?.[7];if(id){Object.keys(custom).forEach(dateKey=>{custom[dateKey]=custom[dateKey].filter(item=>item[7]!==id);if(!custom[dateKey].length)delete custom[dateKey]})}else if(custom[date]?.[index]){custom[date].splice(index,1);if(!custom[date].length)delete custom[date]}}
function updateEventOccurrences(oldEvent,updated,date,index){const id=oldEvent?.[7],positions={};if(id)Object.keys(custom).forEach(dateKey=>{const oldIndex=custom[dateKey].findIndex(item=>item[7]===id);if(oldIndex>=0)positions[dateKey]=oldIndex});else positions[date]=index;removeEventOccurrences(oldEvent,date,index);dateRange(updated[5],updated[6]).forEach(dateKey=>{custom[dateKey]=custom[dateKey]||[];const savedIndex=positions[dateKey],insertIndex=savedIndex===undefined?custom[dateKey].length:Math.min(savedIndex,custom[dateKey].length);custom[dateKey].splice(insertIndex,0,[...updated])})}

function renderToday(){
  const events=[...(seed[TODAY_KEY]||[]),...(custom[TODAY_KEY]||[])];
  document.querySelector('#todayDate').textContent=`${part('month')}.${part('day')}`;
  todaySchedule.innerHTML='';
  if(!events.length){todaySchedule.classList.add('empty-schedule');todaySchedule.innerHTML='<span>🍑</span><p>등록된 오늘 일정이 없습니다.</p>';return}
  todaySchedule.classList.remove('empty-schedule');
  events.forEach(([name,type,time,description='',members='',startDate='',endDate=''])=>{
    const item=document.createElement('article');item.className=`today-event ${type}`;
    item.innerHTML=`<div class="today-event-copy"><h3></h3>${description?'<p class="today-event-description"></p>':''}${members?'<div class="today-event-member-profiles"></div>':''}</div>${time?`<time>${formatTime(time)}</time>`:''}`;
    item.style.backgroundColor=typeColor[type]||'#ffb3c6';item.querySelector('h3').textContent=name;
    if(description)item.querySelector('.today-event-description').textContent=description;
    if(members){const output=item.querySelector('.today-event-member-profiles');const names=(window.nyachoMemberNames?window.nyachoMemberNames(members):String(members).split(',').map(n=>n.trim()).filter(Boolean)).filter(n=>String(n).trim()!=='냐쵸');output.className='today-event-member-text';output.textContent=names.length?`w. ${names.join(', ')}`:''}
    item.onclick=()=>openDay(TODAY_KEY);
    todaySchedule.append(item);
  });
}

function showDetail(date){openDay(date)}

function editorFieldsMarkup(isNew=false){return`<div class="manage-fields"><label>일정 이름<textarea class="manage-name" rows="2" placeholder="무슨 일정인가요? (Enter로 줄바꿈)" required></textarea></label><label>시작 날짜<input class="manage-start-date" type="date" required></label><label>종료 날짜<input class="manage-end-date" type="date" required></label><label class="manage-time-label">시간 (선택)${timePickerMarkup()}</label><label class="manage-type-label">유형<select class="manage-type">${typeOptions()}</select></label><label class="manage-members-label">참여 멤버 (선택)<input class="manage-members" type="text" placeholder="멤버 이름을 입력하세요"></label><label class="manage-description-label">상세 내용 (선택)<textarea class="manage-description" rows="4" placeholder="일정에 대한 상세 내용을 입력하세요"></textarea></label><div class="manage-actions ${isNew?'manage-new-actions':''}"><button type="button" data-action="${isNew?'cancel-new':'cancel-edit'}">취소</button><button type="button" data-action="${isNew?'create':'update'}">저장</button></div></div>`}
function fillEditor(item,event,date){const [name='',type='personal',time='',description='',members='',startDate='',endDate='']=event;item.querySelector('.manage-name').value=name;item.querySelector('.manage-type').value=type;item.querySelector('.manage-description').value=description;item.querySelector('.manage-members').value=members;item.querySelector('.manage-start-date').value=startDate||date;item.querySelector('.manage-end-date').value=endDate||startDate||date;setPickerTime(item,time)}
function readEditor(item,id=createId()){const name=item.querySelector('.manage-name').value.trim(),startDate=item.querySelector('.manage-start-date').value,endDate=item.querySelector('.manage-end-date').value,time=readPickerTime(item);if(!name){item.querySelector('.manage-name').focus();return null}if(!startDate){item.querySelector('.manage-start-date').focus();return null}if(!endDate||endDate<startDate){item.querySelector('.manage-end-date').focus();return null}if(time===null)return null;return[name,item.querySelector('.manage-type').value,time,item.querySelector('.manage-description').value.trim(),item.querySelector('.manage-members').value.trim(),startDate,endDate,id]}
function renderManager(){
  document.querySelector('#manageDate').textContent=manageDate;document.querySelector('#manageFooter').hidden=false;document.querySelector('#manageAdd').hidden=false;manageList.innerHTML='';const events=custom[manageDate]||[];
  if(!events.length){showNewScheduleEditor();return}
  events.forEach((event,index)=>{const row=document.createElement('div');row.className='manage-simple-row';row.dataset.index=index;row.innerHTML='<span class="manage-simple-title"></span><span class="manage-simple-time"></span><span class="manage-order-buttons"><button type="button" data-action="move-up" aria-label="위로 이동">▲</button><button type="button" data-action="move-down" aria-label="아래로 이동">▼</button></span><button type="button" data-action="edit-simple">수정</button><button type="button" class="danger" data-action="delete-simple">삭제</button>';row.querySelector('.manage-simple-title').textContent=event[0];row.querySelector('.manage-simple-time').textContent=formatTime(event[2]);row.querySelector('[data-action="move-up"]').disabled=index===0;row.querySelector('[data-action="move-down"]').disabled=index===events.length-1;manageList.append(row)});
}
function showNewScheduleEditor(){document.querySelector('#manageFooter').hidden=true;manageList.innerHTML='';const item=document.createElement('div');item.className='manage-item manage-new';item.innerHTML=editorFieldsMarkup(true);fillEditor(item,['',scheduleTypes[0]?.id||'personal','','','',manageDate,manageDate,''],manageDate);manageList.append(item);item.querySelector('.manage-name').focus()}
function showScheduleEditor(index){const event=custom[manageDate]?.[index];if(!event)return;document.querySelector('#manageFooter').hidden=true;manageList.innerHTML='';const item=document.createElement('div');item.className='manage-item manage-edit';item.dataset.index=index;item.innerHTML=editorFieldsMarkup(false);fillEditor(item,event,manageDate);manageList.append(item);item.querySelector('.manage-name').focus()}
function openManager(date){if(!isAdmin)return;manageDate=date;if(!manageDialog.open)manageDialog.showModal();renderManager()}
function openDay(date){const events=[...(seed[date]||[]),...(custom[date]||[])],dateParts=date.split('-').map(Number);document.querySelector('#dayDialogTitle').textContent=`${dateParts[1]}월 ${dateParts[2]}일 일정`;dayScheduleList.innerHTML='';if(!events.length){dayScheduleList.innerHTML='<p class="day-empty">등록된 일정이 없습니다.</p>'}else events.forEach(raw=>{const [name,type,time,description,members]=normalizeEvent(raw,date),item=document.createElement('article');item.className='day-schedule-card';item.innerHTML=`<div class="day-card-main"><div class="day-card-title-row"><i class="day-type-dot" aria-hidden="true"></i><h3></h3></div>${description?'<p class="day-card-description"></p>':''}${members?'<div class="day-card-member-profiles"></div>':''}</div>${time?`<time>${formatTime(time)}</time>`:''}`;item.querySelector('.day-type-dot').style.backgroundColor=typeColor[type]||'#ffb3c6';item.querySelector('h3').textContent=name;if(description)item.querySelector('.day-card-description').textContent=description;if(members){const output=item.querySelector('.day-card-member-profiles');if(window.nyachoRenderMemberProfiles)window.nyachoRenderMemberProfiles(output,members);else output.textContent=members}dayScheduleList.append(item)});if(!dayDialog.open)dayDialog.showModal()}

function render(){
  const y=view.getFullYear(),m=view.getMonth(),weekly=mobileWeekMedia.matches;title.textContent=`${m+1}월`;grid.innerHTML='';grid.classList.toggle('weekly-grid',weekly);
  const dates=[];
  if(weekly){const start=new Date(y,m,view.getDate()-view.getDay());for(let i=0;i<7;i++)dates.push(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i))}
  else{const first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate(),prevLast=new Date(y,m,0).getDate(),totalCells=Math.max(35,Math.ceil((first+last)/7)*7);for(let i=0;i<totalCells;i++){let d,month=m;if(i<first){d=prevLast-first+i+1;month=m-1}else if(i>=first+last){d=i-first-last+1;month=m+1}else d=i-first+1;dates.push(new Date(y,month,d))}}
  if(weekly){const firstDate=dates[0],lastDate=dates[6];title.textContent=firstDate.getMonth()===lastDate.getMonth()?`${firstDate.getMonth()+1}월 ${firstDate.getDate()} - ${lastDate.getDate()}`:`${firstDate.getMonth()+1}월 ${firstDate.getDate()} - ${lastDate.getMonth()+1}월 ${lastDate.getDate()}`}
  dates.forEach(actual=>{
    const d=actual.getDate(),muted=actual.getMonth()!==m,dateKey=key(actual.getFullYear(),actual.getMonth(),d),cell=document.createElement('div'),weekday=['일','월','화','수','목','금','토'][actual.getDay()];cell.className='day'+(muted?' muted':'')+(dateKey===TODAY_KEY?' today':'');cell.dataset.date=dateKey;cell.innerHTML=weekly?`<div class="week-date week-day-${actual.getDay()}"><span class="number">${d}</span><span class="mobile-weekday">${weekday}</span></div><div class="events"></div>`:`<span class="number">${d}</span><div class="events"></div>`;
    const all=muted&&!weekly?[]:[...(seed[dateKey]||[]).map(event=>[...normalizeEvent(event,dateKey),false,null]),...(custom[dateKey]||[]).map((event,index)=>[...normalizeEvent(event,dateKey),true,index])];
    all.forEach(event=>{const [name,type,time,description='',members='',startDate='',endDate='',id='',own,eventIndex]=event;const el=document.createElement('div');el.className=`event ${type}${own?' custom':''}`;if(own){el.draggable=true;el.dataset.date=dateKey;el.dataset.index=eventIndex}el.innerHTML=`<span class="event-title"></span>${time?'<span class="event-time"></span>':''}`;el.style.backgroundColor=typeColor[type]||'#ffb3c6';el.querySelector('.event-title').textContent=name;if(time)el.querySelector('.event-time').textContent=formatTime(time);el.title='좌클릭: 이 날짜의 전체 일정'+(isAdmin&&own?' · 우클릭: 일정 관리 · 드래그: 날짜/순서 이동':'');el.onclick=clickEvent=>{clickEvent.stopPropagation();openDay(dateKey)};el.oncontextmenu=contextEvent=>{if(!own||!isAdmin)return;contextEvent.preventDefault();contextEvent.stopPropagation();openManager(dateKey)};cell.querySelector('.events').append(el)});
    cell.onclick=()=>openDay(dateKey);cell.oncontextmenu=contextEvent=>{if(!isAdmin)return;contextEvent.preventDefault();openManager(dateKey)};cell.querySelector('.number').classList.add('date-button');cell.querySelector('.number').onclick=clickEvent=>{clickEvent.stopPropagation();openDay(dateKey)};grid.append(cell);
  });
  renderToday();
}

/* ---- 월간 일정 드래그 앤 드롭 (관리자): 다른 날짜로 이동 + 같은 날 순서 변경 ---- */
let dragInfo=null;
const clearDropMarks=()=>grid.querySelectorAll('.drag-over,.drop-before,.drop-after,.dragging').forEach(el=>el.classList.remove('drag-over','drop-before','drop-after','dragging'));
const shiftDateKey=(dateKey,days)=>{const d=new Date(`${dateKey}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const daysBetween=(from,to)=>Math.round((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000);
const dropIsAfter=(event,target)=>{const rect=target.getBoundingClientRect();return event.clientY>rect.top+rect.height/2};
function moveEvent(fromDate,fromIndex,toDate,targetRef,after){
  const list=custom[fromDate],moving=list?.[fromIndex];if(!moving)return false;
  const movingId=moving[7];
  const insertAt=arr=>{let at=arr.length;if(targetRef&&targetRef!==moving&&!(movingId&&targetRef[7]===movingId)){const i=arr.indexOf(targetRef);if(i>=0)at=i+(after?1:0)}return at};
  if(fromDate===toDate){
    if(targetRef===moving)return false;
    list.splice(fromIndex,1);
    list.splice(insertAt(list),0,moving);
    return list.indexOf(moving)!==fromIndex;
  }
  // 여러 날 일정은 드래그한 날짜가 옮겨진 만큼 전체 기간을 같이 이동합니다.
  const delta=daysBetween(fromDate,toDate),start=shiftDateKey(moving[5]||fromDate,delta),end=shiftDateKey(moving[6]||moving[5]||fromDate,delta);
  const updated=[...moving];updated[5]=start;updated[6]=end;if(!updated[7])updated[7]=createId();
  removeEventOccurrences(moving,fromDate,fromIndex);
  dateRange(start,end).forEach(date=>{const arr=custom[date]=custom[date]||[];if(date===toDate)arr.splice(insertAt(arr),0,[...updated]);else arr.push([...updated])});
  return true;
}
grid.addEventListener('dragstart',event=>{
  const el=event.target.closest?.('.event.custom');if(!el)return;
  if(!isAdmin){event.preventDefault();return}
  dragInfo={date:el.dataset.date,index:Number(el.dataset.index)};
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',el.textContent);
  requestAnimationFrame(()=>el.classList.add('dragging'));
});
grid.addEventListener('dragover',event=>{
  if(!dragInfo)return;const cell=event.target.closest('.day');if(!cell)return;
  event.preventDefault();event.dataTransfer.dropEffect='move';
  grid.querySelectorAll('.drag-over,.drop-before,.drop-after').forEach(el=>el.classList.remove('drag-over','drop-before','drop-after'));
  cell.classList.add('drag-over');
  const target=event.target.closest('.event.custom');
  if(target&&!target.classList.contains('dragging'))target.classList.add(dropIsAfter(event,target)?'drop-after':'drop-before');
});
grid.addEventListener('dragleave',event=>{if(!grid.contains(event.relatedTarget))grid.querySelectorAll('.drag-over,.drop-before,.drop-after').forEach(el=>el.classList.remove('drag-over','drop-before','drop-after'))});
grid.addEventListener('drop',event=>{
  if(!dragInfo)return;const cell=event.target.closest('.day');if(!cell)return;
  event.preventDefault();const info=dragInfo;dragInfo=null;
  const targetEl=event.target.closest('.event.custom');let targetRef=null,after=false;
  if(targetEl){targetRef=custom[targetEl.dataset.date]?.[Number(targetEl.dataset.index)]||null;after=dropIsAfter(event,targetEl)}
  if(isAdmin&&moveEvent(info.date,info.index,cell.dataset.date,targetRef,after))save();
  render();
});
grid.addEventListener('dragend',()=>{dragInfo=null;clearDropMarks()});

function noticeRelativeTime(value){if(!value)return'';const parsed=new Date(String(value).replace(' ','T')+'+09:00');if(Number.isNaN(parsed.getTime()))return'';const minutes=Math.max(0,Math.floor((Date.now()-parsed.getTime())/60000));if(minutes<1)return'방금 전';if(minutes<60)return`${minutes}분 전`;const hours=Math.floor(minutes/60);if(hours<24)return`${hours}시간 전`;const days=Math.floor(hours/24);return days<30?`${days}일 전`:String(value).slice(0,10).replaceAll('-','.');}
function noticeMetric(icon,value,label){const span=document.createElement('span');span.className='notice-metric';span.setAttribute('aria-label',label);span.textContent=`${icon} ${Number(value||0).toLocaleString('ko-KR')}`;return span}
function createNoticeCard(item,boardUrl){const card=document.createElement('a');card.className='broadcast-notice-card';card.href=item.postUrl||boardUrl||NOTICE_BOARD;card.target='_blank';card.rel='noopener';const title=document.createElement('h4');title.textContent=item.title||'방송 공지';const excerpt=document.createElement('p');excerpt.textContent=item.excerpt||'';if(!item.excerpt)excerpt.hidden=true;const meta=document.createElement('div');meta.className='broadcast-notice-meta';meta.append(noticeMetric('♡',item.likeCount,'좋아요'),noticeMetric('▱',item.commentCount,'댓글'),noticeMetric('◉',item.viewCount,'조회수'));const time=document.createElement('span');time.className='notice-time';time.textContent=noticeRelativeTime(item.date);meta.append(time);card.append(time,title,excerpt,meta);return card}
async function loadTodayNotice(){const output=document.querySelector('#noticeContent');try{const response=await fetch('/api/soop-notice',{cache:'no-store'});if(!response.ok)throw new Error('notice request failed');const data=await response.json(),items=Array.isArray(data.notices)?data.notices:[];if(!items.length){output.innerHTML='<strong>등록 된 공지가 없습니다.</strong>';return}output.replaceChildren(...items.slice(0,2).map(item=>createNoticeCard(item,data.boardUrl)))}catch(error){output.innerHTML='<strong>등록 된 공지가 없습니다.</strong>'}}
function formatLiveDuration(seconds,startedAt){const elapsed=Number(seconds||0)*1000||Math.max(0,Date.now()-new Date(startedAt||0).getTime());if(!Number.isFinite(elapsed)||elapsed<=0)return'';const hours=Math.floor(elapsed/3600000),minutes=Math.floor(elapsed%3600000/60000);return hours?`${hours}시간 ${minutes}분째 방송 중`:`${minutes||1}분째 방송 중`}
async function loadBroadcastStatus(){const image=document.querySelector('#broadcastImage'),status=document.querySelector('#broadcastStatus'),card=document.querySelector('#liveCard'),info=document.querySelector('#broadcastLiveInfo');const showOffline=()=>{image.src=OFFLINE_IMAGE;image.alt='냐쵸 오프라인 이미지';status.className='broadcast-status offline';status.querySelector('b').textContent='OFFLINE';info.hidden=true;card.classList.remove('is-live')};try{const response=await fetch('/api/soop-live',{cache:'no-store'});if(!response.ok)throw new Error('live status failed');const data=await response.json();if(!data.live){showOffline();return}image.onerror=()=>{image.onerror=null;image.src=OFFLINE_IMAGE};image.src=data.thumbnail;image.alt=data.title?`냐쵸 라이브: ${data.title}`:'냐쵸 라이브 방송 썸네일';status.className='broadcast-status live';status.querySelector('b').textContent='LIVE';const title=info.querySelector('.broadcast-live-title'),duration=info.querySelector('.broadcast-live-duration');title.textContent=data.title||'냐쵸 라이브 방송';duration.textContent=formatLiveDuration(data.elapsedSeconds,data.startedAt)||'방송 중';info.hidden=false;card.classList.add('is-live')}catch(error){showOffline()}}

loginBtn.onclick=()=>{if(isAdmin){setAdmin(false);render()}else{document.querySelector('#adminId').value='';document.querySelector('#adminPassword').value='';document.querySelector('#rememberLogin').checked=localStorage.getItem('nyacho-auth-remember')==='true';document.querySelector('#loginError').textContent='';loginDialog.showModal()}};
darkModeBtn.onclick=()=>setDark(!isDark);
document.querySelector('#loginForm').onsubmit=async event=>{if(event.submitter?.value==='cancel')return;event.preventDefault();const id=document.querySelector('#adminId').value.trim(),password=document.querySelector('#adminPassword').value,remember=document.querySelector('#rememberLogin').checked,error=document.querySelector('#loginError'),submit=event.submitter;error.textContent='';submit.disabled=true;try{if(!window.nyachoFirebasePasswordLogin)throw new Error('Firebase 인증을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');await window.nyachoFirebasePasswordLogin(id,password,remember);loginDialog.close();render()}catch(loginError){error.textContent=loginError.message||'로그인에 실패했습니다.'}finally{submit.disabled=false}};
document.querySelector('#prevMonth').onclick=()=>{if(mobileWeekMedia.matches)view.setDate(view.getDate()-7);else{view.setDate(1);view.setMonth(view.getMonth()-1)}render()};
document.querySelector('#nextMonth').onclick=()=>{if(mobileWeekMedia.matches)view.setDate(view.getDate()+7);else{view.setDate(1);view.setMonth(view.getMonth()+1)}render()};
document.querySelector('#todayBtn').onclick=()=>{view=new Date(Number(part('year')),Number(part('month'))-1,Number(part('day')));render()};
mobileWeekMedia.addEventListener('change',render);
document.querySelector('#manageClose').onclick=()=>manageDialog.close();
document.querySelector('#dayClose').onclick=()=>dayDialog.close();
dayDialog.addEventListener('click',event=>{if(event.target!==dayDialog)return;const rect=dayDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dayDialog.close()});
document.querySelector('#manageAdd').onclick=showNewScheduleEditor;
document.querySelector('#manageSave').onclick=()=>{save();render();manageDialog.close()};
manageList.onclick=event=>{
  const periodButton=event.target.closest('.period-button');
  if(periodButton){const picker=periodButton.closest('.manual-time-picker');picker.dataset.period=periodButton.dataset.period;picker.querySelectorAll('.period-button').forEach(button=>button.classList.toggle('active',button===periodButton));return}
  const button=event.target.closest('[data-action]');if(!button||!isAdmin)return;
  const action=button.dataset.action;
  if(action==='edit-simple'){showScheduleEditor(Number(button.closest('.manage-simple-row').dataset.index));return}
  if(action==='delete-simple'){const index=Number(button.closest('.manage-simple-row').dataset.index),oldEvent=(custom[manageDate]||[])[index];removeEventOccurrences(oldEvent,manageDate,index);save();render();renderManager();return}
  if(action==='move-up'||action==='move-down'){const events=custom[manageDate]||[],index=Number(button.closest('.manage-simple-row').dataset.index),nextIndex=index+(action==='move-up'?-1:1);if(nextIndex<0||nextIndex>=events.length)return;[events[index],events[nextIndex]]=[events[nextIndex],events[index]];save();render();renderManager();return}
  const item=button.closest('.manage-item');
  if(action==='cancel-new'||action==='cancel-edit'){renderManager();return}
  if(action==='create'){const newEvent=readEditor(item);if(!newEvent)return;addEventToRange(newEvent);save();render();renderManager();return}
  const index=Number(item.dataset.index),events=custom[manageDate]||[],oldEvent=events[index];
  if(action==='update'){const updated=readEditor(item,oldEvent?.[7]||createId());if(!updated)return;updateEventOccurrences(oldEvent,updated,manageDate,index)}
  save();render();renderManager();
};

window.nyachoSetAdmin=setAdmin;window.nyachoTypeIdFromLabel=label=>scheduleTypes.find(type=>type.label===label)?.id;window.nyachoRenderToday=renderToday;window.addEventListener('nyachoSchedulesRemote',event=>{custom=event.detail||{};localStorage.setItem('nyacho-events',JSON.stringify(custom));render()});
const buildLegend=()=>{const legend=document.querySelector('.legend');legend.innerHTML='';scheduleTypes.forEach(type=>{const item=document.createElement('span'),dot=document.createElement('i');dot.className='dot';dot.style.backgroundColor=type.color;item.append(dot,document.createTextNode(type.label));legend.append(item)})};buildLegend();
// 설정에서 일정 유형(이름·색)을 바꾸면 새로고침 없이 달력·오늘 일정·범례에 바로 반영합니다.
window.nyachoUpdateScheduleTypes=types=>{if(!Array.isArray(types)||!types.length)return;scheduleTypes.splice(0,scheduleTypes.length,...types.map(type=>({...type})));Object.keys(typeColor).forEach(id=>delete typeColor[id]);Object.keys(typeLabel).forEach(id=>delete typeLabel[id]);scheduleTypes.forEach(type=>{typeColor[type.id]=type.color;typeLabel[type.id]=type.label});buildLegend();render();window.nyachoRenderToday?.()};
setAdmin(isAdmin,localStorage.getItem('nyacho-admin')==='true');setDark(isDark);render();loadTodayNotice();loadBroadcastStatus();setInterval(loadBroadcastStatus,60000);