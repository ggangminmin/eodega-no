const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

function runIndexHtmlTests() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const js   = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const css  = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  /* HTML 구조 */
  assert.match(html, /어데가노/, 'logo text present');
  assert.match(html, /assets\/app_icon\.png/, 'brand icon asset linked');
  assert.match(html, /어데가노 · 부산 여행 매칭/, 'standalone title present');
  assert.match(html, /class="site"/, 'site header present');
  assert.match(html, /class="tabs"/, 'shared tabs present');
  assert.match(html, /id="screen-home"/, 'home screen present');
  assert.match(html, /id="screen-list"/, 'list screen present');
  assert.match(html, /id="screen-detail"/, 'detail screen present');
  assert.match(html, /class="hero-card"/, 'hero card present');
  assert.match(html, /맞춤 코스가 답이다/, 'standalone hero copy present');
  assert.match(html, /class="cat-grid"/, 'category grid present');
  assert.match(html, /class="place-grid"/, 'popular places grid present');
  assert.match(html, /id="list-grid"/, 'dynamic list grid mount present');
  assert.match(html, /class="d-hero-card"/, 'detail hero present');
  assert.match(html, /class="screen-switcher"/, 'screen switcher present');
  assert.match(html, /css\/style\.css/, 'style.css linked');
  assert.match(html, /js\/app\.js/, 'app.js linked');

  /* JS: standalone prototype 핵심 동작 */
  assert.match(js, /API_BASE/, 'TourAPI base config present');
  assert.match(js, /KorService2/, 'TourAPI KorService2 endpoint present');
  assert.match(js, /fetchCategoryCount/, 'category count function present');
  assert.match(js, /fetchCategory/, 'category list function present');
  assert.match(js, /CATEGORY_META/, 'category metadata present');
  assert.match(js, /function renderList/, 'renderList function present');
  assert.match(js, /function renderDetail/, 'renderDetail function present');
  assert.match(js, /function showScreen/, 'showScreen function present');
  assert.match(js, /function showCategory/, 'showCategory function present');
  assert.match(js, /function showDetail/, 'showDetail function present');
  assert.match(js, /function showRandom/, 'showRandom function present');
  assert.match(js, /function runSearch/, 'runSearch function present');
  assert.match(js, /localStorage\.setItem\('adgn-state'/, 'screen state persistence present');
  assert.match(js, /PAGE_SIZE/, 'paged full list loading present');

  /* CSS: 핵심 설계 토큰 */
  assert.match(css, /--primary/, 'primary color variable present');
  assert.match(css, /--light-blue/, 'light blue token present');
  assert.match(css, /--bg/, 'background color variable present');
  assert.match(css, /header\.site/, 'header style present');
  assert.match(css, /\.brand-mark[\s\S]*object-fit:contain/, 'brand icon scales without distortion');
  assert.match(css, /\.hero/, 'hero style present');
  assert.match(css, /\.place-card/, 'place card style present');
  assert.match(css, /\.filter-chip/, 'filter chip style present');
  assert.match(css, /\.d-hero-card/, 'detail card style present');
  assert.doesNotMatch(css, /letter-spacing:\s*-[0-9.]+em/, 'negative letter spacing is not used');
}

module.exports = {
  name: 'standalone design smoke checks',
  run: runIndexHtmlTests,
};
