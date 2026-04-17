type BackoffOptions = {
  enabled?: boolean;
  initialInterval?: number;
  maxInterval?: number;
  factor?: number;
  jitter?: boolean;
};

type PollingResult<T> = {
  status: "success" | "timeout";
  result?: T;
};

type PollingOptions<T> = {
  interval: number;
  timeout: number;
  task: () => Promise<T>;
  isSuccess: (result: T) => boolean;

  backoff?: BackoffOptions;

  onResult?: (result: T) => void;
  onSuccess?: (result: T) => void;
  onTimeout?: () => void;
  onError?: (error: any) => void;
};

export class Polling<T> {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  private attempt = 0;
  private startTime = 0;

  private resolve?: (value: PollingResult<T>) => void;
  private reject?: (reason?: any) => void;

  private lastResult?: T;

  private readonly backoff: Required<BackoffOptions>;

  constructor(private readonly options: PollingOptions<T>) {
    this.backoff = {
      enabled: options.backoff?.enabled ?? false,
      initialInterval: options.backoff?.initialInterval ?? options.interval,
      maxInterval: options.backoff?.maxInterval ?? 30000,
      factor: options.backoff?.factor ?? 2,
      jitter: options.backoff?.jitter ?? true,
    };
  }


  startAsync(): Promise<PollingResult<T>> {
    if (!this.stopped) {
      return Promise.reject(new Error("Polling already running"));
    }

    this.init();

    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.run();
    });
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stopped = true;
  }

  reset() {
    this.stop();
    this.attempt = 0;
    this.startTime = 0;
    this.lastResult = undefined;
    this.resolve = undefined;
    this.reject = undefined;
  }

  private init() {
    this.stopped = false;
    this.attempt = 0;
    this.startTime = Date.now();
    this.lastResult = undefined;
  }

  private finish(status: "success" | "timeout") {
    this.stop();

    this.resolve?.({
      status,
      result: this.lastResult,
    });

    this.cleanup();
  }

  private fail(err: any) {
    this.stop();
    this.reject?.(err);
    this.cleanup();
  }

  private cleanup() {
    this.resolve = undefined;
    this.reject = undefined;
  }

  private getNextInterval() {
    if (!this.backoff.enabled) return this.options.interval;

    let delay =
      this.backoff.initialInterval *
      Math.pow(this.backoff.factor, this.attempt);

    if (delay > this.backoff.maxInterval) {
      delay = this.backoff.maxInterval;
    }

    if (this.backoff.jitter) {
      const randomFactor = 0.5 + Math.random() * 0.5;
      delay *= randomFactor;
    }

    return Math.floor(delay);
  }

  private async run(): Promise<void> {
    if (this.stopped) return;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.options.timeout) {
      this.options.onTimeout?.();
      return this.finish("timeout");
    }

    try {
      const result = await this.options.task();
      this.lastResult = result;

      this.options.onResult?.(result);

      if (this.options.isSuccess(result)) {
        this.options.onSuccess?.(result);
        return this.finish("success");
      }

      this.attempt++;
    } catch (err) {
      this.options.onError?.(err);
      return this.fail(err);
    }

    const delay = this.getNextInterval();
    this.timer = setTimeout(() => this.run(), delay);
  }
}