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
});
