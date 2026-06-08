# 发布说明

## GitHub Release 自动构建

仓库提供 GitHub Actions 发布流水线：

```text
.github/workflows/release.yml
```

触发方式：

- 推送 `app-v*` tag，例如 `app-v0.1.0`
- 在 GitHub Actions 页面手动运行 `Release` workflow，并填写已经存在的 `tag_name`

流水线会构建并上传三个平台的下载产物：

- macOS universal：Intel 和 Apple Silicon 共用包
- Linux x64
- Windows x64

Release 默认创建为 draft。第一次构建完成后，先在 GitHub Release 页面检查资产名称、安装包和说明，再手动发布。

## 正式发版流程

1. 确认测试和构建通过：

```bash
npm test
npm run build
PATH="$HOME/.cargo/bin:$PATH" cargo check --manifest-path src-tauri/Cargo.toml
```

2. 同步版本号：

```text
package.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
```

3. 提交版本变更并创建 tag：

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "Release app-v0.1.0"
git tag app-v0.1.0
git push origin main --tags
```

4. 等 GitHub Actions 完成后，在 GitHub Release 页面检查 draft release。

## 签名状态

当前 release workflow 未配置代码签名：

- macOS 用户可能看到 Gatekeeper 安全提示
- Windows 用户可能看到 SmartScreen 提示
- Linux 包通常不需要同类签名，但不同发行版仍可能有安装权限提示

面向真实用户公开前，建议补齐：

- Apple Developer ID 签名
- macOS notarization 公证
- Windows 代码签名证书
- changelog 和安装说明

## 开发版构建

生成 debug `.app`：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm run tauri -- build --debug --bundles app
```

输出路径：

```text
src-tauri/target/debug/bundle/macos/ChronoMatrix.app
```

## 正式发布前需要补齐

- 正式 app icon
- release 模式构建
- DMG 打包验收
- Apple Developer ID 签名
- notarization 公证
- Windows 代码签名
- Linux 包安装验收
- changelog
- 用户安装说明

## 版本号

版本号目前在三个位置：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

发布前三处需要保持一致。

## 网络和代理

当前设备 shell 里可能存在指向 `127.0.0.1:7890` 的代理变量。如果该端口不可用，Cargo 下载依赖会失败。构建命令中临时清空代理变量即可，不需要改全局环境。
