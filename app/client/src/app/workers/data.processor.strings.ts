const MARKERS = {
    NUMBER : '\u0002'
};

const REGEXPS = {
    CARRETS: /[\n\r]/gi,
    CLOSE_CARRET: /[\n\r]$/gi,
    SLASH: /\\/gi,
    NUMBER: /\u0002(\d*)\u0002/gi,
    SERIALIZATION: [
        [/\./gi, '.'],
        [/\,/gi, ','],
        [/\{/gi, '{'],
        [/\}/gi, '}'],
        [/\[/gi, '['],
        [/\]/gi, ']'],
        [/\+/gi, '+'],
        [/\=/gi, '+'],
        [/\?/gi, '?'],
        [/\!/gi, '!'],
        [/\$/gi, '$'],
        [/\^/gi, '^'],
        [/\&/gi, '&'],
        [/\*/gi, '*'],
        [/\\/gi, '\\']
    ]
};


const SETTINGS = {
    MAX_FRAGMENT_LENGTH: 1000000,
    MAX_RESULTS_CACHE: 10
};

class RegExpStorage{

    private regs: {[key: string] : RegExp } = {};

    private prepareRegStr(reg: string){
        return reg.replace(REGEXPS.SLASH, '\\');
    }

    public get(reg: string): RegExp | null {
        if (typeof reg !== 'string' || reg === '') {
            return null;
        }
        if (this.regs[reg] !== void 0) {
            return this.regs[reg];
        }
        let regExp;
        try{
            regExp = new RegExp(`(${this.prepareRegStr(reg)}).*${MARKERS.NUMBER}\\d*${MARKERS.NUMBER}`, 'gi');
            this.regs[reg] = regExp;
        } catch (error) {
            regExp = null;
        }
        return regExp;
    }
}

const regExpStorage = new RegExpStorage();

type SearchResults = {[position: number]: number};

class FragmentResultsCache{

    private results: {[key: string] : { length: number, results: SearchResults}} = {};

    private clear(){
        if (Object.keys(this.results).length > SETTINGS.MAX_RESULTS_CACHE) {
            delete this.results[Object.keys(this.results)[0]];
        }
    }

    public get(key: string, length: number) : SearchResults | null {
        const data = this.results[key] !== void 0 ? this.results[key] : null;
        if (data !== null && data.length !== length) {
            delete this.results[key];
            return null;
        } else if (data !== null) {
            return data.results;
        } else {
            return null;
        }
    }

    public set(key: string, results: SearchResults, length: number){
        if (this.results[key] !== void 0) {
            return (this.results[key] = {
                length : length,
                results: results
            });
        }
        this.clear();
        this.results[key] = {
            length : length,
            results: results
        };
    }

}

class Fragment {

    private fragment: string = '';
    private offset: number = 0;
    private length: number = 0;
    private cache: FragmentResultsCache = new FragmentResultsCache();

    constructor(offset: number){
        this.offset = offset;
    }

    private convert(str: string): string{
        let cursor = this.length;
        if (!~str.search(REGEXPS.CLOSE_CARRET)) {
            str = str + '\n';
        }
        str = str.replace(REGEXPS.CARRETS, (substring: string, replaceValue: string) => {
            return MARKERS.NUMBER + (this.offset + cursor++) + MARKERS.NUMBER + '\n';
        });
        this.length = cursor;
        return str;
    }

    public isLocked(): boolean{
        return this.length >= SETTINGS.MAX_FRAGMENT_LENGTH;
    }

    public addFragment(str: string = ''): boolean {
        if (typeof str !== 'string' || str === ''){
            return false;
        }
        str = this.convert(str);
        this.fragment += str;
        return true;
    }

    public find(regStr: string): SearchResults {
        let results = this.cache.get(regStr, this.length);
        if (results !== null) {
            return results;
        }
        results = {};
        const regExp = regExpStorage.get(regStr);
        if (regExp === null) {
            return results;
        }
        this.fragment.replace(regExp, (text: string, replaced: string, index: number) => {
            const number = text.match(REGEXPS.NUMBER);
            if (results !== null && number instanceof Array && number.length === 1) {
                const position = parseInt(number[0].substring(1, number[0].length - 1), 10);
                results[position] = 0;
            }
            return replaced;
        });
        this.cache.set(regStr, results, this.length);
        return results;
    }

    public getLength(){
        return this.length;
    }

}

class StringsCollection {

    private fragments: Array<Fragment> = [];
    private offset: number = 0;

    constructor(offset: number = 0) {
        this.offset = offset;
    }

    private addNewFragment(){
        this.fragments.push(new Fragment(this.offset));
        return this.fragments[this.fragments.length - 1];
    }

    private getCurrentFragment(){
        if (this.fragments.length === 0) {
            this.addNewFragment();
        } else if (this.fragments[this.fragments.length - 1].isLocked()) {
            this.offset += this.fragments[this.fragments.length - 1].getLength();
            this.addNewFragment();
        }
        return this.fragments[this.fragments.length - 1];
    }

    public addFragment(fragment: string = ''): boolean {
        const current = this.getCurrentFragment();
        return current.addFragment(fragment);
    }

    public find(keyword: string = '', isRegExp: boolean = true) {
        if (!isRegExp){
            REGEXPS.SERIALIZATION.forEach((data) => {
                keyword = keyword.replace(data[0] as RegExp, '\\' + data[1] as string);
            });
        }
        let results: SearchResults = {};
        this.fragments.forEach((fragment: Fragment) => {
            const fragmentResults = fragment.find(keyword);
            Object.assign(results, fragmentResults);
        });
        return results;
    }

    public getLength(): number{
        let length = 0;
        this.fragments.forEach((fragment: Fragment) => {
            length += fragment.getLength();
        });
        return length;
    }

}

export { StringsCollection, SearchResults }