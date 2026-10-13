# Implementacao de middleware de autorizacao 

- O middleware deve conferir o header authorization e procurar por :
- Bearer <token>

- Ao achar esse token , usar o service auth para validar esse token .
- Ao validar o token anexar o id do usuario em req.UserId antes do next 

- Aplicar o middleware em todas as notas do /notes