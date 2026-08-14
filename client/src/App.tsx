import React, { useState } from "react";
import type { VideoInfo } from "./VideoInfoCard";
import VideoInfoCard from "./VideoInfoCard";

const API_URL = import.meta.env.VITE_API_URL;

function FetchSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}

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
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0B0D] font-sans">
      <style>{`
        @keyframes loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes blob {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(6%, -8%) scale(1.1); }
          66% { transform: translate(-6%, 6%) scale(0.95); }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.13) 37%, rgba(255,255,255,0.05) 63%);
          background-size: 800px 100%;
          animation: shimmer 1.6s linear infinite;
        }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Background — first in DOM order, no z-index at all */}
      <div className="absolute inset-0">
        {info?.thumbnail ? (
          <>
            <img
              src={info.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/85" />
          </>
        ) : (
          <div className="relative h-full w-full overflow-hidden bg-[#0B0B0D]">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#3452C4]/30 blur-3xl animate-[blob_9s_ease-in-out_infinite]" />
            <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#7B3FE4]/20 blur-3xl animate-[blob_11s_ease-in-out_infinite]" />
            <div className="absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-[#1FAE6E]/10 blur-3xl animate-[blob_13s_ease-in-out_infinite]" />
          </div>
        )}
      </div>

      {/* Foreground — comes after in DOM, paints on top naturally */}
      <div className="relative flex h-full flex-col">
        <form
          onSubmit={handleSubmit}
          className="w-full shrink-0 px-4 pt-4 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-lg items-center gap-2 rounded-lg bg-black/45 p-1 ring-1 ring-white/15 backdrop-blur-md">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a video URL"
              className="flex-1 bg-transparent px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-[#111] transition-colors hover:bg-[#3452C4] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
            >
              {loading && <FetchSpinner />}
              {loading ? "Fetching" : "Fetch"}
            </button>
          </div>
          {error && (
            <p className="mx-auto mt-2 w-full max-w-lg text-xs text-[#FF8A80]">
              {error}
            </p>
          )}
        </form>

        <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-hidden p-4 sm:p-6">
          {loading && (
            <div className="pointer-events-none fixed inset-x-4 bottom-4 z-10 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-8">
              <div className="w-full max-w-md space-y-1.5 rounded-xl bg-black/20 p-3 backdrop-blur-sm">
                <div className="skeleton mb-1 h-2.5 w-14 rounded" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-9 w-full rounded-lg" />
                ))}
              </div>
              <div className="max-w-md space-y-1.5">
                <div className="skeleton h-5 w-56 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
              </div>
            </div>
          )}

          {!loading && !info && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-white/40">
                Paste a link above to fetch download options
              </p>
            </div>
          )}

          {!loading && info && <VideoInfoCard info={info} url={url} />}
        </div>
      </div>
    </div>
  );
}
