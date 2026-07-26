# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.16.5 create --template minimal --no-types --add prettier tailwindcss="plugins:none" drizzle="database:sqlite+sqlite:better-sqlite3" better-auth="demo:password" mcp="ide:cursor+setup:remote" experimental="versions:kit+features:async,remoteFunctions,explicitEnvironmentVariables,handleRenderingErrors" --install bun sndbnk
```

## Developing

Install dependencies and start the development server with Bun:

```sh
bun install
bun run db:push
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

Copy `.env.example` to `.env` if you do not already have one. For local tenant
subdomains, keep `PUBLIC_BASE_DOMAIN=localhost` and open profiles at
`http://{username}.localhost:5173` (browsers resolve `*.localhost` to loopback).
Apex routes (`/settings`, `/signup`, `/signin`) stay on `http://localhost:5173`.
Custom domains can be exercised in dev by pointing a hosts-file entry at
`127.0.0.1` after verifying the domain in Settings (Vite allows arbitrary Host
headers so tenant resolution can run).

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
