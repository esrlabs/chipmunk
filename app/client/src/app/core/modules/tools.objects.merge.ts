
function merge(dest: Object = {}, ...args: Array<Object>) {
    function interaction(dest: Object, src: Object){
        Object.keys(src).forEach((key)=>{
            if (src[key] instanceof Array) {
                dest[key] = src[key].filter((x: any)=>{ return true; });
            } else if (typeof src[key] === 'object' && src[key] !== null){
                dest[key] = typeof dest[key] === 'object' ? (dest[key] !== null ? dest[key] : {}) : {};
                interaction(dest[key], src[key]);
            } else {
                dest[key] = src[key];
            }
        });
    };
    dest = typeof dest === 'object' ? (dest !== null ? dest : {}) : {};
    if (args instanceof Array && args.length > 0){
        args.forEach((src)=>{
            if (typeof src === 'object' && src !== null){
                interaction(dest, src);
            }
        });
    }
    return dest;
};

export { merge };
