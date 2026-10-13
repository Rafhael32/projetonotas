# PRD — API de notas

Data: 08/10/2026  
Status: rascunho para revisão  
Fonte: [brain-dump.md](./brain-dump.md)

## 1. Visão geral

Desenvolver uma API HTTP para criar, consultar, editar e excluir notas. Cada nota contém um título e um texto, persistidos em banco de dados executado via Docker Compose.

O consumidor é uma aplicação que precisa gerenciar notas. Público de negócio, interface visual e autenticação não foram definidos na fonte. Este documento distingue requisitos explícitos de propostas para preencher essas lacunas.

## 2. Objetivos

- Oferecer as cinco operações de CRUD descritas na fonte.
- Retornar todas as notas na listagem, sem paginação.
- Validar entradas com Zod.
- Persistir os registros entre reinicializações do banco com volume Docker.
- Permitir execução em desenvolvimento e compilação TypeScript.

O sucesso do MVP será medido pelo atendimento aos critérios de aceite da seção 10. Metas de adoção, tráfego e latência não foram especificadas.

## 3. Escopo funcional confirmado

| ID | Requisito |
| --- | --- |
| RF-01 | Criar nota com título e texto. |
| RF-02 | Listar todas as notas, sem paginação. |
| RF-03 | Consultar uma nota individual. |
| RF-04 | Editar uma nota. |
| RF-05 | Excluir uma nota. |
| RF-06 | Validar body, params e query das requisições com schemas Zod. |

Fora do escopo proposto: interface gráfica, autenticação, contas de usuários, compartilhamento, pesquisa, filtros, paginação, tags, anexos, histórico e exclusão lógica. Esses recursos não foram solicitados no brain dump.

## 4. Fluxos de uso

1. Criar: consumidor envia título e texto; API valida, persiste e retorna a nota criada.
2. Listar: consumidor solicita as notas; API retorna todos os registros.
3. Consultar: consumidor informa o identificador; API retorna a nota ou informa que ela não existe.
4. Editar: consumidor informa identificador e conteúdo; API valida, atualiza e retorna a nota.
5. Excluir: consumidor informa identificador; API remove a nota e confirma a conclusão.

## 5. Modelo de dados

| Campo | Tipo proposto | Regra | Origem |
| --- | --- | --- | --- |
| `id` | Inteiro positivo gerado pelo banco | Chave primária única e imutável | Proposta para identificar notas |
| `title` | Texto | Obrigatório | Título exigido pela fonte; nome técnico proposto |
| `text` | Texto | Obrigatório | Texto exigido pela fonte; nome técnico proposto |

Proposta: aplicar trim ao título e rejeitar título vazio; exigir ao menos um caractere não branco no texto, preservando sua formatação. Limites máximos de tamanho estão pendentes. Datas de criação e atualização não são exigidas no MVP.

## 6. Contrato HTTP proposto

Métodos, rotas, nomes de campos, códigos de resposta e formatos abaixo são propostas, pois não foram detalhados na fonte.

| Operação | Método e rota | Entrada | Sucesso | Erros esperados |
| --- | --- | --- | --- | --- |
| Criar | `POST /notes` | Body com `title` e `text` | `201` com a nota criada | `400` |
| Listar | `GET /notes` | Sem campos de entrada | `200` com array de notas | `400` |
| Consultar | `GET /notes/:id` | `id` nos params | `200` com a nota | `400`, `404` |
| Editar | `PUT /notes/:id` | `id`; body com `title` e `text` | `200` com a nota atualizada | `400`, `404` |
| Excluir | `DELETE /notes/:id` | `id` nos params | `204` sem corpo de resposta | `400`, `404` |

Todas as operações podem retornar `500` em falhas internas inesperadas. PUT substitui os dois campos; edição parcial não faz parte da proposta. A listagem vazia retorna `[]`; propõe-se ordenar resultados por `id` crescente.

Exemplo de body de criação ou edição:

```json
{
  "title": "Compras",
  "text": "Comprar café e pão."
}
```

Exemplo de nota retornada:

```json
{
  "id": 1,
  "title": "Compras",
  "text": "Comprar café e pão."
}
```

