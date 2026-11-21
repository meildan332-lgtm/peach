// GET /api/soop-hotclips?month=2026-11
// 냐쵸(nslah830)의 클립(vod/clip) + 캐치(catch) 게시판에서(다시보기 제외, 냐쵸 방송에서 만든 것만) 해당 월에 올라온 영상을 모아 조회수순으로 반환합니다.
// Vercel 스타일(Node) 함수입니다. 기존 /api/soop-live 와 같은 위치(api/)에 두세요.

const STREAMER = 'nslah830';
const BASE = 'https://chapi.sooplive.co.kr/api';
const UA = 'Mozilla/5.0 (compatible; NyachoSchedule/1.0)';
const MAX_PAGES = 15;
const PER_PAGE = 60;

// 게시판별로 시도할 API 경로 후보 (앞에서부터 시도해서 목록이 나오는 첫 번째 경로를 사용)
const BOARDS = [
  { key: 'clip', label: '클립', paths: ['vods/clip', 'vods/clips'], pageUrl: `https://www.sooplive.com/station/${STREAMER}/vod/clip` },
  { key: 'catch', label: '캐치', paths: ['vods/catch', 'catch', 'catches', 'vods/catches', 'vods/shorts', 'shorts'], pageUrl: `https://www.sooplive.com/station/${STREAMER}/catch` },
];

const num = v => Number(String(v ?? 0).replace(/,/g, '')) || 0;
const abs = u => (!u ? '' : u.startsWith('//') ? `https:${u}` : u.replace(/^http:/, 'https:'));

// 다시보기(방송 VOD) 판별: 클립/캐치 게시판 응답에 다시보기가 섞여 있어도 걸러냅니다.
const REVIEW_RE = /review|다시보기|replay/i;
function isReview(item) {
  const ucc = item.ucc || {};
  const fields = [item.type, item.vod_type, item.station_type, item.category, item.board_type, item.file_type, ucc.type, ucc.file_type, ucc.category, ucc.vod_type];
  return fields.some(v => typeof v === 'string' && REVIEW_RE.test(v));
}

