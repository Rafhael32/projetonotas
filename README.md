# Node Notas

Aplicação de notas com interface web, cadastro e login, construída com Node.js, TypeScript, Express, Drizzle, Zod e PostgreSQL.

## Acessar online

**[Abrir o Caderno](https://projetonotas-rafhael3.vercel.app)**

Crie uma conta no aplicativo para salvar e gerenciar suas notas. Não é necessário ter conta na Vercel. Cada usuário acessa apenas suas próprias notas.

## Instalar como aplicativo (PWA)

Abra o [Caderno](https://projetonotas-rafhael3.vercel.app) no navegador. No Chrome/Edge compatível, use **Instalar Caderno**, quando o botão aparecer, ou a opção de instalação no menu do navegador. No iPhone/iPad, use **Compartilhar → Adicionar à Tela de Início**. A disponibilidade e o nome da opção dependem do navegador.

O aplicativo instalado abre em uma janela própria. Cadastro, login e acesso ou alteração de notas exigem internet. Após a primeira visita online e a ativação do service worker, abrir o app sem conexão mostra uma tela com a opção de tentar novamente. Se a conexão cair com o aplicativo aberto, um aviso aparece sem descartar o texto do editor; salvar exige reconexão.

O service worker armazena somente a página offline: notas, tokens e respostas da API não são guardados no Cache Storage. Não há edição offline com sincronização. As atualizações do aplicativo são buscadas pela rede; ao alterar a página offline, incremente a versão do cache em `public/sw.js`.

## Hospedagem e banco de dados

| Ambiente | Aplicação | Banco de dados |
| --- | --- | --- |
| Produção | [Vercel](https://projetonotas-rafhael3.vercel.app) | PostgreSQL no Neon |
| Desenvolvimento local | http://localhost:3000 | PostgreSQL no Docker, em localhost:6000 |

O banco online persiste os usuários e as notas independentemente do computador de desenvolvimento. Os bancos local e online são separados: contas e notas criadas localmente não aparecem automaticamente no site, e vice-versa.

O projeto `projetonotas` na Vercel está conectado ao [repositório no GitHub](https://github.com/Rafhael32/projetonotas). Alterações enviadas à branch `main` acionam um novo deploy de produção.

A entrada da aplicação na Vercel é `app.ts`, que exporta o Express e integra o pool PostgreSQL ao ciclo de execução da plataforma. Os arquivos de `public/` são distribuídos pela Vercel. A conexão com o Neon é configurada pela variável de ambiente `DATABASE_URL` na hospedagem; credenciais e arquivos `.env` não devem ser versionados.

As migrações iniciais já foram aplicadas ao banco online. Novas alterações de schema exigem aplicar as migrações versionadas de `drizzle/` no banco correspondente; o deploy não executa `db:migrate` automaticamente. Para migrar o Neon, use a conexão direta `DATABASE_URL_UNPOOLED` como valor de `DATABASE_URL` no processo de migração. O comando local usa o banco configurado no ambiente em que é executado.

## Executar localmente

Requisitos: Node.js 22 ou superior, npm e Docker com Compose.

1. Execute `npm install` (ou `npm ci` com o lockfile).
2. Crie `.env` a partir de `.env-example` e preencha os valores abaixo.
3. Execute `npm run db:up`.
4. Execute `npm run db:migrate`.
5. Opcionalmente, após cadastrar um usuário, defina `SEED_USER_ID` com seu UUID e execute `npm run db:seed`.
6. Execute `npm run dev`. API em http://localhost:3000.

```dotenv
PORT="3000"
DATABASE_URL="postgresql://notes:notes_local@localhost:6000/notes"
```

O Compose expõe o PostgreSQL somente em localhost:6000. As credenciais acima são de desenvolvimento local. O arquivo `.env` é ignorado pelo Git; `.env-example` mantém os placeholders solicitados.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor com recarga automática |
| `npm run build` | Compilar para dist |
| `npm start` | Executar build compilado |
| `npm test` | Testes HTTP com PostgreSQL real |
| `npm run db:up` | Subir banco e aguardar healthcheck |
| `npm run db:down` | Parar banco preservando o volume |
| `npm run db:generate` | Gerar migração após alterar schema |
| `npm run db:migrate` | Aplicar migrações versionadas |
| `npm run db:seed` | Inserir exemplos para SEED_USER_ID se ele não tiver notas |

Os testes criam um schema com nome aleatório no banco configurado e removem apenas esse schema ao terminar. Exigem permissão de criação de schema; não apagam as notas da aplicação.

## Endpoints

| Método | Caminho | Resposta |
| --- | --- | --- |
| POST | /notes | 201 com nota criada |
| GET | /notes | 200 com as notas do usuário autenticado, por ID crescente |
| GET | /notes/:id | 200 com nota |
| PUT | /notes/:id | 200 com nota atualizada |
| DELETE | /notes/:id | 204 sem corpo |

POST e PUT exigem `Content-Type: application/json` e ambos os campos:

```json
{ "title": "Compras", "text": "Comprar café e pão." }
```

Resposta:

```json
{ "id": 1, "title": "Compras", "text": "Comprar café e pão.", "id_user": "uuid-do-usuario" }
```

O título é aparado nas extremidades. Título e texto não podem conter somente espaços; a formatação do texto é preservada. PUT substitui ambos os campos. Campos extras e qualquer query são rejeitados. IDs são inteiros positivos até 2147483647. GET e DELETE não exigem body.

PowerShell (após cadastrar um usuário):

```powershell
$session = Invoke-RestMethod http://localhost:3000/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"Pessoa@example.com","password":"1234"}'
$headers = @{ Authorization = "Bearer $($session.token)" }
Invoke-RestMethod -Headers $headers http://localhost:3000/notes -Method Post -ContentType 'application/json' -Body '{"title":"Compras","text":"Comprar pão."}'
Invoke-RestMethod -Headers $headers http://localhost:3000/notes
Invoke-RestMethod -Headers $headers http://localhost:3000/notes/1 -Method Put -ContentType 'application/json' -Body '{"title":"Compras","text":"Comprar café."}'
Invoke-RestMethod -Headers $headers http://localhost:3000/notes/1 -Method Delete
```

Erros seguem `{ "error": { "code": "...", "message": "...", "details": [] } }`, com details apenas quando aplicável. Retornos: 400 para validação/JSON malformado, 404 para nota ou rota inexistente, 413 para body acima de 1 MB, 415 para formato/codificação não suportado e 500 para falha interna.

## Decisões de implementação

Foram adotadas as propostas do [PRD](./PRD.md): PostgreSQL, ID inteiro, rotas /notes, PUT completo, exclusão definitiva e ordenação por ID. O limite de body foi fixado em 1 MB; não há limites adicionais por campo. O seed roda em transação e ignora usuários que já possuem notas, inclusive em execuções concorrentes.

Todas as rotas de notas exigem autenticação com Bearer token e não possuem paginação. O volume persiste ao parar e subir o banco; `docker compose down -v` remove os dados.

A configuração de migrações segue a [documentação do Drizzle](https://orm.drizzle.team/docs/get-started/postgresql-new), e os schemas estritos usam a [API do Zod](https://zod.dev/api).
## Cadastro

`POST /auth/register` recebe JSON:

```json
{ "email": "Pessoa@example.com", "password": "1234" }
```

Retorna `201` com apenas `id` (UUID) e `email` em minúsculas. E-mails repetidos retornam `409 EMAIL_ALREADY_EXISTS`, inclusive em requisições simultâneas. Entradas inválidas retornam `400`. A tabela `users` possui email único e armazena a senha como hash bcrypt com custo 12.

A senha exige no mínimo 4 caracteres e no máximo 72 bytes UTF-8, para evitar o truncamento descrito na [documentação do bcrypt](https://github.com/kelektiv/node.bcrypt.js/). A senha não é aparada nem normalizada. Body aceita apenas email e password; params e query não aceitam campos.

Execute `npm run db:migrate` para criar a tabela. 
## Login

`POST /auth/login` recebe `{ "email": "Pessoa@example.com", "password": "1234" }`.

O e-mail é convertido para minúsculas. A senha exige ao menos 4 caracteres e no máximo 72 bytes UTF-8, seguindo a validação do cadastro. Campos extras e query são rejeitados com 400.

Credenciais válidas retornam 200 com apenas `{ "id": "uuid-do-usuario", "token": "token-aleatorio" }`. O token tem 32 bytes gerados por `node:crypto.randomBytes` e representados por 64 caracteres hexadecimais. O mesmo valor é persistido em `users.token`, campo text nullable. Cada login substitui o token anterior; novos usuários começam com token nulo.

E-mail não cadastrado e senha incorreta retornam a mesma resposta 401: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "E-mail ou senha inválidos." } }`. Falhas de login não alteram o token existente.

Execute `npm run db:migrate` para adicionar o campo a bancos existentes. A alteração preserva os usuários. Expiração e logout não fazem parte desta implementação.
## Autorização

Todas as rotas `/notes` e `/notes/:id` exigem o header `Authorization: Bearer <token>` retornado pelo login. O middleware usa o serviço de autenticação para consultar o token atual em `users.token` e atribui o UUID do usuário a `req.UserId` antes de continuar.

Header ausente, formato inválido ou token desconhecido retornam `401` com `{ "error": { "code": "UNAUTHORIZED", "message": "Autenticação necessária." } }`. Um novo login invalida o token anterior. Cadastro e login permanecem públicos. Falhas de banco retornam `500`.

Cada usuário acessa apenas suas próprias notas. O proprietário é definido pelo token autenticado e não pode ser enviado ou alterado pelo body.
## Notas por usuário

`notes.id_user` referencia `users.id` com `ON DELETE CASCADE` e índice para consultas por proprietário. POST preenche esse campo com `req.UserId`; GET lista somente as notas desse usuário. GET, PUT e DELETE por ID filtram simultaneamente pelo ID da nota e pelo dono. Notas inexistentes ou de outro usuário retornam o mesmo `404 NOT_FOUND`. Excluir um usuário no banco exclui suas notas automaticamente.

A migração preserva notas antigas com `id_user = NULL`; elas ficam inacessíveis pela API até uma associação explícita ao dono no banco. O campo aceita NULL para essa compatibilidade, mas toda nota criada pela API recebe um proprietário autenticado. Não há atribuição automática de notas antigas a usuários.

O seed exige `SEED_USER_ID` de um usuário já cadastrado. Em PowerShell: `$env:SEED_USER_ID = 'uuid-do-usuario'`, seguido de `npm run db:seed`. Ele cria duas notas apenas se esse usuário ainda não tiver notas.
## Frontend

Abra o [Caderno online](https://projetonotas-rafhael3.vercel.app) ou http://localhost:3000 ao executar localmente. A interface inclui cadastro, login, listagem das notas do usuário, busca por título/texto, criação, edição e exclusão com confirmação. O layout se adapta a celulares e computadores.

Localmente, os arquivos em `public/` são servidos pelo Express, tanto em `npm run dev` quanto em `npm start` após o build. Na Vercel, são servidos pela plataforma. Não é necessário um servidor ou build separado para o frontend. Mantenha a pasta `public/` junto do projeto ao distribuir a aplicação.

O token fica em `sessionStorage` durante a sessão da aba e é enviado no header Authorization. Sair remove a sessão do navegador; um novo login invalida o token anterior no servidor. Respostas 401 nas notas levam de volta ao login. As fontes usam Google Fonts, com fontes locais de fallback.
