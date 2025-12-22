import type { ButtonActionValue, ButtonValue, LinkValue } from "./types";

export type LinkActionValue = { label: string; href: string; target?: string };

export function resolveButtonAction(value: unknown): ButtonActionValue | null {
  if (typeof value === "string") return { label: value };
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const label = obj.label;
  const command = obj.command;
  const commandfor = obj.commandfor;
  if (typeof label !== "string") return null;
  if (typeof command === "string" && typeof commandfor === "string") {
    return { label, command, commandfor };
  }
  return null;
}

export function getButtonLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const label = (value as Record<string, unknown>).label;
  return typeof label === "string" ? label : "";
}

export function resolveLinkAction(value: unknown): LinkActionValue | null {
  if (typeof value === "string") return { label: value, href: value };
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const label = obj.label;
  const href = obj.href;
  const target = obj.target;
  if (typeof label !== "string" || typeof href !== "string") return null;
  if (typeof target === "string") return { label, href, target };
  if (target === undefined) return { label, href };
  return null;
}

export function getLinkLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  const label = obj.label;
  const href = obj.href;
  if (typeof label === "string") return label;
  if (typeof href === "string") return href;
  return "";
}
