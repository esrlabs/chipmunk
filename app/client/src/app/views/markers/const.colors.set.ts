const getColorsSet = function () {
    let colors  = [],
        step    = 40;
    for (let r = 0; r <= 255; r += step){
        for (let g = 0; g <= 255; g += step){
            for (let b = 0; b <= 255; b += step){
                colors.push('rgb('+ r + ','+ g + ','+ b + ')');
            }
        }
    }
    return colors;
};

export { getColorsSet };