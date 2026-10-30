import { promises as dns } from 'node:dns';
import { parseCidr } from './cidr.js';
import { mapLimit } from './pool.js';
import { probe as tcpProbe } from './probe.js';
import { readArpTable } from './arp.js';
import { vendorOf } from './oui.js';

export const DEFAULT_PORTS = [22, 23, 80, 443, 445, 554, 3389, 5060, 8080];

export async function scan(target, options = {}) {
  const {
    ports = DEFAULT_PORTS,
    timeoutMs = 800,
    concurrency = 128,
    resolveNames = true,
    oui = new Map(),
    probe = tcpProbe,
    arp = readArpTable,
    onProgress = () => {},
  } = options;

  const range = parseCidr(target);
  const hosts = [...range.hosts()];
  const jobs = hosts.flatMap((host) => ports.map((port) => ({ host, port })));

  let completed = 0;
  const states = await mapLimit(jobs, concurrency, async ({ host, port }) => {
    const state = await probe(host, port, timeoutMs);
    onProgress(++completed, jobs.length);
    return { host, port, state };
  });

  const byHost = new Map();
  for (const { host, port, state } of states) {
    if (!byHost.has(host)) byHost.set(host, { open: [], responded: false });
    const entry = byHost.get(host);
    if (state === 'open') entry.open.push(port);
    if (state !== 'filtered') entry.responded = true;
  }

  // As tentativas de conexão na rede local fazem o sistema resolver ARP,
  // então a tabela lida agora já tem os MACs dos hosts que responderam.
  const arpTable = await arp();

  const alive = hosts.filter((h) => byHost.get(h).responded || arpTable.has(h));
  const results = await mapLimit(alive, 32, async (ip) => {
    const mac = arpTable.get(ip) ?? null;
    return {
      ip,
      hostname: resolveNames ? await reverseLookup(ip) : null,
      mac,
      vendor: vendorOf(mac, oui),
      openPorts: byHost.get(ip).open.sort((a, b) => a - b),
    };
  });

  return { range: `${range.network}/${range.prefix}`, scanned: hosts.length, ports, hosts: results };
}

async function reverseLookup(ip) {
  try {
    const timeout = new Promise((resolve) => setTimeout(resolve, 1000, []));
    const names = await Promise.race([dns.reverse(ip), timeout]);
    return names[0] ?? null;
  } catch {
    return null;
  }
}
