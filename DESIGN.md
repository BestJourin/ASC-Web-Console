# Sivy ASC 寄存器控制台设计与实现说明

## 目标

Web Console 面向板级 bring-up 和现场调试，目标是替代一部分 UART shell 人工操作：

1. 可视化读取电源、BLE、LED、ADC/DAC/I2C 诊断计数。
2. 读写 DAC A/B/C/D 目标电压和输入模式。
3. 通过 BLE 触发 DAC apply、DAC probe、POWER_EN、强制 ADC 采样和 reset。
4. 通过本地桥接入 RIGOL MHO 5054 的 H.264 屏幕流，并使用浏览器 WebCodecs 在 canvas 中解码显示。
5. 读取本地 OTA 镜像，并通过标准 MCUmgr SMP over BLE 上传、测试启动和复位。
6. 支持可配置 BLE 选择策略，避免固件广播名变化后网页无法检索设备。
7. 对 `firmware/sivy_asc_test` 的 Sivy-1 I2C 默认值快照进行设备侧和网页侧双重校验，避免旧固件参考值误导测试结论。
8. 用独立配置控件计算 `CH0..CH3` 的字段移位和掩码更新值，写入后自动读回并反解对应通道控件。
9. 提供带前置条件锁定的自动 bring-up 流程：Sivy BLE 连接、I2C 参考测试、仅 CH0 的 32 mV 配置与回读。
10. 在同一个页面通过 WebCodecs 解码显示 RIGOL H.264 实时画面。

本目录从正式 `tools/asc_web_console` 复制而来，但测试专用协议只适用于
`Sivy_ASC_Test`。正式 `Sivy_ASC_V0` 固件不实现该协议，必须使用正式网页。

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

自动测试按钮固定以 `namePrefix: "Sivy"` 打开浏览器原生选择器，并在连接前再次
校验设备名。Web Bluetooth 通常不把蓝牙 MAC 地址暴露给页面，`requestDevice()`
的 filter 也不支持 MAC 地址；如果某浏览器的 `device.id` 确实以标准 MAC 格式
返回，页面会再与 `C3:09:E1:7D:0D:08` 比对。无法取得地址时，目标地址只显示给
操作员在浏览器选择器中核对，不能在纯网页中自动锁定。该限制不允许通过脚本绕过。

## 自动 bring-up 状态机

自动流程只在一个按钮点击后编排现有 BLE/寄存器函数，不新增固件协议：

| 步骤 | 进入下一步条件 | 中止条件 |
| --- | --- | --- |
| 连接 | 浏览器返回的设备名以 `Sivy` 开头，GATT 服务就绪。 | 用户取消、连接错误、服务缺失或名称不符。 |
| I2C 参考测试 | 收到 29 项汇总，I2C 错误为 0，网页与固件参考表一致。 | I2C 错误、结果不完整、未知状态或参考表版本不一致。 |
| CH0 配置 | 确认位已勾选，VTH 为 `32 mV`，四个寄存器写入及可写位回读全部通过。 | 任一项写入失败或回读位域不匹配。 |

只有实际寄存器数值不同而桥接通信正常时，第二步骤显示警告并继续；这是因为当前
需求明确允许数值差异。参考表不一致不是普通数值差异，不能被当作可忽略警告。前序
失败后，后续步骤标记为锁定且不发送写请求。流程结束后在顶部保留每步状态和最终
汇总，同时继续使用下方原有结果表和事件日志。

## 实时波形接入

实时面板默认复用 `ADC_DATA` notification 的 CH0/CH1 BLE 采样，不伪装成示波器。
外部示波器目标为 RIGOL MHO 5054，默认 IP 为 `192.168.110.10`，MAC
`00:19:AF:AD:06:A4` 只用于人工核对。浏览器没有原始 TCP、VXI-11/HiSLIP 或 SCPI
客户端，因此随项目提供 `scope_bridge.py` 在本机连接示波器实际开放的 SCPI 端口 `5025`，
每周期执行 `:DISPlay:DATA? JPG`，解析 TMC 二进制块并把截图通过
`ws://127.0.0.1:8765/scope` 推送到网页。网页同时支持 JSON 波形帧，便于后续增加
原始通道数据。

当前系统不包含信号发生器驱动，也不向 MHO 5054 发送改变量程、时基或触发的配置
命令，只读取当前屏幕。这样“实时画面”不会修改仪器原有设置。网页提供全屏显示，
并通过浏览器 Fullscreen API 放大示波器画面区。

RIGOL Web Control 使用 H.264 WebSocket 屏幕共享端口 `9001`。本地桥把该二进制的
Annex-B 视频帧转发到 `/video`，网页使用 Chromium 原生 WebCodecs `VideoDecoder`
解码并绘制到现有 canvas，因此无需打开原厂页面即可保持接近原厂帧率。JPEG
截图路径保留在桥程序中，但不在默认界面展示。页面不再订阅 ASC `ADC_DATA` BLE 通知，避免无用采样占用
蓝牙链路带宽；BLE 只保留状态、配置和寄存器测试所需特征。

