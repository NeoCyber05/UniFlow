import { useId } from "react";

import { cn } from "@/lib/utils";

/** Logo Trợ lý AI: tile đỏ + bong bóng chat có tia sáng, cùng ngôn ngữ hình với public/logo.svg. */
export const AiLogo = ({ className }: { className?: string }) => {
  // Mỗi instance cần id gradient riêng; bỏ ký tự đặc biệt để url(#...) luôn hợp lệ.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Trợ lý AI UniFlow" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d70a2d" />
          <stop offset="52%" stopColor="#ce0027" />
          <stop offset="100%" stopColor="#b9001e" />
        </linearGradient>
        <linearGradient id={`${id}gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd864" />
          <stop offset="100%" stopColor="#ffa725" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id}bg)`} />
      {/* Bong bóng chat */}
      <path d="M17 15h28a7 7 0 0 1 7 7v17a7 7 0 0 1-7 7H27l-9 7v-7h-1a7 7 0 0 1-7-7V22a7 7 0 0 1 7-7z" fill="#fff" />
      {/* Tia sáng AI lớn */}
      <path d="M30 20c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="#cb0026" />
      {/* Tia sáng nhỏ màu vàng */}
      <path d="M50 6c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z" fill={`url(#${id}gold)`} />
      <circle cx="42" cy="37" r="2.6" fill={`url(#${id}gold)`} />
    </svg>
  );
};
