# Implemente a feature de cadastro do usuario 

## Banco de dados 

- id - uuid 
- email - text 
- password - text 

## Fluxo de cadastro ( auth / register)

- Validação com zod do email com toLowercase , validação da senha ( password ) com no minimo 4 caracteres ;
- Verificar se ja existe um usuario com o mesmo email ;
- Criar o hash da senha com bcrypt e salvar hasheado no banco ; 
- Retornar o id e o email do usuario com statusCode (201)