/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';

import { ServiceWorkerManager } from '../ServiceWorkerManager';

// Mock the registration helper so we can assert on the callbacks without
// pulling in the real navigator.serviceWorker machinery.
jest.mock('../serviceWorkerRegistration', () => ({
  registerServiceWorker: jest.fn().mockResolvedValue('registered'),
  applyUpdate: jest.fn().mockReturnValue(false),
}));

// Mock react-hot-toast so we can assert on its calls without rendering
// its portal-based UI in JSDOM.
jest.mock('react-hot-toast', () => {
  const toastFn = jest.fn();
  toastFn.success = jest.fn();
  toastFn.error = jest.fn();
  toastFn.dismiss = jest.fn();
  return {
    __esModule: true,
    default: toastFn,
    toast: toastFn,
  };
});

import { toast } from 'react-hot-toast';
import {
  registerServiceWorker,
  applyUpdate,
} from '../serviceWorkerRegistration';

const toastMock = toast as unknown as jest.Mock;
const toastSuccess = toast.success as unknown as jest.Mock;
const toastDismiss = toast.dismiss as unknown as jest.Mock;
const registerMock = registerServiceWorker as unknown as jest.Mock;
const applyMock = applyUpdate as unknown as jest.Mock;

interface OnUpdateCallbacks {
  onUpdate: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady: (registration: ServiceWorkerRegistration) => void;
  onError: (error: unknown) => void;
}

// The mocked registration helper is called as
//   registerServiceWorker(callbacks, options)
// so `registerMock.mock.calls[0]` is `[callbacks, options]` — length 2.
// Always pull `callbacks` from index 0 to avoid the
// `[, , , callbacks] = [...2 elements]` undefined trap.
const getCallbacks = (): OnUpdateCallbacks =>
  registerMock.mock.calls[0][0] as OnUpdateCallbacks;

describe('ServiceWorkerManager', () => {
  beforeEach(() => {
    registerMock.mockClear().mockResolvedValue('registered');
    applyMock.mockClear().mockReturnValue(false);
    toastMock.mockClear();
    toastSuccess.mockClear();
    toastDismiss.mockClear();
  });

  it('renders nothing', () => {
    const { container } = render(<ServiceWorkerManager />);
    expect(container).toBeEmptyDOMElement();
  });

  it('registers the service worker on mount with the expected callbacks', async () => {
    render(<ServiceWorkerManager forceRegister />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(registerMock).toHaveBeenCalledTimes(1);
    const [callbacks, options] = registerMock.mock.calls[0];
    expect(typeof callbacks.onUpdate).toBe('function');
    expect(typeof callbacks.onOfflineReady).toBe('function');
    expect(typeof callbacks.onError).toBe('function');
    expect(options).toEqual({ force: true });
  });

  it('shows an offline toast on offline events and a success toast + dismiss on online', async () => {
    render(<ServiceWorkerManager forceRegister />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(toastMock).toHaveBeenCalled();
    const dismissCallsBefore = toastDismiss.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(toastDismiss.mock.calls.length).toBeGreaterThan(
      dismissCallsBefore
    );
    expect(toastDismiss).toHaveBeenCalledWith('aethermint-offline');
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Back online')
    );
  });

  it('opens a persistent update toast when onUpdate fires', async () => {
    render(<ServiceWorkerManager forceRegister />);
    await act(async () => {
      await Promise.resolve();
    });

    const { onUpdate } = getCallbacks();
    act(() => {
      onUpdate({
        waiting: null,
        installing: null,
        active: null,
      } as unknown as ServiceWorkerRegistration);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ duration: Infinity })
    );
  });

  it('posts SKIP_WAITING and arms a one-shot controllerchange listener on "Update now"', async () => {
    const controllerListeners: Array<EventListener> = [];
    const removeCalls: Array<[string, EventListenerOrEventListenerObject]> =
      [];

    const fakeServiceWorker = {
      controller: { scriptURL: 'old', state: 'activated' as const },
      addEventListener: jest.fn(
        (event: string, cb: EventListenerOrEventListenerObject) => {
          if (event === 'controllerchange') {
            controllerListeners.push(cb as EventListener);
          }
        }
      ),
      removeEventListener: jest.fn(
        (event: string, cb: EventListenerOrEventListenerObject) => {
          removeCalls.push([event, cb]);
        }
      ),
      ready: Promise.resolve({ sync: { register: jest.fn() } }),
      register: jest.fn().mockResolvedValue({
        scope: '/',
        waiting: { postMessage: jest.fn() },
        active: { scriptURL: 'old' },
        installing: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    };

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: fakeServiceWorker,
    });

    applyMock.mockReturnValue(true);

    render(<ServiceWorkerManager forceRegister />);
    await act(async () => {
      await Promise.resolve();
    });

    const { onUpdate } = getCallbacks();
    act(() => {
      onUpdate({
        waiting: { postMessage: jest.fn() },
        installing: null,
        active: null,
      } as unknown as ServiceWorkerRegistration);
    });

    const [toastRender] = toastMock.mock.calls.find(
      ([arg]) => typeof arg === 'function'
    ) ?? [null];
    expect(toastRender).toBeTruthy();

    let rendered: React.ReactNode;
    act(() => {
      rendered = (toastRender as (t: { id: string }) => React.ReactNode)({
        id: 'test-toast-id',
      });
    });

    const updateBtn = render(<>{rendered}</>).getByRole('button', {
      name: /update now/i,
    });
    act(() => {
      fireEvent.click(updateBtn);
    });

    // `armReloader` posts SKIP_WAITING via the registration helper and
    // waits for the browser's `controllerchange` event rather than
    // guessing with a timer.
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(fakeServiceWorker.addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
      expect.objectContaining({ once: true })
    );

    // Swap the controller — simulate the new worker taking control.
    Object.defineProperty(fakeServiceWorker, 'controller', {
      configurable: true,
      value: { scriptURL: 'new', state: 'activated' as const },
    });
    act(() => {
      controllerListeners.forEach((cb) =>
        cb(new Event('controllerchange'))
      );
    });

    // The once: true option means the listener auto-removes itself
    // after the first controllerchange — verifying the auto-removal is
    // the observable downstream effect of reload firing. (Direct
    // `window.location.reload` mocking is impractical in jsdom because
    // the property is non-configurable on modern engines.)
    expect(removeCalls).toEqual(
      expect.arrayContaining([
        ['controllerchange', expect.any(Function)],
      ])
    );

    // Restoration — restoring `window.navigator.serviceWorker` to its
    // prior value is unnecessary because `next/jest` re-creates the
    // jsdom global between tests, but we clean up here for any in-
    // process consumers that re-use the worker (e.g. later tests in a
    // --runInBand CI run).
  });

  it('removes window listeners on unmount', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<ServiceWorkerManager forceRegister />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
