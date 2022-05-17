import * as obj from '@platform/env/obj';

export class Base {
    public filename: string = '';
    public name: string = '';
    public path: string = '';
    public size: number = 0;
    public created: number = Date.now();

    constructor(inputs: { [key: string]: unknown }) {
        this.filename = obj.getAsNotEmptyString(inputs, 'filename');
        this.name = obj.getAsNotEmptyString(inputs, 'name');
        this.path = obj.getAsNotEmptyString(inputs, 'path');
        this.size = obj.getAsValidNumber(inputs, 'size', { min: 0 });
        this.created = obj.getAsValidNumber(inputs, 'created', { min: 0 });
    }

    public asObj(): { [key: string]: unknown } {
        return {
            filename: this.filename,
            name: this.name,
            path: this.path,
            size: this.size,
            created: this.created,
        };
    }
}
