"use client";

import { FormEvent, KeyboardEvent, ReactNode, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseApp, firebaseAuth, firestoreDb } from "../lib/firebase";

type Message = {
  id: number;
  role: "user" | "zex";
  content: string;
};

type ImageResult = {
  imageUrl: string;
  prompt: string;
  revisedPrompt?: string;
};

type VideoResult = {
  videoUrl: string;
  prompt: string;
  firestoreId?: string;
};

const initialMessage: Message = {
  id: 1,
  role: "zex",
  content:
    "Welcome to Zex. Ask for strategy, code, writing, or analysis and I will shape the answer clearly.",
};
const chatTimeoutMs = 25000;

const starters = [
  "Plan a product launch",
  "Write a crisp pitch",
  "Fix a React bug",
  "Analyze a market",
];

const history = [
  "Brand direction",
  "Next.js dashboard",
  "Investor Q&A",
  "Content calendar",
  "API integration",
];

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}

function renderFormattedContent(content: string) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(<pre key={blocks.length}>{codeLines.join("\n")}</pre>);
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={blocks.length}>{formatInline(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{formatInline(line.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(<h2 key={blocks.length}>{formatInline(line.slice(2))}</h2>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={blocks.length}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{formatInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={blocks.length}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{formatInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(<p key={blocks.length}>{formatInline(paragraphLines.join(" "))}</p>);
  }

  return blocks;
}

export default function Home() {
  void firebaseApp;

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [imageError, setImageError] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [videoError, setVideoError] = useState("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const activeTitle = useMemo(() => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    return firstUserMessage?.content.slice(0, 42) || "New conversation";
  }, [messages]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>, starter?: string) {
    event?.preventDefault();
    const text = (starter || prompt).trim();

    if (!text || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setPrompt("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), chatTimeoutMs);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeoutId));
      const data = (await response.json()) as { content?: string; error?: string };

      if (!response.ok || !data.content) {
        throw new Error(data.error || "Zex could not generate a response.");
      }

      const content = data.content;

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "zex",
          content,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "zex",
          content:
            error instanceof Error && error.name === "AbortError"
              ? "That request took too long. Try a shorter message or ask for a brief answer."
              : error instanceof Error
              ? error.message
              : "Zex could not connect to Azure OpenAI.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function resetChat() {
    setMessages([initialMessage]);
    setPrompt("");
  }

  async function generateImage() {
    const text = prompt.trim();

    if (isImageLoading) {
      return;
    }

    setImageResult(null);
    setImageError("");
    setIsImageModalOpen(true);

    if (!text) {
      setImageError("Type an image prompt first, then use the image button.");
      return;
    }

    setIsImageLoading(true);

    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await response.json()) as {
        imageUrl?: string;
        revisedPrompt?: string;
        error?: string;
      };

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "Zex could not generate an image.");
      }

      setImageResult({
        imageUrl: data.imageUrl,
        prompt: text,
        revisedPrompt: data.revisedPrompt,
      });
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Zex could not connect to image generation.",
      );
    } finally {
      setIsImageLoading(false);
    }
  }

  async function generateVideo() {
    const text = prompt.trim();

    if (isVideoLoading) {
      return;
    }

    setVideoResult(null);
    setVideoError("");
    setIsVideoModalOpen(true);

    if (!text) {
      setVideoError("Type a video prompt first, then use the video button.");
      return;
    }

    setIsVideoLoading(true);

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await response.json()) as {
        videoUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.videoUrl) {
        throw new Error(data.error || "Zex could not generate a video.");
      }

      setVideoResult({
        videoUrl: data.videoUrl,
        prompt: text,
      });

      try {
        const videoUrlCanBeStored = !data.videoUrl.startsWith("data:");
        const videoDocument = await addDoc(collection(firestoreDb, "generatedVideos"), {
          createdAt: serverTimestamp(),
          prompt: text,
          videoUrl: videoUrlCanBeStored ? data.videoUrl : "",
          videoStorageType: videoUrlCanBeStored ? "url" : "inline_data_not_saved",
          userEmail: firebaseAuth.currentUser?.email || null,
          userId: firebaseAuth.currentUser?.uid || null,
        });

        setVideoResult({
          videoUrl: data.videoUrl,
          prompt: text,
          firestoreId: videoDocument.id,
        });
      } catch (saveError) {
        setVideoError(
          saveError instanceof Error
            ? `Video generated, but Firestore save failed: ${saveError.message}`
            : "Video generated, but Firestore save failed.",
        );
      }
    } catch (error) {
      setVideoError(
        error instanceof Error ? error.message : "Zex could not connect to video generation.",
      );
    } finally {
      setIsVideoLoading(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  return (
    <main className={`shell ${isSidebarOpen ? "sidebarOpen" : "sidebarClosed"}`}>
      <video className="backgroundVideo" autoPlay muted loop playsInline aria-hidden="true">
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      <button
        className={`sidebarToggle ${isSidebarOpen ? "active" : ""}`}
        type="button"
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <aside className="sidebar" aria-label="Conversation navigation">
        <div className="sidebarTop">
          <div className="brand">
            <div className="brandMark" aria-hidden="true">
              Z
            </div>
            <div>
              <p>Zex</p>
              <span>Gold intelligence</span>
            </div>
          </div>

          <button className="newChat" type="button" onClick={resetChat}>
            <span aria-hidden="true">+</span>
            New chat
          </button>
        </div>

        <nav className="history" aria-label="Recent chats">
          <p>Recent</p>
          {history.map((item) => (
            <button key={item} type="button">
              {item}
            </button>
          ))}
        </nav>

        <div className="account">
          <div className="avatar" aria-hidden="true">
            A
          </div>
          <div>
            <strong>Admin</strong>
            <span>Premium workspace</span>
          </div>
        </div>
      </aside>

      <section className="chatPanel" aria-label="Zex chat">
        <header className="topbar">
          <div>
            <span className="eyebrow">Zex</span>
            <h1>{activeTitle}</h1>
          </div>
          <div className="topbarActions">
            <button className="modelButton" type="button">
              Aurum 4
            </button>
            <button className="iconButton" type="button" aria-label="Open settings">
              <span aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          <div className="heroPrompt" aria-hidden={messages.length > 1}>
            <div className="heroMark">Z</div>
            <h2>What can I help with?</h2>
          </div>

          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="messageAvatar" aria-hidden="true">
                {message.role === "zex" ? "Z" : "U"}
              </div>
              <div className="bubble">
                <span>{message.role === "zex" ? "Zex" : "You"}</span>
                <div className="formatted">{renderFormattedContent(message.content)}</div>
              </div>
            </article>
          ))}
          {isLoading ? (
            <article className="message zex">
              <div className="messageAvatar" aria-hidden="true">
                Z
              </div>
              <div className="bubble loadingBubble">
                <span>Zex</span>
                <div className="typing" aria-label="Zex is thinking">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </article>
          ) : null}
        </div>

        <div className="starterGrid" aria-label="Prompt suggestions">
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={isLoading}
              onClick={() => submitMessage(undefined, starter)}
            >
              {starter}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={submitMessage}>
          <textarea
            aria-label="Message Zex"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder="Message Zex..."
            rows={1}
            disabled={isLoading}
          />
          <button
            className="imageGenerateButton"
            type="button"
            aria-label="Generate image"
            disabled={isLoading || isImageLoading || isVideoLoading}
            onClick={generateImage}
          >
            <span aria-hidden="true" />
          </button>
          <button
            className="videoGenerateButton"
            type="button"
            aria-label="Generate video"
            disabled={isLoading || isImageLoading || isVideoLoading}
            onClick={generateVideo}
          >
            <span aria-hidden="true" />
          </button>
          <button type="submit" aria-label="Send message" disabled={isLoading}>
            ^
          </button>
        </form>
      </section>

      {isImageModalOpen ? (
        <div className="imageModalBackdrop" role="presentation">
          <section
            className="imageModal"
            role="dialog"
            aria-modal="true"
            aria-label="Generated image"
          >
            <header className="imageModalHeader">
              <div>
                <span className="eyebrow">Image generation</span>
                <h2>{imageResult ? "Generated image" : "Creating image"}</h2>
              </div>
              <button
                className="modalCloseButton"
                type="button"
                aria-label="Close image preview"
                onClick={() => setIsImageModalOpen(false)}
              >
                x
              </button>
            </header>

            <div className="imagePreview">
              {isImageLoading ? (
                <div className="imageLoading" aria-label="Generating image">
                  <i />
                  <i />
                  <i />
                </div>
              ) : null}
              {!isImageLoading && imageError ? <p className="imageError">{imageError}</p> : null}
              {!isImageLoading && imageResult ? (
                <img src={imageResult.imageUrl} alt={imageResult.prompt} />
              ) : null}
            </div>

            {imageResult?.revisedPrompt ? (
              <p className="imagePrompt">{imageResult.revisedPrompt}</p>
            ) : null}
          </section>
        </div>
      ) : null}

      {isVideoModalOpen ? (
        <div className="imageModalBackdrop" role="presentation">
          <section
            className="imageModal videoModal"
            role="dialog"
            aria-modal="true"
            aria-label="Generated video"
          >
            <header className="imageModalHeader">
              <div>
                <span className="eyebrow">Video generation</span>
                <h2>{videoResult ? "Generated video" : "Creating video"}</h2>
              </div>
              <button
                className="modalCloseButton"
                type="button"
                aria-label="Close video preview"
                onClick={() => setIsVideoModalOpen(false)}
              >
                x
              </button>
            </header>

            <div className="imagePreview videoPreview">
              {isVideoLoading ? (
                <div className="imageLoading" aria-label="Generating video">
                  <i />
                  <i />
                  <i />
                </div>
              ) : null}
              {!isVideoLoading && videoError ? <p className="imageError">{videoError}</p> : null}
              {!isVideoLoading && videoResult ? (
                <video src={videoResult.videoUrl} controls playsInline />
              ) : null}
            </div>

            {videoResult ? (
              <p className="imagePrompt">
                {videoResult.prompt}
                {videoResult.firestoreId ? ` Saved as ${videoResult.firestoreId}.` : ""}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
