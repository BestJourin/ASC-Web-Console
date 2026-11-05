# Sivy ASC Register Console

This repository publishes the Web Bluetooth console for the Sivy-1 ASC
register bring-up firmware. The live page is available at:

```text
https://bestjourin.github.io/ASC-Web-Console/
```

The console connects to `firmware/sivy_asc_test`, whose default BLE name is
`Sivy_ASC_Test`. It is a laboratory bring-up tool, not a production device
management portal.

## Language

The page starts in English. Use the **Language** selector in the header to
switch between a complete English view and a complete Chinese view. The
selected language is stored only in the browser's local storage.

## Features

- Web Bluetooth device selection, connection state, runtime checks, logs, and
  localized error messages.
- Status and configuration access, DAC control, ASC profile editing, generic
  `REG_REQ` / `REG_RSP` operations, and BLE OTA.
- Sivy I2C reference testing: a 29-register read-only snapshot, device-side
  PASS/FAIL reporting, CSV export, and the guarded default
  `PW_CTRL[0x38] = 0x36DB` initialization write.
- Complete independent writable controls for CH0 through CH3. Each channel
  exposes `CTRL`, `FEAT`, `AVG_WORKWIN`, and `AVG_WAITWIN`, calculates its own
  bitfields, writes through `UPDATE_BITS`, decodes readback values, verifies
  writable bits only, and exports a channel-specific CSV.
- Clock and frequency controls for `GLB_CTRL0[0x00]`, `GLB_CTRL1[0x02]`,
  `PLL_CTRL[0x04]`, `HSI_CTRL[0x06]`, `QSPI_CTRL[0x0A]`, and `CO_CTRL[0x3A]`,
  including main/PLL source selection, HSI and PLL tuning, MC/QSPI dividers,
  output pulse width, bandwidth selection, and clock output routing.
- Five independent eight-level `PW_CTRL[0x38]` power controls for `PWR_CTL`,
  `PW_AMPIN`, `PW_PGA`, `PW_SAMPAMP`, and `PW_COMP`, with protected masked
  writes and per-field readback decoding.
- A guarded one-click bring-up workflow that connects a Sivy-prefixed BLE
  device, runs the 29-register I2C reference test, configures only CH0 to a
  32 mV threshold, and verifies the four CH0 registers.
- A native H.264 live-screen view for the RIGOL MHO 5054, decoded in the web
  page through WebCodecs.
- Explicit RIGOL DG4102 signal-generator setup for CH1 or CH2, triangle,
  sine, square, or pulse output, with configurable Vpp, frequency, and load.

## Opening the Published Console

After this branch is merged and deployed, open the public page directly in
desktop Chrome or Edge:

```text
https://bestjourin.github.io/ASC-Web-Console/
```

No local Python server is needed. GitHub Pages already serves the page over
HTTPS, which satisfies the browser's Web Bluetooth secure-context requirement.
The local `http.server` command is only needed when previewing changes that
have not yet been published. Changes made in this branch are not visible at
the public URL until they are pushed, merged, and deployed by GitHub Actions.

The one exception is the real RIGOL oscilloscope screen. A public web page
cannot open the oscilloscope's raw TCP/SCPI connection, so a small local bridge
must be running on the test PC. Bluetooth, the I2C test, and CH0 configuration
still work without that bridge.

## One-Click Bring-Up

The workflow intentionally stops if a prerequisite fails:

| Step | Completion rule | Failure behavior |
| --- | --- | --- |
| BLE connection | The browser picker returns a device whose advertised name starts with `Sivy`. | No later step runs. |
| I2C reference test | All 29 results are received, with zero I2C errors and a reference table matching the web console. | Numeric value-only mismatches produce a warning and continue. Communication, incomplete, unknown, or firmware-reference failures stop the workflow. |
| CH0 configuration | Confirm-write is selected, VTH is set to `32 mV`, and all four masked writes read back correctly. | CH1 through CH3 are not written. A write or readback mismatch stops with a failure result. |

The primary action is **一键连接并测试** near the top of the page. It opens the
browser-native Bluetooth picker with the `Sivy` name prefix. Web Bluetooth
requires this one user selection. Browsers normally do not expose the selected
device's Bluetooth MAC address, and `requestDevice()` cannot filter by address.
If a browser returns an address in MAC format, the workflow additionally
checks it against the target. Otherwise the target address
`C3:09:E1:7D:0D:08` is shown so the operator can verify it in the browser
picker.

## RIGOL MHO 5054 Live Screen

The configured instrument is a RIGOL MHO 5054:

```text
IP:  192.168.110.10
MAC: 00:19:AF:AD:06:A4
```

The IP address is used for the network connection. The MAC address is for
operator verification only.

For the normal local setup, the bridge runs on the same computer as the browser
and the address stays `ws://127.0.0.1:8765`; when moving to another network,
normally only the instrument IPs need to change. The test PC must be able to
ping and reach those IPs, either directly or over the organization's VPN.

Opening the published GitHub Pages console from anywhere does not remove the
need for a bridge: the public page cannot open the oscilloscope's TCP video or
SCPI ports directly. The bridge may run locally or as a permanent lab gateway.

