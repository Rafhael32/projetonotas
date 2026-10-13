# Feature de implementacao de login

# Banco de dados 
- Adicionar na tabela users o campo token com o tipo text ( pode ser NULL)

# Fluxo de login ( /auth/login )

Validação zod do email com to lowercase e senha minimo 4 caracteres 
- Buscar o usuario pelo e-mail
- Validar a senha com bcrypt 
- Em caso de email e senha errados , mensagem generica.
- Criar um hash aleatorio e salvar no token do usuario no banco de dados 
- Retornar o id do usuario e o token 

