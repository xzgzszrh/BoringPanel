# Scry 最小权限远程执行环境

受管 Linux 主机使用固定账户 `scry-ops`。该账户仅允许公钥认证，SSH 会强制进入
`/opt/scry-ops/bin/scry-dispatch`，不能获得交互式 Shell、TTY、端口转发或隧道。

安装：

```bash
sudo ./install.sh /path/to/scry-ops.pub
```

安装后编辑 `/etc/scry-ops/allowed-services`，每行保留一个允许重启的 systemd unit。
变更包装器只通过 `/etc/sudoers.d/scry-ops` 中的精确路径白名单提权，包装器及配置必须由
`root:root` 持有且不可由 `scry-ops` 写入。

在 Scry 中新增主机后，先执行“最小权限环境校验”，确认用户名、UID、附加组、包装器属主和
权限均符合预期，再启用其他巡检或变更命令。
