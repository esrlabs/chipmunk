import { initLogger } from './logger';
initLogger();
import { helloWorld } from './common';

describe('Hello World', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorld()).toEqual('Hello, World!');
  });
});