数据桥支持 `--access-key` 或 `SIVY_BRIDGE_KEY` 共享密钥；网页的连接参数会附加到
`/video`、`/scope` 和 `/generator` WebSocket URL。对公网部署，桥应只监听
`127.0.0.1`，由具备有效证书的 HTTPS 反向代理暴露 `wss://`，页面同时填写 WSS
地址和密钥。直接监听非回环地址时，程序默认拒绝无密钥或无 TLS 的配置。共享密钥
只是基础门槛，生产环境仍应叠加 VPN、IP 白名单或完整账户认证。

## 信号发生器 DG4102

信号发生器使用同一本地桥的 `/generator` WebSocket 端点，桥程序通过 DG4102 的
LAN SCPI 端口 `5555` 建立独立 TCP 连接。网页默认地址 `192.168.110.11`、CH1、RAMP 50% 对称度（三角波）、
1 Vpp、1 kHz、高阻负载，并支持切换到 CH2、正弦、方波和脉冲。写入顺序为负载、
波形、幅值单位、幅值、零偏置、频率、波形附加参数和输出状态；随后查询 `*OPC?`
以及波形、幅值、频率、输出和负载进行验证。

方波和脉冲的占空比固定为 50%，三角波对称度固定为 50%，输出偏置固定为 0 V。
该区域只提供“应用并打开输出”“读取当前设置”和“关闭当前通道”，不参与现有
一键自动测试流程。

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
| `07` | SIVY_TEST_CTRL | write | 启动 Sivy-1 默认值快照或显式默认值写回。 |
| `08` | SIVY_TEST_RESULT | notify | 逐项返回 16-bit 寄存器结果并发送最终汇总。 |

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

默认 `Mask=0x0000`，因此写校验必须由测试人员显式填写非零 mask 后才能运行。网页不判断寄存器是否安全可写，安全寄存器和 mask 必须来自 `Sivy-1芯片寄存器表格_v4p4_20260710.xlsx`、设计报告或芯片设计确认。

## Sivy I2C Reference Test

测试专用 BLE 协议由 `firmware/sivy_asc_test` 实现，并使用以下 UUID：

```text
SIVY_TEST_CTRL   41534307-7a6d-4ef9-9c6b-5c5940000001
SIVY_TEST_RESULT 41534308-7a6d-4ef9-9c6b-5c5940000001
```

控制包固定为 2 bytes：`u8 seq`、`u8 opcode`。`0x01` 读取 29 个可读
寄存器并比较默认值；`0x02` 只在用户勾选确认后写入并回读
`PW_CTRL[0x38]=0x36DB`。Excel 定义的 `GLB_RST[0x08]` 是只写软复位，
因此不属于 29 项快照。

结果通知固定为 16 bytes little-endian：`seq`、`type`、`status`、`index`、
`reg`、reserved、`expected`、`actual`、`match_count`、`mismatch_count`、
`io_error_count`。网页不只显示固件上报的 `expected`：它还内置 Excel v4p4
的 29 项参考值。若设备仍上报旧的 `0x38=0x0000`，表格显示“固件期望值不一致”，
最终汇总为失败，CSV 同时保留网页期望值和固件期望值以便追溯。

## 四通道位域配置

四通道面板复用已存在的 `REG_REQ/REG_RSP` 特征（UUID 后缀 `05/06`），不新增
固件协议，也不修改 `tools/sivy_asc_test_console`。所有寄存器访问使用
`target=ASC I2C`、`width=16-bit`，写入使用 `UPDATE_BITS`：

| 通道 | `CTRL` | `FEAT` | `AVG_WORKWIN` | `AVG_WAITWIN` |
| --- | --- | --- | --- | --- |
| CH0 | `0x0E` | `0x10` | `0x12` | `0x14` |
| CH1 | `0x16` | `0x18` | `0x1A` | `0x1C` |
| CH2 | `0x1E` | `0x20` | `0x22` | `0x24` |
| CH3 | `0x26` | `0x28` | `0x2A` | `0x2C` |

每个通道使用相同的计算式和掩码：

| 寄存器类型 | value 计算 | mask |
| --- | --- | --- |
| `CHx_CTRL` | `CH_EN << 0 | PGA_GAIN << 2 | VTH << 8` | `0xFF3D` |
| `CHx_FEAT` | `FEAT_SEL << 0 | AVG_TRG_EN << 1 | AVG_TRG_HA << 2` | `0x000F` |
| `CHx_AVG_WORKWIN` | `WORK_WINDOW` | `0x0FFF` |
| `CHx_AVG_WAITWIN` | `WAIT_WINDOW` | `0x0FFF` |

页面实时展示 value、mask 与字段变量。写入流程必须先由用户确认，然后可选打开
ASC 外部电源，依次发送四个 `UPDATE_BITS` 请求，最后按相同地址读取。比较时仅
比较 mask 内的可写位；保留位不参与通过/失败判定。每个通道维护独立的控件、确认
开关、结果表和 CSV 数据。该通道全部四项读取成功时，页面只把实际位域反解回对应
通道控件。`AVG_TRG_HA=0b11` 是保留值，读回时显示带通道号的警告且不会被当作
可配置边沿写入。

