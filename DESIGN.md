# ASC Web Console 设计与实现说明

## 目标

Web Console 面向板级 bring-up 和现场调试，目标是替代一部分 UART shell 人工操作：

1. 可视化读取电源、BLE、LED、ADC/DAC/I2C 诊断计数。
2. 读写 DAC A/B/C/D 目标电压和输入模式。
3. 通过 BLE 触发 DAC apply、DAC probe、POWER_EN、强制 ADC 采样和 reset。
4. 订阅 ADC_DATA notification，并在浏览器 canvas 中显示 CH0/CH1 采样曲线。
5. 读取本地 OTA 镜像，并通过标准 MCUmgr SMP over BLE 上传、测试启动和复位。
6. 支持可配置 BLE 选择策略，避免固件广播名变化后网页无法检索设备。

## 页面结构

页面采用静态三文件实现：

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构和控件。 |
| `styles.css` | 偏 Apple 的浅色、磨砂、低噪声界面风格。 |
| `app.js` | Web Bluetooth、ASC GATT、SMP OTA、ZIP 解析和 canvas 绘图逻辑。 |

不引入 npm、打包器或远程 CDN，避免调试现场受网络状态影响。

## BLE 设备选择

Web Bluetooth 的设备发现必须由用户手势触发，并由浏览器原生选择器完成授权。因此页面不做后台持续扫描列表，而是在 `Connect` 前提供扫描范围设置：

| 模式 | requestDevice 配置 | 适用场景 |
| --- | --- | --- |
| 名称前缀 | `filters: [{ namePrefix }]` | 默认模式，当前前缀为 `Sivy_ASC`。 |
| ASC 服务 | `filters: [{ services: [ASC service UUID] }]` | 固件广播名变化，但 advertising data 仍包含 ASC service UUID。 |
| 全部设备 | `acceptAllDevices: true` + `optionalServices` | 最宽松排查模式，用于广播名和 service filter 都不确定时手动选择。 |

无论使用哪种模式，连接后都会调用 `getPrimaryService(ASC service UUID)` 做二次校验；如果用户选错设备，页面会断开连接并提示重新选择。

## BLE 协议

ASC 自定义 service 使用一个固定 128-bit UUID 前缀：

```text
415343xx-7a6d-4ef9-9c6b-5c5940000001
```

| xx | Characteristic | 属性 | 用途 |
| --- | --- | --- | --- |
| `00` | ASC service | service | 自定义服务根 UUID。 |
| `01` | STATUS | read/notify | 二进制状态包。 |
| `02` | CTRL_CMD | write | 二进制控制命令。 |
| `03` | CONFIG | read/write | DAC 和采样通知配置。 |
| `04` | ADC_DATA | notify | ADC 采样数据流。 |
| `05` | REG_REQ | write | 上位机发起 ASC/DAC/MCU/诊断/profile 寄存器访问请求。 |
| `06` | REG_RSP | notify | 固件返回 REG_REQ 的异步响应，使用 seq 匹配。 |

所有二进制字段均为 little-endian，和 nRF54L15 原生端序一致。

### complete-app-features 扩展

`complete-app-features` 分支把网页从 DAC/采样/OTA 调试页扩展为完整 bring-up console：

- STATUS 继续兼容旧 48-byte 基础包；新固件在尾部追加 app state、profile flags、sample queue depth、BLE congested、sample drop、REG_REQ、profile 和 settings 诊断计数。
- CONFIG 从旧 16-byte 扩展为 44-byte。前 16 bytes 保持原格式，后 28 bytes 保存 ASC profile enable/verify、entry count、enabled mask、8 个 register address 和 8 个 16-bit value。
- REG_REQ/REG_RSP 使用固定 10-byte 小包，不做任意内存访问，只访问白名单 target。
- ASC profile 默认关闭，网页必须同时打开全局 enable 和单条 entry enable，固件才会在 `APPLY_CONFIG`、`START_ARM` 或 `APPLY_PROFILE` 时写入 ASC I2C。
- 采样曲线消费 `ADC_DATA` notification；固件侧有 16 帧缓冲，所以网页短暂未订阅时可以看到最近样本，但不承诺长期离线记录。
- `ASC Register Test` 面板复用同一条 `REG_REQ/REG_RSP` 链路；只读测试批量发送 target `0x01` / width `16-bit` 的 read 请求，写校验使用 `UPDATE_BITS`，并在 finally 流程中按原值恢复 masked bits。

