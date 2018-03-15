export interface RadioButton {
    id: string | symbol,
    caption: string,
    onSelected: Function,
    onDeselected: Function,
    value: any
}