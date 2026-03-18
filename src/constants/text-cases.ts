export const TEXT_CASES = {
  RESPECT_CASE: "respect_case",
  LOWERCASE: "lowercase",
  UPPERCASE: "uppercase",
  CAPITALIZE: "capitalize",
  SNAKE_CASE: "snake_case",
  CAMEL_CASE: "camel_case",
} as const;

export type TextCaseValue = (typeof TEXT_CASES)[keyof typeof TEXT_CASES];

export const TEXT_CASE_OPTIONS = [
  { value: TEXT_CASES.RESPECT_CASE, label: "Respect Case" },
  { value: TEXT_CASES.LOWERCASE, label: "lowercase" },
  { value: TEXT_CASES.UPPERCASE, label: "UPPERCASE" },
  { value: TEXT_CASES.CAPITALIZE, label: "Capitalize" },
  { value: TEXT_CASES.SNAKE_CASE, label: "snake_case" },
  { value: TEXT_CASES.CAMEL_CASE, label: "camelCase" },
] as const;

export const DEFAULT_TEXT_CASE = TEXT_CASES.RESPECT_CASE;
