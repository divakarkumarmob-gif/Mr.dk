import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface QuestionFormattedTextProps {
  text: string;
  className?: string;
  inline?: boolean;
}

export default function QuestionFormattedText({ text, className = '', inline = false }: QuestionFormattedTextProps) {
  if (!text) return null;

  // Pre-process text to standardize math delimiters
  // Convert \( ... \) to $ ... $ and \[ ... \] to $$ ... $$
  let processedText = text
    .replace(/\\\(|\\\)/g, '$')
    .replace(/\\\[|\\\]/g, '$$');

  // Handle common plain-text math patterns like 10^2 -> $10^2$ if not inside $
  // Keep intact if Markdown already contains math

  if (inline) {
    return (
      <span className={`inline-markdown inline-block ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <span className="inline">{children}</span>,
          }}
        >
          {processedText}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={`markdown-body text-gray-900 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
