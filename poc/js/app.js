const API_KEY = 'cu6+0yMVqXnkE8TFlk4H1yA4ie+/i7jX5/udz/qYY7SUPWVzQRVvNBtIEpGa4/GliSmqNDo/jTvS6Q+5P42Lbg==';
const API_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const AREA_CODE = '6';
const APP_NAME = '어데가노';
const PAGE_SIZE = 1000;

const CATEGORY_META = {
  all: {
    icon: '🧭',
    label: '전체',
    title: '부산 전체 스팟',
    sub: '관광지·음식점·문화시설·축제·숙박 통합 보기',
    unit: '곳',
  },
  attraction: {
    icon: '🏞',
    label: '관광지',
    title: '부산 관광지',
    sub: '바다, 산, 골목까지 부산의 대표 볼거리',
    typeId: '12',
    endpoint: 'areaBasedList2',
    unit: '곳',
  },
  food: {
    icon: '🍜',
    label: '음식점',
    title: '부산 음식점',
    sub: '여행 중 들르기 좋은 부산 맛집',
    typeId: '39',
    endpoint: 'areaBasedList2',
    unit: '곳',
  },
  culture: {
    icon: '🎭',
    label: '문화시설',
    title: '부산 문화시설',
    sub: '전시, 공연, 체험을 함께 즐기는 문화 공간',
    typeId: '14',
    endpoint: 'areaBasedList2',
    unit: '곳',
  },
  festival: {
    icon: '🎉',
    label: '축제·행사',
    title: '부산 축제·행사',
    sub: '지금 부산에서 즐길 수 있는 행사와 축제',
    typeId: '15',
    endpoint: 'searchFestival2',
    unit: '개',
  },
  stay: {
    icon: '🛏',
    label: '숙박',
    title: '부산 숙박',
    sub: '동선에 맞춰 고르기 좋은 부산 숙소',
    typeId: '32',
    endpoint: 'areaBasedList2',
    unit: '곳',
  },
};

const state = {
  screen: 'home',
  category: 'attraction',
  sort: 'popular',
  query: '',
  detailId: '',
  savedOnly: false,
  saved: new Set(),
};

const listCache = {};
const detailCache = {};
const countCache = {};

function apiParams(extra = {}) {
  return new URLSearchParams({
    serviceKey: API_KEY,
    MobileOS: 'ETC',
    MobileApp: APP_NAME,
    _type: 'json',
    areaCode: AREA_CODE,
    ...extra,
  });
}

