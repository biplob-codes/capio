import React from "react";

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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function VideoInfoCard({ info }: { info: VideoInfo }) {
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
                {info.video_formats.map((f) => (
                  <span
                    key={f.format_id}
                    className="inline-flex items-center gap-2 rounded-full border border-[#EAE8E2] bg-[#FAFAF8] px-3 py-1.5 text-sm font-['JetBrains_Mono'] text-[#1C1C1A] hover:border-[#3452C4]/40 hover:bg-white transition-colors cursor-default"
                  >
                    {f.resolution}
                    {f.filesize && (
                      <span className="text-[#A6A399]">{f.filesize}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {info.audio && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#A6A399] font-['Inter'] font-medium mb-2">
                Audio
              </p>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#EAE8E2] bg-[#FAFAF8] px-3 py-1.5 text-sm font-['JetBrains_Mono'] text-[#1C1C1A] cursor-default">
                audio only
                {info.audio.filesize && (
                  <span className="text-[#A6A399]">{info.audio.filesize}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
