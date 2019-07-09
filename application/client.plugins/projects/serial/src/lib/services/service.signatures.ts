export interface ISignature {
    title: string;
    color: string;
    clean: string;
}

export const CDelimiters = {
    signature: '\u0004',
};


class ServiceSignatures {

    private _colors: Map<string, string> = new Map();

    public getSignature(str: string): ISignature {
        const match: RegExpMatchArray = str.match(/\u0004.*\u0004/gi);
        if (match === null || match.length !== 1) {
            return {
                title: '',
                color: '',
                clean: str
            };
        }
        return {
            title: match[0],
            color: this._getColor(match[0]),
            clean: str.replace(/\u0004.*\u0004/gi, ''),
        };
    }

    private _getColor(signature: string): string {
        if (!this._colors.has(signature)) {
            const r: number = Math.round(Math.random() * 154) + 100;
            const g: number = Math.round(Math.random() * 154) + 100;
            const b: number = Math.round(Math.random() * 154) + 100;
            this._colors.set(signature, `rgb(${r},${g},${b})`);
        }
        return this._colors.get(signature);
    }

}

export default new ServiceSignatures();
