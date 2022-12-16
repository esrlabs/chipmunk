export enum Visibility {
    standard = 'standard',
    advanced = 'advanced',
    hidden = 'hidden',
}

export enum Render {
    String = 'String',
    Number = 'Number',
    Bool = 'Bool',
}

export interface IDescription {
    key: string;
    path: string;
    name: string;
    desc: string;
    allowEmpty: boolean;
    type: Visibility;
    render: Render;
}

export class Description {
    static validate(spec: IDescription): Error | undefined {
        if (typeof spec !== 'object' || spec === null) {
            return new Error(`"spec" is not valid.`);
        }
        let error: Error | undefined;
        [
            { name: 'key', type: 'string', canBeEmpty: false },
            { name: 'path', type: 'string', canBeEmpty: false },
            { name: 'name', type: 'string', canBeEmpty: false },
            { name: 'desc', type: 'string', canBeEmpty: false },
            { name: 'allowEmpty', type: 'boolean', canBeEmpty: false },
            { name: 'type', type: 'string', canBeEmpty: false },
            { name: 'render', type: 'string', canBeEmpty: false },
        ].forEach((desc) => {
            if (error !== undefined) {
                return;
            }
            if (typeof (spec as any)[desc.name] !== desc.type) {
                error = new Error(
                    `Key "${desc.name}" has wrong type "${typeof (spec as any)[
                        desc.name
                    ]}", but expected "${desc.type}"`,
                );
            }
            if (!desc.canBeEmpty && typeof (spec as any)[desc.name] === 'string') {
                if ((spec as any)[desc.name].trim() === '') {
                    error = new Error(
                        `Key "${desc.name}" could not be empty. Some value should be defined.`,
                    );
                }
            }
        });
        return error;
    }

    public readonly key: string;
    public readonly name: string;
    public readonly desc: string;
    public readonly type: Visibility;
    public readonly path: string;
    public readonly allowEmpty: boolean;
    public readonly render: Render;

    constructor(desc: IDescription) {
        const err: Error | undefined = Description.validate(desc);
        if (err instanceof Error) {
            throw err;
        }
        this.key = desc.key;
        this.name = desc.name;
        this.desc = desc.desc;
        this.path = desc.path;
        this.type = desc.type;
        this.render = desc.render;
        this.allowEmpty = desc.allowEmpty;
    }

    public asObj(): IDescription {
        return {
            key: this.key,
            name: this.name,
            path: this.path,
            type: this.type,
            desc: this.desc,
            render: this.render,
            allowEmpty: this.allowEmpty,
        };
    }
}
