'use strict';

var pathUtil = require('path');
var Q = require('q');
var gulp = require('gulp');
var less = require('gulp-less');
var jetpack = require('fs-jetpack');
var asar = require('asar');

var bundle = require('./bundle');
var generateSpecImportsFile = require('./generate_spec_imports');
var utils = require('../utils');

var projectDir = jetpack;
var srcDir = projectDir.cwd('./app');
var destDir = projectDir.cwd('./build');

var paths = {
    copyFromAppDir: [
        './branding/**',
        './scripts/**',
        './lib/**',
        './spec.js',
        './app.html',
        './node_modules/**',
        './vendor/**',
        './images/**',
        './icons/**',
        './stylesheets/**/*.css',
        './fonts/**',
        './**/*.html',
        './**/*.+(jpg|png|svg)'
    ],
};

// -------------------------------------
// Tasks
// -------------------------------------

gulp.task('clean', function () {
    return destDir.dirAsync('.', { empty: true });
});


var copyTask = function () {
    return projectDir.copyAsync('app', destDir.path(), {
            overwrite: true,
            matching: paths.copyFromAppDir
        });
};
gulp.task('copy', ['clean'], copyTask);
gulp.task('copy-watch', copyTask);


var bundleApplication = function () {
    return Q.all([
            bundle(srcDir.path('background.js'), destDir.path('background.js')),
            bundle(srcDir.path('servers.js'), destDir.path('servers.js')),
            bundle(srcDir.path('certificate.js'), destDir.path('certificate.js')),
            bundle(srcDir.path('app.js'), destDir.path('app.js')),
        ]);
};

var bundleSpecs = function () {
    return generateSpecImportsFile().then(function (specEntryPointPath) {
        return Q.all([
                bundle(srcDir.path('background.js'), destDir.path('background.js')),
                bundle(specEntryPointPath, destDir.path('spec.js')),
            ]);
    });
};

var bundleTask = function () {
    if (utils.getEnvName() === 'test') {
        return bundleSpecs();
    }
    return bundleApplication();
};
gulp.task('bundle', ['clean'], bundleTask);
gulp.task('bundle-watch', bundleTask);


var lessTask = function () {
    return gulp.src('app/stylesheets/main.less')
        .pipe(less())
        .pipe(gulp.dest(destDir.path('stylesheets')));
};
gulp.task('less', ['clean'], lessTask);
gulp.task('less-watch', lessTask);


gulp.task('finalize', ['clean'], function () {
    var manifest = srcDir.read('package.json', 'json');

    // Add "dev" or "test" suffix to name, so Electron will write all data
    // like cookies and localStorage in separate places for each environment.
    switch (utils.getEnvName()) {
        case 'development':
            manifest.name += '-dev';
            manifest.productName += ' Dev';
            break;
        case 'test':
            manifest.name += '-test';
            manifest.productName += ' Test';
            break;
    }

    // Copy environment variables to package.json file for easy use
    // in the running application. This is not official way of doing
    // things, but also isn't prohibited ;)
    manifest.env = projectDir.read('config/env_' + utils.getEnvName() + '.json', 'json');

    destDir.write('package.json', manifest);
});


gulp.task('watch', function () {
    gulp.watch('app/**/*.js', ['bundle-watch']);
    gulp.watch(paths.copyFromAppDir, { cwd: 'app' }, ['copy-watch']);
    gulp.watch('app/**/*.less', ['less-watch']);
});

var buildAsar = function () {
    var deferred = Q.defer();

    asar.createPackage(destDir.cwd(), projectDir.path('app.asar'), function () {
        deferred.resolve();
    });
    deferred.resolve();

    return deferred.promise;
};

gulp.task('build:asar', ['build'], buildAsar);

gulp.task('build', ['bundle', 'less', 'copy', 'finalize']);
