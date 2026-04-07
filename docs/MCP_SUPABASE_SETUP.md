# Configuração do MCP Supabase

## Passos para Configurar

### 1. Obter Access Token do Supabase

1. Acesse: https://supabase.com/dashboard/account/tokens
2. Clique em **"Generate new token"**
3. Dê um nome (ex: "Claude Code MCP")
4. Copie o token gerado

### 2. Obter Project Reference

1. Acesse seu projeto no dashboard: https://supabase.com/dashboard
2. Vá em **Settings** → **General**
3. Copie o **Reference ID** (ex: `abcdefghijklmnop`)

### 3. Configurar o MCP

Edite o arquivo `.mcp.json` e preencha as variáveis:

```json
{
  "supabase": {
    "command": "cmd",
    "args": ["/c", "npx", "-y", "@supabase/mcp-server-supabase"],
    "env": {
      "SUPABASE_ACCESS_TOKEN": "seu-access-token-aqui",
      "SUPABASE_PROJECT_REF": "seu-project-ref-aqui"
    }
  }
}
```

### 4. Reiniciar o Claude Code

Após configurar, reinicie o Claude Code para carregar o novo servidor MCP.

## Funcionalidades Disponíveis

Com o MCP Supabase configurado, você terá acesso a:

- 📊 **Listar projetos** - Ver todos os projetos Supabase
- 📋 **Gerenciar tabelas** - Criar, listar, modificar tabelas
- 🔐 **Gerenciar RLS** - Configurar políticas de segurança
- 📝 **Executar SQL** - Rodar queries diretamente
- 🔄 **Migrations** - Aplicar e gerenciar migrations
- 📈 **Logs** - Ver logs do projeto

## Verificar Configuração

Após reiniciar, execute:
```
Verificar ferramentas MCP disponíveis
```