async function apiBody(endpoint, extra = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}?${apiParams(extra)}`);
  if (!res.ok) throw new Error(`TourAPI ${endpoint} HTTP ${res.status}`);
  const data = await res.json();
  const header = data?.response?.header;
  if (header?.resultCode && header.resultCode !== '0000') {
    throw new Error(`TourAPI ${endpoint} ${header.resultCode}: ${header.resultMsg}`);
  }
  return data?.response?.body || {};
}

function toItems(rawItems) {
  const item = rawItems?.item || [];
  return Array.isArray(item) ? item : [item];
}

function categoryRequest(category, pageNo, numOfRows) {
  const meta = CATEGORY_META[category];
  const common = {
    pageNo,
    numOfRows,
    arrange: 'Q',
  };
  if (category === 'festival') {
    return apiBody(meta.endpoint, {
      ...common,
      eventStartDate: '20230101',
    });
  }
  return apiBody(meta.endpoint, {
    ...common,
    contentTypeId: meta.typeId,
  });
}

async function fetchCategoryCount(category) {
  if (countCache[category] !== undefined) return countCache[category];
  const body = await categoryRequest(category, 1, 1);
  const count = Number(body.totalCount || 0);
  countCache[category] = count;
  return count;
}

async function fetchCategory(category) {
  if (listCache[category]) return listCache[category];
  const totalCount = await fetchCategoryCount(category);
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requests = [];
  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    requests.push(categoryRequest(category, pageNo, PAGE_SIZE));
  }
  const bodies = await Promise.all(requests);
  const items = bodies.flatMap((body) => toItems(body.items))
    .filter((item) => item && item.contentid)
    .map((item) => normalizeSpot(item, category));
  listCache[category] = items;
  return items;
}

async function fetchAllCategories() {
  const categories = ['attraction', 'food', 'culture', 'festival', 'stay'];
  const groups = await Promise.all(categories.map((category) => fetchCategory(category)));
  return groups.flat();
}

async function fetchDetail(spot) {
  if (!spot?.contentid) return null;
  const key = `${spot.contentid}:${spot.contenttypeid}`;
  if (detailCache[key]) return detailCache[key];
  const body = await apiBody('detailCommon2', {
    contentId: spot.contentid,
    contentTypeId: spot.contenttypeid,
    defaultYN: 'Y',
    overviewYN: 'Y',
    firstImageYN: 'Y',
    addrinfoYN: 'Y',
    mapinfoYN: 'Y',
    homepageYN: 'Y',
    numOfRows: 1,
    pageNo: 1,
  });
  const detail = toItems(body.items)[0] || null;
  detailCache[key] = detail;
  return detail;
}

async function searchApi(keyword) {
  const body = await apiBody('searchKeyword2', {
    keyword,
    pageNo: 1,
    numOfRows: PAGE_SIZE,
    arrange: 'Q',
  });
  return toItems(body.items)
    .filter((item) => item && item.contentid)
    .map((item) => normalizeSpot(item, categoryFromType(item.contenttypeid)));
}

function categoryFromType(typeId) {
  return Object.entries(CATEGORY_META).find(([, meta]) => meta.typeId === String(typeId))?.[0] || 'attraction';
}

function normalizeSpot(item, category) {
  const meta = CATEGORY_META[category] || CATEGORY_META.attraction;
  return {
    id: String(item.contentid),
    contentid: String(item.contentid),
    contenttypeid: String(item.contenttypeid || meta.typeId),
    category,
    name: item.title || '이름 없음',
    loc: item.addr1 || item.addr2 || '주소 정보 없음',
    area: extractArea(item.addr1 || ''),
    q: item.overview ? stripHtml(item.overview).slice(0, 48) : `${meta.label} 데이터`,
    rank: Number(item.rnum || 0),
    popularity: Number(item.readcount || 0),
    distance: Number(item.dist || item.mapx || 999),
    contact: item.tel || '',
    saved: '저장 가능',
    price: category === 'stay' ? '상세 확인' : '정보 확인',
    hero: gradientFor(category),
    image: item.firstimage || item.firstimage2 || '',
    mapx: item.mapx || '',
    mapy: item.mapy || '',
    modifiedtime: item.modifiedtime || '',
    eventstartdate: item.eventstartdate || '',
    eventenddate: item.eventenddate || '',
  };
}

function extractArea(address) {
  const parts = String(address).split(' ').filter(Boolean);
  return parts.find((part) => /구$|군$/.test(part)) || parts[1] || '부산';
}

function gradientFor(category) {
  return {
    attraction: 'linear-gradient(135deg,#3157E8,#8A5CFF)',
    food: 'linear-gradient(135deg,#FF8A4C,#F43F5E)',
    culture: 'linear-gradient(135deg,#111827,#4F6FE8)',
    festival: 'linear-gradient(160deg,#1D4ED8 0%,#4F6FE8 55%,#8A5CFF 100%)',
    stay: 'linear-gradient(135deg,#0EA5E9,#4F6FE8)',
  }[category] || 'linear-gradient(135deg,#3157E8,#8A5CFF)';
}

function formatCount(count, unit) {
  return `${Number(count || 0).toLocaleString('ko-KR')}${unit}`;
}

function formatDate(value) {
  const text = String(value || '');
  if (text.length !== 8) return value || '정보 없음';
  return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function stripHtml(value) {
  const div = document.createElement('div');
  div.innerHTML = value || '';
  return div.textContent || div.innerText || '';
}

function safeJsString(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

function setLoadingList(message = '부산 여행 정보를 불러오는 중입니다.') {
  const grid = document.getElementById('list-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(message)}</strong>
      <span>카테고리 총 개수와 전체 리스트를 동기화하고 있습니다.</span>
    </div>
  `;
}

