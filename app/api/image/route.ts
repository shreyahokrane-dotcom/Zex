import { NextRequest, NextResponse } from "next/server";

type AzureImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ImageGenerationRequest = {
  prompt?: string;
  size?: string;
};

const imageTimeoutMs = 180000;

export async function POST(request: NextRequest) {
  const targetUrl = process.env.AZURE_OPENAI_IMAGE_TARGET_URL;
  const apiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || "gpt-image-2";

  if (!targetUrl || !apiKey) {
    return NextResponse.json(
      { error: "Azure OpenAI image environment variables are missing." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ImageGenerationRequest;
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "No image prompt was provided." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), imageTimeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: body.size || "1024x1024",
      }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as AzureImageResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ||
            `${deployment} image generation failed with status ${response.status}.`,
        },
        { status: response.status },
      );
    }

    const image = data.data?.[0];
    const imageUrl = image?.url || (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : "");

    if (!imageUrl) {
      const responseKeys = Object.keys(data).join(", ") || "none";

      return NextResponse.json(
        {
          error: `Azure OpenAI returned an empty image response. Response keys: ${responseKeys}.`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      imageUrl,
      revisedPrompt: image?.revised_prompt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Azure OpenAI image generation took too long. Try a simpler prompt."
            : "Azure OpenAI image generation failed before a response was returned.",
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
