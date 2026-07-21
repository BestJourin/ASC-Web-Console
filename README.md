# Sivy ASC CH1 寄存器控制台

这个目录是 `firmware/sivy_asc_test` 专用的 CH1 位域和 ASC 功耗配置 Web Bluetooth 上位机。它以 `tools/sivy_asc_test_console` 为基础复制而来，原测试网页不会被本目录修改。除保留原有配置、寄存器、采样、OTA 和默认值快照能力外，本页面新增 CH1 全部可写字段的控件化读写、位域预览、掩码更新和读回反解，以及 PW_CTRL 功耗挡位联动滑块。

## 固件与硬件配对

本网页只匹配 `firmware/sivy_asc_test`：设备广播名应为 `Sivy_ASC_Test`，ASC I2C 使用 `i2c22` 的 SCL `P1.11`、SDA `P1.12`、7-bit 地址 `0x78`。请先烧录测试固件，再使用本网页；若主板运行 `firmware/app`（`Sivy_ASC_V0`），请改用 `tools/asc_web_console`，否则会因缺少测试专用 BLE characteristic 而无法开始默认值快照。

## CH1 位域控制

“通道一”在本工具中严格指 Excel 的 `CH1`，使用以下四个 16-bit 寄存器，而不是采样曲线中的 `CH0`：

| 寄存器 | 地址 | 可写字段 | 掩码更新 |
| --- | --- | --- | --- |
| `CH1_CTRL` | `0x16` | `CH_EN[0]`、`PGA_GAIN[5:2]`、`VTH[15:8]` | `0xFF3D` |
| `CH1_FEAT` | `0x18` | `FEAT_SEL[0]`、`AVG_TRG_EN[1]`、`AVG_TRG_HA[3:2]` | `0x000F` |
| `CH1_AVG_WORKWIN` | `0x1A` | `WORK_WINDOW[11:0]` | `0x0FFF` |
| `CH1_AVG_WAITWIN` | `0x1C` | `WAIT_WINDOW[11:0]` | `0x0FFF` |

控件变更会立即显示四个计算值和掩码。读取按钮依次读取四个寄存器，并将有效位反解回控件；“写入并回读校验”使用 BLE `REG_REQ/REG_RSP` 的 `UPDATE_BITS`，只改掩码内字段并保留保留位。写入需要显式勾选确认，默认会先打开 ASC 外部电源；写入完成后自动读回比较掩码位，结果可导出 CSV。

`VTH` 输入框的单位是 mV，不再要求填写原始码。Excel 定义 `VTH[15:8]` 的编码
`0x00..0xFF` 对应 `8..2048 mV`，网页按 `VTH_code = VTH_mV / 8 - 1` 自动换算，
因此只接受 `8..2048 mV`、每步 `8 mV` 的整数档。读回时则按
`VTH_mV = (VTH_code + 1) × 8` 回填。`WORK_WINDOW` 和 `WAIT_WINDOW` 仍是 12-bit
原始计数值；窗口的实际时间单位以芯片规格和系统时钟配置为准，不由网页猜测。

## ASC 功耗控制器

“ASC 功耗控制器”面板控制 Excel 中的 `PW_CTRL`（旧 I2C 配置名为
`CPW_CTRL`）寄存器 `0x38`。它不是 MCU 的 `POWER_EN`，而是 ASC 芯片内五个
模拟模块的功耗比例控制。

| 字段 | 位段 | 对应模块 |
| --- | --- | --- |
| `PWR_CTL` | `[2:0]` | 全局功耗 |
| `PW_AMPIN` | `[5:3]` | 输入运放 |
| `PW_PGA` | `[8:6]` | PGA |
| `PW_SAMPAMP` | `[11:9]` | 采样运放 |
| `PW_COMP` | `[14:12]` | 比较器 |

一个滑块会让五个字段同步选择相同编码：`0b000` 到 `0b111` 分别对应 `25%`、`50%`、
`75%`、`100%`、`125%`、`150%`、`175%`、`200%`。默认第 3 档为 `100%`，五个字段
均为 `0b011`，组合值是 `0x36DB`。网页同步显示五路模块的实际挡位和填充比例，方便
直观看出当前读回状态。

写入通过 `REG_REQ/REG_RSP` 的 `UPDATE_BITS` 完成，掩码固定为 `0x7FFF`，因此
`bit 15` 始终保留。与 CH1 面板一样，写入前必须勾选确认，完成后自动读取并只比较
五个功耗字段。若读取到五个字段使用不同挡位，网页会逐路显示实际值、提示非联动状态，
并将滑块定位到 `PWR_CTL`；移动滑块并写入才会重新把五路同步为同一档位。

页面 logo 使用 `assets/sivy_logo.svg`，原始 DWG 源文件仅保存在私有项目的 `assets/source/sivylogo.dwg`，不会同步到公开 Web Console 仓库。

