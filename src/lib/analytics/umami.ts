type Payload = Record<string, unknown>;

export const UmamiEvents = new Proxy(
  {},
  {
    get: (_target, prop) => String(prop),
  },
) as Record<string, string>;

export function track(_eventName: string, _payload?: Payload) {}

export function trackEvent(_eventName?: string, _payload?: Payload) {}

export function trackPageView(_path: string) {}
