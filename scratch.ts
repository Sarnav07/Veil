import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
const tx = new Transaction();
const a = tx.pure.u64(100);
console.log(a);
const b = tx.pure.vector('u8', Array.from(new Uint8Array([1, 2, 3])));
console.log(b);
