const cookies = jest.fn().mockResolvedValue({
  get: jest.fn().mockReturnValue(undefined),
  set: jest.fn(),
  delete: jest.fn(),
  getAll: jest.fn().mockReturnValue([]),
});

module.exports = { cookies };
