
import { Modifier, Priorities, EType, IHTMLInjection, EHTMLInjectionType } from 'chipmunk.client.toolkit';

export class ModifierProcessor {

    private _modifiers: Modifier[];
    private _injections: IHTMLInjection[] = [];

    constructor(modifiers: Modifier[]) {
        this._modifiers = modifiers;
    }

    public parse(row: string): string {
        this._injections = [];
        Priorities.forEach((type: EType, index: number) => {
            const subordinateTypes: EType[] = index !== Priorities.length - 1 ? Priorities.slice(index + 1, Priorities.length) : [];
            const masters: Modifier[] = this._modifiers.filter(m => m.type() === type);
            const subordinates: Modifier[] = this._modifiers.filter(m => subordinateTypes.indexOf(m.type()) !== -1);
            if (masters.length === 0) {
                return;
            } else {
                masters.sort((a, b) => a.getGroupPriority() > b.getGroupPriority() ? 1 : -1);
                masters.forEach((master: Modifier, n: number) => {
                    for (let i = n + 1; i <= masters.length - 1; i += 1) {
                        masters[i].obey(master.getRanges());
                    }
                });
            }
            if (subordinates.length === 0) {
                return;
            } else {
                subordinates.sort((a, b) => a.getGroupPriority() > b.getGroupPriority() ? 1 : -1);
                masters.forEach((master: Modifier) => {
                    subordinates.forEach((subordinate: Modifier) => {
                        subordinate.obey(master.getRanges());
                    });
                });
            }
        });
        this._modifiers.forEach((modifier: Modifier) => {
            this._injections.push(...modifier.getInjections());
        });
        this._injections.sort((a: IHTMLInjection, b: IHTMLInjection) => {
            return a.offset < b.offset ? 1 : -1;
        });
        let injections: IHTMLInjection[] = [];
        this._injections.forEach((inj: IHTMLInjection) => {
            const same: IHTMLInjection[] = this._injections.filter(a => a.offset === inj.offset);
            if (same.length === 1) {
                injections.push(inj);
            } else {
                same.sort((a: IHTMLInjection, b: IHTMLInjection) => {
                    return a.type === EHTMLInjectionType.close ? 1 : -1;
                });
            }
            injections = injections.concat(same);
        });
        this._injections = injections;
        this._injections.forEach((inj: IHTMLInjection) => {
            row = row.substring(0, inj.offset) + inj.injection + row.substring(inj.offset, row.length);
        });
        this._modifiers.forEach((modifier: Modifier) => {
            row = modifier.finalize(row);
        });
        return row;
    }

    public wasChanged(): boolean {
        return this._injections.length > 0;
    }

}
