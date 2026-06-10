# Zex

Zex is a black and gold Next.js chat interface backed by Azure OpenAI.

## Setup

Install dependencies:

```powershell
npm.cmd install
```

Create `.env.local` from `.env.example` and add your Azure OpenAI values.

Run the development server:

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:3000`.

## Environment

Required variables:

- `AZURE_OPENAI_TARGET_URL`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

Optional:

- `AZURE_OPENAI_ENABLE_REASONING_EFFORT=false`
- `AZURE_OPENAI_REASONING_EFFORT=low`

Keep `AZURE_OPENAI_ENABLE_REASONING_EFFORT=false` for faster replies on normal chat deployments. Turn it on only for deployments that support `reasoning_effort`.

## Build

```powershell
npm.cmd run build
```

# Zex
