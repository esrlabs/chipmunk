export class ToolBarButton {
    id      : string | number | symbol;
    icon    : string;
    caption : string;
    handle  : string | Function | null;
    enable? : boolean;
}