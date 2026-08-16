import { sleep } from './time.ts';
import { logger } from './logger.ts';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class HttpError extends Error {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly responseBody?: string;

  constructor(message: string, status?: number, statusText?: string, responseBody?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export async function requestJson<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 1000,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const requestHeaders: Record<string, string> = { ...headers };
      let payloadBody: string | undefined = undefined;

      if (body) {
        if (typeof body === 'string') {
          payloadBody = body;
        } else {
          payloadBody = JSON.stringify(body);
          if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
            requestHeaders['Content-Type'] = 'application/json';
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: payloadBody,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const responseText = await response.text();

      if (!response.ok) {
        // Server responded with 4xx or 5xx
        const isServerTransient = response.status >= 500 && response.status < 600;
        const err = new HttpError(
          `HTTP ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          responseText
        );

        if (isServerTransient && attempt < retries) {
          logger.warn(`Server error HTTP ${response.status} from ${url}. Retrying in ${retryDelayMs * (attempt + 1)}ms...`);
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }

        throw err;
      }

      if (!responseText || responseText.trim() === '') {
        return {} as T;
      }

      try {
        return JSON.parse(responseText) as T;
      } catch {
        throw new HttpError(`Failed to parse JSON response: ${responseText.slice(0, 200)}`, response.status);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      const isNetwork = err instanceof TypeError; // fetch network errors are TypeErrors

      if ((isAbort || isNetwork) && attempt < retries) {
        const reason = isAbort ? 'Request timed out' : 'Network failure';
        logger.warn(`${reason} on attempt ${attempt + 1}/${retries + 1}. Retrying in ${retryDelayMs * (attempt + 1)}ms...`);
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      break;
    }
  }

  throw lastError ?? new HttpError('Request failed after retries');
}
