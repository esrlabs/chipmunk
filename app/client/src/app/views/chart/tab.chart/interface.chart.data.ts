interface ChartData{
    lineColors  : Object,
    textColors  : Object,
    data        : Object,
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
