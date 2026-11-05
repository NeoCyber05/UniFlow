"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Giữ vùng tin nhắn ở cuối khi đang trả lời; người dùng cuộn lên thì thôi bám để đọc yên,
 * và có nút "Xuống mới nhất" để quay lại.
 */
export const useStickToBottom = (ref: RefObject<HTMLElement | null>, deps: readonly unknown[]) => {
  const stuck = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => {
      const near = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
      stuck.current = near;
      setAtBottom(near);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (node && stuck.current) node.scrollTop = node.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const scrollToBottom = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    stuck.current = true;
    setAtBottom(true);
    node.scrollTo({ top: node.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [ref]);

  return { atBottom, scrollToBottom };
};
