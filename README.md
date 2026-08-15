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
- Status and configuration access, DAC control, sampling visualization, ASC
  profile editing, generic `REG_REQ` / `REG_RSP` operations, and BLE OTA.
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
