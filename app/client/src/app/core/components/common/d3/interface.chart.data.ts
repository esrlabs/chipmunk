interface ChartData {
    lineColors  : { [key: string]: string },
    textColors  : { [key: string]: string },
    data        : { [key: string]: ChartDataItem[] },
    start       : Date,
    end         : Date,
    min         : number,
    max         : number
}

interface ChartDataItem{
    datetime    : Date,
    value       : number,
    key         : string
}

export { ChartData, ChartDataItem }
