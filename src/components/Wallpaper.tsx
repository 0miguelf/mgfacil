import { useEffect, useState } from "react";
import { pickWallpaper } from "@/lib/wallpapers";

export function Wallpaper() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(pickWallpaper());
  }, []);

  if (!url) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
      style={{
        backgroundImage: `linear-gradient(180deg, oklch(1 0 0 / 0.25), oklch(1 0 0 / 0.45)), url(${url})`,
      }}
    />
  );
}
