// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Matcher } from '../src/api/matcher';
import { TSorted } from '../src/native/native.matcher';

function match(matched: TSorted, result: TSorted) {
    let i_outer = matched.length;
    expect(matched.length).toBe(result.length);
    while (i_outer--) {
        expect(matched[i_outer].length).toBe(result[i_outer].length);
        let i_middle = matched[i_outer].length;
        while (i_middle--) {
            expect(matched[i_outer][i_middle].length).toBe(result[i_outer][i_middle].length);
            let i_inner = matched[i_outer][i_middle].length;
            while (i_inner--) {
                expect(matched[i_outer][i_middle][i_inner]).toBe(
                    result[i_outer][i_middle][i_inner],
                );
            }
        }
    }
}

describe('Matcher', () => {
    it('has no matches', (done) => {
        let matcher: Matcher = new Matcher();
        let query: string = '';
        let keep_zero_score: boolean = false;
        let tag: string = '';
        let items: TSorted = [[['name', 'Command']], [['name', 'Serial']], [['name', 'Search']]];

        matcher.set_items(items);

        let search_result = matcher.search(query, keep_zero_score, tag);
        if (search_result instanceof Error) {
            fail(search_result);
        } else {
            expect(search_result.length === 0);
            done();
        }
    });

    it('has no items', (done) => {
        let matcher: Matcher = new Matcher();
        let query: string = 'ee';
        let keep_zero_score: boolean = false;
        let tag: string = '';
        let items: TSorted = [];

        matcher.set_items(items);

        let search_result: TSorted | Error = matcher.search(query, keep_zero_score, tag);
        if (search_result instanceof Error) {
            fail(search_result);
        } else {
            expect(search_result.length === 0);
            done();
        }
    });

    it('fully matches', (done) => {
        let matcher: Matcher = new Matcher();
        let query: string = 'error';
        let keep_zero_score: boolean = true;
        let tag: string = 'p';
        let items: TSorted = [[['type', 'Error']], [['type', 'Warning']], [['type', 'Info']]];
        let result: TSorted = [
            [['type', '<p>Error</p>']],
            [['type', 'Warning']],
            [['type', 'Info']],
        ];

        matcher.set_items(items);

        let search_result: TSorted | Error = matcher.search(query, keep_zero_score, tag);
        if (search_result instanceof Error) {
            fail(search_result);
        } else {
            match(search_result, result);
            done();
        }
    });

    it('matches scattered', (done) => {
        let matcher: Matcher = new Matcher();
        let query: string = 'eee';
        let keep_zero_score: boolean = true;
        let tag: string = '';
        let items: TSorted = [
            [
                ['level', 'Severe'],
                ['name', 'Very bad error occurred'],
            ],
            [
                ['level', 'Critical'],
                ['name', 'Not so bad'],
            ],
        ];
        let result: TSorted = [
            [
                ['level', 'S<span>e</span>v<span>e</span>r<span>e</span>'],
                ['name', 'V<span>e</span>ry bad <span>e</span>rror occurr<span>e</span>d'],
            ],
            [
                ['level', 'Critical'],
                ['name', 'Not so bad'],
            ],
        ];

        matcher.set_items(items);

        let search_result: TSorted | Error = matcher.search(query, keep_zero_score, tag);
        if (search_result instanceof Error) {
            fail(search_result);
        } else {
            match(search_result, result);
            done();
        }
    });
});
