# Issue: migrar `next lint` para ESLint CLI antes do Next 16

## Contexto

`next lint` está deprecated no Next.js 15 e será removido no Next.js 16.
Hoje `pnpm run lint` ainda passa, mas o comando já emite aviso de depreciação.

## Impacto

Quando o projeto subir para Next 16, o script atual pode parar de funcionar e
quebrar validações locais/CI.

## Plano

1. Rodar o codemod oficial:
   `npx @next/codemod@canary next-lint-to-eslint-cli .`
2. Revisar o novo comando `lint` no `package.json`.
3. Rodar `pnpm run lint`, `pnpm test` e `pnpm build`.
4. Remover o TODO do `package.json` quando concluído.
