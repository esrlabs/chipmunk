const path = require("path");
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const outputPath = path.resolve(__dirname, 'test_output');
module.exports = function (config) {
    config.set({

        frameworks: ["jasmine"],

        mime: {
            'application/wasm': ['wasm']
        },

        files: [

            { pattern: "node_modules/expect.js/index.js" },
            { pattern: "spec/**/*.ts" },
            {
                pattern: `${outputPath}/**/*`,
                watched: false,
                included: false,
            },
        ],

        webpack: {
            mode: "development",
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        exclude: /node_modules/,
                        use: "ts-loader",
                    }
                ],
            },
            output: {
                path: outputPath,
            },
            plugins: [
                new WasmPackPlugin({
                    crateDirectory: __dirname,
                    outDir: "pkg"
                })
            ],
            resolve: {
                extensions: [".tsx", ".ts", ".js", ".wasm"],
            },
            experiments: {
                asyncWebAssembly: true,
            },

        },

        preprocessors: {
            "**/*.ts": ["webpack"]
        },

        browsers: ['ChromeHeadless'],
        customLaunchers: {
            ChromeHeadlessCustom: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-gpu']
            }
        },

        exprContextCritical: false,

        singleRun: true

    });
};
