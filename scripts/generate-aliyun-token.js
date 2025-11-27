// Script to generate Aliyun ASR Token
// Usage:
//   1. Set environment variables: ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET
//   2. Run: node scripts/generate-aliyun-token.js
//
// Or provide credentials as command line arguments:
//   node scripts/generate-aliyun-token.js <ACCESS_KEY_ID> <ACCESS_KEY_SECRET>

import https from 'https';

const ACCESS_KEY_ID = process.argv[2] || process.env.ALIYUN_ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.argv[3] || process.env.ALIYUN_ACCESS_KEY_SECRET;

if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
  console.error('❌ Error: Missing credentials');
  console.error('\nUsage:');
  console.error('  Option 1: Set environment variables');
  console.error('    export ALIYUN_ACCESS_KEY_ID=your_key_id');
  console.error('    export ALIYUN_ACCESS_KEY_SECRET=your_key_secret');
  console.error('    node scripts/generate-aliyun-token.js');
  console.error('\n  Option 2: Pass as arguments');
  console.error('    node scripts/generate-aliyun-token.js <ACCESS_KEY_ID> <ACCESS_KEY_SECRET>');
  process.exit(1);
}

// Correct URL according to Aliyun documentation
const url = `https://nls-meta.cn-shanghai.aliyuncs.com/?Action=CreateToken&AccessKeyId=${encodeURIComponent(ACCESS_KEY_ID)}&Format=JSON`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.Token && result.Token.Id) {
        console.log('\n✅ Token generated successfully!\n');
        console.log('Token:', result.Token.Id);
        console.log('Expires:', new Date(result.Token.ExpireTime * 1000).toLocaleString());
        console.log('\nAdd this to your .env.local file:');
        console.log(`ALIYUN_TOKEN=${result.Token.Id}`);
      } else {
        console.error('❌ Failed to generate token:');
        console.error(JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.error('Response:', data);
    }
  });
}).on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});
