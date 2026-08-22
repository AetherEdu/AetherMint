/**
 * @jest-environment jsdom
 */
import {
  __resetServiceWorkerRegistrationForTests,
  applyUpdate,
  registerServiceWorker,
} from '../serviceWorkerRegistration';

type Listener = (event: Event) => void;

interface FakeWorker {
  state: ServiceWorkerState;
  postMessage: jest.Mock;
}

const makeFakeWorker = (
  initialState: ServiceWorkerState = 'installed'
): FakeWorker => ({
  state: initialState,
  postMessage: jest.fn(),
});

interface FakeRegistration extends ServiceWorkerRegistration {
  _fireUpdateFound: () => void;
}

function installFakeServiceWorkerApi(
  options: {
    waiting?: FakeWorker | null;
    active?: FakeWorker | null;
  } = {}
) {
  const waiting = options.waiting ?? makeFakeWorker('installed');
  const active = options.active ?? makeFakeWorker('activated');

  const updateFoundListeners: Listener[] = [];
  const controllerListeners: Listener[] = [];

  const registration = {
    active,
    installing: null,
    waiting,
    scope: '/',
    updateViaCache: 'none',
    addEventListener: jest.fn((event: string, cb: Listener) => {
      if (event === 'updatefound') updateFoundListeners.push(cb);
    }),
    removeEventListener: jest.fn(),
    _fireUpdateFound: () => {
      updateFoundListeners.forEach((cb) => cb({} as Event));
    },
  } as unknown as FakeRegistration;

  const controller = makeFakeWorker('activated');

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller,
      register: jest.fn().mockResolvedValue(registration),
      addEventListener: jest.fn((event: string, cb: Listener) => {
        if (event === 'controllerchange') controllerListeners.push(cb);
      }),
      removeEventListener: jest.fn(),
      _fireControllerChange: () => {
        controllerListeners.forEach((cb) => cb({} as Event));
      },
    },
  });

  return {
    registration,
    waiting,
    fireControllerChange: () => {
      controllerListeners.forEach((cb) => cb({} as Event));
    },
  };
}

describe('registerServiceWorker', () => {
  beforeEach(() => {
    __resetServiceWorkerRegistrationForTests();
    jest.resetModules();
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
  });

  it('returns "unsupported" when the API is unavailable', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    const status = await registerServiceWorker({});
    expect(status).toBe('unsupported');
  });

  it('returns "unsupported" in development unless force=true', async () => {
    installFakeServiceWorkerApi();
    process.env.NODE_ENV = 'development';
    const status = await registerServiceWorker({});
    expect(status).toBe('unsupported');

    const forced = await registerServiceWorker({}, { force: true });
    expect(forced).toBe('registered');
  });

  it('registers the worker and invokes onUpdate when a worker is waiting', async () => {
    const api = installFakeServiceWorkerApi();
    const onUpdate = jest.fn();
    const onOfflineReady = jest.fn();

    const status = await registerServiceWorker({ onUpdate, onOfflineReady });

    expect(status).toBe('registered');
    expect(api.registration.addEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function)
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onOfflineReady).not.toHaveBeenCalled();

    // First controllerchange fires onOfflineReady once.
    api.fireControllerChange();
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
    // Subsequent changes are no-ops (idempotent guard).
    api.fireControllerChange();
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
  });

  it('captures errors via onError and returns "error"', async () => {
    installFakeServiceWorkerApi();
    (navigator.serviceWorker.register as jest.Mock).mockRejectedValueOnce(
      new Error('boom')
    );
    const onError = jest.fn();
    const status = await registerServiceWorker({ onError });
    expect(status).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('fires onUpdate when a new worker installs after registration', async () => {
    // Start with no waiting worker — becomes the "up to date" case.
    const api = installFakeServiceWorkerApi({ waiting: null });
    const onUpdate = jest.fn();
    await registerServiceWorker({ onUpdate });

    expect(onUpdate).not.toHaveBeenCalled();

    // Simulate a new worker appearing via the updatefound event chain.
    api.registration.waiting = makeFakeWorker('installed');
    api.registration._fireUpdateFound();

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('posts SKIP_WAITING when applyUpdate() is called', async () => {
    const api = installFakeServiceWorkerApi();
    await registerServiceWorker({});
    const posted = applyUpdate();
    expect(posted).toBe(true);
    expect(api.waiting.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
  });

  it('returns false from applyUpdate() when no worker is waiting', async () => {
    installFakeServiceWorkerApi({ waiting: null });
    await registerServiceWorker({});
    expect(applyUpdate()).toBe(false);
  });
});
