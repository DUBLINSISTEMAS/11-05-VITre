The preview is showing the following runtime errors:

```

\[2026-05-09T08:47:41.812Z] Error: ./src/app/globals.css

Error evaluating Node.js code

CssSyntaxError: tailwindcss: /vercel/share/v0-project/src/app/globals.css:1:1: `@utility card-hover:hover` defines an invalid utility name. Utilities should be alphanumeric and start with a lowercase letter.

&#x20;   \[at Input.error (turbopack:///\[project]/node\_modules/.pnpm/postcss@8.4.31/node\_modules/postcss/lib/input.js:106:16)]

&#x20;   \[at Root.error (turbopack:///\[project]/node\_modules/.pnpm/postcss@8.4.31/node\_modules/postcss/lib/node.js:115:32)]

&#x20;   \[at Object.Once (/vercel/share/v0-project/node\_modules/.pnpm/@tailwindcss+postcss@4.2.4/node\_modules/@tailwindcss/postcss/dist/index.js:10:6913)]

&#x20;   \[at async LazyResult.runAsync (turbopack:///\[project]/node\_modules/.pnpm/postcss@8.4.31/node\_modules/postcss/lib/lazy-result.js:261:11)]

&#x20;   \[at async transform (turbopack:///\[turbopack-node]/transforms/postcss.ts:70:34)]

&#x20;   \[at async run (turbopack:///\[turbopack-node]/ipc/evaluate.ts:92:23)]



Import trace:

&#x20; Client Component Browser:

&#x20;   ./src/app/globals.css \[Client Component Browser]

&#x20;   ./src/app/layout.tsx \[Server Component]

&#x20;   at Object.getCompilationErrors (node\_modules/.pnpm/next@15.5.18\_react-dom@19.1.0\_react@19.1.0\_\_react@19.1.0/node\_modules/next/src/server/dev/hot-reloader-turbopack.ts:956:25)

&#x20;   at DevBundlerService.getCompilationError (node\_modules/.pnpm/next@15.5.18\_react-dom@19.1.0\_react@19.1.0\_\_react@19.1.0/node\_modules/next/src/server/lib/dev-bundler-service.ts:52:51)

&#x20;   at DevServer.getCompilationError (node\_modules/.pnpm/next@15.5.18\_react-dom@19.1.0\_react@19.1.0\_\_react@19.1.0/node\_modules/next/src/server/dev/next-dev-server.ts:1031:38)

&#x20;   at DevServer.findPageComponents (node\_modules/.pnpm/next@15.5.18\_react-dom@19.1.0\_react@19.1.0\_\_react@19.1.0/node\_modules/next/src/server/dev/next-dev-server.ts:995:39)

&#x20;   at async DevServer.renderErrorToResponseImpl (node\_modules/.pnpm/next@15.5.18\_react-dom@19.1.0\_react@19.1.0\_\_react@19.1.0/node\_modules/next/src/server/base-server.ts:2825:18)

```

Fix the code to resolve them.

