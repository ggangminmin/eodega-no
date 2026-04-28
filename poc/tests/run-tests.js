const tests = [
  require('./index-html.test'),
  require('./naver-proxy.test'),
  require('./onboarding.test'),
];

async function main() {
  let passed = 0;

  for (const testCase of tests) {
    try {
      await testCase.run();
      passed += 1;
      console.log(`PASS ${testCase.name}`);
    } catch (error) {
      console.error(`FAIL ${testCase.name}`);
      console.error(error && error.stack ? error.stack : error);
      process.exit(1);
    }
  }

  console.log(`All tests passed (${passed}/${tests.length})`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
