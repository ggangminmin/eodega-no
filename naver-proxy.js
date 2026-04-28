/**
 * Naver API Proxy Server
 * - Express + CORS 기반
 * - 로컬: node naver-proxy.js (port 5001)
 * - Vercel serverless: module.exports 로 export
 *
 * 환경변수:
 *   NAVER_CLIENT_ID     - 네이버 API Client ID
 *   NAVER_CLIENT_SECRET - 네이버 API Client Secret
 *   PORT                - 서버 포트 (기본 5001)
 */

const express = require('express');
const cors = require('cors');
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(cors());

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'YOUR_CLIENT_ID';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const NAVER_MAPS_CLIENT_ID =
  process.env.NAVER_MAPS_CLIENT_ID ||
  process.env.NAVER_MAPS_KEY_ID ||
  process.env.NCP_MAPS_KEY_ID ||
  '';
const NAVER_MAPS_CLIENT_SECRET =
  process.env.NAVER_MAPS_CLIENT_SECRET ||
  process.env.NAVER_MAPS_KEY ||
  process.env.NCP_MAPS_KEY ||
  '';

const NAVER_HEADERS = {
  'X-Naver-Client-Id': NAVER_CLIENT_ID,
  'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
};

async function proxyNaver(endpoint, query) {
  const url = `https://openapi.naver.com/v1/search/${endpoint}?${query}`;
  const res = await fetch(url, { headers: NAVER_HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver API ${res.status}: ${text}`);
  }
  return res.json();
}

app.get('/naver/blog', async (req, res) => {
  try {
    const data = await proxyNaver('blog.json', new URLSearchParams(req.query).toString());
    res.json(data);
  } catch (e) {
    console.error('Blog proxy error:', e.message);
    res.status(502).json({ error: e.message, items: [] });
  }
});

app.get('/naver/image', async (req, res) => {
  try {
    const data = await proxyNaver('image', new URLSearchParams(req.query).toString());
    res.json(data);
  } catch (e) {
    console.error('Image proxy error:', e.message);
    res.status(502).json({ error: e.message, items: [] });
  }
});

app.get('/naver/static-map', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const title = String(req.query.title || '위치').slice(0, 40);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat/lng query parameters are required' });
    return;
  }

  if (!NAVER_MAPS_CLIENT_ID || !NAVER_MAPS_CLIENT_SECRET) {
    const fallback = new URL('https://staticmap.openstreetmap.de/staticmap.php');
    fallback.searchParams.set('center', `${lat},${lng}`);
    fallback.searchParams.set('zoom', '15');
    fallback.searchParams.set('size', '640x420');
    fallback.searchParams.set('markers', `${lat},${lng},red-pushpin`);
    res.redirect(302, fallback.toString());
    return;
  }

  const url = new URL('https://naveropenapi.apigw.ntruss.com/map-static/v2/raster');
  url.searchParams.set('center', `${lng},${lat}`);
  url.searchParams.set('level', '15');
  url.searchParams.set('w', '640');
  url.searchParams.set('h', '420');
  url.searchParams.set('scale', '2');
  url.searchParams.set('format', 'png');
  url.searchParams.set('markers', `type:d|size:mid|pos:${lng} ${lat}|label:${title.slice(0, 1)}`);

  try {
    const mapResponse = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': NAVER_MAPS_CLIENT_ID,
        'x-ncp-apigw-api-key': NAVER_MAPS_CLIENT_SECRET,
      },
    });

    if (!mapResponse.ok) {
      const text = await mapResponse.text();
      throw new Error(`Naver Static Map ${mapResponse.status}: ${text}`);
    }

    const buffer = Buffer.from(await mapResponse.arrayBuffer());
    res.setHeader('Content-Type', mapResponse.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (e) {
    console.error('Static map proxy error:', e.message);
    res.status(502).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Local server
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Naver proxy running on http://localhost:${PORT}`);
    console.log('Endpoints: /naver/blog, /naver/image, /health');
  });
}

// Vercel serverless export
module.exports = app;
