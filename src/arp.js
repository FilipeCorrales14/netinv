import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MAC = /([0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2}/i;

export function normalizeMac(mac) {
  return mac
    .split(/[:-]/)
    .map((p) => p.padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

// Formato de /proc/net/arp (Linux):
// IP address       HW type     Flags       HW address            Mask     Device
// 192.168.1.1      0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0
export function parseProcArp(text) {
  const table = new Map();
  for (const line of text.split('\n').slice(1)) {
    const [ip, , flags, mac] = line.trim().split(/\s+/);
    // Flags 0x0 = entrada incompleta (o host não respondeu ao ARP).
    if (!ip || !mac || flags === '0x0' || mac === '00:00:00:00:00:00') continue;
    table.set(ip, normalizeMac(mac));
  }
  return table;
}

// Saída de `arp -a` no macOS e Windows. Os formatos diferem, então a
// busca é por "algo que parece IP" e "algo que parece MAC" na mesma linha.
export function parseArpCommand(text) {
  const table = new Map();
  for (const line of text.split('\n')) {
    const ip = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/.exec(line)?.[1];
    const mac = MAC.exec(line)?.[0];
    if (ip && mac && !/^(ff[:-]){5}ff$/i.test(mac)) table.set(ip, normalizeMac(mac));
  }
  return table;
}

export async function readArpTable() {
  try {
    return parseProcArp(await readFile('/proc/net/arp', 'utf8'));
  } catch {
    try {
      const { stdout } = await run('arp', ['-a'], { timeout: 5000 });
      return parseArpCommand(stdout);
    } catch {
      return new Map();
    }
  }
}
