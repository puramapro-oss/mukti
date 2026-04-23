declare module 'javascript-opentimestamps' {
  export class Ops {
    static OpSHA256: new () => unknown
  }
  export interface DetachedTimestampFileInstance {
    serializeToBytes: () => Buffer
    timestamp: { allAttestations: () => Map<unknown, unknown> }
  }
  export class DetachedTimestampFile {
    static fromHash: (op: unknown, hash: Buffer) => DetachedTimestampFileInstance
    static deserialize: (bytes: Buffer) => DetachedTimestampFileInstance
  }
  export function stamp(file: DetachedTimestampFileInstance): Promise<void>
  export function verify(file: DetachedTimestampFileInstance): Promise<{ bitcoin?: { timestamp: number } }>

  const _default: {
    Ops: typeof Ops
    DetachedTimestampFile: typeof DetachedTimestampFile
    stamp: typeof stamp
    verify: typeof verify
  }
  export default _default
}