Formato de erro proposto:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados da requisição inválidos.",
    "details": [
      { "path": "body.title", "message": "O título é obrigatório." }
    ]
  }
}
```

Usar `NOT_FOUND` para nota inexistente e `INTERNAL_ERROR` para falha interna. `details` é opcional e destinado a erros de validação. Não expor credenciais, SQL ou stack traces nas respostas.

## 7. Validação

Requisito confirmado: schemas em `src/schemas` devem validar body, params e query de todas as requisições.

Regras propostas para implementação:

- Cada rota possui schemas para as três partes, incluindo schemas sem campos quando aplicável.
- Rotas GET e DELETE aceitam ausência de body; a exigência de validar não obriga envio de corpo.
- `id` deve representar um inteiro decimal positivo dentro do intervalo suportado pelo tipo escolhido no banco.
- Criação e edição exigem `title` e `text` como strings válidas.
- Campos extras no body e parâmetros de query são rejeitados; o MVP não possui query suportada.
- JSON malformado e dados inválidos retornam `400`, sem alterar registros.
- Identificador válido inexistente retorna `404` nas operações individuais.

## 8. Requisitos técnicos

### Confirmados pela fonte

- Node.js com TypeScript.
- Express para rotas.
- Drizzle ORM para acesso ao banco.
- Zod para validação.
- Banco em `docker-compose.yml`, com volume e porta `6000`.
- `.env` e `.env-example` contendo `PORT` e `DATABASE_URL`.
- Scripts de desenvolvimento e build no `package.json`; nomes propostos: `dev` e `build`.
- Schema em `src/db/schema.ts` e seed em `src/db/seed.ts`.
- Rotas em `src/routes/main.ts`, usando controller de notas em `src/controllers`.
- Schemas de validação em `src/schemas`.

### Decisões propostas

- PostgreSQL como banco; o mecanismo não foi especificado na fonte.
- Porta `6000` interpretada como porta do host, mapeada para `5432` no contêiner PostgreSQL.
- API executada localmente e banco executado pelo Docker Compose no fluxo inicial.
- Migrações versionadas do Drizzle para criar e evoluir as tabelas.
- Seed executado explicitamente, com notas de exemplo e sem apagar dados existentes.
- `.env` fora do controle de versão; `.env-example` versionado sem credenciais reais.
- Validar configuração ao iniciar e apresentar erro claro se estiver ausente ou inválida.

Modelo de variáveis solicitado:

```dotenv
PORT=""
DATABASE_URL=""
```

Valores vazios são placeholders; a execução exige configuração válida. `PORT` controla a porta HTTP da API e é independente da porta `6000` do banco.

Estrutura mínima, com nomes adicionais de arquivos propostos:

```text
src/
  controllers/
    notes.controller.ts
  db/
    schema.ts
    seed.ts
  routes/
    main.ts
  schemas/
    notes.schema.ts
.env
.env-example
docker-compose.yml
package.json
```

## 9. Qualidade e operação propostas

- Confirmar sucesso de escrita somente após conclusão da operação no banco.
- Preservar registros ao reiniciar ou recriar o contêiner mantendo o volume. Remoção explícita do volume não está coberta por essa garantia.
- Centralizar tratamento de erros para manter respostas consistentes.
- Compilar TypeScript para JavaScript sem erros pelo script de build.
- Documentar instalação, configuração, inicialização do banco, migrações, seed, desenvolvimento e build.
- Utilizar operações parametrizadas do ORM no acesso aos dados.

## 10. Critérios de aceite

Critérios referentes ao contrato e às decisões propostas dependem da adoção dessas propostas.

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| AC-01 | Criar nota válida | `201` com identificador e conteúdo; consulta posterior encontra a nota persistida. |
| AC-02 | Listar banco vazio | `200` e `[]`. |
| AC-03 | Listar várias notas | Retornar todos os registros, sem paginação, na ordem definida. |
| AC-04 | Consultar nota existente | `200` com a nota correspondente. |
| AC-05 | Consultar, editar ou excluir identificador válido inexistente | `404`. |
| AC-06 | Editar nota existente | `200`; nova consulta reflete ambos os campos atualizados, mantendo o identificador. |
| AC-07 | Excluir nota existente | `204` sem body; nova consulta retorna `404`. |
| AC-08 | Enviar campos obrigatórios ausentes, tipos incorretos, conteúdo vazio ou ID inválido | `400` com erro identificável e sem alterações no banco. |
| AC-09 | Enviar campos de body ou query não suportados | `400`, conforme schemas da rota. |
| AC-10 | Fazer GET ou DELETE sem body | Processar normalmente se as demais entradas forem válidas. |
| AC-11 | Enviar JSON malformado | `400` com erro consistente. |
| AC-12 | Reiniciar o banco mantendo o volume | Registros continuam disponíveis. |
| AC-13 | Preparar o projeto pelas instruções | Configurar variáveis, subir banco na porta `6000`, aplicar migrações e executar seed. |
| AC-14 | Executar desenvolvimento e build | API inicia em desenvolvimento; compilação termina sem erros. |
| AC-15 | Inspecionar organização do projeto | Schema, seed, rotas, controller e validações estão nos caminhos exigidos. |
| AC-16 | Simular falha inesperada de banco | `500` sem detalhes sensíveis e sem confirmar sucesso da operação. |

## 11. Sequência de entrega sugerida

1. Configurar Node.js, TypeScript, scripts, variáveis e Docker Compose.
2. Implementar schema, migrações e seed com Drizzle.
3. Implementar schemas Zod, controller, rotas e tratamento de erros.
4. Verificar critérios de aceite e documentar execução.

## 12. Riscos e definições pendentes

| Tema | Impacto ou decisão necessária |
| --- | --- |
| Banco | Confirmar PostgreSQL ou escolher outro mecanismo compatível com Drizzle. |
| Contrato | Confirmar ID inteiro, nomes de campos, rotas e edição completa por PUT. |
| Tamanho dos dados | Definir limites para título, texto e payload HTTP antes de exposição pública. |
| Listagem sem paginação | Memória e tempo de resposta crescem com o volume; preservar no MVP a exigência explícita de listar todas. |
| Acesso | Sem autenticação, qualquer consumidor com acesso à API pode operar todas as notas; definir ambiente de exposição antes da publicação. |
| Seed | Definir registros de exemplo e comportamento em execuções repetidas. |
| Produção | Hospedagem, backups, monitoramento, disponibilidade e metas de desempenho não foram especificados. |

As propostas estabelecem uma base revisável para implementação, sem alterar os requisitos confirmados do brain dump.