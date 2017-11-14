"use strict";
//Hide all deprecation messages
process.noDeprecation = true;

const gulp                  = require('gulp');

//Managers
const tasksManagerStyles    = require('./gulp/tasks-manager.styles.js');
const tasksManagerBuild     = require('./gulp/tasks-manager.build.js');

gulp.task('default', gulp.series(
    tasksManagerStyles.getTaskName(),
    tasksManagerBuild.getTaskName()
));
