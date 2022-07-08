let wasm: typeof import('../pkg');

describe('test', function () {
    beforeAll(async function () {
        wasm = await import('../pkg');
    });

    function compareMulti(result: string, expected: { [key: string]: string }[]) {
        const parsedResult: { [key: string]: string }[] = JSON.parse(result);
        expected.forEach((e_map: { [key: string]: string }, i: number) => {
            let iResult = parsedResult[i];
            Object.entries(e_map).forEach((key_value) => {
                expect(iResult[key_value[0]]).toBe(key_value[1]);
            });
        });
    }

    function matcher() {
        const { Matcher } = wasm;
        const matcher = Matcher.new();
        const items: string = `
        [
            {
                "name": "very_large_file.dlt",
                "size": "20gb",
                "path": "/home/user/Desktop/very_large_file.dlt"
            },
            {
                "name": "medium_sized_file.txt",
                "size": "15mb",
                "path": "/home/user/Desktop/medium_sized_file.txt"
            },
            {
                "name": "small_file.log",
                "size": "630kb",
                "path": "/home/user/Desktop/small_file.log"
            }
        ]`;
        matcher.set_items(items);
        return matcher;
    }

    it('should match one in single search', () => {
        const item: string = 'very_large_file.dlt';
        const query: string = 'e';
        const expected: string = 'very_large_fil<span>e</span>.dlt';
        expect(matcher().search_single(query, item)).toBe(expected);
    });

    it('should match multiple in single search', () => {
        const item: string = 'very_large_file.dlt';
        const query: string = 'efd';
        const expected: string = 'very_larg<span>e</span>_<span>f</span>ile.<span>d</span>lt';
        expect(matcher().search_single(query, item)).toBe(expected);
    });

    it('should match whole word in single search', () => {
        const expected = 'very_<span>large</span>_file.dlt';
        const item: string = 'very_large_file.dlt';
        const query: string = 'large';
        expect(matcher().search_single(query, item)).toBe(expected);
    });

    it('should match everything in single search', () => {
        const expected = '<h1>very_large_file.dlt</h1>';
        const item: string = 'very_large_file.dlt';
        const query: string = 'very_large_file.dlt';
        const tag: string = 'h1';
        expect(matcher().search_single(query, item, tag)).toBe(expected);
    });

    it('should not match in single search', () => {
        const expected = 'very_large_file.dlt';
        const item: string = 'very_large_file.dlt';
        const query: string = 'n';
        expect(matcher().search_single(query, item)).toBe(expected);
    });

    it('should all match in multi search', () => {
        const expected: { [key: string]: string }[] = [
            {
                name: 'very_large_file.dlt',
                size: '20gb',
                path: '/home/user/Desktop/very_large_file.dlt',
                html_name: 'very_<span>l</span>arge_file.dlt',
                html_size: '20gb',
                html_path: '/home/user/Desktop/very_<span>l</span>arge_file.dlt',
            },
            {
                name: 'small_file.log',
                size: '630kb',
                path: '/home/user/Desktop/small_file.log',
                html_name: 'small_file.<span>l</span>og',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.<span>l</span>og',
            },
            {
                name: 'medium_sized_file.txt',
                size: '15mb',
                path: '/home/user/Desktop/medium_sized_file.txt',
                html_name: 'medium_sized_fi<span>l</span>e.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_fi<span>l</span>e.txt',
            },
        ];
        const query: string = 'l';
        const keep_zero_score: boolean = true;
        compareMulti(matcher().search_multi(query, keep_zero_score), expected);
    });

    it('should not match and keep in multi search', () => {
        const expected: { [key: string]: string }[] = [
            {
                name: 'very_large_file.dlt',
                size: '20gb',
                path: '/home/user/Desktop/very_large_file.dlt',
                html_name: 'very_large_file.dlt',
                html_size: '20gb',
                html_path: '/home/user/Desktop/very_large_file.dlt',
            },
            {
                name: 'medium_sized_file.txt',
                size: '15mb',
                path: '/home/user/Desktop/medium_sized_file.txt',
                html_name: 'medium_sized_file.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_file.txt',
            },
            {
                name: 'small_file.log',
                size: '630kb',
                path: '/home/user/Desktop/small_file.log',
                html_name: 'small_file.log',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.log',
            },
        ];
        const query: string = 'c';
        const keep_zero_score: boolean = true;
        compareMulti(matcher().search_multi(query, keep_zero_score), expected);
    });

    it('should not match and not keep in multi search', () => {
        const expected: { [key: string]: string }[] = [];
        const query: string = 'c';
        const keep_zero_score: boolean = false;
        compareMulti(matcher().search_multi(query, keep_zero_score), expected);
    });

    it('should scattered match in multi search', () => {
        const expected: { [key: string]: string }[] = [
            {
                name: 'medium_sized_file.txt',
                size: '15mb',
                path: '/home/user/Desktop/medium_sized_file.txt',
                html_name: '<span>me</span>dium_sized_fi<span>l</span>e.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/<span>me</span>dium_sized_fi<span>l</span>e.txt',
            },
            {
                name: 'small_file.log',
                size: '630kb',
                path: '/home/user/Desktop/small_file.log',
                html_name: 's<span>m</span>all_fil<span>e</span>.<span>l</span>og',
                html_size: '630kb',
                html_path:
                    '/home/user/Desktop/s<span>m</span>all_fil<span>e</span>.<span>l</span>og',
            },
            {
                name: 'very_large_file.dlt',
                size: '20gb',
                path: '/home/user/Desktop/very_large_file.dlt',
                html_name: 'very_large_file.dlt',
                html_size: '20gb',
                html_path: '/ho<span>me</span>/user/Desktop/very_<span>l</span>arge_file.dlt',
            },
        ];
        const query: string = 'mel';
        const keep_zero_score: boolean = true;
        compareMulti(matcher().search_multi(query, keep_zero_score), expected);
    });

    it('should match few and keep in multi search', () => {
        const expected: { [key: string]: string }[] = [
            {
                name: 'very_large_file.dlt',
                size: '20gb',
                path: '/home/user/Desktop/very_large_file.dlt',
                html_name: 'very_lar<span>g</span>e_file.dlt',
                html_size: '20<span>g</span>b',
                html_path: '/home/user/Desktop/very_lar<span>g</span>e_file.dlt',
            },
            {
                name: 'small_file.log',
                size: '630kb',
                path: '/home/user/Desktop/small_file.log',
                html_name: 'small_file.lo<span>g</span>',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.lo<span>g</span>',
            },
            {
                name: 'medium_sized_file.txt',
                size: '15mb',
                path: '/home/user/Desktop/medium_sized_file.txt',
                html_name: 'medium_sized_file.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_file.txt',
            },
        ];
        const query: string = 'g';
        const keep_zero_score: boolean = true;
        compareMulti(matcher().search_multi(query, keep_zero_score), expected);
    });

    it('should match few and not keep in multi search', () => {
        const expected: { [key: string]: string }[] = [
            {
                name: 'very_large_file.dlt',
                size: '20gb',
                path: '/home/user/Desktop/very_large_file.dlt',
                html_name: 'very_lar<p>g</p>e_file.dlt',
                html_size: '20<p>g</p>b',
                html_path: '/home/user/Desktop/very_lar<p>g</p>e_file.dlt',
            },
            {
                name: 'small_file.log',
                size: '630kb',
                path: '/home/user/Desktop/small_file.log',
                html_name: 'small_file.lo<p>g</p>',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.lo<p>g</p>',
            },
        ];
        const query: string = 'g';
        const keep_zero_score: boolean = false;
        const tag: string = 'p';
        compareMulti(matcher().search_multi(query, keep_zero_score, tag), expected);
    });
});
