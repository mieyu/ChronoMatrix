# 发布说明

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
- changelog
- 用户安装说明

## 版本号

版本号目前在两个位置：

- `package.json`
- `src-tauri/tauri.conf.json`

发布前两处需要保持一致。

## 网络和代理

当前设备 shell 里可能存在指向 `127.0.0.1:7890` 的代理变量。如果该端口不可用，Cargo 下载依赖会失败。构建命令中临时清空代理变量即可，不需要改全局环境。
