// GET /api/soop-hotclips?month=2026-11
// 냐쵸(nslah830)의 클립 + 캐치 게시판에서 해당 월에 올라온 영상을 모아 조회수순으로 반환합니다.
// (다시보기 제외, 냐쵸 방송에서 만든 것만, by = 클립/캐치를 만든 사람의 닉네임)
// Vercel 스타일(Node) 함수입니다. 기존 /api/soop-live 와 같은 위치(api/)에 두세요.

const STREAMER = 'nslah830';
const V13 = `https://api-channel.sooplive.com/v1.3/channel/${STREAMER}`;
const CHAPI = `https://chapi.sooplive.co.kr/api/${STREAMER}`;
const UA = 'Mozilla/5.0 (compatible; NyachoSchedule/1.0)';
const PER_PAGE = 40;
const MAX_PAGES = 40;
const FIELDS = 'title,contents,user_nick,user_id';

// 게시판별 목록 API (앞에서부터 시도해서 목록이 나오는 첫 번째 주소를 사용)
const v13Url = kind => page =>
  `${V13}/vod/${kind}?startDate=&endDate=&keyword=&orderBy=reg_date&page=${page}&perPage=${PER_PAGE}&field=${FIELDS}`;

const BOARDS = [
  {
    key: 'clip', label: '클립', pageUrl: `https://www.sooplive.com/station/${STREAMER}/vod/clip`,
    sources: [
      { name: 'v1.3 vod/clip', url: v13Url('clip') },
      { name: 'chapi vods/clip', url: page => `${CHAPI}/vods/clip?page=${page}&per_page=60&orderby=reg_date` },
    ],
  },
  {
    key: 'catch', label: '캐치', pageUrl: `https://www.sooplive.com/station/${STREAMER}/catch`,
    sources: [{ name: 'v1.3 vod/catch', url: v13Url('catch') }],
  },
];

const num = v => Number(String(v ?? 0).replace(/,/g, '')) || 0;
const abs = u => (!u ? '' : u.startsWith('//') ? `https:${u}` : u.replace(/^http:/, 'https:'));
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');

// 다시보기 판별: 클립/캐치 응답에 다시보기가 섞여 있어도 걸러냅니다.
const REVIEW_RE = /review|다시보기|replay/i;
function isReview(item) {
  const ucc = item.ucc || {};
  const fields = [item.type, item.vod_type, item.station_type, item.category, item.board_type, item.file_type, ucc.type, ucc.file_type, ucc.fileType, ucc.vod_type];
  return fields.some(v => typeof v === 'string' && REVIEW_RE.test(v));
}

// 다른 스트리머 방송의 영상 제외 (응답에 방송자 아이디가 있을 때만 비교)
function isOtherStreamer(item) {
  const candidates = [item.badge?.bjId, item.bjId, item.bj_id, item.streamer_id, item.original_bj_id];
  const id = candidates.find(v => typeof v === 'string' && v.trim() && !/^\d+$/.test(v.trim()));
  return id ? id.trim().toLowerCase() !== STREAMER : false;
}

// 클립/캐치를 만든 사람의 닉네임 (스트리머 본인 닉네임 필드는 사용하지 않음)
function findAuthor(item) {
  const direct = pick(item.userNick, item.copyright?.userNick, item.user_nick, item.reg_user_nick, item.writer_nick, item.clip_user_nick);
  return typeof direct === 'string' ? direct.trim() : '';
}

function normalize(item, board) {
  const id = pick(item.titleNo, item.title_no, item.id);
  if (!id || isReview(item) || isOtherStreamer(item)) return null;
  const ucc = item.ucc || {};
  const count = item.count || {};
  const durationMs = pick(ucc.totalFileDuration, ucc.total_file_duration);
  return {
    id: String(id),
    board: board.key,
    boardLabel: board.label,
    title: pick(item.titleName, item.title_name, item.title) || '제목 없음',
    author: findAuthor(item),
    date: String(pick(item.regDate, item.reg_date, item.write_date) || ''),
    views: num(pick(count.readCnt, count.read_cnt, count.vodReadCnt, item.read_cnt, item.view_cnt)),
    likes: num(pick(count.likeCnt, count.like_cnt, count.vote_cnt)),
    comments: num(pick(count.commentCnt, count.comment_cnt)),
    thumbnail: abs(pick(ucc.thumb, item.thumb, item.thumbnail) || ''),
    // totalFileDuration은 밀리초 단위 → 초로 변환
    duration: durationMs != null ? Math.round(num(durationMs) / 1000) : num(item.duration),
    // 세로 영상 여부 (캐치는 가로/세로가 섞여 있음)
    vertical: ucc.catchInfo?.resolutionType === 'vertical',
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
  for (let s = 0; s < board.sources.length; s++) {
    const source = board.sources[s];
    const items = [];
    let firstRows = 0;
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const json = await fetchJson(source.url(page));
        const rows = Array.isArray(json.contents) ? json.contents : Array.isArray(json.data) ? json.data : [];
        if (page === 1) {
          firstRows = rows.length;
          attempts.push({ board: board.key, source: source.name, ok: true, rows: rows.length, keys: Object.keys(json).slice(0, 10), sample: rows[0] ? Object.keys(rows[0]).slice(0, 30) : [] });
        }
        if (!rows.length) break;
        for (const row of rows) {
          const n = normalize(row, board);
          if (n && (!n.date || n.date.slice(0, 10) >= start)) items.push(n);
        }
        // 최신순 정렬이므로 페이지의 마지막 글이 해당 월보다 이전이면 더 볼 필요가 없음
        const last = rows[rows.length - 1];
        const lastDate = String(pick(last.regDate, last.reg_date) || '').slice(0, 10);
        const totalPages = json.meta?.totalPages ?? json.last_page;
        if ((lastDate && lastDate < start) || (totalPages && page >= totalPages)) break;
      }
      // 첫 페이지부터 비어 있으면 잘못된 주소일 수 있으니 다음 후보를 시도
      if (firstRows === 0 && s < board.sources.length - 1) continue;
      return { items, error: null };
    } catch (error) {
      lastError = error;
      attempts.push({ board: board.key, source: source.name, ok: false, error: String(error.message || error) });
    }
  }
  return { items: [], error: lastError ? String(lastError.message || lastError) : 'unknown' };
}

module.exports = async function handler(req, res) {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const current = now.toISOString().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query?.month || '')) ? req.query.month : current;

  const attempts = [];
  const results = await Promise.all(BOARDS.map(b => collectBoard(b, month, attempts)));
  const clips = results
    .flatMap(r => r.items)
    .filter(c => !c.date || c.date.slice(0, 7) === month)
    .filter((c, i, arr) => arr.findIndex(o => o.id === c.id) === i)
    .sort((a, b) => b.views - a.views || b.date.localeCompare(a.date));

  const errors = Object.fromEntries(BOARDS.map((b, i) => [b.key, results[i].error]).filter(([, e]) => e));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({
    month,
    boards: BOARDS.map(b => ({ key: b.key, label: b.label, url: b.pageUrl })),
    count: clips.length,
    errors,
    ...(req.query?.debug ? { attempts } : {}),
    clips,
  });
};
