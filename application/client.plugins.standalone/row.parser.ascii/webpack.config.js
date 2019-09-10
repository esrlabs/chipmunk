module.exports = {
    entry: "./src/index.ts",
    output: {
        filename: "bundle.js",
        path: __dirname + "/dist",
        libraryTarget: 'umd',
        //library: 'parser',
        umdNamedDefine: true
    },
    devtool: "source-map",
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".json"]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                options: {
                    transpileOnly: true
                }
            },
            // { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    },
    externals: {

    },
    optimization: {
		// We no not want to minimize our code.
		minimize: false
	}
};