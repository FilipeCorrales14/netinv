#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scan, DEFAULT_PORTS } from './scan.js';
import { parseCidr } from './cidr.js';
import { loadOui } from './oui.js';
import { toTable, toCsv, toJson } from './output.js';

const MAX_HOSTS = 4096;

const HELP = `Uso: netinv <rede/prefixo> [opções]

Exemplos:
  netinv 192.168.1.0/24
  netinv 10.0.0.0/24 --portas 22,80,443 --formato csv --saida inventario.csv

Opções:
  --portas <lista>      portas TCP testadas (padrão: ${DEFAULT_PORTS.join(',')})
  --timeout <ms>        tempo de espera por porta (padrão: 800)
  --paralelo <n>        conexões simultâneas (padrão: 128)
  --formato <f>         tabela, csv ou json (padrão: tabela)
  --saida <arquivo>     grava o resultado em arquivo
  --oui <arquivo>       lista de fabricantes do IEEE (oui.txt)
  --sem-dns             não faz resolução reversa de nomes
  --forcar              permite redes com mais de ${MAX_HOSTS} hosts

Use apenas em redes que você administra ou tem autorização para inventariar.`;

export function parsePorts(text) {
  const ports = new Set();
  for (const part of text.split(',')) {
    const range = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!range) throw new Error(`porta inválida: "${part}"`);
    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    if (start < 1 || end > 65535 || start > end) throw new Error(`faixa de portas inválida: "${part}"`);
    for (let p = start; p <= end; p++) ports.add(p);
  }
  return [...ports].sort((a, b) => a - b);
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      portas: { type: 'string' },
      timeout: { type: 'string', default: '800' },
      paralelo: { type: 'string', default: '128' },
      formato: { type: 'string', default: 'tabela' },
      saida: { type: 'string' },
      oui: { type: 'string' },
      'sem-dns': { type: 'boolean', default: false },
      forcar: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return 0;
  }

  const formatters = { tabela: toTable, csv: toCsv, json: toJson };
  const format = formatters[values.formato];
  if (!format) throw new Error(`formato desconhecido: ${values.formato}`);

  for (const option of ['timeout', 'paralelo']) {
    const n = Number(values[option]);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--${option} deve ser um inteiro positivo`);
  }

  const ports = values.portas ? parsePorts(values.portas) : DEFAULT_PORTS;
  const { size } = parseCidr(positionals[0]);
  if (size > MAX_HOSTS && !values.forcar) {
    throw new Error(`a rede tem ${size} hosts. Use um prefixo menor ou --forcar`);
  }

  const showProgress = process.stderr.isTTY;
  const result = await scan(positionals[0], {
    ports,
    timeoutMs: Number(values.timeout),
    concurrency: Number(values.paralelo),
    resolveNames: !values['sem-dns'],
    oui: loadOui(values.oui),
    onProgress: (done, total) => {
      if (showProgress && (done % 50 === 0 || done === total)) {
        process.stderr.write(`\r${done}/${total} verificações`);
      }
    },
  });
  if (showProgress) process.stderr.write('\n');

  const output = format(result);
  if (values.saida) {
    writeFileSync(values.saida, `${output}\n`);
    console.log(`Resultado gravado em ${values.saida} (${result.hosts.length} host(s))`);
  } else {
    console.log(output);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (err) => {
      console.error(`erro: ${err.message}`);
      process.exitCode = 1;
    },
  );
}
