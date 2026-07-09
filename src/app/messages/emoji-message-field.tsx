"use client";

import { useRef } from "react";

const quickEmojis = ["🔥", "🖤", "👏", "🙌", "💯", "⚡", "✨", "🙏"];

export function EmojiMessageField({
  className,
  label,
  name = "body",
  placeholder,
  wrapperClassName = "space-y-2",
}: {
  className: string;
  label?: string;
  name?: string;
  placeholder: string;
  wrapperClassName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${textarea.value.slice(0, start)}${emoji}${textarea.value.slice(end)}`;

    textarea.value = nextValue.slice(0, textarea.maxLength || undefined);
    const cursor = Math.min(start + emoji.length, textarea.value.length);
    textarea.setSelectionRange(cursor, cursor);
    textarea.focus();
  }

  return (
    <div className={wrapperClassName}>
      {label ? <label className="text-xs font-bold">{label}</label> : null}
      <textarea
        className={className}
        maxLength={4000}
        name={name}
        placeholder={placeholder}
        ref={textareaRef}
      />
      <div className="flex flex-wrap gap-1.5">
        {quickEmojis.map((emoji) => (
          <button
            aria-label={`Insert ${emoji}`}
            className="flex size-8 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9] text-sm transition hover:border-[#171412]"
            key={emoji}
            onClick={() => insertEmoji(emoji)}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
