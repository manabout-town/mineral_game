// vite.config.ts
import { defineConfig } from "file:///sessions/nice-nifty-archimedes/mnt/mineral/mineral-rush/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/nice-nifty-archimedes/mnt/mineral/mineral-rush/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "/sessions/nice-nifty-archimedes/mnt/mineral/mineral-rush";
var DEV_SECRET_DEFAULT = "dev-secret";
function hmacSecretGuard() {
  return {
    name: "hmac-secret-guard",
    buildStart() {
      const mode = process.env.NODE_ENV ?? "";
      const secret = process.env.VITE_DEV_HMAC_SECRET ?? "";
      if (mode === "production") {
        if (!secret || secret === DEV_SECRET_DEFAULT) {
          throw new Error(
            "[hmac-secret-guard] VITE_DEV_HMAC_SECRET is missing or still set to the default dev value. Set a strong secret in your CI/CD environment before building for production."
          );
        }
        if (secret.length < 32) {
          throw new Error(
            "[hmac-secret-guard] VITE_DEV_HMAC_SECRET must be at least 32 characters long."
          );
        }
      }
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), hmacSecretGuard()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src"),
      "@core": path.resolve(__vite_injected_original_dirname, "src/core"),
      "@systems": path.resolve(__vite_injected_original_dirname, "src/systems"),
      "@platform": path.resolve(__vite_injected_original_dirname, "src/platform"),
      "@view": path.resolve(__vite_injected_original_dirname, "src/view"),
      "@shared": path.resolve(__vite_injected_original_dirname, "src/shared")
    }
  },
  server: {
    port: 5173,
    open: true
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvbmljZS1uaWZ0eS1hcmNoaW1lZGVzL21udC9taW5lcmFsL21pbmVyYWwtcnVzaFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL25pY2UtbmlmdHktYXJjaGltZWRlcy9tbnQvbWluZXJhbC9taW5lcmFsLXJ1c2gvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL25pY2UtbmlmdHktYXJjaGltZWRlcy9tbnQvbWluZXJhbC9taW5lcmFsLXJ1c2gvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgUGx1Z2luIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFBoYXNlIDQtRzogXHVCRTRDXHVCNERDIFx1QzJEQyBITUFDIHNlY3JldCBcdUFDMTVcdUM4MUMgXHVBQzgwXHVDOTlEIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gcHJvZHVjdGlvbiBcdUJFNENcdUI0RENcdUM1RDBcdUMxMUMgXHVBRTMwXHVCQ0Y4XHVBQzEyKGRldi1zZWNyZXQpXHVDNzc0IFx1QURGOFx1QjMwMFx1Qjg1QyBcdUIxNzhcdUNEOUNcdUI0MThcdUIyOTQgXHVBQzgzXHVDNzQ0IFx1QkMyOVx1QzlDMC5cbi8vIFZJVEVfREVWX0hNQUNfU0VDUkVUXHVDNzc0ICdkZXYtc2VjcmV0JyBcdUI2MTBcdUIyOTQgXHVCRTQ4IFx1QUMxMlx1Qzc3NFx1QkE3NCBcdUJFNENcdUI0REMgXHVDMkU0XHVEMzI4LlxuY29uc3QgREVWX1NFQ1JFVF9ERUZBVUxUID0gJ2Rldi1zZWNyZXQnO1xuXG5mdW5jdGlvbiBobWFjU2VjcmV0R3VhcmQoKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnaG1hYy1zZWNyZXQtZ3VhcmQnLFxuICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICBjb25zdCBtb2RlID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPz8gJyc7XG4gICAgICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5WSVRFX0RFVl9ITUFDX1NFQ1JFVCA/PyAnJztcbiAgICAgIGlmIChtb2RlID09PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgaWYgKCFzZWNyZXQgfHwgc2VjcmV0ID09PSBERVZfU0VDUkVUX0RFRkFVTFQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnW2htYWMtc2VjcmV0LWd1YXJkXSBWSVRFX0RFVl9ITUFDX1NFQ1JFVCBpcyBtaXNzaW5nIG9yIHN0aWxsIHNldCB0byB0aGUgJyArXG4gICAgICAgICAgICAnZGVmYXVsdCBkZXYgdmFsdWUuIFNldCBhIHN0cm9uZyBzZWNyZXQgaW4geW91ciBDSS9DRCBlbnZpcm9ubWVudCBiZWZvcmUgJyArXG4gICAgICAgICAgICAnYnVpbGRpbmcgZm9yIHByb2R1Y3Rpb24uJyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWNyZXQubGVuZ3RoIDwgMzIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnW2htYWMtc2VjcmV0LWd1YXJkXSBWSVRFX0RFVl9ITUFDX1NFQ1JFVCBtdXN0IGJlIGF0IGxlYXN0IDMyIGNoYXJhY3RlcnMgbG9uZy4nLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGhtYWNTZWNyZXRHdWFyZCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcbiAgICAgICdAY29yZSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvY29yZScpLFxuICAgICAgJ0BzeXN0ZW1zJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9zeXN0ZW1zJyksXG4gICAgICAnQHBsYXRmb3JtJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9wbGF0Zm9ybScpLFxuICAgICAgJ0B2aWV3JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy92aWV3JyksXG4gICAgICAnQHNoYXJlZCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc2hhcmVkJyksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBvcGVuOiB0cnVlLFxuICB9LFxuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBpbmNsdWRlOiBbJ3Rlc3RzLyoqLyoudGVzdC50cycsICd0ZXN0cy8qKi8qLnRlc3QudHN4JywgJ3NyYy8qKi8qLnRlc3QudHMnXSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQWlDO0FBQzFDLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTSxxQkFBcUI7QUFFM0IsU0FBUyxrQkFBMEI7QUFDakMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sYUFBYTtBQUNYLFlBQU0sT0FBTyxRQUFRLElBQUksWUFBWTtBQUNyQyxZQUFNLFNBQVMsUUFBUSxJQUFJLHdCQUF3QjtBQUNuRCxVQUFJLFNBQVMsY0FBYztBQUN6QixZQUFJLENBQUMsVUFBVSxXQUFXLG9CQUFvQjtBQUM1QyxnQkFBTSxJQUFJO0FBQUEsWUFDUjtBQUFBLFVBR0Y7QUFBQSxRQUNGO0FBQ0EsWUFBSSxPQUFPLFNBQVMsSUFBSTtBQUN0QixnQkFBTSxJQUFJO0FBQUEsWUFDUjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLGdCQUFnQixDQUFDO0FBQUEsRUFDcEMsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsS0FBSztBQUFBLE1BQ2xDLFNBQVMsS0FBSyxRQUFRLGtDQUFXLFVBQVU7QUFBQSxNQUMzQyxZQUFZLEtBQUssUUFBUSxrQ0FBVyxhQUFhO0FBQUEsTUFDakQsYUFBYSxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQ25ELFNBQVMsS0FBSyxRQUFRLGtDQUFXLFVBQVU7QUFBQSxNQUMzQyxXQUFXLEtBQUssUUFBUSxrQ0FBVyxZQUFZO0FBQUEsSUFDakQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsU0FBUztBQUFBLElBQ1QsU0FBUyxDQUFDLHNCQUFzQix1QkFBdUIsa0JBQWtCO0FBQUEsRUFDM0U7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
