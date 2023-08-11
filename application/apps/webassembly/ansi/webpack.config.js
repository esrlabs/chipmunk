const path = require("path");
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

module.exports = {
    devtool: "inline-source-map",
    devServer: {
        static: path.join(__dirname, 'dist'),
        compress: true
    },
    mode: "none",
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
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new WasmPackPlugin({
            crateDirectory: __dirname,
            outDir: "pkg"
        }),
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".wasm"],
    },
    experiments: {
        asyncWebAssembly: true
    },
};