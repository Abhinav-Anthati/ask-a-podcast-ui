"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type Citation = {
  episode_id: string;
  title: string;
  start_time: number;
  text: string;
  url: string;
};

type Podcast = {
  url: string;
  title: string;
  episode_count: number;
};

// NDJSON stream reader: buffers partial lines across chunks, parses complete ones
async function streamNDJSON(response: Response, onLine: (data: any) => void) {
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
      onLine(JSON.parse(line));
    }
  }
}

function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [askError, setAskError] = useState("");

  const [feedUrl, setFeedUrl] = useState("");
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [subscribing, setSubscribing] = useState(false);
  const [progress, setProgress] = useState("");
  const [podcastError, setPodcastError] = useState("");
  const [unsubscribingUrl, setUnsubscribingUrl] = useState("");

  const [filterUrl, setFilterUrl] = useState("");
  const [hasAudio, setHasAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Same episode: just seek. Different episode: load first, seek once metadata's ready
  function playAt(url: string, time: number) {
    const audio = audioRef.current;
    if (!audio) return;

    setHasAudio(true);

    if (audio.src === url) {
      audio.currentTime = time;
      audio.play();
    } else {
      audio.src = url;
      audio.onloadedmetadata = () => {
        audio.currentTime = time;
        audio.play();
      };
    }
  }

  async function loadPodcasts() {
    const response = await fetch(`${API_BASE}/podcasts`);
    const data = await response.json();
    setPodcasts(data);
  }

  useEffect(() => {
    loadPodcasts();
  }, []);

  async function handleAsk() {
    setAnswer("");
    setCitations([]);
    setAskError("");
    setLoading(true);

    const response = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "" means no filter selected; backend expects null for "search all"
      body: JSON.stringify({ question, podcast_url: filterUrl || null }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Something went wrong." }));
      setAskError(errorData.detail || "Failed to get an answer.");
      setLoading(false);
      return;
    }

    await streamNDJSON(response, (data) => {
      if (data.type === "citations") {
        setCitations(data.data);
      } else if (data.type === "token") {
        setAnswer((prev) => prev + data.text);
      }
    });

    setLoading(false);
  }

  async function handleSubscribe() {
    setSubscribing(true);
    setProgress("");
    setPodcastError("");

    const response = await fetch(`${API_BASE}/podcasts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url: feedUrl }),
    });
    setFeedUrl("");

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Something went wrong." }));
      setPodcastError(errorData.detail || "Failed to subscribe.");
      setSubscribing(false);
      return;
    }

    await streamNDJSON(response, (data) => {
      switch (data.status) {
        case "downloaded":
          setProgress(`Downloaded ${data.count} new episode${data.count === 1 ? "" : "s"}`);
          break;
        case "downloading":
          setProgress(`Downloading ${data.episode}`);
          break;
        case "transcribed":
          setProgress(`Transcribed ${data.episode}`);
          break;
        case "ingested":
          setProgress(`Ingested ${data.episode}`);
          break;
        case "failed":
          setProgress(`Failed: ${data.episode}`);
          break;
        case "done":
          setProgress("Sync complete.");
          loadPodcasts();
          setSubscribing(false);
          break;
      }
    });
  }

  async function handleUnsubscribe(url: string) {
    setPodcastError("");
    setUnsubscribingUrl(url);

    const response = await fetch(`${API_BASE}/podcasts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url: url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Something went wrong." }));
      setPodcastError(errorData.detail || "Failed to unsubscribe.");
      setUnsubscribingUrl("");
      return;
    }

    await loadPodcasts();
    setUnsubscribingUrl("");
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Ask a Podcast</h1>

      <div className="flex gap-2">
        <input
          value={question}
          disabled={loading}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something about the podcast..."
          className="flex-1 border rounded px-3 py-2 disabled:opacity-50"
        />
        <select
          value={filterUrl}
          onChange={(e) => setFilterUrl(e.target.value)}
          className="w-40 border rounded px-2 py-2"
        >
          <option value="">All podcasts</option>
          {podcasts.map((p, i) => (
            <option key={i} value={p.url}>{p.title}</option>
          ))}
        </select>
        <button
          onClick={handleAsk}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </div>

      {askError && <p className="text-red-600 text-sm mt-2">{askError}</p>}

      {answer && <p className="mt-4 whitespace-pre-wrap">{answer}</p>}

      {citations.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">Sources</h3>
          <div className="space-y-2">
            {citations.map((c, i) => (
              <button
                key={i}
                onClick={() => playAt(c.url, c.start_time)}
                className="block w-full text-left border rounded p-2 text-sm hover:bg-gray-50"
              >
                <div className="font-medium">{c.title}</div>
                <div className="text-gray-500">starts at {Math.floor(c.start_time)}s</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Always mounted (only visibility toggles) so audioRef never goes stale */}
      <audio ref={audioRef} controls className={`w-full mt-4 ${hasAudio ? "block" : "hidden"}`} />

      <hr className="my-8" />

      <h2 className="text-xl font-bold mb-4">Subscriptions</h2>

      <div className="flex gap-2">
        <input
          value={feedUrl}
          disabled={subscribing}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="Paste a podcast RSS feed URL..."
          className="flex-1 border rounded px-3 py-2 disabled:opacity-50"
        />
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {subscribing ? "Subscribing..." : "Subscribe"}
        </button>
      </div>

      {podcastError && <p className="text-red-600 text-sm mt-2">{podcastError}</p>}
      {progress && <p className="text-sm text-gray-600 mt-2">{progress}</p>}

      <div className="mt-4 space-y-1">
        {podcasts.length === 0 && (
          <p className="text-gray-500 text-sm">No podcasts yet — paste a feed URL above.</p>
        )}
        {podcasts.map((p, i) => (
          <div key={i} className="border rounded px-3 py-2 text-sm flex justify-between items-center">
            <span>{p.title}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{p.episode_count} episodes</span>
              <button
                onClick={() => handleUnsubscribe(p.url)}
                disabled={unsubscribingUrl === p.url}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                {unsubscribingUrl === p.url ? "Unsubscribing..." : "Unsubscribe"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default Home;