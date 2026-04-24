# StackTrace Reader

App web local para acelerar leitura de stack trace durante debug.

## Como usar

1. Abra o arquivo `index.html` no navegador.
2. Cole o stack trace.
3. Clique em **Analisar**.

## O que o MVP entrega

- Detecção simples de linguagem (`Node/JS`, `Python`, `Java`, `.NET`).
- Extração da linha principal de erro.
- Tentativa de identificar frame mais provável da causa raiz.
- Separação de frames da aplicação (filtrando libs comuns).
- Stack trace normalizado (remove linhas duplicadas).
- Lista de ações sugeridas com base no erro.

## Validacao de seguranca

Execute a suite de seguranca antes de publicar:

```bash
node --test tests/security.test.mjs
```

## Próximos passos sugeridos

- Upload de arquivo `.log` e arrastar/soltar.
- Regras customizadas por projeto (ex.: pastas que contam como "app").
- Integração com IA para explicar erro em linguagem natural.
- Exportar análise em Markdown para anexar em ticket.
