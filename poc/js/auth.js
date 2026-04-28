/* ================================================================
   어데가노 — Supabase 인증 & 저장함 연동
   ================================================================ */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://hbjbuquoswruhbqmatyb.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiamJ1cXVvc3dydWhicW1hdHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzk5NTQsImV4cCI6MjA5Mjg1NTk1NH0.F_dIaoLLo8VuXET54VztpzsGcETvX-k9h-drzrYPVC4';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let currentUser = null;

  /* ── DOM ── */
  const btnLogin   = document.getElementById('btn-login');
  const userAvatar = document.getElementById('user-avatar');
  const savedCount = document.getElementById('saved-count');

  /* ================================================================
     인증 상태 감지
     ================================================================ */
  sb.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;
    renderAuthUI();
    if (currentUser) {
      await syncFavoritesFromDB();
    } else {
      // 로그아웃 시 저장함 초기화
      if (typeof state !== 'undefined') {
        state.saved.clear();
        renderSavedCount();
      }
    }
  });

  /* ================================================================
     헤더 UI 업데이트
     ================================================================ */
  function renderAuthUI() {
    if (currentUser) {
      btnLogin.style.display  = 'none';
      userAvatar.style.display = 'flex';

      const meta   = currentUser.user_metadata || {};
      const name   = meta.full_name || meta.name || '사용자';
      const avatar = meta.avatar_url || meta.picture || '';
      userAvatar.title = `${name} · 클릭하면 로그아웃`;

      if (avatar) {
        userAvatar.innerHTML = `<img src="${avatar}" alt="${name}" />`;
      } else {
        userAvatar.textContent = name[0].toUpperCase();
      }
    } else {
      btnLogin.style.display   = '';
      userAvatar.style.display = 'none';
    }
  }

  function renderSavedCount() {
    if (!savedCount) return;
    const count = (typeof state !== 'undefined') ? state.saved.size : 0;
    savedCount.textContent = count > 0 ? `(${count})` : '';
  }

  /* ================================================================
     로그인 / 로그아웃
     ================================================================ */
  btnLogin.addEventListener('click', async () => {
    btnLogin.textContent = '로그인 중…';
    btnLogin.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      if (typeof showToast === 'function') showToast('로그인 중 오류: ' + error.message);
      btnLogin.textContent = '로그인';
      btnLogin.disabled = false;
    }
  });

  userAvatar.addEventListener('click', async () => {
    if (!confirm('로그아웃 하시겠어요?')) return;
    await sb.auth.signOut();
  });

  /* ================================================================
     DB → state.saved 동기화 (로그인 시)
     ================================================================ */
  async function syncFavoritesFromDB() {
    if (!currentUser || typeof state === 'undefined') return;
    const { data } = await sb
      .from('favorites')
      .select('content_id')
      .eq('user_id', currentUser.id);
    if (data) {
      data.forEach(r => state.saved.add(r.content_id));
    }
    renderSavedCount();

    // 저장 버튼 UI 갱신 (상세 화면이 열려 있을 경우)
    const detailId = state.detailId;
    if (detailId && typeof renderDetail === 'function') {
      renderDetail(detailId);
    }
  }

  /* ================================================================
     toggleSaved 가로채기 — DB 연동 추가
     ================================================================ */
  const _originalToggleSaved = window.toggleSaved;

  window.toggleSaved = async function (contentId) {
    if (!currentUser) {
      if (typeof showToast === 'function') {
        showToast('로그인하면 저장함에 담을 수 있어요!');
      }
      return;
    }

    const id = String(contentId);
    const isSaved = state.saved.has(id);

    // 기존 로직 실행 (state.saved 토글 + renderDetail)
    if (typeof _originalToggleSaved === 'function') {
      _originalToggleSaved(contentId);
    }
    renderSavedCount();

    // DB 동기화
    if (isSaved) {
      await sb.from('favorites').delete().match({
        user_id:    currentUser.id,
        content_id: id,
      });
    } else {
      // 현재 스팟 정보 가져오기
      const spot = await getSpotInfo(id);
      await sb.from('favorites').insert({
        user_id:         currentUser.id,
        content_id:      id,
        content_type_id: spot?.typeId  || '',
        title:           spot?.title   || '',
        address:         spot?.addr1   || '',
        image_url:       spot?.image   || '',
        mapx:            spot?.mapx    || '',
        mapy:            spot?.mapy    || '',
      });
    }
  };

  /* 현재 리스트 캐시에서 스팟 정보 가져오기 */
  async function getSpotInfo(contentId) {
    if (typeof listCache === 'undefined') return null;
    for (const key of Object.keys(listCache)) {
      const found = listCache[key]?.find(s => String(s.contentid) === String(contentId));
      if (found) {
        return {
          title: found.title || '',
          addr1: found.addr1 || '',
          image: found.firstimage || found.firstimage2 || '',
          mapx:  found.mapx  || '',
          mapy:  found.mapy  || '',
          typeId: found.contenttypeid || '',
        };
      }
    }
    return null;
  }

  /* ================================================================
     저장함(showSaved) 가로채기 — 로그인 체크 추가
     ================================================================ */
  const _originalShowSaved = window.showSaved;

  window.showSaved = async function () {
    if (!currentUser) {
      if (typeof showToast === 'function') {
        showToast('로그인하면 저장함을 볼 수 있어요!');
      }
      return;
    }
    if (typeof _originalShowSaved === 'function') {
      await _originalShowSaved();
    }
  };

  /* ================================================================
     CSS — 유저 아바타 스타일 (inline injection)
     ================================================================ */
  const style = document.createElement('style');
  style.textContent = `
    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #4F6FE8;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      border: 2px solid transparent;
      transition: border-color .15s;
      flex-shrink: 0;
    }
    .user-avatar:hover { border-color: #4F6FE8; }
    .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
    #saved-count { font-size: 11px; color: #4F6FE8; font-weight: 700; }
  `;
  document.head.appendChild(style);

})();
