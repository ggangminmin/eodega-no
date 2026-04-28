const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

/* standalone 디자인 POC는 홈/리스트/상세 화면 전환을 중심으로 검증합니다. */
function runOnboardingTests() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  /* 탭과 화면 전환 타깃 */
  ['home', 'list', 'detail'].forEach(screen => {
    assert.match(html, new RegExp(`id="screen-${screen}"`), `screen ${screen} present`);
  });
  assert.match(html, /showScreen\('home'\)/, 'home screen switch target present');
  assert.match(js, /showScreen\('list'\)/, 'list screen switch target present');
  assert.match(js, /showScreen\('detail'\)/, 'detail screen switch target present');

  /* 테마 카드와 필터 */
  ['관광지', '음식점', '문화시설', '축제·행사', '숙박', '랜덤'].forEach(label => {
    assert.match(html, new RegExp(label), `category label "${label}" present`);
  });

  /* 부산 지명이 콘텐츠에 포함 */
  ['해운대', '감천문화마을', '라메르호텔', '부산'].forEach(kw => {
    assert.match(html, new RegExp(kw), `keyword "${kw}" in HTML`);
  });

  /* 동적 리스트 렌더링 */
  assert.match(js, /document\.getElementById\('list-grid'\)/, 'list grid mount is used');
  assert.match(js, /showScreen\(id\)/, 'showScreen accepts a screen id');
  assert.match(js, /food:\s*\{/, 'food category metadata present');
  assert.match(js, /culture:\s*\{/, 'culture category metadata present');
  assert.match(js, /festival:\s*\{/, 'festival category metadata present');
  assert.match(js, /stay:\s*\{/, 'stay category metadata present');
  assert.match(js, /totalCount/, 'TourAPI totalCount handling present');
  assert.match(js, /toggleSaved/, 'saved-place interaction present');
}

module.exports = {
  name: 'standalone design interaction checks',
  run: runOnboardingTests,
};