## 运行方式

Web Bluetooth 需要安全上下文。推荐在本目录启动本地 HTTP 服务：

```powershell
cd D:\Study\Share\ASC-Driven-ADC\tools\ASC-Web-Console
python -m http.server 8080
```

然后用 Chrome 或 Edge 打开：

```text
http://localhost:8080
```

`python -m http.server` 只提供 HTTP。不要把它的 `8080` 端口用
`https://` 打开；浏览器向 HTTP server 发送 TLS 握手时，终端会出现乱码和
`400 Bad request version`，这不代表页面代码出错。

### 本地 HTTPS

如需使用真实 HTTPS，使用本目录的 HTTPS 启动脚本。它默认只绑定本机
`127.0.0.1`，使用 `openssl` 生成本机专用 CA 和服务证书，并把证书及私钥
保存到已被 Git 忽略的 `.local-certs/` 目录。

首次运行需要显式信任该本机 CA；这个命令只向当前 Windows 用户的
`Trusted Root Certification Authorities` 导入新生成的 `Sivy ASC CH1 Local CA`：

```powershell
cd D:\Study\Share\ASC-Driven-ADC\tools\ASC-Web-Console
.\start-https.ps1 -TrustCertificate
```

之后每次启动 HTTPS 服务只需：

```powershell
.\start-https.ps1
```

浏览器打开：

```text
https://127.0.0.1:8443/
```

首次导入的 CA 只用于本机开发；不要复制 `.local-certs/`、私钥或 CA 到其他
设备或仓库。若只在当前电脑本地调试，`http://localhost:8080` 已被 Chrome/Edge
视为可信本地来源，通常不必启用 HTTPS。

本仓库的 `.github/workflows/pages.yml` 会在 `main` 更新后部署 GitHub Pages。
部署页面仍然只应连接受控实验环境中的 `Sivy_ASC_Test` 测试固件；它包含 CH1、
`PW_CTRL` 的写入能力和 BLE OTA，不能视为面向生产设备的公共管理后台。

网页蓝牙仍要求用户在浏览器中主动授权附近设备，网页本身不会绕过 BLE 连接权限。
但在公开部署前和每次固件升级后，都必须复核测试固件的 BLE 写权限、OTA 权限、
芯片参考资料和可发布范围；量产使用必须另行实施 pairing/bonding、SMP 认证、
签名密钥和固定分区表。

页面顶部会显示 `页面来源`、`安全上下文`、`Web Bluetooth` 和 `BLE 适配器`。只有安全上下文和 Web Bluetooth 都可用时，`连接设备` 按钮才会启用。

手机 BLE 支持矩阵：

| 平台 | 支持情况 | 说明 |
| --- | --- | --- |
| Android Chrome / Edge / Samsung Internet | 可以尝试使用 | 需要 HTTPS 页面，BLE 扫描使用手机本机蓝牙。 |
| iPhone / iPad Safari | 不支持 | iOS Safari 不暴露 Web Bluetooth。 |
| iPhone / iPad Chrome / Edge | 不支持 | iOS 第三方浏览器同样受 WebKit 限制，通常没有 Web Bluetooth。 |
| 桌面 Chrome / Edge | 推荐 | 最稳定，适合 OTA 和寄存器 bring-up。 |

## 设备选择方式

页面顶部提供三种 BLE 选择模式：

| 模式 | 用途 | 说明 |
| --- | --- | --- |
| `全部设备` | 默认 bring-up | 最宽松，浏览器选择器显示附近可连接 BLE 设备；连接后页面会校验 ASC service，没有该 service 会断开并提示重新选择。 |
| `名称前缀` | 目标广播名稳定时使用 | 使用前缀输入框过滤设备，默认 `Sivy_ASC_Test`。 |
| `目标服务` | 窄范围过滤 | 按 ASC service、SMP service、`Sivy_ASC_Test` 精确名和前缀做兜底过滤。不同浏览器对 scan response 解析不一致；若搜不到，切回 `全部设备`。 |

Web Bluetooth 的设备列表由浏览器弹窗管理，网页不能像手机 BLE scanner 一样无限制后台扫描。如果弹窗里没有目标设备，先确认板子正在 advertising、没有被手机或 nRF Connect 占用连接，再保持 `全部设备` 模式重试。

## 固件要求

