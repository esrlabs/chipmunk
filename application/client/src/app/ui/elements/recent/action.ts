import { Matcher } from '@matcher/matcher';
import { Matchee } from '@module/matcher';
import { Action } from '@service/recent/action';

export class WrappedAction extends Matchee {
    public readonly action: Action;

    constructor(action: Action, matcher: Matcher) {
        super(matcher, {
            major: action.description().major,
            minor: action.description().minor,
        });
        this.action = action;
    }

    public description(): {
        major: string;
        minor: string;
    } {
        const major: string | undefined = this.getHtmlOf('html_major');
        const minor: string | undefined = this.getHtmlOf('html_minor');
        return {
            major: major === undefined ? this.action.description().major : major,
            minor: minor === undefined ? this.action.description().minor : minor,
        };
    }

    public hash(): string {
        return `${this.action.description().major}-${this.action.description().minor}`;
    }
}
