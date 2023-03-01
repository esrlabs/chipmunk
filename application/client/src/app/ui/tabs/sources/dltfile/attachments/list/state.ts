import { Filter } from '@ui/env/entities/filter';
import { AttachmentItem } from './attachment.item';
import { InternalAPI } from '@service/ilc';

import { Holder } from '@module/matcher';
import { Attachment } from '@platform/types/parsers/dlt';

export class State extends Holder {
    public filter: Filter;
    public list: AttachmentItem[] = [];

    constructor(ilc: InternalAPI, list: [string, Attachment][]) {
        super();
        this.filter = new Filter(ilc);
        this.list = list.map((item: [string, Attachment]) => {
            return new AttachmentItem(
                item[0],
                item[1],
                this.matcher,
            );
        })
        this.matcher.search(this.filter.value());
    }

    public update(): void {
        this.matcher.search(this.filter.value());
        this.list = this.list.sort(
            (a: AttachmentItem, b: AttachmentItem) => b.getScore() - a.getScore(),
        );
    }
}
