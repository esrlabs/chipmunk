let wasm: typeof import('../pkg');

describe('test', function () {
    beforeAll(async function () {
        wasm = await import('../pkg');
    });

    it('converting', (done) => {
        const { convert } = wasm;
        const input = '<h1> \x1b[1m Hello \x1b[31m world! </h1>';
        const result = convert(input);
        expect(result).toBe("<h1> <b> Hello <span style='color:#a00'> world! </h1></span></b>");
        done();
    });

    it('escape', (done) => {
        const { escape } = wasm;
        const input =
            '[38;3;43m01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines[0m';
        const result = escape(input);
        const expected =
            '01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines';
        expect(result).toEqual(expected);
        done();
    });
});