### Bridge Access Key And Public Deployment

The page includes an **访问密钥** field and a configurable data-bridge URL.
Every `/video`, `/scope`, and `/generator` WebSocket request includes that key
when one is entered.

For a public lab gateway, use a reverse proxy with a valid TLS certificate and
bind the bridge only to loopback:

```powershell
$env:SIVY_BRIDGE_KEY = "replace-with-a-long-random-secret"
python scope_bridge.py --bind 127.0.0.1 --port 8765 `
  --scope-ip 192.168.110.10 --scope-port 5025
```

Publish only the `wss://bridge.example.com` endpoint through the HTTPS reverse
proxy. In the web page, enter that WSS address and the same access key.

A direct TLS bind is also supported:

```powershell
python scope_bridge.py --bind 0.0.0.0 --port 8765 `
  --tls-cert bridge-cert.pem --tls-key bridge-key.pem `
  --access-key "replace-with-a-long-random-secret"
```

Do not expose the instrument ports `9001`, `5025`, or `5555`, and do not expose
the bridge as unencrypted remote `ws://`. The bridge refuses a non-loopback
plain-WS bind by default. The access key is a basic shared secret, not a
multi-user account system; use VPN/IP allowlists or additional authentication
for a production lab deployment.

Browsers are not allowed to launch a local executable from a web page. Start
`start-scope-bridge.cmd` manually on the test PC and keep its window open while
using the oscilloscope or generator. The project does not install a Windows
login/startup task.

To show the oscilloscope screen:

1. Connect the MHO 5054 and test PC to the same LAN.
2. Double-click `start-scope-bridge.cmd` on the test PC and keep its window
   open.
3. In the web page's **实时波形监视** panel, keep
   **RIGOL 高帧率实时画面** selected.
4. Confirm the IP address and click **连接示波器**. The page normally reaches
   the original instrument frame rate.
5. Use **全屏显示** to maximize the instrument screen.

The bridge relays the RIGOL H.264 WebSocket stream on port `9001`; the browser
decodes it with the native WebCodecs API. The bridge uses only the Python
standard library. It is restricted to the public console origin and local
development origins. A custom origin can be added with `--allowed-origin`.

The default local bridge base address is:

```text
ws://127.0.0.1:8765
```

The page no longer subscribes to the ASC `ADC_DATA` BLE notification, so
routine BLE bandwidth is not consumed by unused debug samples. A generic
waveform message remains available for future numeric-waveform sources:

Waveform message:

```json
{
  "type": "waveform",
  "unit": "V",
  "channels": [
    {
      "name": "CH1",
      "xStart": 0,
      "xStep": 0.000001,
      "samples": [0.0, 0.5, 1.0, 0.5, 0.0]
    }
  ]
}
```

Screenshot message:

```json
{
  "type": "screenshot",
  "mimeType": "image/png",
  "data": "<base64 PNG bytes>"
}
```

`channels[].points` may also be used instead of `samples`; points can be
objects such as `{"x": 0, "y": 1.2}` or two-element arrays such as `[0, 1.2]`.

## RIGOL DG4102 Signal Generator

The signal-generator section is independent from the one-click bring-up flow.
The default DG4102 address is `192.168.110.11`; the SCPI connection and
instrument identity were verified against the physical instrument. Choose a
channel and waveform, set amplitude and frequency, then click
**应用并打开输出**. The bridge sends the complete SCPI configuration over this
device's LAN socket port `5555` and reads the settings back.

Defaults:

| Setting | Default |
| --- | --- |
| Channel | CH1 |
| Waveform | Triangle |
| Amplitude | 1 Vpp |
| Frequency | 1 kHz |
| Output load | High-Z |
| Output state | On after Apply |

Available waveforms are triangle, sine, square, and pulse. Square and pulse use
a 50% duty cycle; triangle uses 50% ramp symmetry. Offset is set to 0 V. A
separate **关闭当前通道** action disables output without changing the waveform
settings.

The test PC must be able to reach `192.168.110.11`. If the instrument address
changes on another network, update it in the page. Generator control remains
intentionally separate from the automated BLE/I2C/CH0 workflow.

The page does not include VXI-11 or HiSLIP drivers. The included bridge uses
the RIGOL raw SCPI socket for screenshots. Signal-generator control is outside
the current scope.

If raw channel samples are needed later, the bridge can be extended with:

| Item | Needed detail |
| --- | --- |
| Instrument identity | Exact oscilloscope brand and model number. |
| Network access | Instrument IP address, bridge PC address, ports, subnet/VLAN rules, and any login credentials. |
| Command protocol | Vendor SCPI command reference or another documented API, including the oscilloscope trace or screenshot query. |
| Data mapping | Scope channel-to-EVB mapping, voltage/current units, timebase, sample format, and whether the live view should use raw trace data or screenshots. |

The bridge keeps raw SCPI out of the public GitHub Pages frontend. The current
implementation prioritizes the full instrument screenshot; numeric waveform
decoding can be added without changing the public page.

## Four-Channel Register Controls

