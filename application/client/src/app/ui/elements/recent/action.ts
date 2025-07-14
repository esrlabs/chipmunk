import { Matchee } from '@module/matcher';
import { Action } from '@service/recent/action';

import * as wasm from '@loader/wasm';

export class WrappedAction extends Matchee {
    public readonly action: Action;

    constructor(action: Action, matcher: wasm.Matcher) {
        super(matcher, {
            major: action.description().major,
            minor: action.description().minor,
        });
        this.action = action;
    }

    protected getIcon(): string {
        const origin = this.action.setup.origin;
        if ((origin as { File: string }).File) {
            return 'insert_drive_file';
        } else if ((origin as { Files: string[] }).Files) {
            return 'folder_open';
        } else {
            return 'compare_arrows';
        }
    }

    public description(): {
        major: string;
        minor: string;
        icon: string;
    } {
        const major: string | undefined = this.getHtmlOf('html_major');
        const minor: string | undefined = this.getHtmlOf('html_minor');
        return {
            major: major === undefined ? this.action.description().major : major,
            minor: minor === undefined ? this.action.description().minor : minor,
            icon: this.getIcon(),
        };
    }

    public hash(): string {
        return `${this.action.description().major}-${this.action.description().minor}`;
    }
}
