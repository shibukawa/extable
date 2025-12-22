import { describe, expect, test, vi } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("button/link cells", () => {
  test("button action emits selection action payload", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [
          {
            name: "Report",
            action: { label: "Open", command: "open", commandfor: "doc" },
          },
        ],
        schema: {
          columns: [
            { key: "name", type: "string" },
            { key: "action", type: "button" },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const events: Array<{ reason: string; next: any }> = [];
    const unsub = core.subscribeSelection((next, _prev, reason) => {
      events.push({ reason, next });
    });

    const button = root.querySelector(
      'button[data-extable-action="button"]',
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    const actionEvent = events.find((e) => e.reason === "action");
    expect(actionEvent?.next.action).toMatchObject({
      kind: "button",
      colKey: "action",
    });
    expect(actionEvent?.next.action?.value).toEqual({
      label: "Open",
      command: "open",
      commandfor: "doc",
    });

    unsub();
    core.destroy();
    root.remove();
  });

  test("disabled button does not emit action", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [
          {
            name: "Report",
            action: { label: "Open", command: "open", commandfor: "doc" },
          },
        ],
        schema: {
          columns: [
            { key: "name", type: "string" },
            {
              key: "action",
              type: "button",
              conditionalStyle: () => ({ disabled: true }),
            },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const events: Array<{ reason: string }> = [];
    const unsub = core.subscribeSelection((_next, _prev, reason) => {
      events.push({ reason });
    });

    const button = root.querySelector(
      'button[data-extable-action="button"]',
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    const actionEvent = events.find((e) => e.reason === "action");
    expect(actionEvent).toBeUndefined();

    unsub();
    core.destroy();
    root.remove();
  });

  test("link click uses anchor navigation", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Doc", link: "https://example.com/docs" }],
        schema: {
          columns: [
            { key: "name", type: "string" },
            { key: "link", type: "link" },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const link = root.querySelector(
      '[data-extable-action="link"]',
    ) as HTMLElement | null;
    expect(link).toBeTruthy();
    link!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(anchor?.href).toContain("https://example.com/docs");
    expect(anchor?.target).toBe("_self");

    clickSpy.mockRestore();
    core.destroy();
    root.remove();
  });
});
