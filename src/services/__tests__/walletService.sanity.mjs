// Sanity check for wallet balance arithmetic.
//
// Postgres `numeric` columns come back from supabase-js as strings, so doing
// `wallet.balance + amount` would silently produce string concatenation
// (e.g. "100" + 50 -> "10050"). walletService.creditWallet/debitWallet now
// coerce balance/total_credited/total_debited/amount with `Number(...) || 0`
// before doing arithmetic. This script mirrors that logic and asserts it
// always returns numeric results.
//
// Run with: `node src/services/__tests__/walletService.sanity.mjs`

function creditBalance(walletBalance, amount) {
  const currentBalance = Number(walletBalance) || 0;
  const numericAmount = Number(amount) || 0;
  return currentBalance + numericAmount;
}

function debitBalance(walletBalance, amount) {
  const currentBalance = Number(walletBalance) || 0;
  const numericAmount = Number(amount) || 0;
  return currentBalance - numericAmount;
}

const cases = [
  { label: 'credit string balance + number amount', fn: creditBalance, a: '100',   b: 50,    want: 150 },
  { label: 'credit string balance + string amount', fn: creditBalance, a: '100.5', b: '49.5', want: 150 },
  { label: 'credit null balance',                   fn: creditBalance, a: null,    b: 25,    want: 25  },
  { label: 'debit string balance',                  fn: debitBalance,  a: '200',   b: 75,    want: 125 },
  { label: 'debit zero',                            fn: debitBalance,  a: 0,       b: '0',   want: 0   },
];

let failed = 0;
for (const c of cases) {
  const got = c.fn(c.a, c.b);
  const ok = typeof got === 'number' && got === c.want;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${c.label}: got ${JSON.stringify(got)} (${typeof got}), want ${c.want}`);
}

if (('100' + 50) !== '10050') {
  console.log('FAIL  baseline string-concat behavior changed');
  failed++;
} else {
  console.log("OK    baseline confirms naive '100' + 50 would produce '10050'");
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll wallet arithmetic sanity checks passed.');
