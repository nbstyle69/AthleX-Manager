module.exports = {
  ...jest.requireActual('react'),
  cache: (fn) => fn,
};
