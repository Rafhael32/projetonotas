# Api de CRUD de notas simples


# Aspectos funcionais 

Cada nota sera um registro com um titulo e um texto
A API pode criar , ler todas ( sem paginacao ) , ler um , editar e excluir notas

# Aspectos tecnicos

Stack 
NODE.JS + ts
express ( rotas )
Drizzle ORM 
zod 
banco de dados no docker compose

O banco de dados roda num docker-compose.yml com volume e na porta 6000

O projeto deve ter um .env e um .env-example com : 
- PORT = ""
- DATABASE_URL = ""

O package.json tem
- Dev 
- Build

O schema do banco de dados estara em src/db/schema.ts e um seed em src/db/seed.ts

As rotas estarao em src/routes/main.ts , usando um controller para as notas que estara em src/controllers

Todas as requisicoes tem body , params e query e devem ser validados pelo zod em schemas em src/schemas