"use client";

import {
  ChangeEvent,
  InputHTMLAttributes,
  RefObject,
  TextareaHTMLAttributes,
  useRef,
  useState,
} from "react";

type SharedProps = {
  className: string;
  emojiShortcuts?: boolean;
  maxCharacters?: number;
  maxWords?: number;
  minTrimmedLength?: number;
  name: string;
  placeholder: string;
  required?: boolean;
  validationMessage?: string;
  wrapperClassName?: string;
};

type WordLimitedFieldProps =
  | (SharedProps &
      Omit<
        TextareaHTMLAttributes<HTMLTextAreaElement>,
        keyof SharedProps | "onChange" | "value"
      > & {
        as: "textarea";
      })
  | (SharedProps &
      Omit<
        InputHTMLAttributes<HTMLInputElement>,
        keyof SharedProps | "onChange" | "value"
      > & {
        as?: "input";
      });

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function trimToWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return value;

  return words.slice(0, maxWords).join(" ");
}

function getLimit(props: WordLimitedFieldProps) {
  return props.maxWords ?? props.maxCharacters ?? 0;
}

function getValueCount(value: string, props: WordLimitedFieldProps) {
  return props.maxWords ? countWords(value) : value.length;
}

function trimToLimit(value: string, props: WordLimitedFieldProps) {
  if (props.maxWords) return trimToWords(value, props.maxWords);
  if (props.maxCharacters) return value.slice(0, props.maxCharacters);

  return value;
}

function validationFor(value: string, props: WordLimitedFieldProps) {
  const minLength = props.minTrimmedLength ?? 0;

  if (minLength > 0 && value.trim().length < minLength) {
    return props.validationMessage ?? `Enter at least ${minLength} characters.`;
  }

  return "";
}

const quickEmojis = [
  "\u{1F525}",
  "\u{1F5A4}",
  "\u{1F44F}",
  "\u{1F64C}",
  "\u{1F4AF}",
  "\u26A1",
  "\u2728",
  "\u{1F64F}",
];

export function WordLimitedField(props: WordLimitedFieldProps) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const limit = getLimit(props);
  const count = getValueCount(value, props);
  const isAtLimit = limit > 0 && count >= limit;
  const isNearLimit = limit > 0 && count >= limit * 0.9;
  const counterLabel = props.maxWords ? "words" : "chars";

  function onChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const nextValue = trimToLimit(event.target.value, props);

    event.currentTarget.setCustomValidity(validationFor(nextValue, props));
    setValue(nextValue);
  }

  function addEmoji(emoji: string) {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const nextValue = trimToLimit(
      `${value.slice(0, start)}${emoji}${value.slice(end)}`,
      props,
    );
    const nextCursor = Math.min(start + emoji.length, nextValue.length);

    field?.setCustomValidity(validationFor(nextValue, props));
    setValue(nextValue);
    window.requestAnimationFrame(() => {
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const counter = (
    <p
      className={`mt-1 text-right text-xs ${
        isAtLimit
          ? "font-semibold text-[#a3432f]"
          : isNearLimit
            ? "font-medium text-[#8a5b1f]"
            : "text-[#766d62]"
      }`}
    >
      {count}/{limit} {counterLabel}
    </p>
  );
  const emojiButtons = props.emojiShortcuts ? (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#766d62]">
        Emoji
      </span>
      <div className="flex flex-wrap gap-1.5">
        {quickEmojis.map((emoji) => (
          <button
            aria-label={`Insert emoji ${emoji}`}
            className="flex size-8 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9] text-sm transition hover:border-[#171412]"
            key={emoji}
            onClick={() => addEmoji(emoji)}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (props.as === "textarea") {
    const {
      as: _as,
      className,
      maxCharacters: _maxCharacters,
      emojiShortcuts: _emojiShortcuts,
      maxWords: _maxWords,
      minTrimmedLength: _minTrimmedLength,
      validationMessage: _validationMessage,
      wrapperClassName,
      ...fieldProps
    } = props;
    void _as;
    void _emojiShortcuts;
    void _maxCharacters;
    void _maxWords;
    void _minTrimmedLength;
    void _validationMessage;

    return (
      <div className={wrapperClassName}>
        <textarea
          {...fieldProps}
          className={className}
          onChange={onChange}
          ref={fieldRef as RefObject<HTMLTextAreaElement>}
          value={value}
        />
        {emojiButtons}
        {counter}
      </div>
    );
  }

  const {
    as: _as,
    className,
    maxCharacters: _maxCharacters,
    emojiShortcuts: _emojiShortcuts,
    maxWords: _maxWords,
    minTrimmedLength: _minTrimmedLength,
    validationMessage: _validationMessage,
    wrapperClassName,
    ...fieldProps
  } = props;
  void _as;
  void _emojiShortcuts;
  void _maxCharacters;
  void _maxWords;
  void _minTrimmedLength;
  void _validationMessage;

  return (
    <div className={wrapperClassName ?? "min-w-0 flex-1"}>
      <input
        {...fieldProps}
        className={className}
        onChange={onChange}
        ref={fieldRef as RefObject<HTMLInputElement>}
        value={value}
      />
      {emojiButtons}
      {counter}
    </div>
  );
}
