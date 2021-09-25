import {
    Modifier,
    Priorities,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    Logger,
    EApplyTo,
} from 'chipmunk.client.toolkit';
import { EParent } from '../../standalone/service.output.redirections';

export class ModifierProcessor {
    private _modifiers: Modifier[];
    private _injections: IHTMLInjection[] = [];
    private _logger: Logger = new Logger('ModifierProcessor');
    private _hasOwnStyles: boolean = false;

    constructor(modifiers: Modifier[], hasOwnStyles: boolean) {
        this._modifiers = modifiers;
        this._hasOwnStyles = hasOwnStyles;
    }

    public parse(row: string, parent: EParent): string {
        const cleanup = (str: string): string => {
            // For finalization procedure we are applying
            // all modifiers. For example, to cleanup from
            // ASCII escapes
            this._modifiers.forEach((modifier: Modifier) => {
                const finalized: string = modifier.finalize(str);
                const safe: string = this._serialize(finalized);
                if (safe.length !== finalized.length) {
                    this._logger.warn(`Modifier "${modifier.getName()}" tries to inject HTML`);
                }
                str = safe;
            });
            return str;
        };
        // Get rid of original HTML in logs
        row = this._serialize(row);
        this._injections = [];
        const modifiers: Modifier[] = this._getApplicableModifiers(parent);
        Priorities.forEach((type: EType, index: number) => {
            const subordinateTypes: EType[] =
                index !== Priorities.length - 1
                    ? Priorities.slice(index + 1, Priorities.length)
                    : [];
            const masters: Modifier[] = modifiers.filter((m) => m.type() === type);
            const subordinates: Modifier[] = modifiers.filter(
                (m) => subordinateTypes.indexOf(m.type()) !== -1,
            );
            if (masters.length === 0) {
                return;
            } else {
                masters.sort((a, b) => (a.getGroupPriority() > b.getGroupPriority() ? 1 : -1));
                masters.forEach((master: Modifier, n: number) => {
                    for (let i = n + 1; i <= masters.length - 1; i += 1) {
                        masters[i].obey(master.getRanges());
                    }
                });
            }
            if (subordinates.length === 0) {
                return;
            } else {
                subordinates.sort((a, b) => (a.getGroupPriority() > b.getGroupPriority() ? 1 : -1));
                masters.forEach((master: Modifier) => {
                    subordinates.forEach((subordinate: Modifier) => {
                        subordinate.obey(master.getRanges());
                    });
                });
            }
        });
        modifiers.forEach((modifier: Modifier) => {
            let ignore: boolean = false;
            // Check injections of modifier
            modifier.getInjections().forEach((inj: IHTMLInjection) => {
                const err: Error | undefined = this._getInjectionError(inj.injection);
                if (err instanceof Error) {
                    this._logger.warn(
                        `Injection of modifier "${modifier.getName()}" has been rejected due error: ${
                            err.message
                        }`,
                    );
                    ignore = true;
                }
            });
            if (!ignore) {
                this._injections.push(...modifier.getInjections());
            } else {
                this._logger.warn(
                    `All injections of modifier "${modifier.getName()}" will be ignored`,
                );
            }
        });
        this._injections.sort((a: IHTMLInjection, b: IHTMLInjection) => {
            return a.offset < b.offset ? 1 : -1;
        });
        let injections: IHTMLInjection[] = [];
        this._injections.forEach((inj: IHTMLInjection) => {
            if (injections.find((a) => a.offset === inj.offset) !== undefined) {
                // Skip. Already done.
                return;
            }
            const same: IHTMLInjection[] = this._injections.filter((a) => a.offset === inj.offset);
            if (same.length === 1) {
                injections.push(inj);
            } else {
                same.sort((a: IHTMLInjection, b: IHTMLInjection) => {
                    return a.type === EHTMLInjectionType.close ? 1 : -1;
                });
                injections = injections.concat(same);
            }
        });
        this._injections = injections;
        this._injections.forEach((inj: IHTMLInjection) => {
            row =
                row.substring(0, inj.offset) +
                inj.injection +
                row.substring(inj.offset, row.length);
        });
        if (row.search(/[\>\<]/g) !== -1) {
            row = row.replace(/(^.*?\<)|(\>.*?\<)|(\>.*?$)/gi, (match: string, ...args: any[]) => {
                let clean: string = match.replace(/[\>\<]/gi, '');
                if (clean === '') {
                    return match;
                }
                clean = cleanup(clean);
                return `${match[0] === '>' ? '>' : ''}${clean}${
                    match[match.length - 1] === '<' ? '<' : ''
                }`;
            });
        } else {
            row = cleanup(row);
        }
        return row;
    }

    public wasChanged(): boolean {
        return this._injections.length > 0;
    }

    private _getApplicableModifiers(target: EParent): Modifier[] {
        const applyTo: EApplyTo = (() => {
            if (target === EParent.output) {
                return EApplyTo.output;
            }
            if (target === EParent.search) {
                return EApplyTo.search;
            }
            return EApplyTo.all;
        })();
        return this._modifiers.filter((modifier: Modifier) => {
            if (modifier.applyTo() !== EApplyTo.all && modifier.applyTo() !== applyTo) {
                return false;
            }
            if (this._hasOwnStyles) {
                return [EType.above, EType.match].indexOf(modifier.type()) !== -1;
            } else {
                return true;
            }
        });
    }

    private _serialize(str: string): string {
        // Serialize input string to prevent brocken HTML
        return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
    }

    private _getInjectionError(injection: string): Error | undefined {
        const tag = /\<\/?(span|b|i).*?\>/gi;
        const match: RegExpMatchArray | null = injection.match(tag);
        if (match === null) {
            return new Error(
                `Expecting "injection" has to be HTML tag (supported tags: <span>, <b> and <i>.)`,
            );
        }
        if (match.length > 1) {
            return new Error(
                `"injection" should return only one tag. Multiple tags are prohibited`,
            );
        }
        if (injection.replace(tag, '').length !== 0) {
            return new Error(
                `"injection" should return only tag without any content outside of tag.`,
            );
        }
        return undefined;
    }
}
