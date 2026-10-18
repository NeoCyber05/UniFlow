/* eslint-disable @typescript-eslint/no-unused-vars -- Next API parity: accepted-but-ignored args */
import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; quality?: number; unoptimized?: boolean };

export default function Image({ fill, priority, quality: _q, unoptimized: _u, style, ...rest }: Props) {
  return (
    <img
      loading={priority ? "eager" : "lazy"}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
      {...rest}
    />
  );
}
