// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Manual start of defined test:
// ./node_modules/.bin/jasmine-ts src/something.spec.ts

// Get rid of default Jasmine timeout
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

import Subject, { IEventDesc } from '../src/util/events.subject';

describe('Utils tests', () => {

    it('Subject interface validator', (done: Function)=> {
        
        let desc: IEventDesc = { self: 'object', propA: 'string', propB: 'number' };
        expect(Subject.validate(desc, { propA: 'this is string', propB: 1 })).toBe(undefined);
        expect(Subject.validate(desc, { propA: 'this is string', propB: '1' })).toBeInstanceOf(Error);

        desc = { self: 'object', propA: 'string', propB: ['number', 'string'] };
        expect(Subject.validate(desc, { propA: 'this is string', propB: 1 })).toBe(undefined);
        expect(Subject.validate(desc, { propA: 'this is string', propB: '1' })).toBe(undefined);
        
        desc = { self: Error };
        expect(Subject.validate(desc, new Error('Test'))).toBe(undefined);
        expect(Subject.validate(desc, {  })).toBeInstanceOf(Error);

        desc = { self: null };
        expect(Subject.validate(desc, undefined)).toBe(undefined);
        expect(Subject.validate(desc, null)).toBe(undefined);
        expect(Subject.validate(desc, {  })).toBeInstanceOf(Error);

        desc = { self: 'object', error: [Error, 'undefined'] };
        expect(Subject.validate(desc, { error: undefined })).toBe(undefined);
        expect(Subject.validate(desc, { error: new Error('Test') })).toBe(undefined);
        expect(Subject.validate(desc, { error: 'Test' })).toBeInstanceOf(Error);

        done();
    });


});
