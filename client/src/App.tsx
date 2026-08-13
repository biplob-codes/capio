import React, { useState } from "react";
import type { VideoInfo } from "./VideoInfoCard";
import VideoInfoCard from "./VideoInfoCard";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_URL}/video-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Couldn't fetch video info.");
      }

      const data: VideoInfo = await res.json();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 px-4 pt-6 bg-[#FDFCFA] min-h-[60vh]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a video URL"
            className="w-full rounded-xl border border-[#E7E5E0] bg-white px-4 py-3 text-sm text-[#1C1C1A] placeholder:text-[#A6A399] font-['Inter'] outline-none focus:border-[#3452C4]/50 focus:ring-2 focus:ring-[#3452C4]/10 transition-colors"
          />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full transition-colors ${
              loading ? "bg-[#3452C4] animate-pulse" : "bg-transparent"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-[#1C1C1A] text-white font-['Space_Grotesk'] text-sm font-medium px-5 py-3 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3452C4] transition-colors"
        >
          {loading ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {error && (
        <p className="w-full max-w-2xl text-sm font-['Inter'] text-[#C4342F]">
          {error}
        </p>
      )}

      {info && <VideoInfoCard info={info} url={url} />}
    </div>
  );
}
