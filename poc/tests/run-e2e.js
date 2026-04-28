const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../dev-server');

async function main() {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);

    const indexResponse = await fetch(baseUrl);
    assert.equal(indexResponse.status, 200);
    const html = await indexResponse.text();
    assert.match(html, /어데가노/);
    assert.match(html, /id="screen-home"/);
    assert.match(html, /id="screen-list"/);
    assert.match(html, /id="screen-detail"/);
    assert.match(html, /맞춤 코스가 답이다/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  console.log('PASS dev server e2e smoke');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