function setListHeader(category, countOverride) {
  const meta = CATEGORY_META[category] || CATEGORY_META.attraction;
  document.querySelector('.list-hero-ico').textContent = meta.icon;
  document.querySelector('.list-hero-title').textContent = state.query
    ? `"${state.query}" 검색 결과`
    : state.savedOnly
      ? '저장한 부산 스팟'
      : meta.title;
  document.querySelector('.list-hero-sub').textContent = state.query
    ? '부산 여행지 검색 결과입니다'
    : state.savedOnly
      ? '상세 화면에서 저장한 장소만 모았습니다'
      : meta.sub;
  document.querySelector('.list-hero-count').textContent = countOverride !== undefined
    ? formatCount(countOverride, meta.unit || '곳')
    : '불러오는 중';
}

function updateActiveControls() {
  document.querySelectorAll('.filter-chip[data-category]').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === state.category);
  });
  document.querySelectorAll('.filter-chip[data-sort]').forEach((button) => {
    button.classList.toggle('active', button.dataset.sort === state.sort);
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    const homeActive = state.screen === 'home' && tab.dataset.screen === 'home';
    const categoryActive = state.screen === 'list' && tab.dataset.category === state.category;
    tab.classList.toggle('active', homeActive || categoryActive);
  });
}

function renderListItems(items) {
  const grid = document.getElementById('list-grid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>표시할 데이터가 없습니다.</strong>
        <span>다른 카테고리나 검색어를 선택해보세요.</span>
      </div>
    `;
    return;
  }
  grid.innerHTML = items.map((spot) => {
    const label = CATEGORY_META[spot.category]?.label || '장소';
    const imageStyle = spot.image
      ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.18)),url('${escapeHtml(spot.image)}');background-size:cover;background-position:center;`
      : `background:${spot.hero};`;
    return `
      <button class="place-card" type="button" onclick="showDetail('${spot.contentid}', '${spot.category}')">
        <div class="place-img" style="${imageStyle}">
          <div class="place-badge">${escapeHtml(label)}</div>
        </div>
        <div class="place-body">
          <div class="place-name">${escapeHtml(spot.name)}</div>
          <div class="place-loc">${escapeHtml(spot.loc)}</div>
          <div class="place-quote">${escapeHtml(spot.q)}</div>
        </div>
      </button>
    `;
  }).join('');
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (state.sort === 'distance') return a.distance - b.distance;
    return b.popularity - a.popularity;
  });
}

async function renderCategoryList(category) {
  setListHeader(category);
  setLoadingList();
  updateActiveControls();
  const meta = CATEGORY_META[category] || CATEGORY_META.all;

  let items = [];
  if (state.savedOnly) {
    const allItems = await fetchAllCategories();
    items = allItems.filter((spot) => state.saved.has(spot.contentid));
  } else if (state.query) {
    items = await searchApi(state.query);
  } else if (category === 'all') {
    items = await fetchAllCategories();
  } else {
    items = await fetchCategory(category);
  }

  const count = state.query || state.savedOnly ? items.length : category === 'all'
    ? items.length
    : await fetchCategoryCount(category);
  setListHeader(category, count);
  renderListItems(sortItems(items));
  updateActiveControls();
  document.querySelectorAll(`.cat-card[data-category="${category}"] .cat-count`).forEach((el) => {
    el.textContent = formatCount(count, meta.unit || '곳');
  });
}

function renderDetailSkeleton() {
  document.querySelector('.d-hero-title').textContent = '상세 정보를 불러오는 중';
  document.querySelector('.d-hero-loc').textContent = 'TourAPI detailCommon2 연결 중';
}