// 클립/캐치를 만든 사람의 닉네임. (방송자 본인 닉네임 bj_nick 등은 제외)
const AUTHOR_KEYS = ['user_nick', 'reg_user_nick', 'writer_nick', 'clip_user_nick', 'creator_nick', 'maker_nick', 'author_nick', 'nickname', 'nick', 'user_name'];
function findAuthor(item) {
  const sources = [item, item.ucc || {}, item.user || {}, item.writer || {}, item.clip || {}, item.count || {}];
  for (const key of AUTHOR_KEYS) for (const src of sources) if (typeof src[key] === 'string' && src[key].trim()) return src[key].trim();
  for (const src of sources) for (const [k, v] of Object.entries(src)) {
    if (/nick/i.test(k) && !/^(bj|station|streamer|broad)/i.test(k) && typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

// 원본 방송 판별: 클립이 다른 스트리머의 방송에서 만들어졌다면 제외합니다.
// 응답에 "원본 방송자 아이디" 항목이 있을 때만 비교합니다. (클립을 만든 사람의 user_id는 비교 대상이 아님)
const SOURCE_KEYS = ['bj_id', 'bjid', 'streamer_id', 'station_bj_id', 'original_bj_id', 'origin_bj_id', 'broad_bj_id', 'owner_id', 'station_id'];
function isOtherStreamer(item) {
  const sources = [item, item.ucc || {}, item.station || {}, item.broad || {}, item.clip || {}];
  for (const key of SOURCE_KEYS) for (const src of sources) {
    const v = src[key];
    if (typeof v !== 'string' || !v.trim() || /^\d+$/.test(v.trim())) continue; // 숫자(방송국 번호)는 비교하지 않음
    return v.trim().toLowerCase() !== STREAMER;
  }
  return false;
}

function normalize(item, board) {
  const id = item.title_no ?? item.titleNo ?? item.id;
  if (!id || isReview(item) || isOtherStreamer(item)) return null;
  const count = item.count || {};
  const ucc = item.ucc || {};
  const date = String(item.reg_date ?? item.regDate ?? item.write_date ?? '');
  return {
    id: String(id),
    board: board.key,
    boardLabel: board.label,
    title: item.title_name ?? item.title ?? '제목 없음',
    author: findAuthor(item),
    date,
    views: num(count.read_cnt ?? item.read_cnt ?? item.view_cnt ?? item.viewCount ?? ucc.read_cnt),
    likes: num(count.like_cnt ?? count.vote_cnt ?? item.like_cnt),
    comments: num(count.comment_cnt ?? item.comment_cnt),
    thumbnail: abs(ucc.thumb ?? item.thumb ?? item.thumbnail ?? ''),
    // SOOP의 total_file_duration은 밀리초 단위 → 초로 변환 (item.duration은 초 단위로 가정)
    duration: ucc.total_file_duration != null ? Math.round(num(ucc.total_file_duration) / 1000) : num(item.duration),
    url: board.key === 'catch' ? `https://vod.sooplive.com/catch/${id}` : `https://vod.sooplive.com/player/${id}`,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function collectBoard(board, month, attempts) {
  const start = `${month}-01`;
  let lastError = null;
  for (const path of board.paths) {
    const items = [];
    let firstRows = 0;
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE}/${STREAMER}/${path}?page=${page}&per_page=${PER_PAGE}&orderby=reg_date`;
        const json = await fetchJson(url);
        const rows = Array.isArray(json.data) ? json.data : [];
        if (page === 1) firstRows = rows.length;
        if (page === 1) attempts.push({ board: board.key, path, ok: true, rows: rows.length, keys: Object.keys(json).slice(0, 10), sample: rows[0] ? Object.keys(rows[0]).slice(0, 25) : [], nickFields: rows[0] ? Object.fromEntries(Object.entries(rows[0]).filter(([k]) => /nick|user|writer|name|bj|station|streamer/i.test(k)).slice(0, 10)) : {} });
        if (!rows.length) break;
        let reachedOlder = false;
        for (const row of rows) {
          const n = normalize(row, board);
          if (!n) continue;
          if (n.date && n.date.slice(0, 10) < start) { reachedOlder = true; continue; }
          items.push(n);
        }
        // 최신순 정렬이므로 이전 달 글을 만나면 더 볼 필요가 없음
        if (reachedOlder || (json.last_page && page >= json.last_page)) break;
      }
      // 첫 페이지부터 비어 있으면 잘못된 경로일 수 있으니 다음 후보 경로를 시도
      if (firstRows === 0 && path !== board.paths[board.paths.length - 1]) continue;
      return { items, error: null };
    } catch (error) {
      lastError = error;
      attempts.push({ board: board.key, path, ok: false, error: String(error.message || error) });
    }
  }
  return { items: [], error: lastError ? String(lastError.message || lastError) : 'unknown' };
}

module.exports = async function handler(req, res) {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const current = now.toISOString().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query?.month || '')) ? req.query.month : current;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  const attempts = [];
  const results = await Promise.all(BOARDS.map(b => collectBoard(b, month, attempts)));
  const clips = results
    .flatMap(r => r.items)
    .filter(c => !c.date || (c.date.slice(0, 7) === month))
    .filter((c, i, arr) => arr.findIndex(o => o.id === c.id) === i)
    .sort((a, b) => b.views - a.views || b.date.localeCompare(a.date));

  const errors = Object.fromEntries(BOARDS.map((b, i) => [b.key, results[i].error]).filter(([, e]) => e));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ month, nextMonth, boards: BOARDS.map(b => ({ key: b.key, label: b.label, url: b.pageUrl })), count: clips.length, errors, ...(req.query?.debug ? { attempts } : {}), clips });
};
