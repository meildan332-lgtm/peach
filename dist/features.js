const defaultScheduleTypes=[{id:'personal',label:'개인',color:'#ffb3c6'},{id:'work',label:'합방',color:'#ffb89c'},{id:'live',label:'휴방',color:'#c9c4c5'}];
const defaultSettings={profileImage:'',personalLabel:'개인',personalColor:'#ffb3c6',workLabel:'합방',workColor:'#ffb89c',liveLabel:'휴방',liveColor:'#c9c4c5',scheduleTypes:defaultScheduleTypes};
const DEFAULT_ADMIN_AVATAR='https://stimg.sooplive.com/LOGO/na/natty09/natty09.jpg';
let featureSettings=window.nyachoMigrateSettings({...defaultSettings,...JSON.parse(localStorage.getItem('nyacho-settings')||'{}')});
if(!Array.isArray(featureSettings.scheduleTypes)||!featureSettings.scheduleTypes.length)featureSettings.scheduleTypes=[{id:'personal',label:featureSettings.personalLabel||'개인',color:featureSettings.personalColor||'#ffb3c6'},{id:'work',label:featureSettings.workLabel||'합방',color:featureSettings.workColor||'#ffb89c'},{id:'live',label:featureSettings.liveLabel||'휴방',color:featureSettings.liveColor||'#c9c4c5'}];
let contents=JSON.parse(localStorage.getItem('nyacho-contents')||'[]').map(item=>({...item,category:item.category==='별별'?'쿠폰':item.category}));
let requests=JSON.parse(localStorage.getItem('nyacho-requests')||'[]');
let activeCategory='쿠폰';
let contentSearch='';
let scheduleTypeDraft=[];
const adminButton=document.querySelector('#adminLoginBtn');
const originalAdminClick=adminButton.onclick;
const profileMenu=document.querySelector('#profileMenu');
const settingsDialog=document.querySelector('#settingsDialog');
const contentDialog=document.querySelector('#contentDialog');
const requestDialog=document.querySelector('#requestDialog');
const requestManageList=document.querySelector('#requestManageList');
const requestForm=document.querySelector('#requestForm');
const requestEditor=document.querySelector('.request-editor');

