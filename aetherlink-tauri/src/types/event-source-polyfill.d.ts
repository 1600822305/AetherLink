declare module 'event-source-polyfill' {
  export class EventSourcePolyfill {
    constructor(url: string, options?: {
      headers?: Record<string, string>;
      withCredentials?: boolean;
      heartbeatTimeout?: number;
    });

    readonly url: string;
    readonly readyState: number;
    readonly withCredentials: boolean;

    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;

    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    close(): void;

    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
  }
}
