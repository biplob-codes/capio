import { useState } from "react";

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

const DOWNLOAD_URL = `${import.meta.env.VITE_API_URL}/download`;

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
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-10 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-8">
      {/* Download panel — minimal, semi-transparent, left-aligned */}
      <div className="pointer-events-auto w-full max-w-md rounded-xl bg-black/20 backdrop-blur-sm">
        <div className="no-scrollbar max-h-[38vh] overflow-y-auto p-3 space-y-3">
          {info.video_formats.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-white/60 font-medium [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                Video
              </p>
              <div className="space-y-1">
                {info.video_formats.map((f) => {
                  const isThisDownloading = downloadingId === f.format_id;
                  return (
                    <div
                      key={f.format_id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-black/10 px-2.5 py-1.5 transition-colors hover:bg-black/25"
                    >
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="text-sm text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                          {f.resolution}
                        </span>
                        {f.filesize && (
                          <span className="truncate text-xs text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                            {f.filesize}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(f.format_id, "video")}
                        disabled={anyDownloading}
                        className="relative shrink-0 inline-flex items-center gap-1.5 overflow-hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[#111] transition-colors hover:bg-[#3452C4] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <DownloadIcon spinning={isThisDownloading} />
                        {isThisDownloading ? "Downloading" : "Download"}
                        {isThisDownloading && (
                          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#3452C4]/70 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {info.audio && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-white/60 font-medium [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                Audio
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-black/10 px-2.5 py-1.5 transition-colors hover:bg-black/25">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="text-sm text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                    Audio only
                  </span>
                  {info.audio.filesize && (
                    <span className="truncate text-xs text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                      {info.audio.filesize}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(info.audio!.format_id, "audio")}
                  disabled={anyDownloading}
                  className="relative shrink-0 inline-flex items-center gap-1.5 overflow-hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[#111] transition-colors hover:bg-[#3452C4] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <DownloadIcon
                    spinning={downloadingId === info.audio.format_id}
                  />
                  {downloadingId === info.audio.format_id
                    ? "Downloading"
                    : "Download"}
                  {downloadingId === info.audio.format_id && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#3452C4]/70 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {downloadError && (
          <p className="px-3 pb-2 text-xs text-[#FF8A80] [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
            {downloadError}
          </p>
        )}
      </div>

      {/* Title + duration — no background at all, just text-shadow for legibility */}
      <div className="max-w-md">
        <h1 className="text-base font-semibold leading-snug text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)] sm:text-lg">
          {info.title}
        </h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {info.uploader && <span>{info.uploader}</span>}
          {info.uploader && <span>•</span>}
          <span>{formatDuration(info.duration)}</span>
        </div>
      </div>
    </div>
  );
}
