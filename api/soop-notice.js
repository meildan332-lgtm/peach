const API_URL='https://api-channel.sooplive.com/v1.3/channel/natty09/board?bbsNo=122887767&perPage=20&page=1&orderBy=reg_date&field=title%2Ccontents%2Cuser_nick%2Cuser_id';
const BOARD_URL='https://www.sooplive.com/station/natty09/board/122887767';
const clean=value=>String(value||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=180');
  try{
    const response=await fetch(API_URL,{headers:{accept:'application/json','user-agent':'Mozilla/5.0'}});
    if(!response.ok)throw new Error(`SOOP ${response.status}`);
    const payload=await response.json();
    if(payload?.code&&payload.code!=='SUCCESS')throw new Error(payload.message||payload.code);
    const rows=(Array.isArray(payload?.contents)?payload.contents:[])
      .sort((a,b)=>String(b.regDate||b.reg_date||'').localeCompare(String(a.regDate||a.reg_date||'')))
      .slice(0,2);
    const notices=rows.map(row=>({
      title:clean(row.titleName||row.title||row.subject),
      excerpt:clean(row.content?.content||row.contents).slice(0,220),
      author:clean(row.userNick||row.user_nick||row.userId),
      profileImage:row.profileImage||null,
      date:row.regDate||row.reg_date||null,
      likeCount:Number(row.count?.likeCnt||0),
      commentCount:Number(row.count?.commentCnt||0),
      viewCount:Number(row.count?.readCnt||0),
      postUrl:`https://www.sooplive.com/station/natty09/post/${row.titleNo}`
    }));
    res.status(200).json({notices,boardUrl:BOARD_URL});
  }catch(error){res.status(502).json({notices:[],error:'SOOP notice unavailable',boardUrl:BOARD_URL})}
};
