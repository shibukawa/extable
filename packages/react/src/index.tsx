import { useEffect, useRef } from 'react';
import { CoreOptions, TableConfig, createTablePlaceholder, mountTable } from '@extable/core';

export interface ExtableProps {
  config: TableConfig;
  options?: CoreOptions;
}

export function Extable(props: ExtableProps) {
  const { config, options = {} } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const table = createTablePlaceholder(config, options);
    mountTable(containerRef.current, table);
  }, [config, options]);

  return <div data-extable-wrapper ref={containerRef} />;
}

export type { TableConfig, CoreOptions };
