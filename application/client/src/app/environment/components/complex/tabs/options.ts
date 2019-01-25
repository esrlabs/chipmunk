export enum ETabsListDirection {
    top = 'top',
    left = 'left',
    right = 'right',
    bottom = 'bottom'
}

export class TabsOptions {

    public direction: ETabsListDirection = ETabsListDirection.top;
    public minimized: boolean = false;

    constructor(options?: {
        direction?: ETabsListDirection,
        minimized?: boolean
    }) {
        options = options ? options : {};
        if (options.direction !== void 0) { this.direction = options.direction; }
        if (options.minimized !== void 0) { this.minimized = options.minimized; }
    }

}
