let wasm: typeof import('../pkg');

class Item {
    private _name: string;
    private _size: string;
    private _path: string;
    private _index!: number;

    constructor(name: string, size: string, path: string) {
        this._name = name;
        this._size = size;
        this._path = path;
    }

    public set index(i: number) {
        this._index = i;
    }

    public get index(): number {
        return this._index;
    }

    public get(): { [key: string]: string } {
        return {
            name: this._name,
            size: this._size,
            path: this._path,
        };
    }
}

describe('test', function () {
    beforeAll(async function () {
        wasm = await import('../pkg');
    });

    function test(expected: { [key: string]: string }[], query: string, tag?: string) {
        const { Matcher } = wasm;
        const matcher = Matcher.new();
        const items: Item[] = [
            new Item('very_large_file.dlt', '20gb', '/home/user/Desktop/very_large_file.dlt'),
            new Item('small_file.log', '630kb', '/home/user/Desktop/small_file.log'),
            new Item('medium_sized_file.txt', '15mb', '/home/user/Desktop/medium_sized_file.txt'),
        ];
        items.forEach((item: Item) => {
            item.index = matcher.set_item(JSON.stringify(item.get()));
        });
        matcher.search(query, tag);
        items.sort((a: Item, b: Item) => {
            const a_score: number = a.index === undefined ? 0 : Number(matcher.get_score(a.index));
            const b_score: number = b.index === undefined ? 0 : Number(matcher.get_score(b.index));
            return b_score - a_score;
        });
        items.forEach((item: Item, index: number) => {
            const keys: string[] = Object.keys(item.get());
            keys.forEach((key: string) => {
                expect(matcher.get_html_of(item.index, `html_${key}`)).toBe(
                    expected[index][`html_${key}`],
                );
            });
        });
    }

    it('should all match', () => {
        const expected: { [key: string]: string }[] = [
            {
                html_name: 'very_<span>l</span>arge_file.dlt',
                html_size: '20gb',
                html_path: '/home/user/Desktop/very_<span>l</span>arge_file.dlt',
            },
            {
                html_name: 'small_file.<span>l</span>og',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.<span>l</span>og',
            },
            {
                html_name: 'medium_sized_fi<span>l</span>e.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_fi<span>l</span>e.txt',
            },
        ];
        const query: string = 'l';
        test(expected, query);
    });

    it('should not match', () => {
        const expected: { [key: string]: string }[] = [
            {
                html_name: 'very_large_file.dlt',
                html_size: '20gb',
                html_path: '/home/user/Desktop/very_large_file.dlt',
            },
            {
                html_name: 'small_file.log',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.log',
            },
            {
                html_name: 'medium_sized_file.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_file.txt',
            },
        ];
        const query: string = 'c';
        test(expected, query);
    });

    it('should scattered match', () => {
        const expected: { [key: string]: string }[] = [
            {
                html_name: '<span>me</span>dium_sized_fi<span>l</span>e.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/<span>me</span>dium_sized_fi<span>l</span>e.txt',
            },
            {
                html_name: 's<span>m</span>all_fil<span>e</span>.<span>l</span>og',
                html_size: '630kb',
                html_path:
                    '/home/user/Desktop/s<span>m</span>all_fil<span>e</span>.<span>l</span>og',
            },
            {
                html_name: 'very_large_file.dlt',
                html_size: '20gb',
                html_path: '/ho<span>me</span>/user/Desktop/very_<span>l</span>arge_file.dlt',
            },
        ];
        const query: string = 'mel';
        test(expected, query);
    });

    it('should match few', () => {
        const expected: { [key: string]: string }[] = [
            {
                html_name: 'very_lar<p>g</p>e_file.dlt',
                html_size: '20<p>g</p>b',
                html_path: '/home/user/Desktop/very_lar<p>g</p>e_file.dlt',
            },
            {
                html_name: 'small_file.lo<p>g</p>',
                html_size: '630kb',
                html_path: '/home/user/Desktop/small_file.lo<p>g</p>',
            },
            {
                html_name: 'medium_sized_file.txt',
                html_size: '15mb',
                html_path: '/home/user/Desktop/medium_sized_file.txt',
            },
        ];
        const query: string = 'g';
        const tag: string = 'p';
        test(expected, query, tag);
    });
});