- 测试固件默认设备名：`Sivy_ASC_Test`；若改名，网页仍可通过 `目标服务` 或 `全部设备` 模式连接。
- ASC service UUID：`41534300-7a6d-4ef9-9c6b-5c5940000001`。
- STATUS characteristic：`41534301-7a6d-4ef9-9c6b-5c5940000001`，read/notify。
- CTRL_CMD characteristic：`41534302-7a6d-4ef9-9c6b-5c5940000001`，write。
- CONFIG characteristic：`41534303-7a6d-4ef9-9c6b-5c5940000001`，read/write。
- ADC_DATA characteristic：`41534304-7a6d-4ef9-9c6b-5c5940000001`，notify。
- REG_REQ characteristic：`41534305-7a6d-4ef9-9c6b-5c5940000001`，write。
- REG_RSP characteristic：`41534306-7a6d-4ef9-9c6b-5c5940000001`，notify。
- SIVY_TEST_CTRL characteristic：`41534307-7a6d-4ef9-9c6b-5c5940000001`，write。
- SIVY_TEST_RESULT characteristic：`41534308-7a6d-4ef9-9c6b-5c5940000001`，notify。
- OTA service：Zephyr MCUmgr SMP over BLE，service UUID `8d53dc1d-1db7-4cd3-868b-8a527460aa84`。

## complete-app-features 页面能力

当前页面对应 `complete-app-features` 固件分支，除原有 DAC、采样曲线和 OTA 外，新增以下调试能力：

| 面板 | 功能 |
| --- | --- |
| 状态 | 显示 power、BLE、LED、ADC/DAC/I2C 计数、app state、profile 状态、采样队列深度、BLE 拥塞和 sample drop。 |
| 参数 | 写入 44-byte CONFIG，包含输入模式、ADC_DATA notify 开关、UART Sample Log 开关、DAC A/B/C/D mV 和 ASC profile shadow。 |
| ASC Profile | 编辑 8 组 ASC 16-bit register profile entry；只有打开 `Enable register profile` 且 entry enabled 后，`Apply Config` / `Start Arm` / `Apply Profile` 才会写 ASC I2C。 |
| Register | 发送 `REG_REQ`，支持 ASC I2C、DAC Config、MCU Status、Diagnostics、ASC Profile target。 |
| ASC Register Test | 面向 Sivy-1 回片测试，支持 ASC I2C 寄存器列表读取、可选安全 masked 写入校验、自动恢复和 CSV 结果导出。 |
| Sivy I2C Reference Test | 写入测试控制包后，由固件读取参考 `.i2c` 配置中的 29 个寄存器、完成设备侧比较并通知每项结果与最终 PASS/FAIL 汇总。 |
| ASC 功耗控制器 | 使用一个八档联动滑块配置 `PW_CTRL[0x38]` 的五个模拟功耗字段，实时可视化、掩码写入、回读校验并支持 CSV 导出。 |
| 采样 | 订阅 `ADC_DATA` notification，并显示 CH0/CH1 曲线；固件侧有 16 帧 ring buffer。 |
| OTA | 读取本地 `.bin` 或 `dfu_application.zip`，通过标准 SMP characteristic 上传并标记 test boot。 |

`Register` 面板的 32-bit 诊断计数使用固件约定的 `REG_RSP.mask:high16 + REG_RSP.value:low16` 组合显示。选择 `Diagnostics` target 时页面会自动把 width 切换为 32-bit。

## 推荐测试顺序

1. 选择扫描范围：默认用 `全部设备`；若现场 BLE 设备很多，可以切到 `名称前缀` + `Sivy_ASC` 或 `目标服务`。
2. 点击 `Connect`，在浏览器 BLE 选择器里选择目标设备。
3. 点击 `Read Config` 和 `Refresh`，确认 STATUS 可读。
4. 点击 `Power On`、`DAC Probe`、`Default` 或 `Apply DAC`，确认 DAC 仍正常。
5. 点击 `Start Arm`，确认 `APP STATE` 变为 `armed`。
6. 点击 `CH0` / `CH1`，确认采样曲线、最新 sample 文本和 `ADC OK` 增长；连续触发或 100 Hz 压力测试前，可先关闭 `UART Sample Log` 并写入配置，避免串口每点日志拖慢采样链路。
7. 在 `Register` 面板读取 `ASC I2C addr=0x00 width=16-bit`，或读取 `Diagnostics addr=0 width=32-bit`。
8. 在 `Sivy I2C Reference Test` 面板点击 `Run Read-only Snapshot`，等待固件回传 29 项结果和最终 PASS/FAIL。网页会以 Excel 内置参考表复核通知中的期望值；例如 `0x38` 必须为 `0x36DB`。若设备仍回传旧期望值，页面会明确报出“固件期望值不一致”，不能视为通过；`Export CSV` 会同时记录网页和固件期望值。
9. 在 `ASC 功耗控制器` 中先点击“读取并反解”，确认五个功耗字段均为默认 `100%`；需要调整时拖动滑块，勾选确认后点击“应用挡位并回读”。调整挡位会改变 ASC 模拟模块的电流与性能，必须结合实际硬件测量验证。
9. 只有在确认恢复默认功耗配置安全后，勾选允许写入选项并执行“执行选定的初始化写入”；该操作写入 `PW_CTRL（CPW_CTRL）[0x38] = 0x36DB`，页面会显示设备回读验证结果。
10. 在 `ASC Register Test` 面板执行 `Basic Reads`，可对单独寄存器做进一步测试；若寄存器表已确认某字段安全可写，再打开 `Enable Write Verify`。
11. 如需 profile，先填写 profile entry，再打开 enable，点击 `Apply Profile` 或 `Apply Config`，然后在 `ASC Register Test` 中选择 `Current Profile` 回读归档。

