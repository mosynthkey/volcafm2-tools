import assert from 'node:assert/strict';
import { createSendRetry, SEND_MAX_ATTEMPTS } from '../src/utils/sendRetry';

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

let sends = 0;
const retry = createSendRetry(() => {
    sends += 1;
    retry.handleWriteState('sending');
}, 0);

retry.handleWriteState('error');
await flush();
assert.equal(sends, 0);
assert.equal(retry.showErrorDialog.value, false);

retry.handleWriteState('requesting');
retry.handleWriteState('received');
await flush();
assert.equal(sends, 0);

retry.handleWriteState('sending');
retry.handleWriteState('ok');
assert.equal(retry.lastFailure.value, null);
assert.equal(retry.retrying.value, false);

retry.handleWriteState('sending');
for (let failure = 1; failure < SEND_MAX_ATTEMPTS; failure++) {
    retry.handleWriteState(failure % 2 === 0 ? 'nak' : 'error');
    await flush();
    assert.equal(sends, failure);
    assert.equal(retry.retrying.value, true);
    assert.equal(retry.showErrorDialog.value, false);
}

retry.handleWriteState('nak');
await flush();
assert.equal(sends, SEND_MAX_ATTEMPTS - 1);
assert.equal(retry.retrying.value, false);
assert.equal(retry.showErrorDialog.value, true);
assert.equal(retry.lastFailure.value, 'nak');

console.log('Send retry verification passed.');
