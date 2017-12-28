const MAP = [
    { regIn: /\s/gi, regOut: /\uAA80/gi, output: '&nbsp;',                   marker: '\uAA80'},
    { regIn: /\t/gi, regOut: /\uAA81/gi, output: '&nbsp;&nbsp;&nbsp;&nbsp;', marker: '\uAA81'},
    { regIn: /\</gi, regOut: /\uAA82/gi, output: '&lt;',                     marker: '\uAA82'},
    { regIn: /\>/gi, regOut: /\uAA83/gi, output: '&gt;',                     marker: '\uAA83'},
    { regIn: /"/gi,  regOut: /\uAA84/gi, output: '&quot;',                   marker: '\uAA84'},
    { regIn: /'/gi,  regOut: /\uAA85/gi, output: '&apos;',                   marker: '\uAA85'},
];

const serializeHTML = function(str : string){
    MAP.forEach((data) => {
        str = str.replace(data.regIn, data.marker);
    });
    return str;
};

const parseHTML = function(str : string){
    MAP.forEach((data) => {
        str = str.replace(data.regOut, data.output);
    });
    return str;
};
export { serializeHTML, parseHTML };