async function renderDetail(contentId, categoryHint) {
  renderDetailSkeleton();
  const spot = await findSpot(contentId, categoryHint);
  if (!spot) {
    showToast('상세 데이터를 찾을 수 없습니다.');
    return;
  }
  const detail = await fetchDetail(spot).catch(() => null);
  const merged = detail ? normalizeSpot({ ...spot, ...detail }, categoryFromType(detail.contenttypeid || spot.contenttypeid)) : spot;
  const meta = CATEGORY_META[merged.category] || CATEGORY_META.attraction;
  state.detailId = merged.contentid;

  document.querySelector('.d-hero-card').style.background = merged.image
    ? `linear-gradient(180deg,rgba(29,78,216,0.18),rgba(11,18,32,0.34)),url('${merged.image}') center/cover`
    : merged.hero;
  document.querySelector('.d-hero-badge').textContent = `${meta.icon} ${meta.label} · ${merged.area}`;
  document.querySelector('.d-hero-title').textContent = merged.name;
  document.querySelector('.d-hero-loc').textContent = merged.loc;

  const quickCards = document.querySelectorAll('.d-quick-card');
  setQuickCard(quickCards[0], '☎️', '문의', displayContact(merged, detail));
  setQuickCard(quickCards[1], '📍', '위치', merged.area || '부산');
  setQuickCard(quickCards[2], '💙', '여행 메모', state.saved.has(merged.contentid) ? '저장한 장소' : '저장 가능');

  const panels = document.querySelectorAll('.d-panel');
  panels[0].querySelector('.d-panel-h').textContent = `${meta.icon} ${meta.label} 정보`;
  panels[0].querySelector('.d-info-rows').innerHTML = detailRows(merged, detail, meta).map(([key, value]) => `
    <div class="d-info-row"><div class="d-info-key">${escapeHtml(key)}</div><div class="d-info-val">${escapeHtml(value)}</div></div>
  `).join('');

  const overview = stripHtml(detail?.overview || '');
  panels[1].querySelector('.d-panel-h').textContent = '📄 상세 소개';
  panels[1].querySelector('.d-rooms').innerHTML = `
    <div class="detail-summary">
      <div class="detail-summary-thumb" style="${merged.image ? `background-image:url('${escapeHtml(merged.image)}');` : ''}"></div>
      <div class="detail-summary-body">
        <div class="detail-summary-title">${escapeHtml(merged.name)}</div>
        <p>${escapeHtml(makeTravelOverview(merged, meta, overview))}</p>
        <div class="detail-actions">
          <button type="button" onclick="openMap('${safeJsString(merged.mapy)}', '${safeJsString(merged.mapx)}', '${safeJsString(merged.name)}')">지도에서 보기</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('.d-quote-t').textContent = `"${overview ? overview.slice(0, 70) : makeFallbackOverview(merged, meta)}"`;
  renderMap(merged);
  document.querySelector('.d-contact-h').textContent = '여행에 담기';
  document.querySelector('.d-contact-t').innerHTML = `가고 싶은 곳으로 저장해두고<br><span style="font-size:13px; opacity:0.78; font-weight:500;">지도와 함께 다시 확인하세요</span>`;
  document.querySelector('.d-contact-btn').textContent = state.saved.has(merged.contentid) ? '저장됨' : '저장하기 →';
  document.querySelector('.d-contact-btn').onclick = () => toggleSaved(merged.contentid);

  renderNearby(merged, panels[3]);
  persistState();
}

function detailRows(spot, detail, meta) {
  const rows = [
    ['장소 유형', userCategoryLabel(meta.label)],
    ['주소', spot.loc || '주소 확인 중'],
    ['문의', displayContact(spot, detail)],
  ];
  if (spot.category === 'festival') {
    rows.push(['행사 기간', formatDateRange(spot.eventstartdate, spot.eventenddate)]);
  } else {
    rows.push(['여행 지역', `${spot.area || '부산'} 주변`]);
  }
  rows.push(['이용 팁', makeVisitTip(spot, meta)]);
  return rows;
}

function makeFallbackOverview(spot, meta) {
  const area = spot.area && spot.area !== '부산' ? `${spot.area}에서 ` : '부산에서 ';
  return `${spot.name}은 ${area}방문하기 좋은 ${userCategoryLabel(meta.label)}입니다. 위치와 주변 정보를 함께 확인하고 여행 동선에 담아보세요.`;
}

function makeTravelOverview(spot, meta, overview) {
  const base = overview || makeFallbackOverview(spot, meta);
  const area = spot.area && spot.area !== '부산' ? spot.area : '부산';
  const category = userCategoryLabel(meta.label);
  const reviewTone = {
    관광지: `${area} 여행 사진을 남기기 좋고, 주변 코스와 함께 묶어 다녀오기 좋은 장소입니다.`,
    음식점: `방문 전 영업시간과 대기 여부를 확인하면 더 편하게 즐길 수 있습니다.`,
    문화시설: `전시나 프로그램 일정이 바뀔 수 있어 방문 전에 운영 정보를 확인해보세요.`,
    축제: `행사 기간에는 주변이 붐빌 수 있으니 대중교통 동선과 종료 시간을 미리 잡아두면 좋습니다.`,
    숙박: `주변 관광지와 이동 시간을 함께 보고 예약하면 여행 동선이 훨씬 편해집니다.`,
  }[meta.label] || `${category}로 여행 일정에 넣기 좋은 곳입니다.`;
  return `${base} ${reviewTone}`;
}

function displayContact(spot, detail) {
  const tel = detail?.tel || spot?.contact || '';
  return tel && tel.trim() ? tel.trim() : '관광안내전화 1330';
}

function userCategoryLabel(label) {
  return {
    관광지: '볼거리',
    음식점: '맛집',
    문화시설: '문화 공간',
    축제: '축제·행사',
    숙박: '숙소',
  }[label] || label || '여행지';
}

function makeVisitTip(spot, meta) {
  if (spot.category === 'festival') return '방문 전 행사 일정과 운영 시간을 확인하세요';
  if (meta.label === '음식점') return '피크 시간대 대기 여부를 확인하면 좋아요';
  if (meta.label === '숙박') return '체크인 시간과 취소 규정을 확인하세요';
  return '지도에서 위치를 확인하고 주변 일정과 함께 둘러보세요';
}

function formatDateRange(start, end) {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (!startText && !endText) return '일정 확인 중';
  if (startText && startText === endText) return startText;
  return `${startText || '시작일 확인 중'} - ${endText || '종료일 확인 중'}`;
}

function renderMap(spot) {
  const map = document.querySelector('.d-map');
  const mapCaption = document.querySelector('.d-side .d-panel:first-child div[style*="font-size:12px"]');
  if (!map || !mapCaption) return;

  mapCaption.textContent = spot.loc;
  map.classList.toggle('has-map-image', Boolean(spot.mapx && spot.mapy));
  map.innerHTML = '<div class="d-map-pin"></div>';

  if (!spot.mapx || !spot.mapy) {
    return;
  }

  const img = document.createElement('img');
  img.className = 'd-map-img';
  img.alt = `${spot.name} 지도`;
  img.loading = 'lazy';
  img.src = `/naver/static-map?lat=${encodeURIComponent(spot.mapy)}&lng=${encodeURIComponent(spot.mapx)}&title=${encodeURIComponent(spot.name)}`;
  img.onerror = () => {
    map.classList.remove('has-map-image');
    img.remove();
    renderOsmTiles(map, Number(spot.mapy), Number(spot.mapx));
  };
  map.prepend(img);
}

function renderOsmTiles(map, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const zoom = 15;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);

  map.classList.add('has-map-image');
  const layer = document.createElement('div');
  layer.className = 'd-map-tile-layer';

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const tile = document.createElement('img');
      tile.alt = '';
      tile.loading = 'lazy';
      tile.src = `https://tile.openstreetmap.org/${zoom}/${x + dx}/${y + dy}.png`;
      tile.style.gridColumn = String(dx + 2);
      tile.style.gridRow = String(dy + 2);
      layer.appendChild(tile);
    }
  }

  map.prepend(layer);
}

