# netinv

Inventário de rede pela linha de comando. Varre uma faixa de IPs, descobre quais hosts estão ativos, quais portas de serviço estão abertas e, na rede local, o MAC e o fabricante de cada equipamento. Exporta em tabela, CSV ou JSON.

Feito para a primeira visita a uma rede desconhecida: levantar o que existe antes de documentar, migrar ou instalar algo novo.

```
$ netinv 192.168.1.0/24

IP             Nome           MAC                Fabricante               Portas abertas
-------------  -------------  -----------------  -----------------------  ------------------------
192.168.1.1    gateway.lan    F0:9F:C2:xx:xx:xx  Ubiquiti                 22/ssh, 80/http, 443/https
192.168.1.10   nas.lan        00:11:32:xx:xx:xx                           80/http, 445/smb
192.168.1.20                  B8:27:EB:xx:xx:xx  Raspberry Pi Foundation  22/ssh
192.168.1.31                  DA:A1:19:xx:xx:xx  (MAC local/aleatório)

4 host(s) ativo(s) de 254 verificado(s) em 192.168.1.0/24
```

(saída ilustrativa)

## Como usar

Node.js 22 ou superior, sem dependências e sem precisar de root.

```bash
node src/cli.js 192.168.1.0/24
node src/cli.js 10.0.0.0/24 --portas 22,80,443,8000-8010
node src/cli.js 192.168.1.0/24 --formato csv --saida inventario.csv
node src/cli.js 192.168.1.0/24 --oui oui.txt      # lista completa de fabricantes
```

| Opção        | Padrão                                  | Descrição                            |
| ------------ | --------------------------------------- | ------------------------------------ |
| `--portas`   | 22,23,80,443,445,554,3389,5060,8080     | lista ou faixas de portas TCP        |
| `--timeout`  | 800                                     | ms de espera por porta               |
| `--paralelo` | 128                                     | conexões simultâneas                 |
| `--formato`  | tabela                                  | `tabela`, `csv` ou `json`            |
| `--saida`    |                                         | grava em arquivo                     |
| `--oui`      | `data/oui.txt` (lista resumida)         | arquivo de fabricantes do IEEE       |
| `--sem-dns`  |                                         | pula a resolução reversa de nomes    |
| `--forcar`   |                                         | permite redes com mais de 4096 hosts |

As portas padrão cobrem o que costuma aparecer em rede corporativa: acesso remoto (SSH, Telnet, RDP), web, compartilhamento de arquivos (SMB), câmeras IP (RTSP) e telefonia (SIP).

**Use apenas em redes que você administra ou tem autorização para inventariar.**

## Como funciona

1. **Faixa de IPs.** `src/cidr.js` calcula rede, broadcast e hosts válidos com aritmética de 32 bits. Trata os casos especiais `/31` (enlace ponto a ponto) e `/32`.
2. **Descoberta sem ICMP.** Ping exige socket raw, ou seja, root. Em vez disso, o netinv tenta conexão TCP em cada porta. Um host é considerado ativo se *qualquer* porta responder, mesmo que seja com recusa (RST): a recusa já prova que existe um equipamento naquele IP.
3. **Paralelismo limitado.** `src/pool.js` mantém no máximo N conexões abertas. Sem esse limite, uma varredura de /24 com 9 portas abriria mais de 2 mil sockets de uma vez e esgotaria os descritores de arquivo.
4. **MAC e fabricante.** As próprias tentativas de conexão fazem o sistema operacional resolver ARP. Ao final, o netinv lê a tabela ARP (`/proc/net/arp` no Linux, `arp -a` no macOS e Windows) e cruza os 3 primeiros bytes do MAC com a lista de fabricantes. Um host que não respondeu em nenhuma porta mas apareceu no ARP também é listado.
5. **MAC aleatório.** Celulares modernos e interfaces de VM usam MAC "localmente administrado" (bit 1 do primeiro byte ligado). Esses aparecem marcados, para não serem confundidos com fabricante desconhecido.

## Limitações

- MAC e fabricante só aparecem para hosts no mesmo segmento de rede; depois de um roteador, o ARP mostra apenas o gateway.
- Host com firewall bloqueando todas as portas testadas e fora do segmento local não é detectado.
- A lista de fabricantes que acompanha o projeto é resumida. Para cobertura completa, baixe a lista oficial em `https://standards-oui.ieee.org/oui/oui.txt` e use `--oui`.

## Testes

```bash
npm test
```

Os testes de varredura sobem servidores TCP reais em portas locais e usam sondas simuladas para cobrir os cenários de host ativo, recusando conexão e filtrado.

## Próximos passos

- Comparar duas varreduras e mostrar o que entrou e saiu da rede.
- Identificar o serviço pelo banner (versão do SSH, servidor HTTP).
- Suporte a IPv6.

## Licença

MIT
