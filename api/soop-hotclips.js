// GET /api/soop-hotclips?month=2026-11
// 냐쵸(nslah830)의 클립(vod/clip) + 캐치(catch) 게시판에서(다시보기 제외) 해당 월에 올라온 영상을 모아 조회수순으로 반환합니다.
// Vercel 스타일(Node) 함수입니다. 기존 /api/soop-live 와 같은 위치(api/)에 두세요.

const STREAMER = 'nslah830';
const BASE = 'https://chapi.sooplive.co.kr/api';
const UA = 'Mozilla/5.0 (compatible; NyachoSchedule/1.0)';
const MAX_PAGES = 15;
const PER_PAGE = 60;

// 게시판별로 시도할 API 경로 후보 (앞에서부터 시도해서 목록이 나오는 첫 번째 경로를 사용)
const BOARDS = [
  { key: 'clip', label: '클립', paths: ['vods/clip', 'vods/clips'], pageUrl: `https://www.sooplive.com/station/${STREAMER}/vod/clip` },
  { key: 'catch', label: '캐치', paths: ['vods/catch', 'catch', 'vods/shorts'], pageUrl: `https://www.sooplive.com/station/${STREAMER}/catch` },
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

function normalize(item, board) {
  const id = item.title_no ?? item.titleNo ?? item.id;
  if (!id || isReview(item)) return null;
  const count = item.count || {};
  const ucc = item.ucc || {};
  const date = String(item.reg_date ?? item.regDate ?? item.write_date ?? '');
  return {
    id: String(id),
    board: board.key,
    boardLabel: board.label,
    title: item.title_name ?? item.title ?? '제목 없음',
    date,
    views: num(count.read_cnt ?? item.read_cnt ?? item.view_cnt ?? item.viewCount ?? ucc.read_cnt),
    likes: num(count.like_cnt ?? count.vote_cnt ?? item.like_cnt),
    comments: num(count.comment_cnt ?? item.comment_cnt),
    thumbnail: abs(ucc.thumb ?? item.thumb ?? item.thumbnail ?? ''),
    duration: num(ucc.total_file_duration ?? item.duration),
    url: `https://vod.sooplive.com/player/${id}`,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function collectBoard(board, month) {
  const start = `${month}-01`;
  let lastError = null;
  for (const path of board.paths) {
    const items = [];
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE}/${STREAMER}/${path}?page=${page}&per_page=${PER_PAGE}&orderby=reg_date`;
        const json = await fetchJson(url);
        const rows = Array.isArray(json.data) ? json.data : [];
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
      return { items, error: null };
    } catch (error) {
      lastError = error;
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

  const results = await Promise.all(BOARDS.map(b => collectBoard(b, month)));
  const clips = results
    .flatMap(r => r.items)
    .filter(c => !c.date || (c.date.slice(0, 7) === month))
    .filter((c, i, arr) => arr.findIndex(o => o.id === c.id) === i)
    .sort((a, b) => b.views - a.views || b.date.localeCompare(a.date));

  const errors = Object.fromEntries(BOARDS.map((b, i) => [b.key, results[i].error]).filter(([, e]) => e));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ month, nextMonth, boards: BOARDS.map(b => ({ key: b.key, label: b.label, url: b.pageUrl })), count: clips.length, errors, clips });
};
