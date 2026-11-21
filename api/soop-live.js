module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=30');
  try{
    const body=new URLSearchParams({bid:'nslah830',bno:'null',type:'live',pwd:'',player_type:'html5',stream_type:'common',quality:'HD',mode:'landing',from_api:'0',is_revive:'false'});
    const response=await fetch('https://live.sooplive.co.kr/afreeca/player_live_api.php',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Mozilla/5.0'},body});
    if(!response.ok)throw new Error(`SOOP ${response.status}`);
    const payload=await response.json(),channel=payload.CHANNEL||{},broadcastNumber=Number(channel.BNO||0),live=Number(channel.RESULT)===1&&broadcastNumber>0;
    const rawStartedAt=channel.BROAD_START_TIME||channel.BROAD_START||channel.START_TIME||channel.START_DATE||channel.STARTED_AT||null;
    const digits=String(rawStartedAt||'').replace(/\D/g,''),startedAt=digits.length>=14?`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}T${digits.slice(8,10)}:${digits.slice(10,12)}:${digits.slice(12,14)}+09:00`:rawStartedAt;
    res.status(200).json({live,title:channel.TITLE||'',startedAt,elapsedSeconds:Number(channel.BTIME||0),broadcastNumber:live?broadcastNumber:null,thumbnail:live?`https://liveimg.sooplive.com/m/${broadcastNumber}`:null,watchUrl:'https://play.sooplive.com/nslah830'});
  }catch(error){res.status(502).json({live:false,error:'SOOP live status unavailable'})}
};
