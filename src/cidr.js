// Aritmética de IPv4 com inteiros de 32 bits. O ">>> 0" força o resultado
// a ser tratado como inteiro sem sinal; sem ele, 192.168.x.x vira negativo.

export function ipToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) throw new Error(`IP inválido: ${ip}`);
  return parts.reduce((acc, part) => {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) throw new Error(`IP inválido: ${ip}`);
    return ((acc << 8) | Number(part)) >>> 0;
  }, 0);
}

export function intToIp(n) {
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
}

export function parseCidr(input) {
  const [ip, prefixText = '32'] = input.split('/');
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`prefixo inválido: /${prefixText}`);

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipToInt(ip) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  // /31 (enlace ponto a ponto, RFC 3021) e /32 não têm endereço de rede
  // nem de broadcast reservados.
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;

  return {
    prefix,
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    first: intToIp(first),
    last: intToIp(last),
    size: last - first + 1,
    *hosts() {
      for (let n = first; n <= last; n++) yield intToIp(n);
    },
  };
}
