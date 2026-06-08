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
  "You are Zex, a helpful AI assistant. Answer clearly, directly, and use a polished black-and-gold product tone without being verbose.";

async function sendAzureRequest(
  targetUrl: string,
  apiKey: string,
  requestBody: AzureRequestBody,
) {
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });
  const data = (await response.json().catch(() => ({}))) as AzureResponse;

  return { response, data };
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

  const azureMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role === "zex" ? "assistant" : "user",
      content: message.content,
    })),
  ];
  const requestBody: AzureRequestBody = {
    messages: azureMessages,
    temperature: 0.7,
    max_tokens: 900,
  };
  const reasoningEffort = process.env.AZURE_OPENAI_REASONING_EFFORT;

  if (reasoningEffort) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  let { response, data } = await sendAzureRequest(targetUrl, apiKey, requestBody);
  const doesNotSupportReasoningEffort =
    data.error?.message?.includes("reasoning_effort") &&
    data.error.message.includes("Unrecognized request argument");

  if (!response.ok && requestBody.reasoning_effort && doesNotSupportReasoningEffort) {
    const fallbackBody = { ...requestBody };

    delete fallbackBody.reasoning_effort;
    ({ response, data } = await sendAzureRequest(targetUrl, apiKey, fallbackBody));
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
