let wasm: typeof import('../pkg');

describe('test', function () {
    beforeAll(async function () {
        wasm = await import('../pkg');
    });

    it('valid regex', (done) => {
        const { get_filter_error } = wasm;
        const filter = '[Warn]';
        const caseSensitive = true;
        const wholeWord = false;
        const regex = true;
        const result = get_filter_error(filter, caseSensitive, wholeWord, regex);
        expect(result).toBeUndefined();
        done();
    });

    it('invalid regex', (done) => {
        const { get_filter_error } = wasm;
        const filter = '[Warn(]\\)(';
        const caseSensitive = false;
        const wholeWord = true;
        const regex = true;
        const result = get_filter_error(filter, caseSensitive, wholeWord, regex);
        expect(typeof result).toEqual('string');
        done();
    });

    it('plain_string_regex_off', (done) => {
        const { get_filter_error } = wasm;
        const filter = 'Some random stuff written';
        const caseSensitive = true;
        const wholeWord = false;
        const regex = false;
        const result = get_filter_error(filter, caseSensitive, wholeWord, regex);
        expect(result).toBeUndefined();
        done();
    });

    it('plain_string_regex_on', (done) => {
        const { get_filter_error } = wasm;
        const filter = 'Another bunch of random stuff';
        const caseSensitive = false;
        const wholeWord = false;
        const regex = true;
        const result = get_filter_error(filter, caseSensitive, wholeWord, regex);
        expect(result).toBeUndefined();
        done();
    });
});
