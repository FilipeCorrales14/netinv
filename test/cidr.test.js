import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipToInt, intToIp, parseCidr } from '../src/cidr.js';

test('conversão IP <-> inteiro sem sinal', () => {
  assert.equal(ipToInt('192.168.1.1'), 3232235777);
  assert.equal(intToIp(3232235777), '192.168.1.1');
  assert.equal(intToIp(ipToInt('255.255.255.255')), '255.255.255.255');
  assert.throws(() => ipToInt('192.168.1.256'));
  assert.throws(() => ipToInt('10.0.0'));
  assert.throws(() => ipToInt('10.0.0.a'));
});

test('/24 exclui rede e broadcast', () => {
  const r = parseCidr('192.168.1.77/24');
  assert.equal(r.network, '192.168.1.0');
  assert.equal(r.broadcast, '192.168.1.255');
  assert.equal(r.first, '192.168.1.1');
  assert.equal(r.last, '192.168.1.254');
  assert.equal(r.size, 254);
  assert.equal([...r.hosts()].length, 254);
});

test('/30, /31 e /32', () => {
  assert.deepEqual([...parseCidr('10.0.0.0/30').hosts()], ['10.0.0.1', '10.0.0.2']);
  assert.deepEqual([...parseCidr('10.0.0.0/31').hosts()], ['10.0.0.0', '10.0.0.1']);
  assert.deepEqual([...parseCidr('10.0.0.5').hosts()], ['10.0.0.5']);
});

test('prefixo que não cai em octeto inteiro', () => {
  const r = parseCidr('172.16.5.130/26');
  assert.equal(r.network, '172.16.5.128');
  assert.equal(r.broadcast, '172.16.5.191');
  assert.equal(r.size, 62);
});

test('prefixo inválido', () => {
  assert.throws(() => parseCidr('10.0.0.0/33'));
  assert.throws(() => parseCidr('10.0.0.0/x'));
});
