/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Use to start test ./node_modules/.bin/jasmine-ts src/something.spec.ts

describe('[Test][name]', () => {
    beforeEach(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
    });

    it('[name]', (done: () => any ) => {
        // Test body
    });

});
