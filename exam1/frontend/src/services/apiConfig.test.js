const originalUrl = process.env.REACT_APP_API_URL;
const originalMode = process.env.NODE_ENV;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalUrl;
  process.env.NODE_ENV = originalMode;
  jest.resetModules();
});

test.each([
  ['https://cloud-campus-backend-rd4h.onrender.com', 'https://cloud-campus-backend-rd4h.onrender.com/api'],
  [' https://backend.example/// ', 'https://backend.example/api'],
])('uses the configured backend origin %s', (url, expected) => {
  process.env.REACT_APP_API_URL = url;
  expect(require('./apiConfig').API_BASE_URL).toBe(expected);
});

test('local development retains its backend default', () => {
  delete process.env.REACT_APP_API_URL;
  process.env.NODE_ENV = 'development';
  expect(require('./apiConfig').API_BASE_URL).toBe('http://localhost:5000/api');
});

test('production never silently falls back to localhost', () => {
  delete process.env.REACT_APP_API_URL;
  process.env.NODE_ENV = 'production';
  expect(() => require('./apiConfig')).toThrow('REACT_APP_API_URL');
});
