import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // eslint-disable-next-line no-undef
    const localEnv = loadEnv(mode, process.cwd(), "");

    const { VITE_BASE_URL, NODE_ENV } = localEnv;
    return {
        plugins: [
            react(),
            viteStaticCopy({
                targets: [
                    {
                        src: "node_modules/@mediapipe/tasks-vision/**/*",
                        dest: "node_modules/@mediapipe/tasks-vision"
                    }
                ]
            })
        ],
        resolve: {
            alias: [{find: "@", replacement: path.resolve(__dirname, "src")}]
        },
        base: VITE_BASE_URL,
    };
});