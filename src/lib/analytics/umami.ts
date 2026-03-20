type Payload = Record<string, unknown>;

export const UmamiEvents = new Proxy(
  {},
  {
    get: (_target, prop) => String(prop),
  },
) as Record<string, string>;

export function track(eventName: string, payload?: Payload) {
  void eventName;
  void payload;
}

export function trackEvent(eventName?: string, payload?: Payload) {
  void eventName;
  void payload;
}

export function trackPageView(path: string) {
  void path;
}
