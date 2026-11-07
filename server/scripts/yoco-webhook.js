'use strict';

/**
 * Registers this server's payment webhook with Yoco and prints the secret
 * Yoco returns, which it shows only once. Put that secret in the server's
 * YOCO_WEBHOOK_SECRET setting; Yoco payments are offered only once it is set.
 *
 * Run once per server, with the secret key in the environment:
 *   YOCO_SECRET_KEY=sk_test_... npm run yoco:webhook -- https://ithrift-api.onrender.com
 */

const yoco = require('../payments/yoco');

async function main() {
  const base = process.argv[2];
  if (!process.env.YOCO_SECRET_KEY) throw new Error('Set YOCO_SECRET_KEY first.');
  if (!base || !/^https:\/\//.test(base)) throw new Error('Give the server\'s public https address, for example https://ithrift-api.onrender.com');
  const hook = await yoco.registerWebhook(base);
  console.log(`Registered ${hook.url} (${hook.mode} mode).`);
  console.log('Set this as YOCO_WEBHOOK_SECRET on the server. Yoco will not show it again:');
  console.log(hook.secret);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
