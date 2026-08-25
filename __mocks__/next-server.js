// Certaines routes renvoient autre chose que du JSON (un ZIP, un PDF) et
// construisent la réponse : `new NextResponse(body, init)` doit donc marcher,
// en plus des fabriques statiques.
class NextResponse {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status ?? 200;
    // Les en-têtes HTTP sont insensibles à la casse, comme `Headers`.
    this.headers = new Map(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const get = this.headers.get.bind(this.headers);
    this.headers.get = (name) => get(String(name).toLowerCase());
  }
  async arrayBuffer() {
    const b = this._body;
    return b instanceof Uint8Array ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b;
  }
  async text() {
    return String(this._body);
  }
}

NextResponse.json = jest.fn((data, init) => {
  const headers = new Map(
    Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const get = headers.get.bind(headers);
  headers.get = (name) => get(String(name).toLowerCase()) ?? null;
  return {
    _data: data,
    _status: init?.status ?? 200,
    status: init?.status ?? 200,
    headers,
    json: async () => data,
  };
});
NextResponse.redirect = jest.fn((url) => ({ _redirect: url, status: 302 }));
NextResponse.next = jest.fn(() => ({ _next: true, status: 200 }));

class NextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this._body = options.body ? JSON.parse(options.body) : null;
    this.method = options.method ?? 'GET';
    this.headers = new Map(Object.entries(options.headers ?? {}));
  }
  async json() {
    return this._body;
  }
}

module.exports = { NextResponse, NextRequest };
