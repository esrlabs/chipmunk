import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { scheme_color_2, scheme_color_match } from '@styles/colors';
import { Base } from './render';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

export class Render extends Base {
    static COLUMN_WIDTH = 2;

    protected map: ISearchMap = [];
    protected filters: FilterRequest[] = [];
    protected active: boolean = false;

    public setMap(map: ISearchMap): Render {
        this.map = map;
        return this;
    }

    public setFilters(filters: FilterRequest[]): Render {
        this.filters = filters;
        return this;
    }

    public setActive(active: boolean): Render {
        this.active = active;
        return this;
    }

    public render(): void {
        const frame = this.frame;
        if (frame === undefined) {
            return;
        }
        const frameLength = frame.to - frame.from;
        if (frameLength <= 0) {
            return;
        }
        let max = 0;
        this.map.forEach((matches: [number, number][]) => {
            const m = Math.max(...matches.map((p) => p[1]));
            max = m > max ? m : max;
        });
        if (max === 0) {
            return;
        }
        const size = this.size();
        const rateByY = size.height / max;
        const maxColumns = size.width / Render.COLUMN_WIDTH;
        const columnWidth =
            maxColumns <= frameLength ? Render.COLUMN_WIDTH : size.width / frameLength;
        this.map.forEach((matches: [number, number][], left: number) => {
            matches.forEach((pair: [number, number]) => {
                const color = this.active
                    ? scheme_color_2
                    : this.filters[pair[0]] === undefined
                    ? scheme_color_match
                    : this.filters[pair[0]].definition.colors.background;
                const h = Math.round(pair[1] * rateByY);
                this.context.fillStyle = color;
                this.context.fillRect(left * columnWidth, size.height - h, columnWidth, h);
            });
        });
    }
}
