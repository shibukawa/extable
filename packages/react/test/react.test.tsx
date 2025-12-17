import { describe, expect, test } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Extable } from '../src/index';
import { createRef } from 'react';
import type { ExtableHandle } from '../src/index';

describe('react wrapper', () => {
  test('renders container', () => {
    const { container } = render(
      <Extable
        schema={{ columns: [] }}
        defaultData={[]}
        defaultView={{}}
        options={{ renderMode: 'html', editMode: 'direct', lockMode: 'none' }}
      />
    );
    const wrapper = container.querySelector('[data-extable-wrapper]');
    expect(wrapper).toBeTruthy();
  });

  test('exposes subscriptions via handle', async () => {
    const ref = createRef<ExtableHandle>();
    render(
      <Extable
        ref={ref}
        schema={{ columns: [] }}
        defaultData={[]}
        defaultView={{}}
        options={{ renderMode: 'html', editMode: 'direct', lockMode: 'none' }}
      />,
    );

    await waitFor(() => expect(ref.current?.getCore()).toBeTruthy());
    const core = ref.current!.getCore()!;

    let tableCalls = 0;
    const unsubTable = core.subscribeTableState(() => {
      tableCalls += 1;
    });
    expect(tableCalls).toBe(1);
    unsubTable();
    unsubTable();

    let selectionCalls = 0;
    const unsubSel = core.subscribeSelection(() => {
      selectionCalls += 1;
    });
    expect(selectionCalls).toBe(1);
    unsubSel();
    unsubSel();
  });
});
