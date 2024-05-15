const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        background: './src/background/background.ts',
        popup: './src/popup/popup.ts',
        options: './src/options/options.ts',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'manifest.json', to: '.' },
                { from: 'src/stylesheet/', to: 'stylesheet' },
                { from: 'src/popup/popup.html', to: '.' },
                { from: 'src/options/options.html', to: '.' },
            ],
        }),
    ],
    devServer: {
        hot: true,
        host: 'localhost',
        port: 8080,
        devMiddleware: {
            writeToDisk: true,
            publicPath: '/',
        },
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        client: {
            webSocketURL: 'ws://localhost:8080/ws',
        },
    },
    devtool: 'source-map'
};
