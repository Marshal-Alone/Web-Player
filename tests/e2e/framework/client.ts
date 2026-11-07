import { ApiClient, TestResponse } from './types';

export class HttpClient implements ApiClient {
  baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:4000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private resolveUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  private async execute(
    url: string,
    options: RequestInit
  ): Promise<TestResponse> {
    try {
      const res = await fetch(url, options);
      const headersRecord: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersRecord[key.toLowerCase()] = val;
      });

      const arrayBuf = await res.arrayBuffer();
      const rawBody = Buffer.from(arrayBuf);
      let data: any = null;

      const contentType = headersRecord['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawBody.toString('utf-8'));
        } catch {
          data = rawBody.toString('utf-8');
        }
      } else if (
        contentType.includes('text/') ||
        contentType.includes('application/x-www-form-urlencoded')
      ) {
        data = rawBody.toString('utf-8');
      } else {
        data = rawBody;
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: headersRecord,
        data,
        rawBody
      };
    } catch (err: any) {
      // Return a connection failure response with clear message
      return {
        status: 0,
        statusText: err.message || 'Connection Error',
        headers: {},
        data: { error: err.message || 'Connection Refused' },
        rawBody: Buffer.alloc(0)
      };
    }
  }

  async get(endpoint: string, headers: Record<string, string> = {}): Promise<TestResponse> {
    return this.execute(this.resolveUrl(endpoint), {
      method: 'GET',
      headers
    });
  }

  async post(
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<TestResponse> {
    const isJson = body && typeof body === 'object' && !Buffer.isBuffer(body);
    const finalHeaders = {
      ...(isJson ? { 'content-type': 'application/json' } : {}),
      ...headers
    };
    return this.execute(this.resolveUrl(endpoint), {
      method: 'POST',
      headers: finalHeaders,
      body: isJson ? JSON.stringify(body) : body
    });
  }

  async put(
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<TestResponse> {
    const isJson = body && typeof body === 'object' && !Buffer.isBuffer(body);
    const finalHeaders = {
      ...(isJson ? { 'content-type': 'application/json' } : {}),
      ...headers
    };
    return this.execute(this.resolveUrl(endpoint), {
      method: 'PUT',
      headers: finalHeaders,
      body: isJson ? JSON.stringify(body) : body
    });
  }

  async patch(
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<TestResponse> {
    const isJson = body && typeof body === 'object' && !Buffer.isBuffer(body);
    const finalHeaders = {
      ...(isJson ? { 'content-type': 'application/json' } : {}),
      ...headers
    };
    return this.execute(this.resolveUrl(endpoint), {
      method: 'PATCH',
      headers: finalHeaders,
      body: isJson ? JSON.stringify(body) : body
    });
  }

  async delete(endpoint: string, headers: Record<string, string> = {}): Promise<TestResponse> {
    return this.execute(this.resolveUrl(endpoint), {
      method: 'DELETE',
      headers
    });
  }

  async stream(endpoint: string, range?: string): Promise<TestResponse> {
    const headers: Record<string, string> = {};
    if (range) {
      headers['range'] = range.startsWith('bytes=') ? range : `bytes=${range}`;
    }
    return this.execute(this.resolveUrl(endpoint), {
      method: 'GET',
      headers
    });
  }

  async beacon(
    endpoint: string,
    payload: any,
    contentType: string = 'text/plain;charset=UTF-8'
  ): Promise<TestResponse> {
    // navigator.sendBeacon sends POST requests typically with text/plain or application/x-www-form-urlencoded
    const bodyStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    return this.execute(this.resolveUrl(endpoint), {
      method: 'POST',
      headers: {
        'content-type': contentType
      },
      body: bodyStr
    });
  }

  async isServerReachable(): Promise<boolean> {
    const res = await this.get('/api/health');
    return res.status === 200 || res.status === 404; // Got a valid HTTP response from a server
  }
}
