# TicketBoxQR — Kiểm kê toàn bộ package-lock

Snapshot ngày 27/09/2026. Dữ liệu đọc từ client/package-lock.json và server/package-lock.json. Mỗi dòng là một vị trí package trong lockfile; có thể trùng tên ở nhiều vị trí/bản. Package optional theo OS/CPU có thể chưa được cài trên máy. Đây không phải kết quả npm ls hoặc danh mục chỉ các package đi vào bundle.

Mục đích của các dependency trực tiếp được giải thích trong [tài liệu 03](03-cong-cu-va-thu-vien.md). Phụ thuộc gián tiếp là do thư viện/build tool kéo theo; lockfile lưu cạnh dependencies, integrity và URL phân phối đầy đủ.

## client: 360 vị trí

| Đường dẫn trong lockfile | Version | Nhãn lockfile |
|---|---|---|
| `node_modules/@babel/code-frame` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/compat-data` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/core` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/generator` | 7.29.8 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-compilation-targets` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-globals` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-module-imports` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-module-transforms` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-string-parser` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-validator-identifier` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helper-validator-option` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/helpers` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/parser` | 7.29.8 | gián tiếp/lồng, dev |
| `node_modules/@babel/runtime` | 7.29.7 | gián tiếp/lồng |
| `node_modules/@babel/template` | 7.29.7 | gián tiếp/lồng, dev |
| `node_modules/@babel/traverse` | 7.29.8 | gián tiếp/lồng, dev |
| `node_modules/@babel/types` | 7.29.8 | gián tiếp/lồng, dev |
| `node_modules/@eslint-community/eslint-utils` | 4.10.1 | gián tiếp/lồng, dev |
| `node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys` | 3.4.3 | gián tiếp/lồng, dev |
| `node_modules/@eslint-community/regexpp` | 4.12.2 | gián tiếp/lồng, dev |
| `node_modules/@eslint/config-array` | 0.23.5 | gián tiếp/lồng, dev |
| `node_modules/@eslint/config-helpers` | 0.7.0 | gián tiếp/lồng, dev |
| `node_modules/@eslint/core` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/@eslint/js` | 10.0.1 | trực tiếp, dev |
| `node_modules/@eslint/object-schema` | 3.0.5 | gián tiếp/lồng, dev |
| `node_modules/@eslint/plugin-kit` | 0.7.2 | gián tiếp/lồng, dev |
| `node_modules/@floating-ui/core` | 1.8.0 | gián tiếp/lồng |
| `node_modules/@floating-ui/dom` | 1.8.0 | gián tiếp/lồng |
| `node_modules/@floating-ui/react-dom` | 2.1.9 | gián tiếp/lồng |
| `node_modules/@floating-ui/utils` | 0.2.12 | gián tiếp/lồng |
| `node_modules/@hookform/resolvers` | 5.8.0 | trực tiếp |
| `node_modules/@humanfs/core` | 0.19.2 | gián tiếp/lồng, dev |
| `node_modules/@humanfs/node` | 0.16.8 | gián tiếp/lồng, dev |
| `node_modules/@humanfs/types` | 0.15.0 | gián tiếp/lồng, dev |
| `node_modules/@humanwhocodes/module-importer` | 1.0.1 | gián tiếp/lồng, dev |
| `node_modules/@humanwhocodes/retry` | 0.4.3 | gián tiếp/lồng, dev |
| `node_modules/@jridgewell/gen-mapping` | 0.3.13 | gián tiếp/lồng |
| `node_modules/@jridgewell/remapping` | 2.3.5 | gián tiếp/lồng |
| `node_modules/@jridgewell/resolve-uri` | 3.1.2 | gián tiếp/lồng |
| `node_modules/@jridgewell/sourcemap-codec` | 1.5.5 | gián tiếp/lồng |
| `node_modules/@jridgewell/trace-mapping` | 0.3.31 | gián tiếp/lồng |
| `node_modules/@oxc-project/types` | 0.144.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/number` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/primitive` | 1.1.1 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-accordion` | 1.2.3 | trực tiếp |
| `node_modules/@radix-ui/react-alert-dialog` | 1.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-arrow` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-aspect-ratio` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-avatar` | 1.1.3 | trực tiếp |
| `node_modules/@radix-ui/react-checkbox` | 1.1.4 | trực tiếp |
| `node_modules/@radix-ui/react-collapsible` | 1.1.3 | trực tiếp |
| `node_modules/@radix-ui/react-collection` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-compose-refs` | 1.1.1 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-context` | 1.1.1 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-context-menu` | 2.2.6 | trực tiếp |
| `node_modules/@radix-ui/react-dialog` | 1.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-direction` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-dismissable-layer` | 1.1.5 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-dropdown-menu` | 2.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-focus-guards` | 1.1.1 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-focus-scope` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-hover-card` | 1.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-id` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-label` | 2.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-menu` | 2.1.6 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-menubar` | 1.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-navigation-menu` | 1.2.5 | trực tiếp |
| `node_modules/@radix-ui/react-popover` | 1.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-popper` | 1.2.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-portal` | 1.1.4 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-presence` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-primitive` | 2.0.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-progress` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-radio-group` | 1.2.3 | trực tiếp |
| `node_modules/@radix-ui/react-roving-focus` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-scroll-area` | 1.2.3 | trực tiếp |
| `node_modules/@radix-ui/react-select` | 2.1.6 | trực tiếp |
| `node_modules/@radix-ui/react-separator` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-slider` | 1.2.3 | trực tiếp |
| `node_modules/@radix-ui/react-slot` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-switch` | 1.1.3 | trực tiếp |
| `node_modules/@radix-ui/react-tabs` | 1.1.3 | trực tiếp |
| `node_modules/@radix-ui/react-toggle` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-toggle-group` | 1.1.2 | trực tiếp |
| `node_modules/@radix-ui/react-tooltip` | 1.1.8 | trực tiếp |
| `node_modules/@radix-ui/react-use-callback-ref` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-controllable-state` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-escape-keydown` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-layout-effect` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-previous` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-rect` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-use-size` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@radix-ui/react-visually-hidden` | 1.1.2 | gián tiếp/lồng |
| `node_modules/@radix-ui/rect` | 1.1.0 | gián tiếp/lồng |
| `node_modules/@rolldown/binding-android-arm64` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-darwin-arm64` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-darwin-x64` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-freebsd-x64` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-arm-gnueabihf` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-arm64-gnu` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-arm64-musl` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-ppc64-gnu` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-s390x-gnu` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-x64-gnu` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-linux-x64-musl` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-openharmony-arm64` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-win32-arm64-msvc` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/binding-win32-x64-msvc` | 1.2.4 | gián tiếp/lồng, optional |
| `node_modules/@rolldown/pluginutils` | 1.0.1 | gián tiếp/lồng |
| `node_modules/@standard-schema/utils` | 0.3.0 | gián tiếp/lồng |
| `node_modules/@tailwindcss/node` | 4.3.3 | gián tiếp/lồng |
| `node_modules/@tailwindcss/node/node_modules/lightningcss` | 1.32.0 | gián tiếp/lồng |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-android-arm64` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-darwin-arm64` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-darwin-x64` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-freebsd-x64` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-linux-arm-gnueabihf` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-linux-arm64-gnu` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-linux-arm64-musl` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-linux-x64-gnu` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-linux-x64-musl` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-win32-arm64-msvc` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/node/node_modules/lightningcss-win32-x64-msvc` | 1.32.0 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide` | 4.3.3 | gián tiếp/lồng |
| `node_modules/@tailwindcss/oxide-android-arm64` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-darwin-arm64` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-darwin-x64` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-freebsd-x64` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-linux-arm-gnueabihf` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-linux-arm64-gnu` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-linux-arm64-musl` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-linux-x64-gnu` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-linux-x64-musl` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-wasm32-wasi` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-win32-arm64-msvc` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/oxide-win32-x64-msvc` | 4.3.3 | gián tiếp/lồng, optional |
| `node_modules/@tailwindcss/vite` | 4.3.3 | trực tiếp |
| `node_modules/@types/d3-array` | 3.2.2 | gián tiếp/lồng |
| `node_modules/@types/d3-color` | 3.1.3 | gián tiếp/lồng |
| `node_modules/@types/d3-ease` | 3.0.2 | gián tiếp/lồng |
| `node_modules/@types/d3-interpolate` | 3.0.4 | gián tiếp/lồng |
| `node_modules/@types/d3-path` | 3.1.1 | gián tiếp/lồng |
| `node_modules/@types/d3-scale` | 4.0.9 | gián tiếp/lồng |
| `node_modules/@types/d3-shape` | 3.1.8 | gián tiếp/lồng |
| `node_modules/@types/d3-time` | 3.0.4 | gián tiếp/lồng |
| `node_modules/@types/d3-timer` | 3.0.2 | gián tiếp/lồng |
| `node_modules/@types/esrecurse` | 4.3.1 | gián tiếp/lồng, dev |
| `node_modules/@types/estree` | 1.0.9 | gián tiếp/lồng, dev |
| `node_modules/@types/json-schema` | 7.0.15 | gián tiếp/lồng, dev |
| `node_modules/@types/node` | 24.13.3 | trực tiếp |
| `node_modules/@types/react` | 19.2.18 | trực tiếp |
| `node_modules/@types/react-dom` | 19.2.4 | trực tiếp |
| `node_modules/@typescript-eslint/eslint-plugin` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore` | 7.0.6 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/parser` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/project-service` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/scope-manager` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/tsconfig-utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/type-utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/types` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/typescript-estree` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/typescript-estree/node_modules/semver` | 7.8.5 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/visitor-keys` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@vitejs/plugin-react` | 6.0.5 | trực tiếp, dev |
| `node_modules/acorn` | 8.18.0 | gián tiếp/lồng, dev |
| `node_modules/acorn-jsx` | 5.3.2 | gián tiếp/lồng, dev |
| `node_modules/agent-base` | 6.0.2 | gián tiếp/lồng |
| `node_modules/aria-hidden` | 1.2.6 | gián tiếp/lồng |
| `node_modules/asynckit` | 0.4.0 | gián tiếp/lồng |
| `node_modules/axios` | 1.19.0 | trực tiếp |
| `node_modules/balanced-match` | 4.0.4 | gián tiếp/lồng, dev |
| `node_modules/baseline-browser-mapping` | 2.11.14 | gián tiếp/lồng, dev |
| `node_modules/brace-expansion` | 5.0.9 | gián tiếp/lồng, dev |
| `node_modules/browserslist` | 4.28.8 | gián tiếp/lồng, dev |
| `node_modules/call-bind-apply-helpers` | 1.0.2 | gián tiếp/lồng |
| `node_modules/caniuse-lite` | 1.0.30001809 | gián tiếp/lồng, dev |
| `node_modules/class-variance-authority` | 0.7.1 | trực tiếp |
| `node_modules/clsx` | 2.1.1 | trực tiếp |
| `node_modules/cmdk` | 1.1.1 | trực tiếp |
| `node_modules/combined-stream` | 1.0.8 | gián tiếp/lồng |
| `node_modules/convert-source-map` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/cookie` | 1.1.1 | gián tiếp/lồng |
| `node_modules/cross-spawn` | 7.0.6 | gián tiếp/lồng, dev |
| `node_modules/csstype` | 3.2.3 | gián tiếp/lồng |
| `node_modules/d3-array` | 3.2.4 | gián tiếp/lồng |
| `node_modules/d3-color` | 3.1.0 | gián tiếp/lồng |
| `node_modules/d3-ease` | 3.0.1 | gián tiếp/lồng |
| `node_modules/d3-format` | 3.1.2 | gián tiếp/lồng |
| `node_modules/d3-interpolate` | 3.0.1 | gián tiếp/lồng |
| `node_modules/d3-path` | 3.1.0 | gián tiếp/lồng |
| `node_modules/d3-scale` | 4.0.2 | gián tiếp/lồng |
| `node_modules/d3-shape` | 3.2.0 | gián tiếp/lồng |
| `node_modules/d3-time` | 3.1.0 | gián tiếp/lồng |
| `node_modules/d3-time-format` | 4.1.0 | gián tiếp/lồng |
| `node_modules/d3-timer` | 3.0.1 | gián tiếp/lồng |
| `node_modules/date-fns` | 3.6.0 | trực tiếp |
| `node_modules/debug` | 4.4.3 | gián tiếp/lồng |
| `node_modules/decimal.js-light` | 2.5.1 | gián tiếp/lồng |
| `node_modules/deep-is` | 0.1.4 | gián tiếp/lồng, dev |
| `node_modules/delayed-stream` | 1.0.0 | gián tiếp/lồng |
| `node_modules/detect-libc` | 2.1.2 | gián tiếp/lồng |
| `node_modules/detect-node-es` | 1.1.0 | gián tiếp/lồng |
| `node_modules/dom-helpers` | 5.2.1 | gián tiếp/lồng |
| `node_modules/dunder-proto` | 1.0.1 | gián tiếp/lồng |
| `node_modules/electron-to-chromium` | 1.5.406 | gián tiếp/lồng, dev |
| `node_modules/embla-carousel` | 8.6.0 | gián tiếp/lồng |
| `node_modules/embla-carousel-react` | 8.6.0 | trực tiếp |
| `node_modules/embla-carousel-reactive-utils` | 8.6.0 | gián tiếp/lồng |
| `node_modules/enhanced-resolve` | 5.24.5 | gián tiếp/lồng |
| `node_modules/es-define-property` | 1.0.1 | gián tiếp/lồng |
| `node_modules/es-errors` | 1.3.0 | gián tiếp/lồng |
| `node_modules/es-object-atoms` | 1.1.2 | gián tiếp/lồng |
| `node_modules/es-set-tostringtag` | 2.1.0 | gián tiếp/lồng |
| `node_modules/escalade` | 3.2.0 | gián tiếp/lồng, dev |
| `node_modules/escape-string-regexp` | 4.0.0 | gián tiếp/lồng, dev |
| `node_modules/eslint` | 10.8.1 | trực tiếp, dev |
| `node_modules/eslint-plugin-react-hooks` | 7.1.1 | trực tiếp, dev |
| `node_modules/eslint-plugin-react-refresh` | 0.5.4 | trực tiếp, dev |
| `node_modules/eslint-scope` | 9.1.2 | gián tiếp/lồng, dev |
| `node_modules/eslint-visitor-keys` | 5.0.1 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/ajv` | 6.15.0 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/json-schema-traverse` | 0.4.1 | gián tiếp/lồng, dev |
| `node_modules/espree` | 11.2.0 | gián tiếp/lồng, dev |
| `node_modules/esquery` | 1.7.0 | gián tiếp/lồng, dev |
| `node_modules/esrecurse` | 4.3.0 | gián tiếp/lồng, dev |
| `node_modules/estraverse` | 5.3.0 | gián tiếp/lồng, dev |
| `node_modules/esutils` | 2.0.3 | gián tiếp/lồng, dev |
| `node_modules/eventemitter3` | 4.0.7 | gián tiếp/lồng |
| `node_modules/fast-deep-equal` | 3.1.3 | gián tiếp/lồng, dev |
| `node_modules/fast-equals` | 5.4.1 | gián tiếp/lồng |
| `node_modules/fast-json-stable-stringify` | 2.1.0 | gián tiếp/lồng, dev |
| `node_modules/fast-levenshtein` | 2.0.6 | gián tiếp/lồng, dev |
| `node_modules/fdir` | 6.5.0 | gián tiếp/lồng |
| `node_modules/file-entry-cache` | 8.0.0 | gián tiếp/lồng, dev |
| `node_modules/find-up` | 5.0.0 | gián tiếp/lồng, dev |
| `node_modules/flat-cache` | 4.0.1 | gián tiếp/lồng, dev |
| `node_modules/flatted` | 3.4.4 | gián tiếp/lồng, dev |
| `node_modules/follow-redirects` | 1.16.0 | gián tiếp/lồng |
| `node_modules/form-data` | 4.0.6 | gián tiếp/lồng |
| `node_modules/fsevents` | 2.3.3 | gián tiếp/lồng, optional |
| `node_modules/function-bind` | 1.1.2 | gián tiếp/lồng |
| `node_modules/gensync` | 1.0.0-beta.2 | gián tiếp/lồng, dev |
| `node_modules/get-intrinsic` | 1.3.0 | gián tiếp/lồng |
| `node_modules/get-nonce` | 1.0.1 | gián tiếp/lồng |
| `node_modules/get-proto` | 1.0.1 | gián tiếp/lồng |
| `node_modules/glob-parent` | 6.0.2 | gián tiếp/lồng, dev |
| `node_modules/globals` | 17.11.0 | trực tiếp, dev |
| `node_modules/gopd` | 1.2.0 | gián tiếp/lồng |
| `node_modules/graceful-fs` | 4.2.11 | gián tiếp/lồng |
| `node_modules/has-symbols` | 1.1.0 | gián tiếp/lồng |
| `node_modules/has-tostringtag` | 1.0.2 | gián tiếp/lồng |
| `node_modules/hasown` | 2.0.4 | gián tiếp/lồng |
| `node_modules/hermes-estree` | 0.25.1 | gián tiếp/lồng, dev |
| `node_modules/hermes-parser` | 0.25.1 | gián tiếp/lồng, dev |
| `node_modules/https-proxy-agent` | 5.0.1 | gián tiếp/lồng |
| `node_modules/ignore` | 5.3.2 | gián tiếp/lồng, dev |
| `node_modules/imurmurhash` | 0.1.4 | gián tiếp/lồng, dev |
| `node_modules/input-otp` | 1.4.2 | trực tiếp |
| `node_modules/internmap` | 2.0.3 | gián tiếp/lồng |
| `node_modules/is-extglob` | 2.1.1 | gián tiếp/lồng, dev |
| `node_modules/is-glob` | 4.0.3 | gián tiếp/lồng, dev |
| `node_modules/isexe` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/jiti` | 2.7.0 | gián tiếp/lồng |
| `node_modules/js-tokens` | 4.0.0 | gián tiếp/lồng |
| `node_modules/jsesc` | 3.1.0 | gián tiếp/lồng, dev |
| `node_modules/json-buffer` | 3.0.1 | gián tiếp/lồng, dev |
| `node_modules/json-stable-stringify-without-jsonify` | 1.0.1 | gián tiếp/lồng, dev |
| `node_modules/json5` | 2.2.3 | gián tiếp/lồng, dev |
| `node_modules/jsqr` | 1.4.0 | trực tiếp |
| `node_modules/keyv` | 4.5.4 | gián tiếp/lồng, dev |
| `node_modules/levn` | 0.4.1 | gián tiếp/lồng, dev |
| `node_modules/lightningcss` | 1.33.0 | gián tiếp/lồng |
| `node_modules/lightningcss-android-arm64` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-darwin-arm64` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-darwin-x64` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-freebsd-x64` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-linux-arm-gnueabihf` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-linux-arm64-gnu` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-linux-arm64-musl` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-linux-x64-gnu` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-linux-x64-musl` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-win32-arm64-msvc` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/lightningcss-win32-x64-msvc` | 1.33.0 | gián tiếp/lồng, optional |
| `node_modules/locate-path` | 6.0.0 | gián tiếp/lồng, dev |
| `node_modules/lodash` | 4.18.1 | gián tiếp/lồng |
| `node_modules/loose-envify` | 1.4.0 | gián tiếp/lồng |
| `node_modules/lru-cache` | 5.1.1 | gián tiếp/lồng, dev |
| `node_modules/lucide-react` | 1.31.0 | trực tiếp |
| `node_modules/magic-string` | 0.30.21 | gián tiếp/lồng |
| `node_modules/math-intrinsics` | 1.1.0 | gián tiếp/lồng |
| `node_modules/mime-db` | 1.52.0 | gián tiếp/lồng |
| `node_modules/mime-types` | 2.1.35 | gián tiếp/lồng |
| `node_modules/minimatch` | 10.2.6 | gián tiếp/lồng, dev |
| `node_modules/ms` | 2.1.3 | gián tiếp/lồng |
| `node_modules/nanoid` | 3.3.18 | gián tiếp/lồng |
| `node_modules/natural-compare` | 1.4.0 | gián tiếp/lồng, dev |
| `node_modules/next-themes` | 0.4.6 | trực tiếp |
| `node_modules/node-releases` | 2.0.53 | gián tiếp/lồng, dev |
| `node_modules/object-assign` | 4.1.1 | gián tiếp/lồng |
| `node_modules/optionator` | 0.9.4 | gián tiếp/lồng, dev |
| `node_modules/p-limit` | 3.1.0 | gián tiếp/lồng, dev |
| `node_modules/p-locate` | 5.0.0 | gián tiếp/lồng, dev |
| `node_modules/path-exists` | 4.0.0 | gián tiếp/lồng, dev |
| `node_modules/path-key` | 3.1.1 | gián tiếp/lồng, dev |
| `node_modules/picocolors` | 1.1.1 | gián tiếp/lồng |
| `node_modules/picomatch` | 4.0.5 | gián tiếp/lồng |
| `node_modules/postcss` | 8.5.26 | gián tiếp/lồng |
| `node_modules/prelude-ls` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/prop-types` | 15.8.1 | gián tiếp/lồng |
| `node_modules/prop-types/node_modules/react-is` | 16.13.1 | gián tiếp/lồng |
| `node_modules/proxy-from-env` | 2.1.0 | gián tiếp/lồng |
| `node_modules/punycode` | 2.3.1 | gián tiếp/lồng, dev |
| `node_modules/react` | 19.2.8 | trực tiếp |
| `node_modules/react-dom` | 19.2.8 | trực tiếp |
| `node_modules/react-hook-form` | 7.85.0 | trực tiếp |
| `node_modules/react-is` | 18.3.1 | gián tiếp/lồng |
| `node_modules/react-remove-scroll` | 2.7.2 | gián tiếp/lồng |
| `node_modules/react-remove-scroll-bar` | 2.3.8 | gián tiếp/lồng |
| `node_modules/react-resizable-panels` | 2.1.7 | trực tiếp |
| `node_modules/react-router` | 7.18.2 | gián tiếp/lồng |
| `node_modules/react-router-dom` | 7.18.2 | trực tiếp |
| `node_modules/react-smooth` | 4.0.4 | gián tiếp/lồng |
| `node_modules/react-style-singleton` | 2.2.3 | gián tiếp/lồng |
| `node_modules/react-transition-group` | 4.4.5 | gián tiếp/lồng |
| `node_modules/recharts` | 2.15.2 | trực tiếp |
| `node_modules/recharts-scale` | 0.4.5 | gián tiếp/lồng |
| `node_modules/rolldown` | 1.2.4 | gián tiếp/lồng |
| `node_modules/scheduler` | 0.27.0 | gián tiếp/lồng |
| `node_modules/semver` | 6.3.1 | gián tiếp/lồng, dev |
| `node_modules/set-cookie-parser` | 2.7.2 | gián tiếp/lồng |
| `node_modules/shebang-command` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/shebang-regex` | 3.0.0 | gián tiếp/lồng, dev |
| `node_modules/sonner` | 2.0.3 | trực tiếp |
| `node_modules/source-map-js` | 1.2.1 | gián tiếp/lồng |
| `node_modules/tailwind-merge` | 3.2.0 | trực tiếp |
| `node_modules/tailwindcss` | 4.3.3 | trực tiếp |
| `node_modules/tapable` | 2.3.3 | gián tiếp/lồng |
| `node_modules/tiny-invariant` | 1.3.3 | gián tiếp/lồng |
| `node_modules/tinyglobby` | 0.2.17 | gián tiếp/lồng |
| `node_modules/ts-api-utils` | 2.5.0 | gián tiếp/lồng, dev |
| `node_modules/tslib` | 2.8.1 | gián tiếp/lồng |
| `node_modules/tw-animate-css` | 1.3.8 | trực tiếp |
| `node_modules/type-check` | 0.4.0 | gián tiếp/lồng, dev |
| `node_modules/typescript` | 6.0.3 | trực tiếp, dev |
| `node_modules/typescript-eslint` | 8.67.0 | trực tiếp, dev |
| `node_modules/undici-types` | 7.18.2 | gián tiếp/lồng |
| `node_modules/update-browserslist-db` | 1.3.1 | gián tiếp/lồng, dev |
| `node_modules/uri-js` | 4.4.1 | gián tiếp/lồng, dev |
| `node_modules/use-callback-ref` | 1.3.3 | gián tiếp/lồng |
| `node_modules/use-sidecar` | 1.1.3 | gián tiếp/lồng |
| `node_modules/vaul` | 1.1.2 | trực tiếp |
| `node_modules/victory-vendor` | 36.9.2 | gián tiếp/lồng |
| `node_modules/vite` | 8.2.1 | trực tiếp |
| `node_modules/which` | 2.0.2 | gián tiếp/lồng, dev |
| `node_modules/word-wrap` | 1.2.5 | gián tiếp/lồng, dev |
| `node_modules/yallist` | 3.1.1 | gián tiếp/lồng, dev |
| `node_modules/yocto-queue` | 0.1.0 | gián tiếp/lồng, dev |
| `node_modules/zod` | 4.4.3 | trực tiếp |
| `node_modules/zod-validation-error` | 4.0.2 | gián tiếp/lồng, dev |

## server: 473 vị trí

| Đường dẫn trong lockfile | Version | Nhãn lockfile |
|---|---|---|
| `node_modules/@esbuild/aix-ppc64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/android-arm` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/android-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/android-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/darwin-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/darwin-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/freebsd-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/freebsd-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-arm` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-ia32` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-loong64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-mips64el` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-ppc64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-riscv64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-s390x` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/linux-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/netbsd-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/netbsd-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/openbsd-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/openbsd-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/openharmony-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/sunos-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/win32-arm64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/win32-ia32` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@esbuild/win32-x64` | 0.28.2 | gián tiếp/lồng, dev, optional |
| `node_modules/@eslint-community/eslint-utils` | 4.10.1 | gián tiếp/lồng, dev |
| `node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys` | 3.4.3 | gián tiếp/lồng, dev |
| `node_modules/@eslint-community/regexpp` | 4.12.2 | gián tiếp/lồng, dev |
| `node_modules/@eslint/config-array` | 0.23.5 | gián tiếp/lồng, dev |
| `node_modules/@eslint/config-helpers` | 0.7.0 | gián tiếp/lồng, dev |
| `node_modules/@eslint/core` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/@eslint/js` | 10.0.1 | trực tiếp, dev |
| `node_modules/@eslint/object-schema` | 3.0.5 | gián tiếp/lồng, dev |
| `node_modules/@eslint/plugin-kit` | 0.7.2 | gián tiếp/lồng, dev |
| `node_modules/@fast-csv/format` | 4.3.5 | gián tiếp/lồng |
| `node_modules/@fast-csv/format/node_modules/@types/node` | 14.18.63 | gián tiếp/lồng |
| `node_modules/@fast-csv/parse` | 4.3.6 | gián tiếp/lồng |
| `node_modules/@fast-csv/parse/node_modules/@types/node` | 14.18.63 | gián tiếp/lồng |
| `node_modules/@humanfs/core` | 0.19.2 | gián tiếp/lồng, dev |
| `node_modules/@humanfs/node` | 0.16.8 | gián tiếp/lồng, dev |
| `node_modules/@humanfs/types` | 0.15.0 | gián tiếp/lồng, dev |
| `node_modules/@humanwhocodes/module-importer` | 1.0.1 | gián tiếp/lồng, dev |
| `node_modules/@humanwhocodes/retry` | 0.4.3 | gián tiếp/lồng, dev |
| `node_modules/@jridgewell/sourcemap-codec` | 1.5.5 | gián tiếp/lồng, dev |
| `node_modules/@noble/hashes` | 1.8.0 | gián tiếp/lồng, dev |
| `node_modules/@oxc-project/types` | 0.144.0 | gián tiếp/lồng, dev |
| `node_modules/@paralleldrive/cuid2` | 2.3.1 | gián tiếp/lồng, dev |
| `node_modules/@rolldown/binding-android-arm64` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-darwin-arm64` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-darwin-x64` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-freebsd-x64` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-arm-gnueabihf` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-arm64-gnu` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-arm64-musl` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-ppc64-gnu` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-s390x-gnu` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-x64-gnu` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-linux-x64-musl` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-openharmony-arm64` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-win32-arm64-msvc` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/binding-win32-x64-msvc` | 1.2.4 | gián tiếp/lồng, dev, optional |
| `node_modules/@rolldown/pluginutils` | 1.0.1 | gián tiếp/lồng, dev |
| `node_modules/@standard-schema/spec` | 1.1.0 | gián tiếp/lồng, dev |
| `node_modules/@types/bcrypt` | 6.0.0 | trực tiếp, dev |
| `node_modules/@types/body-parser` | 1.19.6 | gián tiếp/lồng, dev |
| `node_modules/@types/chai` | 5.2.3 | gián tiếp/lồng, dev |
| `node_modules/@types/connect` | 3.4.38 | gián tiếp/lồng, dev |
| `node_modules/@types/cookie-parser` | 1.4.10 | trực tiếp, dev |
| `node_modules/@types/cookiejar` | 2.1.5 | gián tiếp/lồng, dev |
| `node_modules/@types/cors` | 2.8.19 | trực tiếp, dev |
| `node_modules/@types/deep-eql` | 4.0.2 | gián tiếp/lồng, dev |
| `node_modules/@types/esrecurse` | 4.3.1 | gián tiếp/lồng, dev |
| `node_modules/@types/estree` | 1.0.9 | gián tiếp/lồng, dev |
| `node_modules/@types/express` | 5.0.6 | trực tiếp, dev |
| `node_modules/@types/express-serve-static-core` | 5.1.3 | gián tiếp/lồng, dev |
| `node_modules/@types/http-errors` | 2.0.5 | gián tiếp/lồng, dev |
| `node_modules/@types/json-schema` | 7.0.15 | gián tiếp/lồng, dev |
| `node_modules/@types/jsonwebtoken` | 9.0.10 | trực tiếp, dev |
| `node_modules/@types/methods` | 1.1.4 | gián tiếp/lồng, dev |
| `node_modules/@types/morgan` | 1.9.10 | trực tiếp, dev |
| `node_modules/@types/ms` | 2.1.0 | gián tiếp/lồng, dev |
| `node_modules/@types/node` | 26.2.0 | trực tiếp |
| `node_modules/@types/node-cron` | 3.0.11 | trực tiếp, dev |
| `node_modules/@types/nodemailer` | 8.0.1 | trực tiếp, dev |
| `node_modules/@types/qrcode` | 1.5.6 | trực tiếp, dev |
| `node_modules/@types/qs` | 6.15.1 | gián tiếp/lồng, dev |
| `node_modules/@types/range-parser` | 1.2.7 | gián tiếp/lồng, dev |
| `node_modules/@types/send` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/@types/serve-static` | 2.2.0 | gián tiếp/lồng, dev |
| `node_modules/@types/superagent` | 8.1.11 | gián tiếp/lồng, dev |
| `node_modules/@types/supertest` | 7.2.1 | trực tiếp, dev |
| `node_modules/@types/ws` | 8.18.1 | trực tiếp, dev |
| `node_modules/@typescript-eslint/eslint-plugin` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore` | 7.0.6 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/parser` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/project-service` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/scope-manager` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/tsconfig-utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/type-utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/types` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/typescript-estree` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/utils` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@typescript-eslint/visitor-keys` | 8.67.0 | gián tiếp/lồng, dev |
| `node_modules/@vitest/expect` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/mocker` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/pretty-format` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/runner` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/snapshot` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/spy` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/@vitest/utils` | 4.1.10 | gián tiếp/lồng, dev |
| `node_modules/accepts` | 2.0.0 | gián tiếp/lồng |
| `node_modules/acorn` | 8.18.0 | gián tiếp/lồng, dev |
| `node_modules/acorn-jsx` | 5.3.2 | gián tiếp/lồng, dev |
| `node_modules/agent-base` | 7.1.4 | gián tiếp/lồng |
| `node_modules/ajv` | 6.15.0 | gián tiếp/lồng, dev |
| `node_modules/ansi-regex` | 5.0.1 | gián tiếp/lồng |
| `node_modules/ansi-styles` | 4.3.0 | gián tiếp/lồng |
| `node_modules/archiver` | 5.3.2 | gián tiếp/lồng |
| `node_modules/archiver-utils` | 2.1.0 | gián tiếp/lồng |
| `node_modules/archiver-utils/node_modules/readable-stream` | 2.3.8 | gián tiếp/lồng |
| `node_modules/archiver-utils/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/archiver-utils/node_modules/string_decoder` | 1.1.1 | gián tiếp/lồng |
| `node_modules/asap` | 2.0.6 | gián tiếp/lồng, dev |
| `node_modules/assertion-error` | 2.0.1 | gián tiếp/lồng, dev |
| `node_modules/async` | 3.2.6 | gián tiếp/lồng |
| `node_modules/asynckit` | 0.4.0 | gián tiếp/lồng, dev |
| `node_modules/aws-ssl-profiles` | 1.1.2 | gián tiếp/lồng |
| `node_modules/balanced-match` | 4.0.4 | gián tiếp/lồng, dev |
| `node_modules/base64-js` | 1.5.1 | gián tiếp/lồng |
| `node_modules/basic-auth` | 2.0.1 | gián tiếp/lồng |
| `node_modules/basic-auth/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/bcrypt` | 6.0.0 | trực tiếp |
| `node_modules/big-integer` | 1.6.52 | gián tiếp/lồng |
| `node_modules/bignumber.js` | 9.3.1 | gián tiếp/lồng |
| `node_modules/binary` | 0.3.0 | gián tiếp/lồng |
| `node_modules/bl` | 4.1.0 | gián tiếp/lồng |
| `node_modules/bluebird` | 3.4.7 | gián tiếp/lồng |
| `node_modules/body-parser` | 2.3.0 | gián tiếp/lồng |
| `node_modules/body-parser/node_modules/content-type` | 2.1.0 | gián tiếp/lồng |
| `node_modules/brace-expansion` | 5.0.9 | gián tiếp/lồng, dev |
| `node_modules/buffer` | 5.7.1 | gián tiếp/lồng |
| `node_modules/buffer-crc32` | 0.2.13 | gián tiếp/lồng |
| `node_modules/buffer-equal-constant-time` | 1.0.1 | gián tiếp/lồng |
| `node_modules/buffer-indexof-polyfill` | 1.0.2 | gián tiếp/lồng |
| `node_modules/buffers` | 0.1.1 | gián tiếp/lồng |
| `node_modules/bytes` | 3.1.2 | gián tiếp/lồng |
| `node_modules/call-bind-apply-helpers` | 1.0.2 | gián tiếp/lồng |
| `node_modules/call-bound` | 1.0.4 | gián tiếp/lồng |
| `node_modules/camelcase` | 5.3.1 | gián tiếp/lồng |
| `node_modules/chai` | 6.2.2 | gián tiếp/lồng, dev |
| `node_modules/chainsaw` | 0.1.0 | gián tiếp/lồng |
| `node_modules/cliui` | 6.0.0 | gián tiếp/lồng |
| `node_modules/clone` | 2.1.2 | gián tiếp/lồng |
| `node_modules/cloudinary` | 2.11.0 | trực tiếp |
| `node_modules/color-convert` | 2.0.1 | gián tiếp/lồng |
| `node_modules/color-name` | 1.1.4 | gián tiếp/lồng |
| `node_modules/combined-stream` | 1.0.8 | gián tiếp/lồng, dev |
| `node_modules/component-emitter` | 1.3.1 | gián tiếp/lồng, dev |
| `node_modules/compress-commons` | 4.1.2 | gián tiếp/lồng |
| `node_modules/concat-map` | 0.0.1 | gián tiếp/lồng |
| `node_modules/content-disposition` | 1.1.0 | gián tiếp/lồng |
| `node_modules/content-type` | 1.0.5 | gián tiếp/lồng |
| `node_modules/convert-source-map` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/cookie` | 0.7.2 | gián tiếp/lồng |
| `node_modules/cookie-parser` | 1.4.7 | trực tiếp |
| `node_modules/cookie-parser/node_modules/cookie-signature` | 1.0.6 | gián tiếp/lồng |
| `node_modules/cookie-signature` | 1.2.2 | gián tiếp/lồng |
| `node_modules/cookiejar` | 2.1.4 | gián tiếp/lồng, dev |
| `node_modules/core-util-is` | 1.0.3 | gián tiếp/lồng |
| `node_modules/cors` | 2.8.6 | trực tiếp |
| `node_modules/crc-32` | 1.2.2 | gián tiếp/lồng |
| `node_modules/crc32-stream` | 4.0.3 | gián tiếp/lồng |
| `node_modules/cross-spawn` | 7.0.6 | gián tiếp/lồng, dev |
| `node_modules/data-uri-to-buffer` | 4.0.1 | gián tiếp/lồng |
| `node_modules/dayjs` | 1.11.23 | gián tiếp/lồng |
| `node_modules/debug` | 4.4.3 | gián tiếp/lồng |
| `node_modules/decamelize` | 1.2.0 | gián tiếp/lồng |
| `node_modules/deep-is` | 0.1.4 | gián tiếp/lồng, dev |
| `node_modules/delayed-stream` | 1.0.0 | gián tiếp/lồng, dev |
| `node_modules/depd` | 2.0.0 | gián tiếp/lồng |
| `node_modules/detect-libc` | 2.1.2 | gián tiếp/lồng, dev |
| `node_modules/dezalgo` | 1.0.4 | gián tiếp/lồng, dev |
| `node_modules/dijkstrajs` | 1.0.3 | gián tiếp/lồng |
| `node_modules/dotenv` | 17.4.2 | trực tiếp |
| `node_modules/dunder-proto` | 1.0.1 | gián tiếp/lồng |
| `node_modules/duplexer2` | 0.1.4 | gián tiếp/lồng |
| `node_modules/duplexer2/node_modules/readable-stream` | 2.3.8 | gián tiếp/lồng |
| `node_modules/duplexer2/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/duplexer2/node_modules/string_decoder` | 1.1.1 | gián tiếp/lồng |
| `node_modules/ecdsa-sig-formatter` | 1.0.11 | gián tiếp/lồng |
| `node_modules/ee-first` | 1.1.1 | gián tiếp/lồng |
| `node_modules/emoji-regex` | 8.0.0 | gián tiếp/lồng |
| `node_modules/encodeurl` | 2.0.0 | gián tiếp/lồng |
| `node_modules/end-of-stream` | 1.4.5 | gián tiếp/lồng |
| `node_modules/es-define-property` | 1.0.1 | gián tiếp/lồng |
| `node_modules/es-errors` | 1.3.0 | gián tiếp/lồng |
| `node_modules/es-module-lexer` | 2.3.1 | gián tiếp/lồng, dev |
| `node_modules/es-object-atoms` | 1.1.2 | gián tiếp/lồng |
| `node_modules/es-set-tostringtag` | 2.1.0 | gián tiếp/lồng, dev |
| `node_modules/esbuild` | 0.28.2 | gián tiếp/lồng, dev |
| `node_modules/escape-html` | 1.0.3 | gián tiếp/lồng |
| `node_modules/escape-string-regexp` | 4.0.0 | gián tiếp/lồng, dev |
| `node_modules/eslint` | 10.8.1 | trực tiếp, dev |
| `node_modules/eslint-scope` | 9.1.2 | gián tiếp/lồng, dev |
| `node_modules/eslint-visitor-keys` | 5.0.1 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/find-up` | 5.0.0 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/locate-path` | 6.0.0 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/p-limit` | 3.1.0 | gián tiếp/lồng, dev |
| `node_modules/eslint/node_modules/p-locate` | 5.0.0 | gián tiếp/lồng, dev |
| `node_modules/espree` | 11.2.0 | gián tiếp/lồng, dev |
| `node_modules/esquery` | 1.7.0 | gián tiếp/lồng, dev |
| `node_modules/esrecurse` | 4.3.0 | gián tiếp/lồng, dev |
| `node_modules/estraverse` | 5.3.0 | gián tiếp/lồng, dev |
| `node_modules/estree-walker` | 3.0.3 | gián tiếp/lồng, dev |
| `node_modules/esutils` | 2.0.3 | gián tiếp/lồng, dev |
| `node_modules/etag` | 1.8.1 | gián tiếp/lồng |
| `node_modules/exceljs` | 4.4.0 | trực tiếp |
| `node_modules/expect-type` | 1.4.0 | gián tiếp/lồng, dev |
| `node_modules/express` | 5.2.1 | trực tiếp |
| `node_modules/express-rate-limit` | 8.6.2 | trực tiếp |
| `node_modules/extend` | 3.0.2 | gián tiếp/lồng |
| `node_modules/fast-csv` | 4.3.6 | gián tiếp/lồng |
| `node_modules/fast-deep-equal` | 3.1.3 | gián tiếp/lồng, dev |
| `node_modules/fast-json-stable-stringify` | 2.1.0 | gián tiếp/lồng, dev |
| `node_modules/fast-levenshtein` | 2.0.6 | gián tiếp/lồng, dev |
| `node_modules/fast-safe-stringify` | 2.1.1 | gián tiếp/lồng, dev |
| `node_modules/fdir` | 6.5.0 | gián tiếp/lồng, dev |
| `node_modules/fetch-blob` | 3.2.0 | gián tiếp/lồng |
| `node_modules/file-entry-cache` | 8.0.0 | gián tiếp/lồng, dev |
| `node_modules/finalhandler` | 2.1.1 | gián tiếp/lồng |
| `node_modules/find-up` | 4.1.0 | gián tiếp/lồng |
| `node_modules/flat-cache` | 4.0.1 | gián tiếp/lồng, dev |
| `node_modules/flatted` | 3.4.4 | gián tiếp/lồng, dev |
| `node_modules/form-data` | 4.0.6 | gián tiếp/lồng, dev |
| `node_modules/form-data/node_modules/mime-db` | 1.52.0 | gián tiếp/lồng, dev |
| `node_modules/form-data/node_modules/mime-types` | 2.1.35 | gián tiếp/lồng, dev |
| `node_modules/formdata-polyfill` | 4.0.10 | gián tiếp/lồng |
| `node_modules/formidable` | 3.5.4 | gián tiếp/lồng, dev |
| `node_modules/forwarded` | 0.2.0 | gián tiếp/lồng |
| `node_modules/fresh` | 2.0.0 | gián tiếp/lồng |
| `node_modules/fs-constants` | 1.0.0 | gián tiếp/lồng |
| `node_modules/fs.realpath` | 1.0.0 | gián tiếp/lồng |
| `node_modules/fsevents` | 2.3.3 | gián tiếp/lồng, dev, optional |
| `node_modules/fstream` | 1.0.12 | gián tiếp/lồng |
| `node_modules/function-bind` | 1.1.2 | gián tiếp/lồng |
| `node_modules/gaxios` | 7.3.1 | gián tiếp/lồng |
| `node_modules/gcp-metadata` | 9.0.4 | gián tiếp/lồng |
| `node_modules/generate-function` | 2.3.1 | gián tiếp/lồng |
| `node_modules/get-caller-file` | 2.0.5 | gián tiếp/lồng |
| `node_modules/get-intrinsic` | 1.3.0 | gián tiếp/lồng |
| `node_modules/get-proto` | 1.0.1 | gián tiếp/lồng |
| `node_modules/glob` | 7.2.3 | gián tiếp/lồng |
| `node_modules/glob-parent` | 6.0.2 | gián tiếp/lồng, dev |
| `node_modules/glob/node_modules/balanced-match` | 1.0.2 | gián tiếp/lồng |
| `node_modules/glob/node_modules/brace-expansion` | 1.1.21 | gián tiếp/lồng |
| `node_modules/glob/node_modules/minimatch` | 3.1.5 | gián tiếp/lồng |
| `node_modules/globals` | 17.11.0 | trực tiếp, dev |
| `node_modules/google-auth-library` | 11.1.0 | trực tiếp |
| `node_modules/google-logging-utils` | 2.0.1 | gián tiếp/lồng |
| `node_modules/gopd` | 1.2.0 | gián tiếp/lồng |
| `node_modules/graceful-fs` | 4.2.11 | gián tiếp/lồng |
| `node_modules/has-symbols` | 1.1.0 | gián tiếp/lồng |
| `node_modules/has-tostringtag` | 1.0.2 | gián tiếp/lồng, dev |
| `node_modules/hasown` | 2.0.4 | gián tiếp/lồng |
| `node_modules/helmet` | 8.3.0 | trực tiếp |
| `node_modules/http-errors` | 2.0.1 | gián tiếp/lồng |
| `node_modules/https-proxy-agent` | 7.0.6 | gián tiếp/lồng |
| `node_modules/iconv-lite` | 0.7.3 | gián tiếp/lồng |
| `node_modules/ieee754` | 1.2.1 | gián tiếp/lồng |
| `node_modules/ignore` | 5.3.2 | gián tiếp/lồng, dev |
| `node_modules/immediate` | 3.0.6 | gián tiếp/lồng |
| `node_modules/imurmurhash` | 0.1.4 | gián tiếp/lồng, dev |
| `node_modules/inflight` | 1.0.6 | gián tiếp/lồng |
| `node_modules/inherits` | 2.0.4 | gián tiếp/lồng |
| `node_modules/ip-address` | 10.5.0 | gián tiếp/lồng |
| `node_modules/ipaddr.js` | 1.9.1 | gián tiếp/lồng |
| `node_modules/is-extglob` | 2.1.1 | gián tiếp/lồng, dev |
| `node_modules/is-fullwidth-code-point` | 3.0.0 | gián tiếp/lồng |
| `node_modules/is-glob` | 4.0.3 | gián tiếp/lồng, dev |
| `node_modules/is-promise` | 4.0.0 | gián tiếp/lồng |
| `node_modules/is-property` | 1.0.2 | gián tiếp/lồng |
| `node_modules/isarray` | 1.0.0 | gián tiếp/lồng |
| `node_modules/isexe` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/json-bigint` | 1.0.0 | gián tiếp/lồng |
| `node_modules/json-buffer` | 3.0.1 | gián tiếp/lồng, dev |
| `node_modules/json-schema-traverse` | 0.4.1 | gián tiếp/lồng, dev |
| `node_modules/json-stable-stringify-without-jsonify` | 1.0.1 | gián tiếp/lồng, dev |
| `node_modules/jsonwebtoken` | 9.0.3 | trực tiếp |
| `node_modules/jszip` | 3.10.2 | gián tiếp/lồng |
| `node_modules/jszip/node_modules/readable-stream` | 2.3.8 | gián tiếp/lồng |
| `node_modules/jszip/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/jszip/node_modules/string_decoder` | 1.1.1 | gián tiếp/lồng |
| `node_modules/jwa` | 2.0.1 | gián tiếp/lồng |
| `node_modules/jws` | 4.0.1 | gián tiếp/lồng |
| `node_modules/keyv` | 4.5.4 | gián tiếp/lồng, dev |
| `node_modules/lazystream` | 1.0.1 | gián tiếp/lồng |
| `node_modules/lazystream/node_modules/readable-stream` | 2.3.8 | gián tiếp/lồng |
| `node_modules/lazystream/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/lazystream/node_modules/string_decoder` | 1.1.1 | gián tiếp/lồng |
| `node_modules/levn` | 0.4.1 | gián tiếp/lồng, dev |
| `node_modules/lie` | 3.3.0 | gián tiếp/lồng |
| `node_modules/lightningcss` | 1.33.0 | gián tiếp/lồng, dev |
| `node_modules/lightningcss-android-arm64` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-darwin-arm64` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-darwin-x64` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-freebsd-x64` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-linux-arm-gnueabihf` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-linux-arm64-gnu` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-linux-arm64-musl` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-linux-x64-gnu` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-linux-x64-musl` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-win32-arm64-msvc` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/lightningcss-win32-x64-msvc` | 1.33.0 | gián tiếp/lồng, dev, optional |
| `node_modules/listenercount` | 1.0.1 | gián tiếp/lồng |
| `node_modules/locate-path` | 5.0.0 | gián tiếp/lồng |
| `node_modules/lodash` | 4.18.1 | gián tiếp/lồng |
| `node_modules/lodash.defaults` | 4.2.0 | gián tiếp/lồng |
| `node_modules/lodash.difference` | 4.5.0 | gián tiếp/lồng |
| `node_modules/lodash.escaperegexp` | 4.1.2 | gián tiếp/lồng |
| `node_modules/lodash.flatten` | 4.4.0 | gián tiếp/lồng |
| `node_modules/lodash.groupby` | 4.6.0 | gián tiếp/lồng |
| `node_modules/lodash.includes` | 4.3.0 | gián tiếp/lồng |
| `node_modules/lodash.isboolean` | 3.0.3 | gián tiếp/lồng |
| `node_modules/lodash.isequal` | 4.5.0 | gián tiếp/lồng |
| `node_modules/lodash.isfunction` | 3.0.9 | gián tiếp/lồng |
| `node_modules/lodash.isinteger` | 4.0.4 | gián tiếp/lồng |
| `node_modules/lodash.isnil` | 4.0.0 | gián tiếp/lồng |
| `node_modules/lodash.isnumber` | 3.0.3 | gián tiếp/lồng |
| `node_modules/lodash.isplainobject` | 4.0.6 | gián tiếp/lồng |
| `node_modules/lodash.isstring` | 4.0.1 | gián tiếp/lồng |
| `node_modules/lodash.isundefined` | 3.0.1 | gián tiếp/lồng |
| `node_modules/lodash.once` | 4.1.1 | gián tiếp/lồng |
| `node_modules/lodash.union` | 4.6.0 | gián tiếp/lồng |
| `node_modules/lodash.uniq` | 4.5.0 | gián tiếp/lồng |
| `node_modules/long` | 5.3.2 | gián tiếp/lồng |
| `node_modules/lru.min` | 1.1.4 | gián tiếp/lồng |
| `node_modules/magic-string` | 0.30.21 | gián tiếp/lồng, dev |
| `node_modules/math-intrinsics` | 1.1.0 | gián tiếp/lồng |
| `node_modules/media-typer` | 1.1.1 | gián tiếp/lồng |
| `node_modules/merge-descriptors` | 2.0.0 | gián tiếp/lồng |
| `node_modules/methods` | 1.1.2 | gián tiếp/lồng, dev |
| `node_modules/mime` | 2.6.0 | gián tiếp/lồng, dev |
| `node_modules/mime-db` | 1.54.0 | gián tiếp/lồng |
| `node_modules/mime-types` | 3.0.2 | gián tiếp/lồng |
| `node_modules/minimatch` | 10.2.6 | gián tiếp/lồng, dev |
| `node_modules/minimist` | 1.2.8 | gián tiếp/lồng |
| `node_modules/mkdirp` | 0.5.6 | gián tiếp/lồng |
| `node_modules/morgan` | 1.11.0 | trực tiếp |
| `node_modules/morgan/node_modules/debug` | 2.6.9 | gián tiếp/lồng |
| `node_modules/morgan/node_modules/ms` | 2.0.0 | gián tiếp/lồng |
| `node_modules/ms` | 2.1.3 | gián tiếp/lồng |
| `node_modules/mysql2` | 3.23.3 | trực tiếp |
| `node_modules/named-placeholders` | 1.1.6 | gián tiếp/lồng |
| `node_modules/nanoid` | 3.3.18 | gián tiếp/lồng, dev |
| `node_modules/natural-compare` | 1.4.0 | gián tiếp/lồng, dev |
| `node_modules/negotiator` | 1.0.0 | gián tiếp/lồng |
| `node_modules/node-addon-api` | 8.9.2 | gián tiếp/lồng |
| `node_modules/node-cache` | 5.1.2 | trực tiếp |
| `node_modules/node-cron` | 4.6.0 | trực tiếp |
| `node_modules/node-domexception` | 1.0.0 | gián tiếp/lồng |
| `node_modules/node-fetch` | 3.3.2 | gián tiếp/lồng |
| `node_modules/node-gyp-build` | 4.8.4 | gián tiếp/lồng |
| `node_modules/nodemailer` | 9.0.5 | trực tiếp |
| `node_modules/normalize-path` | 3.0.0 | gián tiếp/lồng |
| `node_modules/object-assign` | 4.1.1 | gián tiếp/lồng |
| `node_modules/object-inspect` | 1.13.4 | gián tiếp/lồng |
| `node_modules/obug` | 2.1.4 | gián tiếp/lồng, dev |
| `node_modules/on-finished` | 2.4.1 | gián tiếp/lồng |
| `node_modules/on-headers` | 1.1.0 | gián tiếp/lồng |
| `node_modules/once` | 1.4.0 | gián tiếp/lồng |
| `node_modules/optionator` | 0.9.4 | gián tiếp/lồng, dev |
| `node_modules/p-limit` | 2.3.0 | gián tiếp/lồng |
| `node_modules/p-locate` | 4.1.0 | gián tiếp/lồng |
| `node_modules/p-try` | 2.2.0 | gián tiếp/lồng |
| `node_modules/pako` | 1.0.11 | gián tiếp/lồng |
| `node_modules/parseurl` | 1.3.3 | gián tiếp/lồng |
| `node_modules/path-exists` | 4.0.0 | gián tiếp/lồng |
| `node_modules/path-is-absolute` | 1.0.1 | gián tiếp/lồng |
| `node_modules/path-key` | 3.1.1 | gián tiếp/lồng, dev |
| `node_modules/path-to-regexp` | 8.4.2 | gián tiếp/lồng |
| `node_modules/pathe` | 2.0.3 | gián tiếp/lồng, dev |
| `node_modules/picocolors` | 1.1.1 | gián tiếp/lồng, dev |
| `node_modules/picomatch` | 4.0.5 | gián tiếp/lồng, dev |
| `node_modules/pngjs` | 5.0.0 | gián tiếp/lồng |
| `node_modules/postcss` | 8.5.26 | gián tiếp/lồng, dev |
| `node_modules/prelude-ls` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/process-nextick-args` | 2.0.1 | gián tiếp/lồng |
| `node_modules/proxy-addr` | 2.0.7 | gián tiếp/lồng |
| `node_modules/punycode` | 2.3.1 | gián tiếp/lồng, dev |
| `node_modules/qrcode` | 1.5.4 | trực tiếp |
| `node_modules/qs` | 6.15.3 | gián tiếp/lồng |
| `node_modules/range-parser` | 1.3.0 | gián tiếp/lồng |
| `node_modules/raw-body` | 3.0.2 | gián tiếp/lồng |
| `node_modules/readable-stream` | 3.6.2 | gián tiếp/lồng |
| `node_modules/readdir-glob` | 1.1.3 | gián tiếp/lồng |
| `node_modules/readdir-glob/node_modules/balanced-match` | 1.0.2 | gián tiếp/lồng |
| `node_modules/readdir-glob/node_modules/brace-expansion` | 2.1.7 | gián tiếp/lồng |
| `node_modules/readdir-glob/node_modules/minimatch` | 5.1.9 | gián tiếp/lồng |
| `node_modules/require-directory` | 2.1.1 | gián tiếp/lồng |
| `node_modules/require-main-filename` | 2.0.0 | gián tiếp/lồng |
| `node_modules/rimraf` | 2.7.1 | gián tiếp/lồng |
| `node_modules/rolldown` | 1.2.4 | gián tiếp/lồng, dev |
| `node_modules/router` | 2.2.0 | gián tiếp/lồng |
| `node_modules/safe-buffer` | 5.2.1 | gián tiếp/lồng |
| `node_modules/safer-buffer` | 2.1.2 | gián tiếp/lồng |
| `node_modules/saxes` | 5.0.1 | gián tiếp/lồng |
| `node_modules/semver` | 7.8.5 | gián tiếp/lồng |
| `node_modules/send` | 1.2.1 | gián tiếp/lồng |
| `node_modules/serve-static` | 2.2.1 | gián tiếp/lồng |
| `node_modules/set-blocking` | 2.0.0 | gián tiếp/lồng |
| `node_modules/setimmediate` | 1.0.5 | gián tiếp/lồng |
| `node_modules/setprototypeof` | 1.2.0 | gián tiếp/lồng |
| `node_modules/shebang-command` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/shebang-regex` | 3.0.0 | gián tiếp/lồng, dev |
| `node_modules/side-channel` | 1.1.1 | gián tiếp/lồng |
| `node_modules/side-channel-list` | 1.0.1 | gián tiếp/lồng |
| `node_modules/side-channel-map` | 1.0.1 | gián tiếp/lồng |
| `node_modules/side-channel-weakmap` | 1.0.2 | gián tiếp/lồng |
| `node_modules/siginfo` | 2.0.0 | gián tiếp/lồng, dev |
| `node_modules/source-map-js` | 1.2.1 | gián tiếp/lồng, dev |
| `node_modules/sql-escaper` | 1.5.1 | gián tiếp/lồng |
| `node_modules/stackback` | 0.0.2 | gián tiếp/lồng, dev |
| `node_modules/statuses` | 2.0.2 | gián tiếp/lồng |
| `node_modules/std-env` | 4.2.0 | gián tiếp/lồng, dev |
| `node_modules/string_decoder` | 1.3.0 | gián tiếp/lồng |
| `node_modules/string-width` | 4.2.3 | gián tiếp/lồng |
| `node_modules/strip-ansi` | 6.0.1 | gián tiếp/lồng |
| `node_modules/superagent` | 10.3.0 | gián tiếp/lồng, dev |
| `node_modules/supertest` | 7.2.2 | trực tiếp, dev |
| `node_modules/tar-stream` | 2.2.0 | gián tiếp/lồng |
| `node_modules/tinybench` | 2.9.0 | gián tiếp/lồng, dev |
| `node_modules/tinyexec` | 1.3.0 | gián tiếp/lồng, dev |
| `node_modules/tinyglobby` | 0.2.17 | gián tiếp/lồng, dev |
| `node_modules/tinyrainbow` | 3.1.1 | gián tiếp/lồng, dev |
| `node_modules/tmp` | 0.2.7 | gián tiếp/lồng |
| `node_modules/toidentifier` | 1.0.1 | gián tiếp/lồng |
| `node_modules/traverse` | 0.3.9 | gián tiếp/lồng |
| `node_modules/ts-api-utils` | 2.5.0 | gián tiếp/lồng, dev |
| `node_modules/tsx` | 4.23.12 | trực tiếp, dev |
| `node_modules/type-check` | 0.4.0 | gián tiếp/lồng, dev |
| `node_modules/type-is` | 2.1.0 | gián tiếp/lồng |
| `node_modules/type-is/node_modules/content-type` | 2.1.0 | gián tiếp/lồng |
| `node_modules/typescript` | 6.0.3 | trực tiếp, dev |
| `node_modules/typescript-eslint` | 8.67.0 | trực tiếp, dev |
| `node_modules/undici-types` | 8.3.0 | gián tiếp/lồng |
| `node_modules/unpipe` | 1.0.0 | gián tiếp/lồng |
| `node_modules/unzipper` | 0.10.14 | gián tiếp/lồng |
| `node_modules/unzipper/node_modules/readable-stream` | 2.3.8 | gián tiếp/lồng |
| `node_modules/unzipper/node_modules/safe-buffer` | 5.1.2 | gián tiếp/lồng |
| `node_modules/unzipper/node_modules/string_decoder` | 1.1.1 | gián tiếp/lồng |
| `node_modules/uri-js` | 4.4.1 | gián tiếp/lồng, dev |
| `node_modules/util-deprecate` | 1.0.2 | gián tiếp/lồng |
| `node_modules/uuid` | 8.3.2 | gián tiếp/lồng |
| `node_modules/vary` | 1.1.2 | gián tiếp/lồng |
| `node_modules/vite` | 8.2.1 | gián tiếp/lồng, dev |
| `node_modules/vitest` | 4.1.10 | trực tiếp, dev |
| `node_modules/web-streams-polyfill` | 3.3.3 | gián tiếp/lồng |
| `node_modules/which` | 2.0.2 | gián tiếp/lồng, dev |
| `node_modules/which-module` | 2.0.1 | gián tiếp/lồng |
| `node_modules/why-is-node-running` | 2.3.0 | gián tiếp/lồng, dev |
| `node_modules/word-wrap` | 1.2.5 | gián tiếp/lồng, dev |
| `node_modules/wrap-ansi` | 6.2.0 | gián tiếp/lồng |
| `node_modules/wrappy` | 1.0.2 | gián tiếp/lồng |
| `node_modules/ws` | 8.21.3 | trực tiếp |
| `node_modules/xmlchars` | 2.2.0 | gián tiếp/lồng |
| `node_modules/y18n` | 4.0.3 | gián tiếp/lồng |
| `node_modules/yargs` | 15.4.1 | gián tiếp/lồng |
| `node_modules/yargs-parser` | 18.1.3 | gián tiếp/lồng |
| `node_modules/yocto-queue` | 0.1.0 | gián tiếp/lồng, dev |
| `node_modules/zip-stream` | 4.1.1 | gián tiếp/lồng |
| `node_modules/zip-stream/node_modules/archiver-utils` | 3.0.4 | gián tiếp/lồng |
| `node_modules/zod` | 4.4.3 | trực tiếp |