REG target 约定：

| Target | 名称 | 访问规则 |
| --- | --- | --- |
| `0x01` | ASC I2C | 16-bit read/write/update_bits，地址 `0x00..0x7f`。 |
| `0x03` | DAC Config | 读写 CONFIG 中的 DAC A/B/C/D mV shadow，不直接输出，输出需再执行 APPLY_DAC/APPLY_CONFIG。 |
| `0x04` | MCU Status | 只读 app state、flags、queue depth、profile flags、settings support。 |
| `0x05` | Diagnostics | 只读 32-bit 诊断计数，`REG_RSP.mask` 为高 16 bit，`value` 为低 16 bit。 |
| `0x06` | ASC Profile | `addr=0` 读写 profile flags；`addr=1..8` 读写 profile entries。 |

CTRL_CMD 新增 opcode：

| Opcode | 名称 | 行为 |
| --- | --- | --- |
| `0x0a` | START_ARM | 打开外部电源，应用 CONFIG DAC，若 profile enabled 则应用 ASC profile，状态切到 ARMED。 |
| `0x0b` | STOP_ARM | 退出 ARMED；`arg0 != 0` 时同时关闭外部电源。 |
| `0x0c` | ENTER_LOW_POWER | 关闭外部电源，状态切到 LOW_POWER。 |
| `0x0d` | SAVE_SETTINGS | 当前分区表没有 storage_partition，因此返回不支持并增加 settings error。 |
| `0x0e` | APPLY_PROFILE | 只应用当前 ASC profile，不改 DAC。 |

## ASC Register Test

回片寄存器测试面板只在 Web 侧编排测试流程，不扩展固件协议：

| 流程 | REG_REQ 行为 | 记录 |
| --- | --- | --- |
| `Run Reads` | 对 `Read Registers` 中的地址逐个发送 `target=ASC I2C, op=READ, width=16-bit`。 | 表格记录地址、读值和 REG_RSP status。 |
| `Write Verify` | 先读原值，再发送 `UPDATE_BITS(value=test_value, mask=mask)`，回读比较 masked bits。 | 表格记录原值、期望值、读回值和 pass/fail。 |
| `Restore` | 写校验后发送 `UPDATE_BITS(value=original, mask=mask)` 并回读。 | 表格记录 masked bits 是否恢复。 |
| `Export CSV` | 不访问设备，只导出当前浏览器内存中的结果表。 | CSV 用于芯片编号/板卡编号归档。 |

默认 `Mask=0x0000`，因此写校验必须由测试人员显式填写非零 mask 后才能运行。网页不判断寄存器是否安全可写，安全寄存器和 mask 必须来自 `Sivy-1芯片寄存器表.xlsx`、设计报告或芯片设计确认。

## OTA 设计

OTA 不重新定义 ASC 私有协议，而是直接使用 Zephyr/NCS 标准 MCUmgr SMP over BLE：

- SMP service UUID：`8d53dc1d-1db7-4cd3-868b-8a527460aa84`
- SMP characteristic UUID：`da2e7828-fbce-4e01-ae9e-261174997c48`
- image group：`1`
- image upload command：`1`
- image state command：`0`
- OS reset group/command：`0/5`

页面实现了最小 CBOR 编解码、SMP 8-byte header、notification 分包重组和 image upload 流程。上传完成后使用 `hash + confirm=false` 设置 test boot，再由用户触发 reset。

## 安全边界

当前工具是 bring-up 调试工具，不是量产上位机：

- 不做用户登录。
- 不保存 OTA 文件。
- 不把数据发出浏览器本地环境。
- 依赖固件端的 BLE SMP 权限配置；当前 `CONFIG_MCUMGR_TRANSPORT_BT_PERM_RW=y` 只适合调试。
- 量产前应加入 BLE pairing/bonding、SMP 认证、私有 signing key 和固定分区表。
