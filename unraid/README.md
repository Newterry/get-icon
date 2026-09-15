# Get Icon — Unraid 用户模板

模板直接从 Docker Hub 拉取 `newterry/get-icon:latest`，无需 Compose Manager，也不需要数据卷。

## 一次安装模板

在 Unraid 终端执行：

```bash
mkdir -p /boot/config/plugins/dockerMan/templates-user
wget -O /boot/config/plugins/dockerMan/templates-user/my-get-icon.xml \
  https://raw.githubusercontent.com/Newterry/get-icon/main/unraid/my-get-icon.xml
```

随后进入 **Docker → Add Container**，在 **User templates** 中选择 `get-icon`，确认 WebUI 端口为 `3080`，点击 **Apply**。

## 手动创建容器

也可以直接点击 **Docker → Add Container** 并填写：

- Name：`get-icon`
- Repository：`newterry/get-icon:latest`
- Network Type：`Bridge`
- Port：主机 `3080` → 容器 `3080`
- Variable：`TZ=Asia/Shanghai`
- Variable：`PORT=3080`

Web 地址为 `http://UNRAID-IP:3080`。

应用不保存使用历史，语言和主题偏好只保存在各自浏览器中。后端缓存仅在容器内存中保留一小时。
