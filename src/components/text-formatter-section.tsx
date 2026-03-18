"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { camelCase, capitalize, snakeCase } from "lodash";
import {
  ArrowRightLeft,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { TEXT_CASES, TEXT_CASE_OPTIONS, DEFAULT_TEXT_CASE, type TextCaseValue } from "@/constants/text-cases";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Dropdown } from "@/components/ui/dropdown";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";

const symbols = [
  { value: ",", label: "Comma (,)" },
  { value: ".", label: "Period (.)" },
  { value: ";", label: "Semicolon (;)" },
  { value: ":", label: "Colon (:)" },
  { value: "|", label: "Pipe (|)" },
  { value: "/", label: "Slash (/)" },
  { value: " ", label: "Space ( )" },
];

const brackets = [
  { value: "none", label: "No Brackets", symbols: ["", ""] },
  { value: "parentheses", label: "Parentheses ( )", symbols: ["(", ")"] },
  { value: "square", label: "Square Brackets [ ]", symbols: ["[", "]"] },
  { value: "curly", label: "Curly Braces { }", symbols: ["{", "}"] },
];

interface TextFormatterSectionProps {
  mode: "delimiters" | "json" | "env";
}

export function TextFormatterSection({ mode }: TextFormatterSectionProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]);
  const [selectedBracket, setSelectedBracket] = useState(brackets[0]);
  const [selectedTextCase, setSelectedTextCase] = useState(
    TEXT_CASE_OPTIONS.find((o) => o.value === DEFAULT_TEXT_CASE) || TEXT_CASE_OPTIONS[0]
  );
  const [isString, setIsString] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [convertToLines, setConvertToLines] = useState(false);
  const [splitByLines, setSplitByLines] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const { copied, copy } = useCopyToClipboard();

  const isJsonMode = mode === "json";
  const isEnvMode = mode === "env";

  const applyTextCase = useCallback(
    (text: string): string => {
      switch (selectedTextCase.value as TextCaseValue) {
        case TEXT_CASES.LOWERCASE:
          return text.toLowerCase();
        case TEXT_CASES.UPPERCASE:
          return text.toUpperCase();
        case TEXT_CASES.CAPITALIZE:
          return capitalize(text);
        case TEXT_CASES.SNAKE_CASE:
          return snakeCase(text);
        case TEXT_CASES.CAMEL_CASE:
          return camelCase(text);
        default:
          return text;
      }
    },
    [selectedTextCase]
  );

  const handleConvert = useCallback(() => {
    if (!input.trim()) return;

    if (isJsonMode) {
      try {
        const parsed = JSON.parse(input);
        setOutput(JSON.stringify(JSON.stringify(parsed)));
      } catch {
        setOutput("Error: Invalid JSON format");
      }
      return;
    }

    if (isEnvMode) {
      try {
        const trimmed = input.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          // JSON → ENV
          const parsed = JSON.parse(trimmed);
          const lines: string[] = [];
          const processObject = (obj: Record<string, unknown>, prefix = "") => {
            Object.entries(obj).forEach(([key, value]) => {
              const cleanKey = key.replace(/\s+/g, "");
              const envKey = prefix
                ? `${prefix}_${cleanKey.toUpperCase()}`
                : cleanKey.toUpperCase();
              if (
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value)
              ) {
                processObject(value as Record<string, unknown>, envKey);
              } else if (Array.isArray(value)) {
                lines.push(`${envKey}=${JSON.stringify(value)}`);
              } else {
                lines.push(`${envKey}=${value}`);
              }
            });
          };
          processObject(parsed);
          setOutput(lines.join("\n"));
        } else {
          // ENV → JSON
          const lines = trimmed
            .split("\n")
            .filter((l) => l.trim() && l.includes("="));
          const result: Record<string, unknown> = {};
          lines.forEach((line) => {
            const [key, ...valueParts] = line.split("=");
            const value = valueParts.join("=").trim();
            const cleanKey = key.trim().replace(/\s+/g, "");
            const cleanValue = value.replace(/\s+/g, "");
            let parsed: unknown;
            try {
              parsed = JSON.parse(cleanValue);
            } catch {
              parsed = cleanValue;
            }
            result[cleanKey] = parsed;
          });
          setOutput(JSON.stringify(result, null, 2));
        }
      } catch {
        setOutput("Error: Invalid format. Please check your input.");
      }
      return;
    }

    // Delimiters mode
    let items = splitByLines
      ? input.split("\n").filter(Boolean)
      : input.split(/\s+|,/).filter(Boolean);

    if (removeDuplicates) {
      items = Array.from(new Set(items));
    }

    items = items.map((item) => applyTextCase(item));

    if (convertToLines) {
      setOutput(items.map((i) => (isString ? `"${i}"` : i)).join("\n"));
      return;
    }

    const joined = items
      .map((i) => (isString ? `"${i}"` : i))
      .join(selectedSymbol.value);

    const [left, right] = selectedBracket.symbols;
    setOutput(left + joined + right);
  }, [
    input,
    isJsonMode,
    isEnvMode,
    splitByLines,
    removeDuplicates,
    convertToLines,
    isString,
    selectedSymbol,
    selectedBracket,
    applyTextCase,
  ]);

  // Convert & Copy in one action
  const handleConvertAndCopy = useCallback(() => {
    if (!input.trim()) return;

    // Run convert logic inline to get the result synchronously
    let result = "";

    if (isJsonMode) {
      try {
        const parsed = JSON.parse(input);
        result = JSON.stringify(JSON.stringify(parsed));
      } catch {
        result = "Error: Invalid JSON format";
      }
    } else if (isEnvMode) {
      try {
        const trimmed = input.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const parsed = JSON.parse(trimmed);
          const lines: string[] = [];
          const processObject = (obj: Record<string, unknown>, prefix = "") => {
            Object.entries(obj).forEach(([key, value]) => {
              const cleanKey = key.replace(/\s+/g, "");
              const envKey = prefix
                ? `${prefix}_${cleanKey.toUpperCase()}`
                : cleanKey.toUpperCase();
              if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                processObject(value as Record<string, unknown>, envKey);
              } else if (Array.isArray(value)) {
                lines.push(`${envKey}=${JSON.stringify(value)}`);
              } else {
                lines.push(`${envKey}=${value}`);
              }
            });
          };
          processObject(parsed);
          result = lines.join("\n");
        } else {
          const lines = trimmed.split("\n").filter((l) => l.trim() && l.includes("="));
          const obj: Record<string, unknown> = {};
          lines.forEach((line) => {
            const [key, ...valueParts] = line.split("=");
            const value = valueParts.join("=").trim();
            const cleanKey = key.trim().replace(/\s+/g, "");
            const cleanValue = value.replace(/\s+/g, "");
            let parsed: unknown;
            try { parsed = JSON.parse(cleanValue); } catch { parsed = cleanValue; }
            obj[cleanKey] = parsed;
          });
          result = JSON.stringify(obj, null, 2);
        }
      } catch {
        result = "Error: Invalid format. Please check your input.";
      }
    } else {
      let items = splitByLines
        ? input.split("\n").filter(Boolean)
        : input.split(/\s+|,/).filter(Boolean);
      if (removeDuplicates) items = Array.from(new Set(items));
      items = items.map((item) => applyTextCase(item));
      if (convertToLines) {
        result = items.map((i) => (isString ? `"${i}"` : i)).join("\n");
      } else {
        const joined = items.map((i) => (isString ? `"${i}"` : i)).join(selectedSymbol.value);
        const [left, right] = selectedBracket.symbols;
        result = left + joined + right;
      }
    }

    setOutput(result);
    if (!result.startsWith("Error:")) {
      copy(result);
    }
  }, [input, isJsonMode, isEnvMode, splitByLines, removeDuplicates, convertToLines, isString, selectedSymbol, selectedBracket, applyTextCase, copy]);

  // Keyboard shortcut: Cmd/Ctrl+Enter to convert & copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleConvertAndCopy();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleConvertAndCopy]);

  const handleClear = () => {
    setInput("");
    setOutput("");
  };

  const getLineCount = (text: string) => {
    return Math.max(text.split("\n").length, 1);
  };

  const placeholderInput = isJsonMode
    ? 'Paste your JSON here...\n\nExample:\n{"name": "test", "count": 42}'
    : isEnvMode
    ? "Paste JSON or ENV format here...\n\nSupports both directions:\n  JSON → ENV variables\n  ENV variables → JSON"
    : "Paste your data here (one item per line or comma separated)...\n\nExample:\napple\nbanana\ncherry";

  const placeholderOutput = isJsonMode
    ? "Stringified JSON will appear here"
    : isEnvMode
    ? "Converted format will appear here"
    : "Formatted output will appear here";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="rounded-xl border border-border bg-card mb-4 shrink-0">
        {/* Row 1: Dropdowns (Delimiters mode only) */}
        {!isJsonMode && !isEnvMode && (
          <div className="flex flex-wrap items-end gap-3 sm:gap-4 px-3 sm:px-4 pt-3 pb-2.5">
            <div className="flex-1 min-w-[8rem]">
              <SectionLabel as="span" className="block mb-1.5">
                Separator
              </SectionLabel>
              <Dropdown
                value={selectedSymbol}
                options={symbols}
                onChange={setSelectedSymbol}
                size="sm"
              />
            </div>
            <div className="flex-1 min-w-[8rem]">
              <SectionLabel as="span" className="block mb-1.5">
                Wrap
              </SectionLabel>
              <Dropdown
                value={selectedBracket}
                options={brackets}
                onChange={setSelectedBracket}
                size="sm"
              />
            </div>
            <div className="flex-1 min-w-[8rem]">
              <SectionLabel as="span" className="block mb-1.5">
                Case
              </SectionLabel>
              <Dropdown
                value={selectedTextCase}
                options={TEXT_CASE_OPTIONS as unknown as readonly { value: string; label: string }[]}
                onChange={(v) =>
                  setSelectedTextCase(v as unknown as typeof selectedTextCase)
                }
                size="sm"
              />
            </div>
          </div>
        )}

        {/* Row 2: Toggles + Actions (or single row for JSON/ENV) */}
        <div className={`flex flex-wrap items-center gap-3 px-3 sm:px-4 py-2.5 ${!isJsonMode && !isEnvMode ? "border-t border-border/50" : ""}`}>
          {!isJsonMode && !isEnvMode && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <ToggleSwitch
                label="Split by Lines"
                checked={splitByLines}
                onChange={setSplitByLines}
              />
              <ToggleSwitch
                label="Quotes"
                checked={isString}
                onChange={setIsString}
              />
              <ToggleSwitch
                label="Dedup"
                checked={removeDuplicates}
                onChange={setRemoveDuplicates}
              />
              <ToggleSwitch
                label="To Lines"
                checked={convertToLines}
                onChange={setConvertToLines}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="primary"
              onClick={handleConvertAndCopy}
              disabled={!input.trim()}
              className="px-3 sm:px-4"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ArrowRightLeft className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Convert & Copy"}</span>
              <span className="sm:hidden">{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button
              onClick={handleConvert}
              disabled={!input.trim()}
              title="Convert"
              className="px-3"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Convert</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              aria-label="Clear input and output"
              className="px-3 py-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor panels */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Input panel */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0 min-h-[140px] sm:min-h-[200px] lg:min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <SectionLabel>Input</SectionLabel>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {getLineCount(input)} lines
              </span>
              <KbdShortcut shortcut="Mod+↵" />
            </div>
          </div>
          <div className="flex-1 relative min-h-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholderInput}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-sm text-foreground font-mono p-4 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Output panel */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0 min-h-[140px] sm:min-h-[200px] lg:min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <SectionLabel>Output</SectionLabel>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {getLineCount(output)} lines
              </span>
              {output && (
                <button
                  onClick={() => copy(output)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 relative min-h-0">
            <textarea
              ref={outputRef}
              value={output}
              readOnly
              placeholder={placeholderOutput}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-sm text-foreground font-mono p-4 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
