# Rodando em produção

O sistema é um único processo Node.js com banco SQLite em arquivo, então roda
bem em qualquer computador sempre ligado no local do evento (PC, notebook,
mini PC ou Raspberry Pi). Celulares e a TV acessam pela rede Wi-Fi.

## 1. Instalação

Pré-requisito: [Node.js 20 ou superior](https://nodejs.org).

```bash
git clone https://github.com/guruwlsnetflix-collab/tabela-sinuca.git
cd tabela-sinuca
npm ci --omit=dev
cp .env.example .env
npm run db:init
```

No `.env`, defina pelo menos:

| Variável         | Valor                         |
| ---------------- | ----------------------------- |
| `NODE_ENV`       | `production`                  |
| `SENHA_MAESTRA`  | senha forte de administrador  |
| `SESSION_SECRET` | texto aleatório (veja abaixo) |

Sem `SENHA_MAESTRA`, uma senha temporária é gerada a cada reinício e só aparece
no terminal. Para gerar o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Iniciar o servidor

```bash
npm start
```

O terminal mostra `Tabela de Sinuca rodando em http://0.0.0.0:3000`.

## 3. Acessar pelos celulares e pela TV

1. Descubra o IP do computador na rede: `ipconfig` (Windows) ou `ip addr` (Linux).
2. Nos outros aparelhos, abra `http://<ip-do-computador>:3000`
   (ex.: `http://192.168.0.15:3000`).
3. Na TV/Fire Stick, abra o painel do evento ou torneio (botão **Painel TV**) e
   pressione **OK** no controle para tela cheia.

> **Dica:** reserve um IP fixo para o computador nas configurações do roteador
> (DHCP estático), assim o endereço não muda entre um evento e outro.
>
> **Windows:** na primeira execução, permita o Node.js no Firewall para
> **redes privadas**, senão os outros aparelhos não conseguem acessar.

## 4. Manter rodando sozinho (opcional)

Com o [PM2](https://pm2.keymetrics.io), o servidor reinicia sozinho se cair:

```bash
npm install -g pm2
pm2 start src/server.js --name sinuca
pm2 save
```

Para iniciar junto com o sistema: `pm2 startup` (Linux/macOS) ou o pacote
`pm2-windows-startup` (Windows).

## 5. Backup

Todos os dados ficam no arquivo SQLite (`DATABASE_PATH`, padrão `data/sinuca.db`).
Faça backup com o servidor rodando mesmo:

```bash
npm run db:backup              # salva em data/backups/sinuca-AAAA-MM-DD-HH-MM-SS.db
npm run db:backup -- D:/backup # ou em outra pasta (pendrive, pasta sincronizada)
```

Não copie o `sinuca.db` manualmente com o servidor ligado: parte dos dados
recentes fica no arquivo `-wal` e a cópia pode sair incompleta. Para restaurar,
pare o servidor e substitua o `sinuca.db` pelo arquivo do backup.

## 6. Atualizar para uma nova versão

```bash
npm run db:backup
git pull
npm ci --omit=dev
npm run db:init   # aplica alterações de esquema, mantendo os dados
pm2 restart sinuca   # ou pare e rode npm start de novo
```

### Publicar em um servidor remoto (VM)

Com acesso SSH ao servidor, rode a partir do seu computador:

```bash
npm run publicar            # publica a branch main do GitHub
npm run publicar -- status  # mostra versão, processo e saúde do app
```

O script faz backup do banco, atualiza o código, reinstala as dependências,
reinicia o processo do pm2 e confere `/health`. Se o app não responder,
volta sozinho para a versão anterior. Servidor, chave SSH e pastas são
configurados por variáveis `SINUCA_*` (veja o topo de `scripts/publicar.sh`).

## Acesso pela internet (opcional)

Para acompanhar de fora da rede local, coloque o app atrás de um proxy com
HTTPS (por exemplo, [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/),
gratuito e sem abrir portas no roteador) e defina `TRUST_PROXY=true` no `.env`.
Assim o limite de tentativas de login enxerga o IP real de cada visitante e o
cookie de sessão passa a exigir HTTPS automaticamente.
