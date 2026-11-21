const API_URL='https://api-channel.sooplive.com/v1.3/channel/nslah830/board?bbsNo=114425409&perPage=20&page=1&orderBy=reg_date&field=title%2Ccontents%2Cuser_nick%2Cuser_id';
const BOARD_URL='https://www.sooplive.com/station/nslah830/board/114425409';
const clean=value=>String(value||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const rowDate=row=>String(row.regDate||row.reg_date||'');
const rowId=row=>row.titleNo??row.title_no??row.id;
// 일반 글(contents)뿐 아니라 응답 안의 다른 목록(고정 공지 등)도 함께 모읍니다.
const collectRows=payload=>{const seen=new Set(),rows=[];Object.values(payload||{}).forEach(value=>{if(!Array.isArray(value))return;value.forEach(row=>{const id=row&&typeof row==='object'?rowId(row):undefined;if(id===undefined||id===null||seen.has(String(id)))return;seen.add(String(id));rows.push(row)})});return rows};
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=180');
  try{
    const response=await fetch(API_URL,{headers:{accept:'application/json','user-agent':'Mozilla/5.0'}});
    if(!response.ok)throw new Error(`SOOP ${response.status}`);
    const payload=await response.json();
    if(payload?.code&&payload.code!=='SUCCESS')throw new Error(payload.message||payload.code);
    // 고정 공지 포함, 날짜 기준 가장 최신 1개
    const rows=collectRows(payload).sort((a,b)=>rowDate(b).localeCompare(rowDate(a))).slice(0,1);
    const notices=rows.map(row=>({
      title:clean(row.titleName||row.title||row.subject),
      excerpt:clean(row.content?.content||row.contents).slice(0,220),
      author:clean(row.userNick||row.user_nick||row.userId),
      profileImage:row.profileImage||null,
      date:row.regDate||row.reg_date||null,
      postUrl:`https://www.sooplive.com/station/nslah830/post/${rowId(row)}`
    }));
    res.status(200).json({notices,boardUrl:BOARD_URL,...(req.query?.debug?{keys:Object.keys(payload||{})}:{})});
  }catch(error){res.status(502).json({notices:[],error:'SOOP notice unavailable',boardUrl:BOARD_URL})}
};
