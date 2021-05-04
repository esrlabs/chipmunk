// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Manual start of defined test:
// ./node_modules/.bin/jasmine-ts src/something.spec.ts

// If you have error like next:
//
// Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist' is not defined by "exports" in ./application/apps/rustcore/ts/node_modules/ts-node/package.json
//
// You have to resolve it by hands. Open "./application/apps/rustcore/ts/node_modules/ts-node/package.json"
// Add there ("./dist": "./dist/index.js") into "exports" sections. Like this:
//
// "exports": {
//     ".": "./dist/index.js",
//     "./dist": "./dist/index.js",
//     ...
// }

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

import { Subject, IEventDesc } from '../src/util/events.subject';
import { IGrabbedElement } from '../src/interfaces/index';

class GrabberElementsFactory {

    private _pos: number = 0;

    public next(): IGrabbedElement {
        return {
            content: `${Date.now()}: ${Math.random() * Math.random()}`,
            source_id: `test`,
            position: this._pos++,
            row: this._pos++,
        }
    }

    public get(count: number): IGrabbedElement[] {
        const rows: IGrabbedElement[] = [];
        for (let i = count - 1; i >= 0; i -= 1) {
            rows.push(this.next());
        }
        return rows;
    }

    public getAsJSON(count: number): string {
        return JSON.stringify(this.get(count));
    }

    public getAsStrings(count: number): string {
        const rows: string[] = [];
        for (let i = count - 1; i >= 0; i -= 1) {
            const row: IGrabbedElement = this.next();
            rows.push(`${row.position};${row.row};${row.source_id};${row.content}`);
        }
        return rows.join('\n');
    }

    public fromJsonString(jsonString: string): IGrabbedElement[] {
        return JSON.parse(jsonString);
    }

    public fromStrings(strings: string): IGrabbedElement[] {
        return strings.split('\n').map((str: string) => {
            const parts: string[] = str.split(';');
            return {
                position: parseInt(parts[0], 10),
                row: parseInt(parts[0], 10),
                source_id: parts[2],
                content: parts[3],
            } as IGrabbedElement;
        });
    }
}

describe('Performance tests', () => {

    it('Strings vs objects', (done: Function) => {

        const count: number = 50000;
        const jsonString = (new GrabberElementsFactory()).getAsJSON(count);
        const jsonStrings = (new GrabberElementsFactory()).getAsStrings(count);

        const jsonStringStart = Date.now();
        let rows = (new GrabberElementsFactory()).fromJsonString(jsonString);
        const jsonStringDone = Date.now() - jsonStringStart;
        expect(rows.length).toEqual(count);

        const jsonStringsStart = Date.now();
        rows = (new GrabberElementsFactory()).fromStrings(jsonStrings);
        const jsonStringsDone = Date.now() - jsonStringsStart;
        expect(rows.length).toEqual(count);

        console.log(`\n\n${'='.repeat(60)}`);
        console.log(`parsing ${count} rows`);
        console.log(`${'='.repeat(60)}`);
        console.log(`- pure JSON done in:     ${jsonStringDone}ms`);
        console.log(`- strings JSON done in:  ${jsonStringsDone}ms`);
        console.log(`${'='.repeat(60)}\n\n`);

        done();
    });

});
