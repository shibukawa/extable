import type { SelectionRange } from "./types";

export interface ViewportState {
  scrollTop: number;
  scrollLeft: number;
  clientWidth: number;
  clientHeight: number;
  deltaX: number;
  deltaY: number;
  timestamp: number;
}

export interface Renderer {
  mount(root: HTMLElement): void;
  render(state?: ViewportState): void;
  destroy(): void;
  getCellElements(): NodeListOf<HTMLElement> | null;
  hitTest(
    event: MouseEvent,
  ): { rowId: string; colKey: string | null; element?: HTMLElement; rect: DOMRect } | null;
  hitTestAction?(
    event: MouseEvent,
  ):
    | { rowId: string; colKey: string; kind: "button" | "link" }
    | { rowId: string; colKey: string; kind: "tag-remove"; tagIndex: number }
    | null;
  setActiveCell(rowId: string | null, colKey: string | null): void;
  setSelection(ranges: SelectionRange[]): void;
}
