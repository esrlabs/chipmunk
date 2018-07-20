export class ParserTimestampToStrDate {

    private str: string;
    public name: string = 'Timestamp -> Date';

    constructor(str: string) {
        this.str = str;
    }

    private fill(value: number, count: number = 2) {
        const str = `${value}`;
        const less =  count - str.length;
        return `${'0'.repeat(less >= 0 ? less : 0)}${str}`;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.replace(/\d/gi, '').length > 0) {
            return false;
        }
        const timestamp = parseInt(this.str, 10);
        if (timestamp < 0 || isNaN(timestamp)) {
            return false;
        }
        const date = new Date(timestamp);
        const time = date.getTime();
        if (time < 0 || isNaN(time)) {
            return false;
        }
        try{ this.convert(true); } catch (e) { return false; }
        return true;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const date = new Date(parseInt(this.str, 10));
        return `${this.fill(date.getDate(), 2)}.${this.fill(date.getMonth(), 2)}.${date.getFullYear()} ${this.fill(date.getHours(), 2)}:${this.fill(date.getMinutes(), 2)}:${this.fill(date.getSeconds(), 2)}.${this.fill(date.getMilliseconds(), 3)}`;
    }
}

export class DecodeBase64Str {

    private str: string;
    public name: string = 'Base64 -> String';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        try{ this.convert(true); } catch (e) { return false; }
        return true;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        return atob(this.str);
    }
}

export class EncodeBase64Str {

    private str: string;
    public name: string = 'String -> Base64';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        try{ this.convert(true); } catch (e) { return false; }
        return true;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        return btoa(this.str);
    }
}

export class Base64ToJSON{

    private str: string;
    public name: string = 'Base64 -> JSON';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        try{ this.convert(true); } catch (e) { return false; }
        return true;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const str = atob(this.str);
        return JSON.stringify(JSON.parse(str));
    }
}

export class BytesToStr {

    private str: string;
    public name: string = 'Bytes -> String';

    constructor(str: string) {
        this.str = str;
    }

    private getSeparator(){
        const separators = [',', ' '];
        let separator = separators[0];
        let count = -1;
        separators.forEach((_splitter: string) => {
            const parts = this.str.split(_splitter);
            if (parts.length > count) {
                separator = _splitter;
                count = parts.length;
            }
        });
        return separator;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\d,\s]/gi) !== -1) {
            return false;
        }
        const separator = this.getSeparator();
        const bytes = this.str.split(separator).map((part: string) => {
            return parseInt(part);
        });
        if (bytes.length === 1){
            return false;
        }
        let results = true;
        bytes.forEach((byte: number) => {
           if (isNaN(byte)) {
               results = false;
           }
        });
        try{ this.convert(true); } catch (e) { return false; }
        return results;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const separator = this.getSeparator();
        const bytes = this.str.split(separator).map((part: string) => {
            return parseInt(part);
        });
        return String.fromCharCode.apply(null, bytes);
    }
}

export class HEXToBytes {

    private str: string;
    public name: string = 'HEXs -> Bytes';

    constructor(str: string) {
        this.str = str;
    }

    private getSeparator(){
        const separators = [',', ' '];
        let separator = separators[0];
        let count = -1;
        separators.forEach((_splitter: string) => {
            const parts = this.str.split(_splitter);
            if (parts.length > count) {
                separator = _splitter;
                count = parts.length;
            }
        });
        return separator;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\dabcdefx,\s-]/gi) !== -1) {
            return false;
        }
        const separator = this.getSeparator();
        const bytes = this.str.split(separator).map((part: string) => {
            return parseInt(part, 16);
        });
        if (bytes.length === 1){
            return false;
        }
        let results = true;
        bytes.forEach((byte: number) => {
            if (isNaN(byte)) {
                results = false;
            }
        });
        try{ this.convert(true); } catch (e) { return false; }
        return results;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const separator = this.getSeparator();
        return `${this.str.split(separator).map((part: string) => {
            return parseInt(part, 16);
        }).join(', ')}`;
    }
}

export class HEXToString {

    private str: string;
    public name: string = 'HEXs -> String';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        const hexToBytes = new HEXToBytes(this.str);
        if (!hexToBytes.test()) {
            return false;
        }
        const bytesToString = new BytesToStr(hexToBytes.convert());
        return bytesToString.test();
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const hexToBytes = new HEXToBytes(this.str);
        const bytesToString = new BytesToStr(hexToBytes.convert());
        return bytesToString.convert();
    }
}

export class BytesToHEX {

    private str: string;
    public name: string = 'Bytes -> HEXs';

    constructor(str: string) {
        this.str = str;
    }

