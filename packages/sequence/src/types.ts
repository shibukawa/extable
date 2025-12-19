import type { SequenceRegistry } from './registry';

export type SequenceValue = string | number | Date;

export type SequenceKind =
  | 'copy'
  | 'list'
  | 'arithmetic'
  | 'geometric'
  | 'seed-repeat';

export type InferOptions = {
  registry?: SequenceRegistry;
};
