"use client";

import { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes, useState } from "react";

type SharedProps = {
  className: string;
  maxWords: number;
  name: string;
  placeholder: string;
  required?: boolean;
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

export function WordLimitedField(props: WordLimitedFieldProps) {
  const [value, setValue] = useState("");
  const words = countWords(value);
  const isAtLimit = words >= props.maxWords;

  function onChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValue(trimToWords(event.target.value, props.maxWords));
  }

  const counter = (
    <p
      className={`mt-1 text-right text-xs ${
        isAtLimit ? "font-semibold text-[#a3432f]" : "text-[#766d62]"
      }`}
    >
      {words}/{props.maxWords} words
    </p>
  );

  if (props.as === "textarea") {
    const {
      as: _as,
      className,
      maxWords: _maxWords,
      ...fieldProps
    } = props;
    void _as;
    void _maxWords;

    return (
      <div>
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
    maxWords: _maxWords,
    ...fieldProps
  } = props;
  void _as;
  void _maxWords;

  return (
    <div className="min-w-0 flex-1">
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
