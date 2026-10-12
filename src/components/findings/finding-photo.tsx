"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Photo bytes come from the findings photo route. A missing route or a
 * failed load shows a tile. The storage key is never passed in.
 */
export function FindingPhoto({
  findingId,
  mediaId,
}: {
  findingId: string;
  mediaId: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  if (failed) {
    return (
      <div
        role="img"
        aria-label="Photo unavailable"
        className="flex aspect-square items-center justify-center border border-line bg-sunken px-3 text-center text-ui text-ink-muted"
      >
        Photo unavailable
      </div>
    );
  }

  return (
    // The photo route is not on this branch yet. A failed load shows a tile.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={`/api/findings/${findingId}/photos/${mediaId}`}
      alt=""
      className="aspect-square w-full border border-line object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
