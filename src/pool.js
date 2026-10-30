// Executa fn sobre os itens com no máximo `limit` promessas em paralelo.
// Abrir milhares de sockets ao mesmo tempo esgota descritores de arquivo
// e ainda gera falso "filtrado" por causa da fila do próprio sistema.

export async function mapLimit(items, limit, fn) {
  const list = [...items];
  const results = new Array(list.length);
  let next = 0;

  async function worker() {
    while (next < list.length) {
      const index = next++;
      results[index] = await fn(list[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length) }, worker);
  await Promise.all(workers);
  return results;
}
