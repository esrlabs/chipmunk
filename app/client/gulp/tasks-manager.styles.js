const TASKS = {
    STYLES          : 'styles',
    LESS            : 'less',
    CONCAT_LESS     : 'concat_less',
    COLOR_SCHEMES   : 'color_schemes',
    CLEANUP_LESS    : 'cleanup_less'
};
const PATHS = require('./config.js');

const gulp            = require('gulp');
const gulpless        = require('gulp-less');
const gulpconcat      = require('gulp-concat');
const gulpclean       = require('gulp-clean');

class StylesTasks {

    constructor(){
        this._schemes = [];
        //Get list of color schemes
        this._getColorSchemesList();
        //Create tasks
        this._createCleanupTask();
        this._createConcatTask();
        this._createColorSchemesTask();
        this._createConvertingTask();
        this._create();
    }

    _isFileOrFolderExist(file){
        const FS = require('fs');
        try {
            FS.accessSync(file);
            return true;
        } catch (err) {
            return false;
        }
    }

    _getColorSchemesList(){
        const FS    = require('fs');
        const path  = require('path');
        if (!this._isFileOrFolderExist(PATHS.IN.THEMES)){
            throw new Error(`Folder "${PATHS.IN.THEMES}" doesn't exist. Building styles isn't possible. At least one color scheme should be defined.`);
        }
        FS.readdirSync(PATHS.IN.THEMES).forEach(file => {
            if (path.extname(file).toLowerCase() === '.less'){
                this._schemes.push(path.basename(file));
            }
        })
    }

    _createCleanupTask(){
        //Cleanup previous build
        gulp.task(TASKS.CLEANUP_LESS, () => {
            let toRemove = this._schemes.filter(scheme => true);
            toRemove.push(PATHS.IN.STYLES);
            toRemove = toRemove.filter((file)=>{
                return this._isFileOrFolderExist(PATHS.IN.LESS + '/' + file);
            });
            return toRemove.length > 0 ? Promise.all(toRemove.map((file)=>{
                new Promise((resolve) => {
                    gulp.src(PATHS.IN.LESS + '/' + file, {read: false})
                        .pipe(gulpclean())
                        .on('end', ()=>{
                            resolve();
                        });
                })
            })) : Promise.resolve();
        });
    }

    _createConcatTask(){
        //Concat LESS basic (without color scheme) sources
        gulp.task(TASKS.CONCAT_LESS, () => {
            return gulp.src([
                    PATHS.IN.BASE + '/**/*.less',
                    '!' + PATHS.IN.LESS + '/' + PATHS.IN.STYLES,
                    '!' + PATHS.IN.THEMES,
                    '!' + PATHS.IN.THEMES + '/**/*'])
                .pipe(gulpconcat(PATHS.IN.STYLES))
                .pipe(gulp.dest(PATHS.IN.LESS));
        });
    }

    _createColorSchemesTask(){
        //Collect and create color schemes
        gulp.task(TASKS.COLOR_SCHEMES, (done) => {
            return Promise.all(this._schemes.map((scheme)=>{
                return new Promise((resolve)=>{
                    gulp.src([
                            PATHS.IN.THEMES + '/' + scheme,
                            PATHS.IN.LESS + '/' + PATHS.IN.STYLES])
                        .pipe(gulpconcat(scheme))
                        .pipe(gulp.dest(PATHS.IN.LESS))
                        .on('end', ()=>{
                            console.log('Color theme "' + PATHS.IN.THEMES + '/' + scheme + '" is created.');
                            resolve();
                        });
                });
            }));
        });
    }

    _createConvertingTask(){
        //Convert LESS to CSS
        gulp.task(TASKS.LESS, () => {
            return Promise.all(this._schemes.map((scheme)=>{
                return new Promise((resolve)=>{
                    gulp.src([
                            PATHS.IN.LESS + '/' + scheme])
                        .pipe(gulpless({
                            paths: [PATHS.IN.LESS]
                        }))
                        .pipe(gulp.dest(PATHS.OUT.CSS))
                        .on('end', ()=>{
                            console.log('CSS for color theme "' + PATHS.IN.THEMES + '/' + scheme + '" is created.');
                            resolve();
                        });
                });
            }));
        });
    }

    _create(){
        gulp.task(TASKS.STYLES, gulp.series(
            TASKS.CLEANUP_LESS,
            TASKS.CONCAT_LESS,
            TASKS.COLOR_SCHEMES,
            TASKS.LESS,
            TASKS.CLEANUP_LESS
        ));
    }

    getTaskName(){
        return TASKS.STYLES;
    }
}

module.exports = new StylesTasks();

