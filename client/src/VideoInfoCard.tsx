import React, { useState } from "react";

interface VideoFormat {
  format_id: string;
  resolution: string;
  filesize: string | null;
}

interface AudioFormat {
  format_id: string;
  filesize: string | null;
}

export interface VideoInfo {
  title: string;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  video_formats: VideoFormat[];
  audio: AudioFormat | null;
}

const DOWNLOAD_URL = "http://localhost:3000/download";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
}

function DownloadIcon({ spinning }: { spinning?: boolean }) {
  if (spinning) {
    return (
      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
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
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export default function VideoInfoCard({
  info,
  url,
}: {
  info: VideoInfo;
  url: string;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (formatId: string, kind: "video" | "audio") => {
    setDownloadError(null);
    setDownloadingId(formatId);

    try {
      const res = await fetch(DOWNLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format_id: formatId, kind }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Download failed.");
      }

      const blob = await res.blob();
      const filename = extractFilename(
        res.headers.get("Content-Disposition"),
        `${info.title}.${kind === "audio" ? "m4a" : "mp4"}`,
      );

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const anyDownloading = downloadingId !== null;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-[#E7E5E0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Thumbnail — fixed 16:9 ratio, scales fluidly with card width */}
      <div className="relative w-full aspect-video bg-[#F1F0EB]">
        {info.thumbnail ? (
          <img
            src={info.thumbnail}
            alt={info.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#A6A399] text-sm font-['JetBrains_Mono']">
            no preview available
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded-md bg-black/70 backdrop-blur-sm px-2 py-1 text-xs font-['JetBrains_Mono'] text-white tracking-wide">
          {formatDuration(info.duration)}
        </span>
      </div>

      {/* Details */}
      <div className="p-6">
        <h2 className="font-['Space_Grotesk'] text-xl text-[#1C1C1A] leading-snug">
          {info.title}
        </h2>
        {info.uploader && (
          <p className="mt-1.5 text-sm font-['Inter'] text-[#8A8779]">
            {info.uploader}
          </p>
        )}

        <div className="my-5 h-px w-full bg-[#EEEDE8]" />

        <div className="space-y-4">
          {info.video_formats.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#A6A399] font-['Inter'] font-medium mb-2">
                Video
              </p>
              <div className="flex flex-wrap gap-2">
                {info.video_formats.map((f) => {
                  const isThisDownloading = downloadingId === f.format_id;
                  return (
                    <button
                      key={f.format_id}
                      type="button"
                      onClick={() => handleDownload(f.format_id, "video")}
                      disabled={anyDownloading}
                      className="group inline-flex items-center gap-2 rounded-full border border-[#EAE8E2] bg-[#FAFAF8] px-3 py-1.5 text-sm font-['JetBrains_Mono'] text-[#1C1C1A] hover:border-[#3452C4]/50 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {f.resolution}
                      {f.filesize && (
                        <span className="text-[#A6A399]">{f.filesize}</span>
                      )}
                      <span className="text-[#A6A399] group-hover:text-[#3452C4] transition-colors">
                        <DownloadIcon spinning={isThisDownloading} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {info.audio && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#A6A399] font-['Inter'] font-medium mb-2">
                Audio
              </p>
              <button
                type="button"
                onClick={() => handleDownload(info.audio!.format_id, "audio")}
                disabled={anyDownloading}
                className="group inline-flex items-center gap-2 rounded-full border border-[#EAE8E2] bg-[#FAFAF8] px-3 py-1.5 text-sm font-['JetBrains_Mono'] text-[#1C1C1A] hover:border-[#3452C4]/50 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                audio only
                {info.audio.filesize && (
                  <span className="text-[#A6A399]">{info.audio.filesize}</span>
                )}
                <span className="text-[#A6A399] group-hover:text-[#3452C4] transition-colors">
                  <DownloadIcon
                    spinning={downloadingId === info.audio.format_id}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {downloadError && (
          <p className="mt-4 text-sm font-['Inter'] text-[#C4342F]">
            {downloadError}
          </p>
        )}
      </div>
    </div>
  );
}
