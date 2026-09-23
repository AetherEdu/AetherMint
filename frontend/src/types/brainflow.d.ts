/**
 * Ambient declaration for `brainflow`.
 *
 * The BrainFlow SDK is a native/Node-only dependency. It is aliased to
 * `false` in `next.config.js` (webpack `resolve.alias`) so it is never
 * bundled into the browser build, and `bciService.ts` guards its use behind
 * runtime checks. The package ships no types, so declare the named exports
 * it uses as `any` (each name is declared as both a value and a type so it
 * can be used as a constructor/namespace and in type positions).
 */
declare module 'brainflow' {
  export type BoardShim = any;
  export const BoardShim: any;

  export type BrainFlowInputParams = any;
  export const BrainFlowInputParams: any;

  export type DataFilter = any;
  export const DataFilter: any;

  export const AggOperations: any;
  export const FilterTypes: any;
}
