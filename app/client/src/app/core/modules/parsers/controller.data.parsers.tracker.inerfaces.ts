
interface ParserDataIndex {
    value?  : string,
    index   : number,
    label   : string
}

interface ParserData {
    name        : string,
    segments?   : Array<string>,
    tests?      : Array<string>,
    values?     : Array<string>,
    clearing?   : Array<string>,
    indexes?    : Object,
    lineColor   : string,
    textColor   : string
    active      : boolean
}

interface ParsedResultIndexes{
    index : number,
    label : any,
}

interface ParserClass{
    parse(str: string) : Object
}

export { ParserDataIndex,  ParserData, ParserClass, ParsedResultIndexes }