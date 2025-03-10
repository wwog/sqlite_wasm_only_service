import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: {
      // 为.wasm文件添加正确的MIME类型
      "*.wasm": {
        "Content-Type": "application/wasm",
      },
    },
    // 配置正确处理wasm文件
    middleware: [
      (req, res, next) => {
        if (req.url.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      },
    ],
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"], // 排除sqlite-wasm从依赖优化中
  },
});