    private getSeparator(){
        const separators = [',', ' '];
        let separator = separators[0];
        let count = -1;
        separators.forEach((_splitter: string) => {
            const parts = this.str.split(_splitter);
            if (parts.length > count) {
                separator = _splitter;
                count = parts.length;
            }
        });
        return separator;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\d,\s]/gi) !== -1) {
            return false;
        }
        const separator = this.getSeparator();
        const bytes = this.str.split(separator).map((part: string) => {
            return parseInt(part, 10);
        });
        if (bytes.length === 1){
            return false;
        }
        let results = true;
        bytes.forEach((byte: number) => {
            if (isNaN(byte)) {
                results = false;
            }
        });
        try{ this.convert(true); } catch (e) { return false; }
        return results;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const separator = this.getSeparator();
        return `${this.str.split(separator).map((part: string) => {
            return parseInt(part, 10).toString(16);
        }).join(' ')}`;
    }
}

export class HEXToBase64 {

    private str: string;
    public name: string = 'HEXs -> Base64';

    constructor(str: string) {
        this.str = str;
    }

    private getSeparator(){
        const separators = [',', ' '];
        let separator = separators[0];
        let count = -1;
        separators.forEach((_splitter: string) => {
            const parts = this.str.split(_splitter);
            if (parts.length > count) {
                separator = _splitter;
                count = parts.length;
            }
        });
        return separator;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\dabcdefx,\s-]/gi) !== -1) {
            return false;
        }
        const separator = this.getSeparator();
        const bytes = this.str.split(separator);
        try{ this.convert(true); } catch (e) { return false; }
        return bytes.length > 1;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const separator = this.getSeparator();
        let str = this.str;
        if (separator === ',') {
            str = str.replace(/,/gi, ' ');
        }
        return btoa(String.fromCharCode.apply(null,
            str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" "))
        );
    }
}

export class HEXToBase64Decode {

    private str: string;
    public name: string = 'HEXs -> Base64 -> String';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        const hexToBase64 = new HEXToBase64(this.str);
        if (!hexToBase64.test()) {
            return false;
        }
        const decodeBase64 = new DecodeBase64Str(hexToBase64.convert());
        return decodeBase64.test();
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const hexToBase64 = new HEXToBase64(this.str);
        const decodeBase64 = new DecodeBase64Str(hexToBase64.convert());
        return decodeBase64.convert();
    }
}

export class Base64ToHEX {

    private str: string;
    public name: string = 'Base64 -> HEXs';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        try{ this.convert(true); } catch (e) { return false; }
        return true;
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        let hex = [];
        for (let i = 0, bin = atob(this.str.replace(/[ \r\n]+$/, "")); i < bin.length; ++i) {
            let tmp = bin.charCodeAt(i).toString(16);
            hex[hex.length] = tmp.length === 1 ? "0" + tmp : tmp;
        }
        return hex.join(" ");
    }
}

export class BytesToBase64 {

    private str: string;
    public name: string = 'Bytes -> Base64';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\d,\s]/gi) !== -1) {
            return false;
        }
        const bytesToHEX = new BytesToHEX(this.str);
        if (!bytesToHEX.test()) {
            return false;
        }
        const hexToBase64 = new HEXToBase64(bytesToHEX.convert());
        return hexToBase64.test();
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const bytesToHEX = new BytesToHEX(this.str);
        const hex = bytesToHEX.convert();
        const hexToBase64 = new HEXToBase64(hex);
        return hexToBase64.convert();
    }
}

export class BytesToBase64Decode {

    private str: string;
    public name: string = 'Bytes -> Base64 -> String';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        if (this.str.search(/[^\d,\s]/gi) !== -1) {
            return false;
        }
        const bytesToHEX = new BytesToHEX(this.str);
        if (!bytesToHEX.test()) {
            return false;
        }
        const hexToBase64 = new HEXToBase64(bytesToHEX.convert());
        if (!hexToBase64.test()) {
            return false;
        }
        const decodeBase64 = new DecodeBase64Str(hexToBase64.convert());
        return decodeBase64.test();
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const bytesToHEX = new BytesToHEX(this.str);
        const hex = bytesToHEX.convert();
        const hexToBase64 = new HEXToBase64(hex);
        const decodeBase64 = new DecodeBase64Str(hexToBase64.convert());
        return decodeBase64.convert();
    }
}

export class Base64ToBytes {

    private str: string;
    public name: string = 'Base64 -> Bytes';

    constructor(str: string) {
        this.str = str;
    }

    public test(): boolean {
        if (typeof this.str !== 'string') {
            return false;
        }
        const base64ToHEX = new Base64ToHEX(this.str);
        if (!base64ToHEX.test()) {
            return false;
        }
        const hexToBytes = new HEXToBytes(base64ToHEX.convert());
        return hexToBytes.test();
    }

    public convert(internal: boolean = false): string {
        if (!internal) {
            if (!this.test()) {
                return '';
            }
        }
        const base64ToHEX = new Base64ToHEX(this.str);
        const hexToBytes = new HEXToBytes(base64ToHEX.convert());
        return hexToBytes.convert();
    }
}



