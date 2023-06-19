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
    public pcap: Files.Pcap | undefined;

    public isSuitable(parser: ParserName): boolean {
        switch (parser) {
            case ParserName.Text:
                return this.text !== undefined;
            case ParserName.Dlt:
                return this.dlt !== undefined;
            case ParserName.Someip:
                return this.pcap !== undefined;
        }
    }

    public asComponent(): IComponentDesc {
        return {
            factory: components.get('app-recent-file'),
            inputs: {
                text: this.text,
                dlt: this.dlt,
                pcap: this.pcap,
            },
        };
    }

    public getBaseInfo(): BaseInfo {
        const base =
            this.text !== undefined
                ? this.text
                : this.dlt !== undefined
                ? this.dlt
                : this.pcap !== undefined
                ? this.pcap
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
                : this.pcap !== undefined
                ? this.pcap
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
        } else if (this.pcap !== undefined) {
            return this.pcap.asObj();
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
        } else if (inputs['pcap'] !== undefined) {
            this.pcap = new Files.Pcap(inputs);
        } else {
            this.text = new Files.Text(inputs);
        }
        return this;
    }
}
