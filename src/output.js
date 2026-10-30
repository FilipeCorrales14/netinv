const SERVICES = {
  22: 'ssh',
  23: 'telnet',
  80: 'http',
  443: 'https',
  445: 'smb',
  554: 'rtsp',
  3389: 'rdp',
  5060: 'sip',
  8080: 'http-alt',
};

export function portLabel(port) {
  return SERVICES[port] ? `${port}/${SERVICES[port]}` : String(port);
}

export function toTable(result) {
  const rows = result.hosts.map((h) => [
    h.ip,
    h.hostname ?? '',
    h.mac ?? '',
    h.vendor ?? '',
    h.openPorts.map(portLabel).join(', '),
  ]);
  const header = ['IP', 'Nome', 'MAC', 'Fabricante', 'Portas abertas'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();

  return [
    line(header),
    widths.map((w) => '-'.repeat(w)).join('  '),
    ...rows.map(line),
    '',
    `${result.hosts.length} host(s) ativo(s) de ${result.scanned} verificado(s) em ${result.range}`,
  ].join('\n');
}

export function toCsv(result) {
  const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    'ip,hostname,mac,fabricante,portas_abertas',
    ...result.hosts.map((h) =>
      [h.ip, h.hostname ?? '', h.mac ?? '', h.vendor ?? '', h.openPorts.join(' ')].map(quote).join(','),
    ),
  ].join('\n');
}

export function toJson(result) {
  return JSON.stringify(result, null, 2);
}
