import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUNDLED = fileURLToPath(new URL('../data/oui.txt', import.meta.url));

// Aceita duas formas de linha:
//   - a lista resumida do projeto:  B8:27:EB  Raspberry Pi Foundation
//   - o arquivo oficial do IEEE:    B8-27-EB   (hex)		Raspberry Pi Foundation
export function parseOui(text) {
  const table = new Map();
  for (const line of text.split('\n')) {
    const match = /^\s*([0-9A-F]{2})[:-]([0-9A-F]{2})[:-]([0-9A-F]{2})\s+(?:\(hex\)\s+)?(.+?)\s*$/i.exec(line);
    if (match) table.set(`${match[1]}:${match[2]}:${match[3]}`.toUpperCase(), match[4]);
  }
  return table;
}

export function loadOui(path = BUNDLED) {
  return parseOui(readFileSync(path, 'utf8'));
}

export function vendorOf(mac, table) {
  if (!mac) return null;
  const firstOctet = parseInt(mac.slice(0, 2), 16);
  // Bit "localmente administrado": MAC gerado por software, como os
  // endereços aleatórios de celulares e as interfaces de VM/container.
  if (firstOctet & 0b10) {
    return table.get(mac.slice(0, 8)) ?? '(MAC local/aleatório)';
  }
  return table.get(mac.slice(0, 8)) ?? null;
}