function ensureCouponGuideLayout(){const guide=document.querySelector('#couponGuideContent');if(!guide)return;let columns=guide.querySelector(':scope > .coupon-guide-columns');if(!columns){const rewardGrid=guide.querySelector('.coupon-reward-grid'),ranking=guide.querySelector('.ranking-reward');if(!rewardGrid||!ranking)return;columns=document.createElement('div');columns.className='coupon-guide-columns';const rewardSection=document.createElement('section'),title=document.createElement('h2');rewardSection.className='coupon-reward-section';title.textContent='쿠폰 보상 안내';guide.insertBefore(columns,rewardGrid);rewardSection.append(title,rewardGrid);columns.append(rewardSection,ranking)}else{const rewardSection=columns.querySelector('.coupon-reward-section');if(rewardSection&&!rewardSection.querySelector('h2')){const title=document.createElement('h2');title.textContent='쿠폰 보상 안내';rewardSection.prepend(title)}}const outfit=guide.querySelector('.outfit-guide');if(outfit&&outfit.parentElement!==columns)columns.append(outfit);outfit?.querySelectorAll('article').forEach(article=>{if(article.querySelector('ol'))return;const paragraph=article.querySelector('p');if(!paragraph)return;const items=paragraph.textContent.split('·').map(item=>item.trim()).filter(Boolean),list=document.createElement('ol');items.forEach(text=>{const item=document.createElement('li');item.textContent=text;list.append(item)});paragraph.replaceWith(list)})}
function applyFeatureSettings(){document.documentElement.style.setProperty('--type-personal',featureSettings.personalColor);document.documentElement.style.setProperty('--type-work',featureSettings.workColor);document.documentElement.style.setProperty('--type-live',featureSettings.liveColor);window.nyachoUpdateScheduleTypes?.(featureSettings.scheduleTypes);let image=adminButton.querySelector('.admin-avatar');if(!image){image=document.createElement('img');image.className='admin-avatar';image.alt='관리자 프로필';adminButton.append(image)}image.src=DEFAULT_ADMIN_AVATAR;const guide=document.querySelector('#couponGuideContent');if(guide&&featureSettings.couponGuideHtml)guide.innerHTML=featureSettings.couponGuideHtml;ensureCouponGuideLayout()}
function updateAdminProfile(){const loggedIn=adminButton.classList.contains('logged-in');adminButton.classList.toggle('has-avatar',loggedIn);const guide=document.querySelector('#couponGuideContent');if(guide)guide.contentEditable='false';document.querySelector('#guideSaveBtn').hidden=true;document.querySelector('#guideEditBtn').hidden=false;if(!loggedIn)profileMenu.hidden=true;renderContents()}
function positionProfileMenu(){const rect=adminButton.getBoundingClientRect(),width=profileMenu.offsetWidth||150;profileMenu.style.left=`${Math.max(10,Math.min(window.innerWidth-width-10,rect.right-width))}px`;profileMenu.style.top=`${rect.bottom+8}px`}
adminButton.onclick=()=>{if(!adminButton.classList.contains('logged-in')){originalAdminClick();return}profileMenu.hidden=!profileMenu.hidden;if(!profileMenu.hidden)positionProfileMenu()};
document.addEventListener('click',event=>{if(!profileMenu.contains(event.target)&&!adminButton.contains(event.target))profileMenu.hidden=true});
new MutationObserver(updateAdminProfile).observe(adminButton,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',()=>{if(!profileMenu.hidden)positionProfileMenu()});
document.querySelector('#adminLogout').onclick=async()=>{profileMenu.hidden=true;await window.nyachoFirebaseSignOut?.();originalAdminClick()};

const contentBoard=document.querySelector('#content-board'),calendarSection=document.querySelector('#calendar'),requestPanel=document.querySelector('.request-panel'),liveCard=document.querySelector('#liveCard'),todayCard=document.querySelector('.today-card'),noticeBlock=document.querySelector('.notice-block'),heroGrid=document.querySelector('#today'),heroLeftStack=document.createElement('div'),heroRightStack=document.createElement('div'),noticeCard=document.createElement('aside');heroLeftStack.className='hero-left-stack';heroRightStack.className='hero-right-stack';noticeCard.className='notice-card';heroGrid.insertBefore(heroLeftStack,liveCard);heroLeftStack.append(liveCard,requestPanel);heroRightStack.append(todayCard,noticeCard);noticeCard.append(noticeBlock);heroGrid.append(heroRightStack);calendarSection.after(contentBoard);
const VIEW_HASH={schedule:'#schedule',content:'#Backlog'};
const viewFromHash=()=>{const h=location.hash.replace('#','').toLowerCase();return h==='backlog'?'content':h==='schedule'?'schedule':null};
function setActiveView(view,{updateHash=true,scroll=true}={}){const isContent=view==='content';document.body.dataset.view=view;document.documentElement.dataset.view=view;try{sessionStorage.setItem('nyacho-view',view)}catch{}heroGrid.hidden=isContent;calendarSection.hidden=isContent;contentBoard.hidden=!isContent;document.querySelectorAll('.top-tabs a').forEach(link=>link.classList.toggle('active',link.dataset.view===view));if(updateHash&&viewFromHash()!==view)history.pushState(null,'',VIEW_HASH[view]);if(isContent)renderContents();if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.top-tabs [data-view]').forEach(tab=>tab.onclick=event=>{event.preventDefault();setActiveView(tab.dataset.view)});
window.addEventListener('hashchange',()=>setActiveView(viewFromHash()||'schedule',{updateHash:false}));
setActiveView(viewFromHash()||(()=>{try{return sessionStorage.getItem('nyacho-view')==='content'?'content':'schedule'}catch{return'schedule'}})(),{updateHash:false,scroll:false});if(!viewFromHash())history.replaceState(null,'',VIEW_HASH[document.body.dataset.view]);

function renderScheduleTypeSettings(){const list=document.querySelector('#scheduleTypeList');list.innerHTML='';scheduleTypeDraft.forEach((type,index)=>{const row=document.createElement('div');row.className='schedule-type-row';row.dataset.id=type.id;row.innerHTML='<input class="type-name-input" type="text" aria-label="일정 유형 이름"><input class="type-color-input" type="color" aria-label="일정 유형 색상"><button type="button" class="type-remove-btn" aria-label="일정 유형 삭제" title="삭제">×</button>';row.querySelector('.type-name-input').value=type.label;row.querySelector('.type-color-input').value=type.color;row.querySelector('.type-remove-btn').disabled=scheduleTypeDraft.length===1;row.querySelector('.type-remove-btn').onclick=()=>{scheduleTypeDraft.splice(index,1);renderScheduleTypeSettings()};list.append(row)})}
document.querySelector('#scheduleTypeAdd').onclick=()=>{scheduleTypeDraft.push({id:`type-${Date.now()}`,label:'새 유형',color:'#ffb3c6'});renderScheduleTypeSettings();document.querySelector('#scheduleTypeList .schedule-type-row:last-child .type-name-input')?.select()};
document.querySelector('#openSettings').onclick=()=>{profileMenu.hidden=true;document.querySelector('#profileImageUrl').value=featureSettings.profileImage;scheduleTypeDraft=featureSettings.scheduleTypes.map(type=>({...type}));renderScheduleTypeSettings();settingsDialog.showModal()};
document.querySelector('#settingsForm').onsubmit=async event=>{if(event.submitter?.value==='cancel')return;event.preventDefault();const scheduleTypes=[...document.querySelectorAll('.schedule-type-row')].map((row,index)=>({id:row.dataset.id||`type-${Date.now()}-${index}`,label:row.querySelector('.type-name-input').value.trim()||'일정',color:row.querySelector('.type-color-input').value}));const legacy=id=>scheduleTypes.find(type=>type.id===id);featureSettings={...featureSettings,profileImage:document.querySelector('#profileImageUrl').value.trim(),scheduleTypes,personalLabel:legacy('personal')?.label||'개인',personalColor:legacy('personal')?.color||'#ffb3c6',workLabel:legacy('work')?.label||'합방',workColor:legacy('work')?.color||'#ffb89c',liveLabel:legacy('live')?.label||'휴방',liveColor:legacy('live')?.color||'#c9c4c5'};localStorage.setItem('nyacho-settings',JSON.stringify(featureSettings));const submitButton=event.submitter||document.querySelector('#settingsForm button[type=submit]');if(submitButton)submitButton.disabled=true;const saved=window.nyachoFirebaseSave?await window.nyachoFirebaseSave('settings',featureSettings):true;if(submitButton)submitButton.disabled=false;applyFeatureSettings();settingsDialog.close();if(saved===false)return};

function saveContents(){localStorage.setItem('nyacho-contents',JSON.stringify(contents));window.nyachoFirebaseSave?.('contents',contents)}
function renderContentTable(category,body){const isAdmin=adminButton.classList.contains('logged-in'),query=contentSearch.trim().toLowerCase(),filtered=contents.filter(item=>item.category===category&&(!query||`${item.title} ${item.applicant}`.toLowerCase().includes(query)));body.innerHTML='';if(!filtered.length){const row=document.createElement('tr');row.innerHTML='<td colspan="3" class="content-empty">등록된 내용이 없습니다.</td>';body.append(row);return}filtered.forEach(item=>{const row=document.createElement('tr');row.innerHTML='<td class="content-name"></td><td class="content-applicant"></td><td class="content-actions admin-only"><button type="button" data-action="delete" aria-label="행 삭제" title="행 삭제">×</button></td>';row.dataset.id=item.id;for(const [selector,key]of[['.content-name','title'],['.content-applicant','applicant']]){const cell=row.querySelector(selector);cell.textContent=item[key]||'';if(isAdmin){cell.contentEditable='true';cell.dataset.field=key;cell.setAttribute('aria-label',key==='title'?'닉네임':'내용')}}body.append(row)})}
function renderContents(){document.querySelector('#couponGuide').hidden=false;renderContentTable('쿠폰',document.querySelector('#couponTableBody'));renderContentTable('업보',document.querySelector('#karmaTableBody'))}
document.querySelector('#contentSearch').oninput=event=>{contentSearch=event.target.value;renderContents()};
function setContentValueLabel(category){document.querySelector('#contentValueLabel').childNodes[0].textContent=category}
function openContentEditor(item=null){document.querySelector('#contentDialogTitle').textContent=item?'행 수정':'행 추가';document.querySelector('#contentEditId').value=item?.id||'';document.querySelector('#contentCategory').value=item?.category||activeCategory;document.querySelector('#contentTitle').value=item?.title||'';document.querySelector('#contentApplicant').value=item?.applicant||'';setContentValueLabel(document.querySelector('#contentCategory').value);contentDialog.showModal()}
document.querySelectorAll('.content-add-btn').forEach(button=>button.onclick=()=>{if(!adminButton.classList.contains('logged-in'))return;const category=button.dataset.category,entry={id:`content-${Date.now()}`,category,title:'',applicant:''};contents.push(entry);saveContents();renderContents();const row=document.querySelector(`.content-table-body tr[data-id="${entry.id}"]`);row?.classList.add('new-content-row');row?.querySelector('.content-name')?.focus()});
document.querySelector('#contentCategory').onchange=event=>setContentValueLabel(event.target.value);
document.querySelector('#contentForm').onsubmit=event=>{if(event.submitter?.value==='cancel')return;event.preventDefault();const id=document.querySelector('#contentEditId').value||`content-${Date.now()}`,entry={id,category:document.querySelector('#contentCategory').value,title:document.querySelector('#contentTitle').value.trim(),applicant:document.querySelector('#contentApplicant').value.trim()};const index=contents.findIndex(item=>item.id===id);if(index>=0)contents[index]=entry;else contents.push(entry);saveContents();contentDialog.close();renderContents()};
document.querySelectorAll('.content-table-body').forEach(body=>{body.addEventListener('focusout',event=>{const cell=event.target.closest('[contenteditable][data-field]');if(!cell||!adminButton.classList.contains('logged-in'))return;const item=contents.find(entry=>entry.id===cell.closest('tr').dataset.id);if(item){item[cell.dataset.field]=cell.textContent.trim();saveContents()}});body.onclick=event=>{const button=event.target.closest('[data-action]');if(!button||!adminButton.classList.contains('logged-in'))return;const id=button.closest('tr').dataset.id;if(button.dataset.action==='delete'){contents=contents.filter(entry=>entry.id!==id);saveContents();renderContents()}}});

document.querySelector('#guideEditBtn').onclick=()=>{if(!adminButton.classList.contains('logged-in'))return;const guide=document.querySelector('#couponGuideContent');guide.contentEditable='true';guide.focus();document.querySelector('#guideEditBtn').hidden=true;document.querySelector('#guideSaveBtn').hidden=false};
document.querySelector('#guideSaveBtn').onclick=()=>{const guide=document.querySelector('#couponGuideContent');featureSettings.couponGuideHtml=guide.innerHTML;localStorage.setItem('nyacho-settings',JSON.stringify(featureSettings));window.nyachoFirebaseSave?.('settings',featureSettings);guide.contentEditable='false';document.querySelector('#guideSaveBtn').hidden=true;document.querySelector('#guideEditBtn').hidden=false};

function todayKey(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=type=>parts.find(item=>item.type===type).value;return`${part('year')}-${part('month')}-${part('day')}`}
function saveRequests(){localStorage.setItem('nyacho-requests',JSON.stringify(requests));window.nyachoFirebaseSave?.('requests',requests)}
async function loadRequestComments(item,card){const container=card.querySelector('.request-comments');try{const response=await fetch(`/api/comment?url=${encodeURIComponent(item.commentLink)}`,{cache:'no-store'}),payload=await response.json();if(!response.ok)throw new Error(payload.error||'comment request failed');const comment=payload.comment;if(!comment)throw new Error('comment not found');card.querySelector('.request-post-title').textContent=payload.title||'신청 콘텐츠';container.innerHTML='<div class="request-comment-profile"><span class="request-comment-rank"></span><img alt=""><div><strong class="request-comment-author"></strong></div><span class="request-comment-likes" aria-label="좋아요 수"></span></div>';const profile=container.querySelector('.request-comment-profile img');profile.src=comment.profileImage||'https://stimg.sooplive.com/LOGO/na/natty09/natty09.jpg';profile.onerror=()=>{profile.src='https://stimg.sooplive.com/LOGO/na/natty09/natty09.jpg'};container.querySelector('.request-comment-author').textContent=comment.userNick||'익명';container.querySelector('.request-comment-rank').textContent=`${payload.rank}위`;container.querySelector('.request-comment-likes').textContent=`♥ ${Number(comment.likeCount||0).toLocaleString()}`}catch(error){container.innerHTML=`<p class="request-comment-empty">${error.message||'댓글을 불러오지 못했습니다.'}</p>`}}
function renderRequests(){const list=document.querySelector('#requestList'),today=todayKey(),visible=requests.filter(item=>item.deadline>=today);list.classList.toggle('has-multiple',visible.length>1);list.innerHTML='';if(!visible.length){list.innerHTML='<p class="request-empty">현재 신청한 콘텐츠가 없습니다.</p>';return}visible.forEach(item=>{const card=document.createElement('a');card.className='request-card';card.dataset.id=item.id;card.href=item.commentLink;card.target='_blank';card.rel='noopener';card.innerHTML='<div class="request-card-head"><div><strong class="request-post-title">게시글 제목을 불러오는 중…</strong></div><span class="request-card-actions"><span class="request-deadline"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg></span></div><div class="request-comments"><p class="request-comment-empty">댓글을 불러오는 중입니다…</p></div>';card.querySelector('.request-deadline').textContent=`마감 · ${item.deadline}`;list.append(card);loadRequestComments(item,card)})}
function hideRequestEditor(){requestEditor.hidden=true;requestForm.reset();document.querySelector('#requestEditId').value=''}
function showRequestEditor(item){requestEditor.hidden=false;document.querySelector('#requestEditId').value=item?.id||'';document.querySelector('#requestFormTitle').textContent=item?'신청 콘텐츠 수정':'신청 콘텐츠 추가';document.querySelector('#requestCommentLink').value=item?.commentLink||'';document.querySelector('#requestDeadline').value=item?.deadline||todayKey();requestEditor.scrollIntoView({behavior:'smooth',block:'nearest'})}
function renderRequestManager(){requestManageList.innerHTML='';if(!requests.length){requestManageList.innerHTML='<p class="request-manage-empty">등록된 신청 콘텐츠가 없습니다.</p>';return}requests.forEach(item=>{const card=document.createElement('article');card.className='request-manage-card';card.dataset.id=item.id;card.innerHTML='<div class="request-manage-card-copy"><strong>신청 콘텐츠</strong><a target="_blank" rel="noopener"></a><span></span></div><div class="request-manage-actions"><button type="button" data-action="edit-managed-request">수정</button><button type="button" class="danger" data-action="delete-managed-request">삭제</button></div>';const link=card.querySelector('a');link.href=item.commentLink;link.textContent=item.commentLink;card.querySelector('span').textContent=`마감 날짜 · ${item.deadline}`;requestManageList.append(card)})}
document.querySelector('#requestAddBtn').onclick=()=>{if(!adminButton.classList.contains('logged-in'))return;hideRequestEditor();renderRequestManager();requestDialog.showModal()};
document.querySelector('#requestCreateBtn').onclick=()=>showRequestEditor();
document.querySelector('#requestEditorCancel').onclick=hideRequestEditor;
document.querySelector('#requestManagerClose').onclick=()=>requestDialog.close();
requestForm.onsubmit=event=>{event.preventDefault();const commentLink=document.querySelector('#requestCommentLink').value.trim(),deadline=document.querySelector('#requestDeadline').value,id=document.querySelector('#requestEditId').value;if(!commentLink||!deadline)return;if(id){const index=requests.findIndex(item=>item.id===id);if(index>=0)requests[index]={...requests[index],commentLink,deadline}}else requests.push({id:`request-${Date.now()}`,commentLink,deadline});saveRequests();renderRequests();renderRequestManager();hideRequestEditor()};
requestManageList.onclick=event=>{const button=event.target.closest('[data-action]');if(!button||!adminButton.classList.contains('logged-in'))return;const id=button.closest('.request-manage-card')?.dataset.id,item=requests.find(request=>request.id===id);if(button.dataset.action==='edit-managed-request'&&item)showRequestEditor(item);if(button.dataset.action==='delete-managed-request'&&item&&confirm('이 신청 콘텐츠를 삭제할까요?')){requests=requests.filter(request=>request.id!==id);saveRequests();renderRequests();renderRequestManager();hideRequestEditor()}};
requestDialog.addEventListener('click',event=>{if(event.target===requestDialog)requestDialog.close()});
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();button.closest('dialog')?.close()}));
window.addEventListener('nyachoContentsRemote',event=>{contents=event.detail||[];localStorage.setItem('nyacho-contents',JSON.stringify(contents));renderContents()});window.addEventListener('nyachoRequestsRemote',event=>{requests=event.detail||[];localStorage.setItem('nyacho-requests',JSON.stringify(requests));renderRequests()});window.addEventListener('nyachoSettingsRemote',event=>{featureSettings=window.nyachoMigrateSettings({...defaultSettings,...event.detail});if(!Array.isArray(featureSettings.scheduleTypes)||!featureSettings.scheduleTypes.length)featureSettings.scheduleTypes=defaultScheduleTypes.map(type=>({...type}));localStorage.setItem('nyacho-settings',JSON.stringify(featureSettings));applyFeatureSettings()});
applyFeatureSettings();updateAdminProfile();renderContents();renderRequests();
/* ===== 메모 버튼 + 이동 가능한 메모지 팝업 (Firebase 연동) ===== */
(()=>{
  const controls=document.querySelector('.month-controls'),todayButton=document.querySelector('#todayBtn');
  if(!controls||document.querySelector('#memoBtn'))return;
  const MEMO_KEY='nyacho-memo',readMemo=()=>{try{return JSON.parse(localStorage.getItem(MEMO_KEY)||'{}')||{}}catch{return{}}};
  let memo=readMemo();
  const saveLocal=()=>{try{localStorage.setItem(MEMO_KEY,JSON.stringify(memo))}catch{}};
  const isAdminNow=()=>document.body.classList.contains('admin-mode');

  /* 오늘 버튼과 메모 버튼을 각각 따로 된 알약(pill)으로 분리 */
  const actions=document.createElement('div');actions.className='calendar-head-actions';
  controls.before(actions);actions.append(controls);
  const memoControls=document.createElement('div');memoControls.className='month-controls memo-controls';
  const button=document.createElement('button');button.id='memoBtn';button.type='button';button.textContent='메모';
  memoControls.append(button);actions.append(memoControls);

  const pad=document.createElement('section');pad.id='memoPad';pad.hidden=true;pad.setAttribute('aria-label','메모');
  pad.innerHTML='<header class="memo-pad-head"><span>메모</span><button type="button" class="memo-pad-close" aria-label="메모 닫기">×</button></header><textarea class="memo-pad-text" spellcheck="false" placeholder="여기에 메모하세요"></textarea>';
  document.body.append(pad);
  const head=pad.querySelector('.memo-pad-head'),text=pad.querySelector('.memo-pad-text'),closeButton=pad.querySelector('.memo-pad-close');
  text.value=memo.text||'';

  /* ---- Firebase 저장 (관리자만, 입력이 멈추면 0.8초 뒤 저장) ---- */
  let remoteTimer=null;
  const scheduleRemoteSave=()=>{
    if(!isAdminNow())return;
    clearTimeout(remoteTimer);
    remoteTimer=setTimeout(()=>{remoteTimer=null;window.nyachoFirebaseSave?.('memo',{text:memo.text||''})},800);
  };
  window.addEventListener('nyachoMemoRemote',event=>{
    const incoming=typeof event.detail?.text==='string'?event.detail.text:null;
    if(incoming===null||incoming===text.value)return;
    if(remoteTimer&&document.activeElement===text)return; /* 내가 입력 중이면 덮어쓰지 않음 */
    memo.text=incoming;text.value=incoming;saveLocal();
  });

  const clamp=(left,top)=>{const width=pad.offsetWidth,height=pad.offsetHeight;return[Math.min(Math.max(0,left),Math.max(0,innerWidth-width)),Math.min(Math.max(0,top),Math.max(0,innerHeight-Math.min(height,60)))]};
  const place=(left,top)=>{[left,top]=clamp(left,top);pad.style.left=`${left}px`;pad.style.top=`${top}px`;return[left,top]};
  const openPad=()=>{
    pad.hidden=false;
    if(memo.width)pad.style.width=`${Math.min(memo.width,innerWidth-8)}px`;
    if(memo.height)pad.style.height=`${Math.min(memo.height,innerHeight-8)}px`;
    const left=Number.isFinite(memo.left)?memo.left:Math.max(8,innerWidth-pad.offsetWidth-32),top=Number.isFinite(memo.top)?memo.top:100;
    place(left,top);button.classList.add('active');text.focus({preventScroll:true});
  };
  const closePad=()=>{pad.hidden=true;button.classList.remove('active')};
  button.onclick=()=>pad.hidden?openPad():closePad();
  closeButton.onclick=closePad;
  text.addEventListener('input',()=>{if(!isAdminNow())return;memo.text=text.value;saveLocal();scheduleRemoteSave()});
  /* 관리자만 수정 가능, 그 외에는 읽기 전용 */
  const syncEditable=()=>{const admin=isAdminNow();text.readOnly=!admin;pad.classList.toggle('readonly',!admin);text.placeholder=admin?'여기에 메모하세요':'메모가 비어 있습니다'};
  syncEditable();
  new MutationObserver(syncEditable).observe(document.body,{attributes:true,attributeFilter:['class']});

  /* ---- 빈 줄을 클릭하면 그 줄까지 자동으로 줄바꿈 ---- */
  const LINE_HEIGHT=32,PAD_TOP=6,PAD_BOTTOM=10;
  const visualLineCount=()=>{
    const prevHeight=text.style.height,prevFlex=text.style.flex;
    text.style.flex='none';text.style.height='0px';
    const contentHeight=text.scrollHeight-PAD_TOP-PAD_BOTTOM;
    text.style.height=prevHeight;text.style.flex=prevFlex;
    return Math.max(1,Math.round(contentHeight/LINE_HEIGHT));
  };
  text.addEventListener('click',event=>{
    if(!isAdminNow())return;
    if(text.selectionStart!==text.selectionEnd)return;
    if(event.offsetX>text.clientWidth)return; /* 스크롤바 클릭 제외 */
    const rect=text.getBoundingClientRect(),y=event.clientY-rect.top+text.scrollTop-PAD_TOP;
    if(y<0)return;
    const clickedLine=Math.floor(y/LINE_HEIGHT),lines=visualLineCount();
    if(clickedLine<lines)return;
    const extra=Math.min(200,clickedLine-lines+1);
    text.value+='\n'.repeat(extra);
    text.setSelectionRange(text.value.length,text.value.length);
    memo.text=text.value;saveLocal();scheduleRemoteSave();
  });

  let drag=null;
  head.addEventListener('pointerdown',event=>{if(event.target.closest('.memo-pad-close'))return;drag={x:event.clientX-pad.offsetLeft,y:event.clientY-pad.offsetTop,id:event.pointerId};head.setPointerCapture(event.pointerId);pad.classList.add('dragging')});
  head.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;place(event.clientX-drag.x,event.clientY-drag.y)});
  const endDrag=event=>{if(!drag)return;drag=null;pad.classList.remove('dragging');memo.left=pad.offsetLeft;memo.top=pad.offsetTop;saveLocal()};
  head.addEventListener('pointerup',endDrag);head.addEventListener('pointercancel',endDrag);
  if(window.ResizeObserver)new ResizeObserver(()=>{if(pad.hidden)return;memo.width=pad.offsetWidth;memo.height=pad.offsetHeight;saveLocal()}).observe(pad);
  addEventListener('resize',()=>{if(!pad.hidden)place(pad.offsetLeft,pad.offsetTop)});
})();