import { NextRequest, NextResponse } from "next/server";

type ClientMessage = {
  role: "user" | "zex";
  content: string;
};

type AzureResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type AzureRequestBody = {
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
  reasoning_effort?: string;
};

const systemPrompt =
  "You are Zex, a helpful AI assistant. Answer clearly and directly. Keep responses concise unless the user asks for detail.";
const maxContextMessages = 8;
const maxResponseTokens = 450;
const azureTimeoutMs = 20000;

async function sendAzureRequest(
  targetUrl: string,
  apiKey: string,
  requestBody: AzureRequestBody,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), azureTimeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as AzureResponse;

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const targetUrl = process.env.AZURE_OPENAI_TARGET_URL;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!targetUrl || !apiKey) {
    return NextResponse.json(
      { error: "Azure OpenAI environment variables are missing." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { messages?: ClientMessage[] };
  const messages = body.messages || [];

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages were provided." }, { status: 400 });
  }

  const recentMessages = messages.slice(-maxContextMessages);
  const azureMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((message) => ({
      role: message.role === "zex" ? "assistant" : "user",
      content: message.content,
    })),
  ];
  const requestBody: AzureRequestBody = {
    messages: azureMessages,
    temperature: 0.45,
    max_tokens: maxResponseTokens,
  };
  const reasoningEffort = process.env.AZURE_OPENAI_ENABLE_REASONING_EFFORT === "true"
    ? process.env.AZURE_OPENAI_REASONING_EFFORT
    : undefined;

  if (reasoningEffort) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  let response: Response;
  let data: AzureResponse;

  try {
    ({ response, data } = await sendAzureRequest(targetUrl, apiKey, requestBody));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Azure OpenAI took too long to respond. Try a shorter prompt."
            : "Azure OpenAI request failed before a response was returned.",
      },
      { status: 504 },
    );
  }

  const doesNotSupportReasoningEffort =
    data.error?.message?.includes("reasoning_effort") &&
    data.error.message.includes("Unrecognized request argument");

  if (!response.ok && requestBody.reasoning_effort && doesNotSupportReasoningEffort) {
    const fallbackBody = { ...requestBody };

    delete fallbackBody.reasoning_effort;

    try {
      ({ response, data } = await sendAzureRequest(targetUrl, apiKey, fallbackBody));
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.name === "AbortError"
              ? "Azure OpenAI took too long to respond. Try a shorter prompt."
              : "Azure OpenAI request failed before a response was returned.",
        },
        { status: 504 },
      );
    }
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          data.error?.message ||
          `Azure OpenAI request failed with status ${response.status}.`,
      },
      { status: response.status },
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json(
      { error: "Azure OpenAI returned an empty response." },
      { status: 502 },
    );
  }

  return NextResponse.json({ content });
}
