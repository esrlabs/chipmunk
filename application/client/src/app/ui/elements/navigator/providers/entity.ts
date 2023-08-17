import { PassiveMatchee } from '@module/matcher';
import { Action } from '@service/recent/action';
import { unique } from '@platform/env/sequence';

import * as wasm from '@loader/wasm';

export { Action };
export interface IFileDescription {
    parent: string;
    filename: string;
    name: string;
}

export type TEntity = Action | IFileDescription;

export class Entity extends PassiveMatchee {
    public readonly uuid: string = unique();

    constructor(
        public readonly origin: Action | IFileDescription,
        public readonly index: number,
        matcher: wasm.Matcher,
    ) {
        super(matcher);
    }

    public override asObj(): object {
        if (this.origin instanceof Action) {
            return {
                criteria: this.origin.description().major,
            };
        } else {
            return {
                criteria: this.origin.name,
            };
        }
    }

    public description(): {
        major: string;
        minor: string;
    } {
        const major: string | undefined = this.getHtmlOf('html_criteria');
        if (this.origin instanceof Action) {
            return major === undefined
                ? this.origin.description()
                : {
                      major,
                      minor: this.origin.description().minor,
                  };
        } else {
            return {
                major: major === undefined ? this.origin.name : major,
                minor: this.origin.parent,
            };
        }
    }

    // public hash(): string {
    //     if (this.origin instanceof Action) {
    //         return `${this.origin.description().major}-${this.origin.description().minor}`;
    //     } else {
    //         return `${this.origin.name}-${this.origin.parent}`;
    //     }
    // }
}
