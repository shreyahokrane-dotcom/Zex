"use client";

import { FormEvent, KeyboardEvent, ReactNode, useMemo, useState } from "react";

type Message = {
  id: number;
  role: "user" | "zex";
  content: string;
};

const starters = [
  "Design a launch plan",
  "Write a product brief",
  "Debug a React issue",
  "Summarize meeting notes",
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "zex",
      content:
        "Welcome to Zex. Ask for strategy, code, writing, or analysis and I will shape the answer clearly.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });
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
            error instanceof Error
              ? error.message
              : "Zex could not connect to Azure OpenAI.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function resetChat() {
    setMessages(messages.slice(0, 1));
    setPrompt("");
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Conversation navigation">
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
          <button className="iconButton" type="button" aria-label="Open settings">
            ...
          </button>
        </header>

        <div className="messages" aria-live="polite">
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
              <div className="bubble">
                <span>Zex</span>
                <p>Thinking...</p>
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
          <button type="submit" aria-label="Send message" disabled={isLoading}>
            ^
          </button>
        </form>
      </section>
    </main>
  );
}
