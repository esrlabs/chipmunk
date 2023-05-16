import { components } from '@env/decorators/initial';
import { RecentAction } from '../recent';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { ParserName } from '@platform/types/observe';

import * as Files from './index';

export interface BaseInfo {
    filename: string;
    name: string;
    path: string;
    size: number;
    created: number;
}

export class Recent extends RecentAction {
    public text: Files.Text | undefined;
    public dlt: Files.Dlt | undefined;
    public pcapng: Files.PcapNG | undefined;

    public isSuitable(parser: ParserName): boolean {
        switch (parser) {
            case ParserName.Text:
                return this.text !== undefined;
            case ParserName.Dlt:
                return this.dlt !== undefined;
            case ParserName.Someip:
                return this.pcapng !== undefined;
        }
    }

    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-file'),
            inputs: {
                text: this.text,
                dlt: this.dlt,
                pcapng: this.pcapng,
            },
        };
    }

    public getBaseInfo(): BaseInfo {
        const base =
            this.text !== undefined
                ? this.text
                : this.dlt !== undefined
                ? this.dlt
                : this.pcapng !== undefined
                ? this.pcapng
                : undefined;
        if (base === undefined) {
            throw new Error(`No file data provided`);
        }
        return {
            filename: base.filename,
            name: base.name,
            path: base.path,
            size: base.size,
            created: base.created,
        };
    }
    public description(): {
        major: string;
        minor: string;
    } {
        const base =
            this.text !== undefined
                ? this.text
                : this.dlt !== undefined
                ? this.dlt
                : this.pcapng !== undefined
                ? this.pcapng
                : undefined;
        if (base === undefined) {
            throw new Error(`No file data provided`);
        }
        return {
            major: base.name,
            minor: base.path,
        };
    }
    public asObj(): { [key: string]: unknown } {
        if (this.text !== undefined) {
            return this.text.asObj();
        } else if (this.dlt !== undefined) {
            return this.dlt.asObj();
        } else if (this.pcapng !== undefined) {
            return this.pcapng.asObj();
        } else {
            throw new Error(`No any file type defined`);
        }
    }

    public from(inputs: { [key: string]: unknown }): Recent {
        if (typeof inputs !== 'object') {
            throw new Error(
                `Expected format of recent file-action is an object. Actual type: ${typeof inputs}`,
            );
        }
        if (inputs['dlt'] !== undefined) {
            this.dlt = new Files.Dlt(inputs);
        } else if (inputs['pcapng'] !== undefined) {
            this.pcapng = new Files.PcapNG(inputs);
        } else {
            this.text = new Files.Text(inputs);
        }
        return this;
    }
}
