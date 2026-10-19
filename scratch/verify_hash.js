const crypto = require('crypto');

const password = 'Lina12345678';
const salt = Buffer.from('b16d22ddded0e0a53502a47aed1301aa', 'hex');
const iterations = 310000;
const keylen = 32; // 256 bits = 32 bytes

const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, 'sha256');
const hashHex = derived.toString('hex');

console.log('Derived hash: ', hashHex);
console.log('Expected hash: 518212696f8b30738c2e314ebb3df823ade748dd3b2baaa1f50052458eb34f3b');
console.log('Matches:', hashHex === '518212696f8b30738c2e314ebb3df823ade748dd3b2baaa1f50052458eb34f3b');
