const NextResponse = {
  json: jest.fn((data, init) => ({
    _data: data,
    _status: init?.status ?? 200,
    status: init?.status ?? 200,
    json: async () => data,
  })),
  redirect: jest.fn((url) => ({ _redirect: url, status: 302 })),
  next: jest.fn(() => ({ _next: true, status: 200 })),
};

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
