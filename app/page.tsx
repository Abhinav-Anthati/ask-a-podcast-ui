"use client";

import { useState } from "react";

type Citation = {
  episode_id: string;
  start_time: number;
  text: string;
  url: string;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    setAnswer("");
    setCitations([]);
    setLoading(true);

    const response = await fetch("http://localhost:8000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);

        if (data.type === "citations") {
          setCitations(data.data);
        } else if (data.type === "token") {
          setAnswer((prev) => prev + data.text);
        }
      }
    }

    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>Ask a Podcast</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something about the podcast..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleAsk} disabled={loading}>
          {loading ? "Asking..." : "Ask"}
        </button>
      </div>

      {citations.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Sources</h3>
          {citations.map((c, i) => (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: "block", marginBottom: 8, padding: 8, border: "1px solid #ccc" }}
            >
              {c.episode_id} — starts at {Math.floor(c.start_time)}s
            </a>
          ))}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>
          <h3>Answer</h3>
          <p>{answer}</p>
        </div>
      )}
    </main>
  );
}