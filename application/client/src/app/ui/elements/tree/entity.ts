import { Entity as IEntity, EntityType } from '@platform/types/files';
import { Filter } from '@elements/filter/filter';
import { getDomSanitizer } from '@ui/env/globals';
import { SafeHtml } from '@angular/platform-browser';
import { fromStr, serialize } from '@platform/env/regex';
import { getFileExtention } from '@platform/types/files';

const EXTENTION_PATTERN = /^\*\.|^\./gi;

export class Entity {
    public readonly entity: IEntity;
    public readonly parent: string;
    public ext: string | undefined;
    public selected: boolean = false;
    public favourite: boolean = false;
    public expanded: boolean = false;
    public exists: boolean = false;

    protected readonly filter: Filter;

    constructor(
        entity: IEntity,
        parent: string,
        favourite: boolean,
        exists: boolean,
        filter: Filter,
    ) {
        this.entity = entity;
        this.parent = parent;
        this.favourite = favourite;
        this.exists = exists;
        this.filter = filter;
        if (entity.details !== undefined) {
            this.ext = entity.details.ext.toUpperCase().replace('.', '');
        }
    }

    public getPath(): string {
        return `${this.parent}${this.parent === '' ? '' : '/'}${this.entity.name}`;
    }

    public isFolder(): boolean {
        return this.entity.type === EntityType.Directory;
    }

    public getName(): string {
        return this.entity.name;
    }

    public getExtention(): string {
        return getFileExtention(this.entity.name);
    }

    public selecting(): {
        select(): void;
        unselect(): void;
    } {
        return {
            select: (): void => {
                this.selected = true;
            },
            unselect: (): void => {
                this.selected = false;
            },
        };
    }

    public isVisible(): boolean {
        if (this.expanded) {
            return true;
        }
        const value = this.filter.value();
        if (value === undefined) {
            return true;
        }
        const filter = value.toLowerCase();
        if (filter.trim() === '') {
            return true;
        }
        if (this.isExtentionSearch(filter)) {
            const extention = this.getExtention();
            if (extention.trim() === '') {
                return true;
            }
            return (
                this.getExtention()
                    .toLowerCase()
                    .indexOf(serialize(filter.replace(EXTENTION_PATTERN, ''))) !== -1
            );
        } else {
            return this.getName().toLowerCase().indexOf(serialize(filter)) !== -1;
        }
    }

    public html(): SafeHtml {
        const name = this.getName();
        const value = this.filter.value();
        if (value === undefined) {
            return getDomSanitizer().bypassSecurityTrustHtml(name);
        }
        const filter = value.toLowerCase();
        if (filter.trim() === '') {
            return getDomSanitizer().bypassSecurityTrustHtml(name);
        }
        if (this.isExtentionSearch(filter)) {
            const extention = this.getExtention();
            if (extention.trim() === '') {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            const regexp = fromStr(serialize(filter.replace(EXTENTION_PATTERN, '')));
            if (regexp instanceof Error) {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            const regexpExt = fromStr(serialize(`.${extention}`) + '$');
            if (regexpExt instanceof Error) {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            const match = extention.match(regexp);
            if (match === null) {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            let html = extention;
            match.forEach((m) => {
                html = html.replace(m, `<span class="match">${m}</span>`);
            });
            return getDomSanitizer().bypassSecurityTrustHtml(name.replace(regexpExt, `.${html}`));
        } else {
            const regexp = fromStr(filter);
            if (regexp instanceof Error) {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            const match = name.match(regexp);
            if (match === null) {
                return getDomSanitizer().bypassSecurityTrustHtml(name);
            }
            let html = name;
            match.forEach((m) => {
                html = html.replace(m, `<span class="match">${m}</span>`);
            });
            return getDomSanitizer().bypassSecurityTrustHtml(html);
        }
    }

    protected isExtentionSearch(filter: string): boolean {
        return filter.startsWith('.') || filter.startsWith('*.');
    }
}