async function renderNearby(spot, panel) {
  panel.querySelector('.d-panel-h').textContent = '🔍 같은 카테고리 추천';
  const holder = panel.querySelector('div[style*="display:grid"]');
  const items = (await fetchCategory(spot.category)).filter((item) => item.contentid !== spot.contentid).slice(0, 3);
  holder.innerHTML = items.map((item) => `
    <button class="nearby-item" type="button" onclick="showDetail('${item.contentid}', '${item.category}')">
      <div class="nearby-thumb" style="${item.image ? `background-image:url('${escapeHtml(item.image)}');background-size:cover;background-position:center;` : ''}"></div>
      <div>
        <div class="nearby-name">${escapeHtml(item.name)}</div>
        <div class="nearby-meta">${escapeHtml(item.area)} · TourAPI</div>
      </div>
    </button>
  `).join('');
}

function openMap(lat, lng, name) {
  const query = name || (lat && lng ? `${lat},${lng}` : '');
  if (query) {
    window.location.href = `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
    return;
  }
  if (!lat || !lng) {
    showToast('지도에서 볼 위치 정보가 없습니다.');
    return;
  }
}

function runSearchWith(keyword) {
  const search = document.getElementById('site-search');
  if (search) search.value = keyword;
  runSearch();
}

function setQuickCard(card, icon, label, value) {
  card.querySelector('.d-quick-ico').textContent = icon;
  card.querySelector('.d-quick-label').textContent = label;
  card.querySelector('.d-quick-val').textContent = value || '정보 없음';
}

async function findSpot(contentId, categoryHint) {
  const id = String(contentId || state.detailId || '');
  if (id) {
    if (categoryHint && CATEGORY_META[categoryHint]) {
      const group = await fetchCategory(categoryHint);
      const match = group.find((spot) => spot.contentid === id);
      if (match) return match;
    }
    for (const category of ['attraction', 'food', 'culture', 'festival', 'stay']) {
      const group = await fetchCategory(category);
      const match = group.find((spot) => spot.contentid === id);
      if (match) return match;
    }
  }
  const group = await fetchCategory(state.category === 'all' ? 'attraction' : state.category);
  return group[0] || null;
}

function showScreen(id) {
  state.screen = id;
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  document.querySelectorAll('.switch-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.s === id);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateActiveControls();
  persistState();
}

async function showCategory(category) {
  state.category = category;
  state.query = '';
  state.savedOnly = false;
  const search = document.getElementById('site-search');
  if (search) search.value = '';
  showScreen('list');
  await renderCategoryList(category);
}

async function showDetail(contentId, categoryHint) {
  showScreen('detail');
  await renderDetail(contentId, categoryHint);
}

async function setSort(sort) {
  state.sort = sort;
  await renderCategoryList(state.category);
}

async function showRandom() {
  const allItems = await fetchAllCategories();
  const spot = allItems[Math.floor(Math.random() * allItems.length)];
  if (!spot) return;
  await showDetail(spot.contentid, spot.category);
  showToast(`${spot.name} 랜덤 추천을 열었습니다.`);
}

async function showCourse() {
  state.category = 'all';
  state.query = '';
  state.savedOnly = false;
  showScreen('list');
  await renderCategoryList('all');
  showToast('부산 여행지를 인기순으로 모았습니다.');
}

async function showSaved() {
  if (!state.saved.size) {
    showToast('아직 저장한 장소가 없습니다. 상세 화면에서 저장해보세요.');
    return;
  }
  state.category = 'all';
  state.query = '';
  state.savedOnly = true;
  showScreen('list');
  await renderCategoryList('all');
}

function toggleSaved(contentId) {
  const id = String(contentId);
  if (state.saved.has(id)) {
    state.saved.delete(id);
    showToast('저장을 해제했습니다.');
  } else {
    state.saved.add(id);
    showToast('저장함에 담았습니다.');
  }
  persistState();
  renderDetail(id);
}

async function runSearch() {
  const search = document.getElementById('site-search');
  const query = search ? search.value.trim() : '';
  if (!query) {
    await showCategory(state.category === 'all' ? 'attraction' : state.category);
    return;
  }
  state.query = query;
  state.category = 'all';
  state.savedOnly = false;
  showScreen('list');
  await renderCategoryList('all');
}

function jumpToNearby(name) {
  const search = document.getElementById('site-search');
  if (search) search.value = name;
  runSearch();
}

function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function persistState() {
  try {
    localStorage.setItem('adgn-state', JSON.stringify({
      screen: state.screen,
      category: state.category,
      sort: state.sort,
      detailId: state.detailId,
      savedOnly: state.savedOnly,
      saved: [...state.saved],
    }));
  } catch (error) {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function restoreState() {
  try {
    const stored = JSON.parse(localStorage.getItem('adgn-state') || '{}');
    if (stored.category && CATEGORY_META[stored.category]) state.category = stored.category;
    if (stored.sort) state.sort = stored.sort;
    if (stored.detailId) state.detailId = stored.detailId;
    if (typeof stored.savedOnly === 'boolean') state.savedOnly = stored.savedOnly;
    if (Array.isArray(stored.saved)) state.saved = new Set(stored.saved);
  } catch (error) {
    // Ignore stale localStorage data.
  }
}

function bindSearch() {
  const search = document.getElementById('site-search');
  if (!search) return;
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
}

async function hydrateCounts() {
  await Promise.all(['attraction', 'food', 'culture', 'festival', 'stay'].map(async (category) => {
    const count = await fetchCategoryCount(category);
    const meta = CATEGORY_META[category];
    document.querySelectorAll(`.cat-card[data-category="${category}"] .cat-count`).forEach((el) => {
      el.textContent = formatCount(count, meta.unit);
    });
  }));
}

async function hydrateHomeCards() {
  try {
    const attractions = await fetchCategory('attraction');
    const festivals = await fetchCategory('festival');
    const festivalCards = await enrichWithDetails(festivals.slice(0, 4));
    renderHomePlaces(attractions.slice(0, 4));
    renderHomeFestivals(festivalCards);
  } catch (error) {
    console.warn('[어데가노] 홈 카드 API 렌더 실패', error);
  }
}

async function enrichWithDetails(items) {
  const enriched = await Promise.all(items.map(async (spot) => {
    if (spot.image) return spot;
    const detail = await fetchDetail(spot).catch(() => null);
    if (!detail) return spot;
    return normalizeSpot({ ...spot, ...detail }, categoryFromType(detail.contenttypeid || spot.contenttypeid));
  }));
  return enriched;
}

function renderHomePlaces(items) {
  const grid = document.querySelector('.now-popular .place-grid');
  if (!grid || !items.length) return;
  grid.innerHTML = items.map((spot, index) => `
    <button class="place-card" type="button" onclick="showDetail('${spot.contentid}', '${spot.category}')">
      <div class="place-img" style="${spot.image ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.18)),url('${escapeHtml(spot.image)}');background-size:cover;background-position:center;` : `background:${spot.hero};`}">
        <div class="place-rank">${index + 1}</div>
        <div class="place-badge">${escapeHtml(CATEGORY_META[spot.category].label)}</div>
      </div>
      <div class="place-body">
        <div class="place-name">${escapeHtml(spot.name)}</div>
        <div class="place-loc">${escapeHtml(spot.loc)}</div>
        <div class="place-quote">${escapeHtml(spot.q)}</div>
      </div>
    </button>
  `).join('');
}

function renderHomeFestivals(items) {
  const grid = document.querySelector('.fest-grid');
  if (!grid || !items.length) return;
  grid.innerHTML = items.map((spot, index) => `
    <div class="fest-card ${spot.image ? 'has-image' : 'is-fallback'}" style="${spot.image ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.58)),url('${escapeHtml(spot.image)}');` : `background:${gradientFor('festival')};`}" onclick="showDetail('${spot.contentid}', 'festival')">
      <div class="fest-body">
        <div class="fest-date">${formatDateRange(spot.eventstartdate, spot.eventenddate)}</div>
        <div class="fest-h">${escapeHtml(spot.name)}</div>
      </div>
    </div>
  `).join('');
}

async function init() {
  restoreState();
  bindSearch();
  hydrateCounts().catch(() => showToast('카테고리 정보를 불러오지 못했습니다.'));
  hydrateHomeCards();
  if (state.screen === 'list') {
    showScreen('list');
    await renderCategoryList(state.category);
  } else if (state.screen === 'detail' && state.detailId) {
    showScreen('detail');
    await renderDetail(state.detailId);
  } else {
    showScreen('home');
  }
}

init().catch((error) => {
  console.error('[어데가노] 초기화 실패', error);
  showToast('부산 여행 정보를 불러오지 못했습니다.');
});
