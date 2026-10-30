import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLimit } from '../src/pool.js';
import { parseProcArp, parseArpCommand, normalizeMac } from '../src/arp.js';
import { parseOui, vendorOf, loadOui } from '../src/oui.js';
import { parsePorts } from '../src/cli.js';

test('mapLimit respeita o limite e preserva a ordem', async () => {
  let running = 0;
  let peak = 0;
  const result = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, n * 5));
    running--;
    return n * 10;
  });
  assert.deepEqual(result, [50, 10, 40, 20, 30]);
  assert.equal(peak, 2);
});

test('lê /proc/net/arp ignorando entradas incompletas', () => {
  const text = `IP address       HW type     Flags       HW address            Mask     Device
192.168.1.1      0x1         0x2         b8:27:eb:12:34:56     *        eth0
192.168.1.50     0x1         0x0         00:00:00:00:00:00     *        eth0
192.168.1.60     0x1         0x2         52:54:00:aa:bb:cc     *        eth0`;
  const table = parseProcArp(text);
  assert.equal(table.size, 2);
  assert.equal(table.get('192.168.1.1'), 'B8:27:EB:12:34:56');
});

test('lê saída do arp -a do Windows e do macOS', () => {
  const windows = `Interface: 192.168.0.10 --- 0x4
  Endereço IP           Endereço físico       Tipo
  192.168.0.1           00-50-56-c0-00-08     dinâmico
  192.168.0.255         ff-ff-ff-ff-ff-ff     estático`;
  const mac = `? (10.0.0.1) at 0:c:29:a:b:c on en0 ifscope [ethernet]`;
  assert.deepEqual([...parseArpCommand(windows)], [['192.168.0.1', '00:50:56:C0:00:08']]);
  assert.equal(parseArpCommand(mac).get('10.0.0.1'), '00:0C:29:0A:0B:0C');
});

test('normalizeMac completa zeros à esquerda', () => {
  assert.equal(normalizeMac('0:c:29:a:b:c'), '00:0C:29:0A:0B:0C');
});

test('OUI: formato do projeto e do IEEE', () => {
  const table = parseOui('B8:27:EB  Raspberry Pi Foundation\nDC-A6-32   (hex)\t\tRaspberry Pi Trading Ltd\n# comentário');
  assert.equal(table.get('B8:27:EB'), 'Raspberry Pi Foundation');
  assert.equal(table.get('DC:A6:32'), 'Raspberry Pi Trading Ltd');
  assert.equal(table.size, 2);
});

test('vendorOf identifica fabricante e MAC localmente administrado', () => {
  const table = loadOui();
  assert.equal(vendorOf('00:50:56:01:02:03', table), 'VMware');
  assert.equal(vendorOf('52:54:00:01:02:03', table), 'QEMU/KVM');
  assert.equal(vendorOf('DA:A1:19:01:02:03', table), '(MAC local/aleatório)');
  assert.equal(vendorOf('00:11:22:33:44:55', table), null);
  assert.equal(vendorOf(null, table), null);
});

test('parsePorts aceita lista e faixa', () => {
  assert.deepEqual(parsePorts('443,22,80-82,22'), [22, 80, 81, 82, 443]);
  assert.throws(() => parsePorts('0'));
  assert.throws(() => parsePorts('90-80'));
  assert.throws(() => parsePorts('http'));
});
