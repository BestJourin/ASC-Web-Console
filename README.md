# Sivy ASC CH0 Test Console

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
- Complete writable CH0 controls for `CH0_CTRL[0x0E]`, `CH0_FEAT[0x10]`,
  `CH0_AVG_WORKWIN[0x12]`, and `CH0_AVG_WAITWIN[0x14]`. The console calculates
  bitfields, writes through `UPDATE_BITS`, decodes readback values, verifies
  writable bits only, and exports CSV results.
- A linked eight-level `PW_CTRL[0x38]` power controller for `PWR_CTL`,
  `PW_AMPIN`, `PW_PGA`, `PW_SAMPAMP`, and `PW_COMP`, including five-field
  visualization, protected masked writes, and readback verification.

## CH0 VTH Conversion

The CH0 VTH control uses millivolts rather than a raw register value. The
Sivy-1 register table defines `VTH[15:8]` as follows:

```text
raw code 0x00..0xFF = 8..2048 mV
VTH_code = VTH_mV / 8 - 1
VTH_mV   = (VTH_code + 1) * 8
```

The input therefore accepts only `8..2048 mV` in exact `8 mV` steps. The
browser does not silently round an entered threshold.

## PW_CTRL Levels

The linked power slider applies one code to all five writable three-bit power
fields. Levels `0..7` map to `25%`, `50%`, `75%`, `100%`, `125%`, `150%`,
`175%`, and `200%`. The default level is `3`, which produces `0x36DB`.

```text
value = (level << 0) | (level << 3) | (level << 6) | (level << 9) | (level << 12)
mask  = 0x7FFF
```

Bit 15 is reserved and is never changed by the masked update. If the device
reports different levels for the five fields, the console displays each actual
level and requires an explicit write before synchronizing them.

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
