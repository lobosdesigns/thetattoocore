"use client";

import { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes, useState } from "react";

type SharedProps = {
  className: string;
  maxCharacters?: number;
  maxWords?: number;
  name: string;
  placeholder: string;
  required?: boolean;
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

export function WordLimitedField(props: WordLimitedFieldProps) {
  const [value, setValue] = useState("");
  const limit = getLimit(props);
  const count = getValueCount(value, props);
  const isAtLimit = limit > 0 && count >= limit;
  const isNearLimit = limit > 0 && count >= limit * 0.9;
  const counterLabel = props.maxWords ? "words" : "chars";

  function onChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValue(trimToLimit(event.target.value, props));
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

  if (props.as === "textarea") {
    const {
      as: _as,
      className,
      maxCharacters: _maxCharacters,
      maxWords: _maxWords,
      wrapperClassName,
      ...fieldProps
    } = props;
    void _as;
    void _maxCharacters;
    void _maxWords;

    return (
      <div className={wrapperClassName}>
        <textarea
          {...fieldProps}
          className={className}
          onChange={onChange}
          value={value}
        />
        {counter}
      </div>
    );
  }

  const {
    as: _as,
    className,
    maxCharacters: _maxCharacters,
    maxWords: _maxWords,
    wrapperClassName,
    ...fieldProps
  } = props;
  void _as;
  void _maxCharacters;
  void _maxWords;

  return (
    <div className={wrapperClassName ?? "min-w-0 flex-1"}>
      <input
        {...fieldProps}
        className={className}
        onChange={onChange}
        value={value}
      />
      {counter}
    </div>
  );
}
