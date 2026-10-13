# Implementacao de feature de associacao da nota de usuario 

## Banco de dados 

-  Na tabela notes , adicionar notes.id_user com referencia 1:N ao user.id e onDelete cascade

## Regras 

- Na rota de criação ( POST/notes ) : adicionar o req.UserId na criação da nota.
- Na rota de listagem ( GET/notes ) : Listar as notas filtrando por notas.id_user = req.UserId
- Nas rotas /notes/:id , incluir verificação se req.UserId é dono da nota (notes.id_user)