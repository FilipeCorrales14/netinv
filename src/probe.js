import net from 'node:net';

// Resultado de uma tentativa de conexão TCP:
//   open      handshake completo
//   closed    o host respondeu com RST: a porta está fechada, mas o host existe
//   filtered  sem resposta dentro do timeout (firewall descartando ou host inexistente)
//
// O caso "closed" é o que permite descobrir hosts sem ICMP e sem root:
// um RST prova que tem alguém ali.

export function probe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let done = false;

    const finish = (state) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(state);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('open'));
    socket.once('timeout', () => finish('filtered'));
    socket.once('error', (err) => {
      if (err.code === 'ECONNREFUSED') finish('closed');
      else finish('filtered');
    });
  });
}
