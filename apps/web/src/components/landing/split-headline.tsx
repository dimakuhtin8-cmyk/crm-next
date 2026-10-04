'use client';

/**
 * Hero H1 з посимвольним reveal (SplitText, expo.out). При reduced-motion
 * або недоступності SplitText — статичний текст.
 */

import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useEffect, useRef } from 'react';

gsap.registerPlugin(SplitText);

export function SplitHeadline({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    let split: SplitText | null = null;
    try {
      split = new SplitText(el, { type: 'chars' });
    } catch {
      return;
    }
    const tween = gsap.from(split.chars, {
      opacity: 0,
      y: 20,
      rotateX: -40,
      duration: 0.6,
      stagger: 0.015,
      ease: 'expo.out',
    });
    return () => {
      tween.kill();
      split?.revert();
    };
  }, [text]);

  return (
    <h1 ref={ref} className={className}>
      {text}
    </h1>
  );
}