Excel 为 `VTH[15:8]` 定义 `0x00..0xFF` 对应 `8..2048 mV`。页面只向用户显示和
接受 mV，使用精确换算：

```text
VTH_code = VTH_mV / 8 - 1
VTH_mV   = (VTH_code + 1) * 8
```

因此 VTH 输入范围为 `8..2048 mV`，且必须为 `8 mV` 的整数档；页面不会对任意
mV 输入静默取整，避免阈值与用户设置不一致。

## 时钟与频率位域控制

时钟与频率面板根据 Excel v4p4 提取 6 个寄存器中的相关字段，并继续复用
`REG_REQ/REG_RSP`、`target=ASC I2C`、`width=16-bit` 与 `UPDATE_BITS`：

| 寄存器 | 地址 | 控制字段 | mask |
| --- | --- | --- | --- |
| `GLB_CTRL0` | `0x00` | `CLK_SEL`、`SAMP_CTRL`、`CC_SEL` | `0x061D` |
| `GLB_CTRL1` | `0x02` | `CLK_IN_SEL`、`MC_SEL`、`SAMPSW_SEL`、`PLL_CLK_SEL` | `0x45FF` |
| `PLL_CTRL` | `0x04` | `PLL_EN`、`PLL_DICP`、`RES_PLL_CTR`、`PLL_DM/DN/DP`、`PLL_BYPASS`、`PLL_PW` | `0xFFFF` |
| `HSI_CTRL` | `0x06` | `HSI_EN`、`HSI_SEL`、`HSI_TRIM` | `0x1FFF` |
| `QSPI_CTRL` | `0x0A` | `SCLK_FRQ` | `0x0060` |
| `CO_CTRL` | `0x3A` | `COSEL` | `0x0038` |

`SAMP_CTRL=0..7` 分别映射 `1/2/3/4/5/6/10/20 MC` 的输出脉宽。
`MC_SEL` 只接受 `0`（不分频）或 `2..254` 的偶数分频值。`HSI_TRIM[10:0]`
拆成 5-bit 粗调和 6-bit 细调显示，同时保留合成 raw code 预览。

为避免先把主时钟切到尚未配置的源，写入顺序固定为：

```text
HSI_CTRL -> PLL_CTRL -> QSPI_CTRL -> CO_CTRL -> GLB_CTRL0 -> GLB_CTRL1
```

写 `HSI_CTRL` 后至少等待 `1 us`，再继续后续寄存器。全部写入完成后读取 6 个
寄存器，只比较各自 mask 内的位；读取操作也会把硬件值逐字段反解回控件。

PLL 区额外提供预计输出频率计算。选择 HSI 时使用 `HSI_SEL` 对应的 48/72 MHz
标称值（不估算 `HSI_TRIM` 偏移）；选择 ECLK/HSE 时使用用户填写、且不会写入
寄存器的外部输入 MHz 值。正常模式计算 `Fout = Fin * N / M / P`，旁路模式计算
`Fout = Fin`。

## PW_CTRL 功耗挡位控制

功耗控制面板同样复用 `REG_REQ/REG_RSP`，不新增 BLE 特征，也不修改
`tools/sivy_asc_test_console` 或 `firmware/sivy_asc_test`。Excel v4p4 定义的
`PW_CTRL`（旧名称 `CPW_CTRL`）位域如下：

| 字段 | 位段 | shift |
| --- | --- | --- |
| `PWR_CTL` | `[2:0]` | 0 |
| `PW_AMPIN` | `[5:3]` | 3 |
| `PW_PGA` | `[8:6]` | 6 |
| `PW_SAMPAMP` | `[11:9]` | 9 |
| `PW_COMP` | `[14:12]` | 12 |

网页给五个字段各提供一个独立 `level`（`0..7`）滑块：

```text
value = (pwr_ctl << 0) | (pw_ampin << 3) | (pw_pga << 6)
      | (pw_sampamp << 9) | (pw_comp << 12)
mask  = 0x7FFF
```

`level=0..7` 分别代表 `25%`、`50%`、`75%`、`100%`、`125%`、`150%`、`175%` 和
`200%` 的模拟功耗比例。`level=3` 的值为 `0x36DB`，也是 Excel 的默认值。写入请求
使用 `UPDATE_BITS`，因此保留的 bit 15 不变；写后读取 `0x38` 并只比较 `mask` 内的
位。读取时每个字段只更新对应滑块；页面不会再把不同挡位同步为一个共享值。

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

## 发布边界

本仓库的 GitHub Pages workflow 会从 `main` 部署该控制台。部署页面连接的是
`Sivy_ASC_Test` 测试固件，包含四通道、`PW_CTRL` 写入和 BLE OTA，因此仅限受控
bring-up 环境使用，不是生产设备管理后台。

Web Bluetooth 仍要求浏览器用户主动选择和授权设备，但公开部署前必须审查 BLE
写权限、OTA 权限和寄存器参考资料的发布范围。量产系统需要独立实现 pairing/bonding、
SMP 认证、私有签名密钥和固定分区表。
