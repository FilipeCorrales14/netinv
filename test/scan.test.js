import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { probe } from '../src/probe.js';
import { scan } from '../src/scan.js';
import { toTable, toCsv } from '../src/output.js';

let server;
let openPort;
let closedPort;

before(async () => {
  server = net.createServer((socket) => socket.end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  openPort = server.address().port;

  const tmp = net.createServer();
  await new Promise((r) => tmp.listen(0, '127.0.0.1', r));
  closedPort = tmp.address().port;
  await new Promise((r) => tmp.close(r));
});

after(() => server.close());

test('probe distingue porta aberta e fechada', async () => {
  assert.equal(await probe('127.0.0.1', openPort, 1000), 'open');
  assert.equal(await probe('127.0.0.1', closedPort, 1000), 'closed');
});

test('scan real em 127.0.0.1/32', async () => {
  const result = await scan('127.0.0.1/32', {
    ports: [openPort, closedPort],
    resolveNames: false,
    arp: async () => new Map(),
  });
  assert.equal(result.scanned, 1);
  assert.deepEqual(result.hosts, [
    { ip: '127.0.0.1', hostname: null, mac: null, vendor: null, openPorts: [openPort] },
  ]);
});

test('host que só responde RST conta como ativo; sem resposta não conta', async () => {
  const fakeProbe = async (host, port) => {
    if (host === '10.0.0.1') return port === 22 ? 'open' : 'closed';
    if (host === '10.0.0.2') return 'closed';
    return 'filtered';
  };
  const result = await scan('10.0.0.0/29', {
    ports: [22, 80],
    resolveNames: false,
    probe: fakeProbe,
    arp: async () => new Map([['10.0.0.5', '00:50:56:AA:BB:CC']]),
    oui: new Map([['00:50:56', 'VMware']]),
  });

  assert.equal(result.scanned, 6);
  assert.deepEqual(
    result.hosts.map((h) => [h.ip, h.openPorts, h.vendor]),
    [
      ['10.0.0.1', [22], null],
      ['10.0.0.2', [], null],
      // filtrado em todas as portas, mas respondeu ao ARP
      ['10.0.0.5', [], 'VMware'],
    ],
  );
});

test('saídas em tabela e CSV', () => {
  const result = {
    range: '10.0.0.0/30',
    scanned: 2,
    hosts: [{ ip: '10.0.0.1', hostname: 'sw-core', mac: '00:00:0C:01:02:03', vendor: 'Cisco Systems', openPorts: [22, 443] }],
  };
  const table = toTable(result);
  assert.match(table, /10\.0\.0\.1\s+sw-core\s+00:00:0C:01:02:03\s+Cisco Systems\s+22\/ssh, 443\/https/);
  assert.match(table, /1 host\(s\) ativo\(s\) de 2/);
  assert.equal(toCsv(result).split('\n')[1], '10.0.0.1,sw-core,00:00:0C:01:02:03,Cisco Systems,22 443');
});
