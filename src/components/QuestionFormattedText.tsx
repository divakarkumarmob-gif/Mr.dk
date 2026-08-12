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

  // Auto-format Statement Questions (I., II., III., IV., V., Statement I, Statement II) onto clean separate lines
  let processedText = text
    .replace(/\\\(|\\\)/g, '$')
    .replace(/\\\[|\\\]/g, '$$')
    .replace(/\s+(I\.|II\.|III\.|IV\.|V\.|VI\.|VII\.|VIII\.)\s+/g, '\n\n$1 ')
    .replace(/\s+(Statement\s+[I|V|X\d]+:?)/gi, '\n\n$1')
    .replace(/\s+(Options:?|Select the correct option:?)/gi, '\n\n**$1**');

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
    <div className={`markdown-body text-gray-900 leading-relaxed whitespace-pre-line ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
