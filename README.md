# Branch Core Hub

Central operations platform for gym and fitness branch management.

## Local development

Prerequisites:

- Node.js 18+
- npm

Run locally:

```sh
npm install
npm run dev
```

Build for production:

```sh
npm run build
npm run preview
```

## Stack

- Vite
- React + TypeScript
- Tailwind CSS
- Radix UI / shadcn-ui
- Supabase

## Hardware callback endpoints

Current callback URLs used by terminal devices:

- /functions/v1/terminal-heartbeat
- /functions/v1/terminal-identify
- /functions/v1/terminal-register
