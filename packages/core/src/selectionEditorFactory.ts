import type { ColumnSchema } from "./types";

export type CreatedEditor = {
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  value: string;
  datalistId?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatLocalDateForInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalTimeForInput(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatLocalDateTimeForInput(d: Date) {
  return `${formatLocalDateForInput(d)}T${formatLocalTimeForInput(d)}`;
}

export function normalizeTemporalInitialValue(
  colType: "date" | "time" | "datetime",
  initial: string,
) {
  const value = initial.trim();
  if (!value) return "";

  if (colType === "date") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1] ?? "";
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatLocalDateForInput(d);
    return "";
  }

  if (colType === "time") {
    const m = value.match(/(\d{2}:\d{2})(?::\d{2})?/);
    if (m) return m[1] ?? "";
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatLocalTimeForInput(d);
    return "";
  }

  if (/Z$/.test(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return value.replace(/Z$/, "").slice(0, 16);
  }
  if (
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/.test(value) &&
    !/[+-]\d{2}:\d{2}$/.test(value)
  ) {
    return value.slice(0, 16);
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return formatLocalDateTimeForInput(d);
  return "";
}

export function autosizeTextarea(ta: HTMLTextAreaElement) {
  const style = window.getComputedStyle(ta);
  let lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 16;
  ta.rows = 1;
  const lines = Math.ceil(ta.scrollHeight / lineHeight);
  ta.rows = Math.max(1, lines);
  ta.style.minHeight = `${lineHeight}px`;
}

function resolveEditorOptions(col: ColumnSchema): string[] {
  let rawOptions: unknown[] = [];
  if (col.type === "enum" && Array.isArray(col.enum)) rawOptions = col.enum as unknown[];
  if (col.type === "tags" && Array.isArray(col.tags)) rawOptions = col.tags as unknown[];
  if (col.type === "labeled" && Array.isArray(col.enum)) rawOptions = col.enum as unknown[];
  return rawOptions.map((o) => {
    if (typeof o === "string") return o;
    if (o && typeof o === "object") {
      const obj = o as Record<string, unknown>;
      if (col.type === "labeled") {
        return String(obj.label ?? obj.value ?? "");
      }
      if ("value" in obj) return String(obj.value ?? obj.label ?? "");
      if ("label" in obj) return String(obj.label ?? "");
    }
    return String(o ?? "");
  });
}

export function createEditorControl(
  col: ColumnSchema | undefined,
  colKey: string,
  initial: string,
  root: HTMLElement,
): CreatedEditor {
  if (col?.edit?.lookup) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = initial;
    input.autocomplete = "off";
    input.spellcheck = false;
    return { control: input, value: initial };
  }

  const needsTextarea = col?.wrapText || initial.includes("\n");
  if (needsTextarea) {
    const ta = document.createElement("textarea");
    ta.value = initial;
    ta.style.resize = "none";
    ta.style.whiteSpace = "pre-wrap";
    ta.style.overflowWrap = "anywhere";
    ta.style.overflow = "hidden";
    autosizeTextarea(ta);
    ta.addEventListener("input", () => autosizeTextarea(ta));
    return { control: ta, value: initial };
  }

  if (col?.type === "boolean") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = initial === "true" || initial === "1" || initial === "on";
    return { control: input, value: initial };
  }

  if (col?.type === "number" || col?.type === "int" || col?.type === "uint") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = initial;
    return { control: input, value: initial };
  }

  if (col?.type === "date" || col?.type === "time" || col?.type === "datetime") {
    const input = document.createElement("input");
    input.type = col.type === "date" ? "date" : col.type === "time" ? "time" : "datetime-local";
    const normalized = normalizeTemporalInitialValue(col.type, initial);
    input.value = normalized;
    return { control: input, value: normalized };
  }

  if (col?.type === "enum" || col?.type === "tags" || col?.type === "labeled") {
    const allowCustom =
      col.type === "enum"
        ? (col.enumAllowCustom ?? false)
        : col.type === "tags"
          ? (col.tagsAllowCustom ?? false)
          : (col.enumAllowCustom ?? false);
    const options = resolveEditorOptions(col);
    if (allowCustom === false) {
      const select = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "";
      select.appendChild(empty);
      for (const opt of options) {
        const op = document.createElement("option");
        op.value = opt;
        op.textContent = opt;
        if (initial === opt) op.selected = true;
        select.appendChild(op);
      }
      return { control: select, value: initial };
    }
    const input = document.createElement("input");
    input.type = "text";
    const listId = `extable-datalist-${String(colKey)}`;
    input.setAttribute("list", listId);
    input.value = initial;
    let datalist = document.getElementById(listId) as HTMLDataListElement | null;
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = listId;
      for (const opt of options) {
        const op = document.createElement("option");
        op.value = opt;
        datalist.appendChild(op);
      }
      root.appendChild(datalist);
    }
    return { control: input, value: initial, datalistId: listId };
  }

  const input = document.createElement("input");
  input.type = "text";
  input.value = initial;
  return { control: input, value: initial };
}
