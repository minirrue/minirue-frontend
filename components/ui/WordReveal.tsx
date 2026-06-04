'use client';

import React from 'react';

interface WordRevealProps {
  text: string;
  delay?: number;
  wordDelay?: number;
}

export default function WordReveal({ text, delay = 0, wordDelay = 80 }: WordRevealProps) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            animation: 'mr-word-in 0.65s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: `${delay + i * wordDelay}ms`,
          }}
        >
          {word}{i < words.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
    </>
  );
}
