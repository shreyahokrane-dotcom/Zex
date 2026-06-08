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

- `AZURE_OPENAI_REASONING_EFFORT=low`

The current `gpt-4o` Azure chat deployment may reject `reasoning_effort`; the API route automatically retries without it when unsupported.

## Build

```powershell
npm.cmd run build
```