The channel panel maps the same writable fields independently across all four
register groups:

| Channel | `CTRL` | `FEAT` | `AVG_WORKWIN` | `AVG_WAITWIN` |
| --- | --- | --- | --- | --- |
| CH0 | `0x0E` | `0x10` | `0x12` | `0x14` |
| CH1 | `0x16` | `0x18` | `0x1A` | `0x1C` |
| CH2 | `0x1E` | `0x20` | `0x22` | `0x24` |
| CH3 | `0x26` | `0x28` | `0x2A` | `0x2C` |

Each VTH control uses millivolts rather than a raw register value. The Sivy-1
register table defines `VTH[15:8]` as follows:

```text
raw code 0x00..0xFF = 8..2048 mV
VTH_code = VTH_mV / 8 - 1
VTH_mV   = (VTH_code + 1) * 8
```

The input therefore accepts only `8..2048 mV` in exact `8 mV` steps. The
browser does not silently round an entered threshold.

## Clock and Frequency Controls

The frequency panel maps the v4p4 register table fields without changing the
firmware protocol. It uses the existing 16-bit ASC `REG_REQ` / `REG_RSP`
transport and updates only these masks:

| Register | Address | Controlled fields | Mask |
| --- | --- | --- | --- |
| `GLB_CTRL0` | `0x00` | `CLK_SEL`, `SAMP_CTRL`, `CC_SEL` | `0x061D` |
| `GLB_CTRL1` | `0x02` | `CLK_IN_SEL`, `MC_SEL`, `SAMPSW_SEL`, `PLL_CLK_SEL` | `0x45FF` |
| `PLL_CTRL` | `0x04` | all PLL fields | `0xFFFF` |
| `HSI_CTRL` | `0x06` | `HSI_EN`, `HSI_SEL`, `HSI_TRIM` | `0x1FFF` |
| `QSPI_CTRL` | `0x0A` | `SCLK_FRQ` | `0x0060` |
| `CO_CTRL` | `0x3A` | `COSEL` | `0x0038` |

`SAMP_CTRL=0..7` maps to output pulse widths of `1`, `2`, `3`, `4`, `5`, `6`,
`10`, and `20` MC cycles. `MC_SEL` accepts `0` for no division or an even
divider from `2` through `254`. HSI trim is exposed as an independent 5-bit
coarse code and 6-bit fine code that combine into `HSI_TRIM[10:0]`.

Writes configure HSI and PLL before changing the main source selection in
`GLB_CTRL1`. The panel then reads all six registers back and compares only the
controlled mask bits.

The PLL section also calculates an estimated numeric output frequency. HSI
input uses the selected nominal 48 or 72 MHz value and explicitly excludes the
unknown trim offset. ECLK/HSE input uses a user-supplied MHz value that is only
used by the calculator and is never written to a register. Normal mode applies
the selected M/N/P ratio; bypass mode reports the input frequency directly.

## PW_CTRL Levels

Each writable three-bit power field has its own slider. Levels `0..7` map to
`25%`, `50%`, `75%`, `100%`, `125%`, `150%`, `175%`, and `200%`. All five
fields default to level `3`, which produces `0x36DB`.

```text
value = (pwr_ctl << 0) | (pw_ampin << 3) | (pw_pga << 6)
      | (pw_sampamp << 9) | (pw_comp << 12)
mask  = 0x7FFF
```

Bit 15 is reserved and is never changed by the masked update. Readback decodes
each field into its corresponding slider, so different hardware levels remain
independent instead of being synchronized to one shared control.

## Browser and Firmware Requirements

- Use desktop Chrome or Edge, or an Android browser with Web Bluetooth support.
  iPhone and iPad browsers do not expose Web Bluetooth.
- GitHub Pages provides HTTPS. For local development, `http://localhost` is
  also a secure context for Web Bluetooth in Chrome and Edge.
- Flash `firmware/sivy_asc_test` and verify that the device is advertising as
  `Sivy_ASC_Test`. The ASC I2C connection uses `i2c22`, SCL `P1.11`, SDA
  `P1.12`, and 7-bit device address `0x78`.

## Local Development

```powershell
git clone https://github.com/BestJourin/ASC-Web-Console.git
cd ASC-Web-Console
python -m http.server 8080
```

Open `http://localhost:8080/` in Chrome or Edge. For a local HTTPS endpoint,
run the included script once to trust its development CA and then start the
server:

```powershell
.\start-https.ps1 -TrustCertificate
.\start-https.ps1
```

Open `https://127.0.0.1:8443/`. The generated `.local-certs/` directory holds
local certificate private keys and must never be committed or shared.

## Publishing and Safety

The GitHub Actions workflow in `.github/workflows/pages.yml` deploys the
repository's `main` branch to GitHub Pages. This console can write ASC
registers and trigger BLE OTA operations after a browser user explicitly
selects a nearby device. Use it only with authorized test hardware.

Before a firmware release, review BLE write permissions, OTA permissions,
register-reference publication scope, and all board-level safety constraints.
Production deployments require separate pairing/bonding, SMP authentication,
private signing keys, and a fixed partition layout.
