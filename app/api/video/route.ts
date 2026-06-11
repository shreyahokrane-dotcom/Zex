import { NextRequest, NextResponse } from "next/server";

type VideoRequest = {
  prompt?: string;
  seconds?: string;
  size?: string;
};

type VideoResponse = {
  id?: string;
  status?: string;
  url?: string;
  video_url?: string;
  output_url?: string;
  content?: string;
  b64_json?: string;
  data?: Array<{
    url?: string;
    video_url?: string;
    b64_json?: string;
    content?: string;
  }>;
  output?: Array<{
    url?: string;
    video_url?: string;
    b64_json?: string;
    content?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ResolvedVideo = {
  videoUrl: string;
  status?: string;
};

const videoTimeoutMs = 300000;
const pollIntervalMs = 5000;
const terminalStatuses = new Set(["completed", "succeeded", "failed", "cancelled", "canceled"]);
const allowedDurations = new Set(["4", "8", "12"]);

function getHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "api-key": apiKey,
  };
}

function getVideoUrl(data: VideoResponse): string {
  const directUrl = data.url || data.video_url || data.output_url;

  if (directUrl) {
    return directUrl;
  }

  if (data.b64_json || data.content) {
    return `data:video/mp4;base64,${data.b64_json || data.content}`;
  }

  const nested = data.data?.[0] || data.output?.[0];
  const nestedUrl = nested?.url || nested?.video_url;

  if (nestedUrl) {
    return nestedUrl;
  }

  if (nested?.b64_json || nested?.content) {
    return `data:video/mp4;base64,${nested.b64_json || nested.content}`;
  }

  return "";
}

async function fetchVideoContent(
  targetUrl: string,
  videoId: string,
  apiKey: string,
  signal: AbortSignal,
) {
  const contentResponse = await fetch(`${targetUrl}/${videoId}/content`, {
    headers: getHeaders(apiKey),
    signal,
  });

  if (!contentResponse.ok) {
    return "";
  }

  const contentType = contentResponse.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await contentResponse.json().catch(() => ({}))) as VideoResponse;

    return getVideoUrl(data);
  }

  const buffer = await contentResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return `data:${contentType || "video/mp4"};base64,${base64}`;
}

async function waitForVideo(
  targetUrl: string,
  apiKey: string,
  initialData: VideoResponse,
  signal: AbortSignal,
): Promise<ResolvedVideo> {
  let data = initialData;

  while (true) {
    const videoUrl = getVideoUrl(data);

    if (videoUrl) {
      return { videoUrl, status: data.status };
    }

    const status = data.status?.toLowerCase();

    if (status && terminalStatuses.has(status)) {
      if (status === "completed" || status === "succeeded") {
        const videoId = data.id;

        if (videoId) {
          const contentUrl = await fetchVideoContent(targetUrl, videoId, apiKey, signal);

          if (contentUrl) {
            return { videoUrl: contentUrl, status };
          }
        }
      }

      throw new Error(
        data.error?.message || `Sora video generation finished with status "${data.status}".`,
      );
    }

    if (!data.id) {
      throw new Error("Sora did not return a video id or video URL.");
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const response = await fetch(`${targetUrl}/${data.id}`, {
      headers: getHeaders(apiKey),
      signal,
    });

    data = (await response.json().catch(() => ({}))) as VideoResponse;

    if (!response.ok) {
      throw new Error(
        data.error?.message || `Sora status check failed with status ${response.status}.`,
      );
    }
  }
}

export async function POST(request: NextRequest) {
  const targetUrl = process.env.AZURE_OPENAI_VIDEO_TARGET_URL;
  const apiKey = process.env.AZURE_OPENAI_VIDEO_API_KEY;
  const deployment = process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT || "sora-2";

  if (!targetUrl || !apiKey) {
    return NextResponse.json(
      { error: "Azure OpenAI video environment variables are missing." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as VideoRequest;
  const prompt = body.prompt?.trim();
  const seconds = body.seconds && allowedDurations.has(body.seconds) ? body.seconds : "4";

  if (!prompt) {
    return NextResponse.json({ error: "No video prompt was provided." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), videoTimeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model: deployment,
        prompt,
        seconds,
        size: body.size || "1280x720",
      }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as VideoResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ||
            `${deployment} video generation failed with status ${response.status}.`,
        },
        { status: response.status },
      );
    }

    const result = await waitForVideo(targetUrl, apiKey, data, controller.signal);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Azure OpenAI video generation took too long. Try a shorter prompt."
            : error instanceof Error
            ? error.message
            : "Azure OpenAI video generation failed before a response was returned.",
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