ASC 回片寄存器测试的完整流程见 [ASC_Chip_Register_Bringup_Test.md](../../docs/04_test/ASC_Chip_Register_Bringup_Test.md)。

## OTA 文件

页面支持两种输入：

- `build_ota/app/zephyr/zephyr.signed.bin`
- `build_ota/dfu_application.zip`

选择 zip 时，页面会在浏览器本地解析 zip，并优先根据 `manifest.json` 找到 `.bin`；如果没有 manifest，则使用 zip 中第一个 `.bin` 文件。

选择 OTA 文件后，页面会解析 MCUboot image header，并在文件大小旁显示版本号，例如 `266.3 KiB / v0.1.1+0`；事件日志也会显示 `Web Console build ...` 和所选文件的修改时间。重新 build 后必须重新选择新的 `dfu_application.zip`，如果仍显示旧版本或日志里没有当前 Web Console build，先按 `Ctrl+F5` 强制刷新页面。当前 `len=64` hash 支持对应的页面版本为 `20260629-public-ble-access`。

OTA 进度条按真实字节数推进，状态文字会依次显示 `ready`、`hashing image`、`sending chunk @ ...`、`uploading`、`reading image state`、`marking test boot` 和 `complete - press Reset to boot test image`。上传到 100% 后，页面会先读取设备返回的 image state，并使用非 active slot 的 MCUboot image hash 写入 test boot；不要用本地文件 SHA256 直接判断 test boot hash。当前页面接受 MCUboot 返回的 32/48/64 字节 image hash，其中 ED25519/SHA512 配置通常返回 64 字节 hash。

OTA 完成状态按以下方式判断：

| 页面状态 | 含义 | 下一步 |
| --- | --- | --- |
| `complete - press Reset to boot test image` | 镜像已上传到 secondary slot，并已写入 test boot。 | 点击 `Reset`，等待设备重启并重新广播，再重新连接。 |
| `complete - image matches active; no test boot marked` | 上传传输完成，但 secondary slot 的 hash 与当前 active slot 完全相同；MCUmgr 无法通过 hash 区分 slot0/slot1，因此不标记 test boot。 | 修改固件内容或递增 MCUboot image version 后重新 build/sign，再上传新的 `dfu_application.zip`。 |

如果需要从 `0.1.1` 回刷到 `0.1.0`，页面会在上传后看到类似 `slot=0 version=0.1.1 active,confirmed ... | slot=1 version=0.1.0 idle ... len=64` 的状态；只要 slot1 hash 与 active hash 不同，页面会使用 slot1 的完整 hash 写入 test boot。若后续 reset 后仍未进入旧版本，再检查 MCUboot 是否启用了 downgrade prevention。

若看到 `No non-active bootable image hash found in image state`，但 image state 中确实存在 `slot=1 ... idle ... len=64`，说明浏览器大概率仍在使用旧脚本；强制刷新并确认事件日志中的 Web Console build 为 `20260629-public-ble-access` 或更新版本。

当前 OTA image version 在 [firmware/app/prj.conf](../../firmware/app/prj.conf) 中配置：

```conf
CONFIG_MCUBOOT_IMGTOOL_SIGN_VERSION="0.1.1+0"
```

需要验证真正的 reboot swap 时，将它递增为例如 `"0.1.2+0"` 后重新构建 OTA 包。注意 [firmware/app/src/ble/asc_ble.h](../../firmware/app/src/ble/asc_ble.h) 中的 `ASC_BLE_PROTOCOL_VERSION` 是 ASC 自定义 GATT 协议版本，不是 MCUboot OTA 镜像版本。

点击 `Reset` 进入新镜像后，应用启动成功会由固件调用 `boot_write_img_confirmed()` 确认镜像。

## 当前限制

- Web Bluetooth 主要支持 Chrome/Edge 桌面版；iOS Safari 不支持。
- 浏览器不能直接访问串口日志，低层错误仍需要串口辅助判断。
- OTA 分块当前使用 128 bytes，优先保证兼容性，速度不是最大化。
- MCUmgr SMP 当前 bring-up 配置未启用认证，量产前必须改为认证/加密并替换 MCUboot signing key。
