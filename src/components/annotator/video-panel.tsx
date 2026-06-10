"use client";

import { memo } from "react";

export const VideoPanel = memo(function VideoPanel({
  videoId,
  url,
  title,
  videoType,
  videoIdx,
}: {
  videoId: string | null;
  url: string;
  title: string;
  videoType: string;
  videoIdx: string;
}) {
  return (
    <div className="flex w-[315px] shrink-0 flex-col gap-2">
      {videoId ? (
        // src가 같으면 React가 DOM을 건드리지 않으므로 같은 영상의 연속 행에서 리로드되지 않음
        <iframe
          title="영상"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          className="h-[560px] w-[315px] border bg-black"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="flex h-[560px] w-[315px] items-center justify-center border text-muted-foreground text-xs">
          영상 링크 파싱 실패
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-primary text-xs underline underline-offset-4"
      >
        YouTube에서 열기 ↗
      </a>
      <div className="text-muted-foreground text-xs leading-relaxed">
        <p className="line-clamp-2 text-foreground">{title}</p>
        <p>
          {videoType} · video_idx {videoIdx}
        </p>
      </div>
    </div>
  );
});
