'use strict';

const WEB_CONSOLE_BUILD = '20260629-public-ble-access';

const UUIDS = {
  ascService: '41534300-7a6d-4ef9-9c6b-5c5940000001',
  status: '41534301-7a6d-4ef9-9c6b-5c5940000001',
  ctrl: '41534302-7a6d-4ef9-9c6b-5c5940000001',
  config: '41534303-7a6d-4ef9-9c6b-5c5940000001',
  adcData: '41534304-7a6d-4ef9-9c6b-5c5940000001',
  regReq: '41534305-7a6d-4ef9-9c6b-5c5940000001',
  regRsp: '41534306-7a6d-4ef9-9c6b-5c5940000001',
  smpService: '8d53dc1d-1db7-4cd3-868b-8a527460aa84',
  smpChar: 'da2e7828-fbce-4e01-ae9e-261174997c48',
};

const DEFAULT_NAME_PREFIX = 'Sivy_ASC';
const DEFAULT_DEVICE_NAME = 'Sivy_ASC_V0';
const DEFAULT_FILTER_MODE = 'allDevices';

const CTRL = {
  POWER_OFF: 0x01,
  POWER_ON: 0x02,
  APPLY_DAC: 0x03,
  APPLY_CONFIG: 0x04,
  FORCE_SAMPLE: 0x05,
  RESET_EXT: 0x06,
  CLEAR_DIAG: 0x07,
  DAC_DEFAULT: 0x08,
  DAC_PROBE: 0x09,
  START_ARM: 0x0a,
  STOP_ARM: 0x0b,
  ENTER_LOW_POWER: 0x0c,
  SAVE_SETTINGS: 0x0d,
  APPLY_PROFILE: 0x0e,
};

const REG = {
  READ: 0x01,
  WRITE: 0x02,
  UPDATE_BITS: 0x03,
  OK: 0x00,
};

const REG_STATUS_NAMES = [
  'OK',
  'INVALID_PARAM',
  'INVALID_STATE',
  'UNSUPPORTED',
  'IO_ERROR',
  'DENIED',
];

const ASC_REG_TEST_PRESETS = {
  basic: [0x00, 0x08, 0x10, 0x11, 0x12, 0x13, 0x20, 0x21],
};

const SMP = {
  OP_READ: 0,
  OP_WRITE: 2,
  GROUP_OS: 0,
  GROUP_IMAGE: 1,
  IMG_STATE: 0,
  IMG_UPLOAD: 1,
  OS_RESET: 5,
};

const SMP_RC_NAMES = {
  1: 'UNKNOWN',
  2: 'NO_MEMORY',
  3: 'INVALID_ARGUMENT',
  4: 'TIMEOUT',
  5: 'NO_ENTRY',
  6: 'BAD_STATE',
  7: 'RESPONSE_TOO_LARGE',
  8: 'NOT_SUPPORTED',
  9: 'CORRUPT',
  10: 'BUSY',
  11: 'ACCESS_DENIED',
};

const state = {
  device: null,
  server: null,
  chars: {},
  smp: null,
  ctrlSeq: 0,
  regSeq: 0,
  pendingReg: new Map(),
  config: {
    version: 1,
    inputMode: 0,
    notify: true,
    sampleLog: true,
    dac: [1750, 1550, 1650, 1650],
    sampleIntervalMs: 0,
    profile: {
      enable: false,
      verify: true,
      entries: Array.from({ length: 8 }, (_, index) => ({
        enabled: false,
        reg: [0x00, 0x08, 0x10, 0x11, 0x12, 0x13, 0x20, 0x21][index],
        value: 0,
      })),
    },
  },
  samples: [],
  ascRegTestRows: [],
  otaBytes: null,
  otaName: '',
  otaInfo: null,
  otaSourceModifiedMs: 0,
  bluetoothReady: false,
};

const $ = (id) => document.getElementById(id);
const logView = $('logView');
const canvas = $('sampleCanvas');
const ctx = canvas.getContext('2d');

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logView.textContent = `${line}\n${logView.textContent}`.slice(0, 12000);
}

function setConnected(connected) {
  $('connectionDot').classList.toggle('connected', connected);
  $('connectionText').textContent = connected ? '已连接' : '未连接';
  const alwaysEnabled = new Set(['clearLogBtn', 'ascTestClearBtn', 'ascTestExportBtn']);
  for (const button of document.querySelectorAll('button')) {
    if (button.id !== 'connectBtn') {
      button.disabled = !connected && !alwaysEnabled.has(button.id);
    }
  }
  $('connectBtn').disabled = connected || !state.bluetoothReady;
}

function setRuntimeItem(id, value, level = 'ok') {
  const valueEl = $(id);
  const item = valueEl?.closest('.runtime-item');
  if (!valueEl || !item) return;
  valueEl.textContent = value;
  item.classList.remove('ok', 'warn', 'error');
  item.classList.add(level);
}

function runtimeOriginLabel() {
  if (location.protocol === 'file:') return '本地文件';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1') return 'localhost';
  if (location.protocol === 'https:') return 'HTTPS';
  if (location.protocol === 'http:') return 'HTTP';
  return location.protocol.replace(':', '') || '--';
}

function updateRuntimeEnvironment() {
  const secure = window.isSecureContext === true;
  const hasBluetooth = !!navigator.bluetooth;
  const origin = runtimeOriginLabel();
  const insecureHttp = location.protocol === 'http:' && origin !== 'localhost';
  const localFile = location.protocol === 'file:';

  state.bluetoothReady = secure && hasBluetooth && !localFile;
  setRuntimeItem('runtimeOrigin', origin, insecureHttp || localFile ? 'warn' : 'ok');
  setRuntimeItem('runtimeSecurity', secure && !localFile ? '可用' : '不可用', secure && !localFile ? 'ok' : 'error');
  setRuntimeItem('runtimeBluetooth', hasBluetooth ? '可用' : '不可用', hasBluetooth ? 'ok' : 'error');
  setRuntimeItem('runtimeAdapter', '本机 BLE', 'ok');

  if (localFile) {
    log('Web Bluetooth disabled: serve this directory over HTTPS or http://localhost instead of opening index.html directly.');
  } else if (!secure) {
    log('Web Bluetooth disabled: open this page over HTTPS or localhost.');
  } else if (!hasBluetooth) {
    log('Web Bluetooth disabled: use desktop Chrome/Edge with a local BLE adapter.');
  } else {
    log(`Web Bluetooth ready on this browser; nearby devices are scanned from this computer (${origin}).`);
  }
}

function clampMv(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3300, n));
}

function parseNumber(value, fallback = 0) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const n = Number.parseInt(text, text.toLowerCase().startsWith('0x') ? 16 : 10);
  return Number.isFinite(n) ? n : fallback;
}

function hex(value, width = 4) {
  return `0x${Number(value >>> 0).toString(16).padStart(width, '0')}`;
}

function parseNumberStrict(value) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('empty number');
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text, 16);
  if (/^[0-9]+$/.test(text)) return Number.parseInt(text, 10);
  throw new Error(`invalid number ${text}`);
}

function parseRegisterList(text) {
  const regs = [];
  const seen = new Set();
  const tokens = String(text ?? '').split(/[\s,;]+/).filter(Boolean);

  for (const token of tokens) {
    const range = token.split('-');
    if (range.length === 1) {
      const reg = parseNumberStrict(range[0]);
      if (reg > 0x7f) throw new Error(`register out of range ${hex(reg, 2)}`);
      if (!seen.has(reg)) {
        seen.add(reg);
        regs.push(reg);
      }
      continue;
    }

    if (range.length !== 2) throw new Error(`invalid range ${token}`);
    const start = parseNumberStrict(range[0]);
    const end = parseNumberStrict(range[1]);
    if (start > end || end > 0x7f || (end - start) > 31) {
      throw new Error(`invalid range ${token}`);
    }
    for (let reg = start; reg <= end; reg += 1) {
      if (!seen.has(reg)) {
        seen.add(reg);
        regs.push(reg);
      }
    }
  }

  if (regs.length === 0) throw new Error('register list is empty');
  if (regs.length > 64) throw new Error('too many registers');
  return regs;
}

function regStatusName(status) {
  return REG_STATUS_NAMES[status] || `STATUS_${status}`;
}

function getDeviceFilterMode() {
  return $('deviceFilterMode')?.value || DEFAULT_FILTER_MODE;
}

function getDeviceNamePrefix() {
  return ($('deviceNamePrefix')?.value || DEFAULT_NAME_PREFIX).trim() || DEFAULT_NAME_PREFIX;
}

function buildBluetoothRequestOptions() {
  const mode = getDeviceFilterMode();
  const optionalServices = [UUIDS.ascService, UUIDS.smpService];

  if (mode === 'ascService') {
    return {
      filters: [
        { services: [UUIDS.ascService] },
        { services: [UUIDS.smpService] },
        { name: DEFAULT_DEVICE_NAME },
        { namePrefix: getDeviceNamePrefix() },
      ],
      optionalServices,
    };
  }

  if (mode === 'allDevices') {
    return {
      acceptAllDevices: true,
      optionalServices,
    };
  }

  return {
    filters: [{ namePrefix: getDeviceNamePrefix() }],
    optionalServices,
  };
}

function describeDeviceFilter() {
  const mode = getDeviceFilterMode();
  if (mode === 'ascService') return `target services/name (${UUIDS.ascService}, SMP, ${getDeviceNamePrefix()})`;
  if (mode === 'allDevices') return 'all nearby BLE devices';
  return `name prefix "${getDeviceNamePrefix()}"`;
}

function updateDeviceFilterUi() {
  const prefixMode = getDeviceFilterMode() === 'namePrefix';
  $('deviceNamePrefix').disabled = !prefixMode;
  $('namePrefixLabel').classList.toggle('muted-control', !prefixMode);
}

function webBluetoothHint(error) {
  const name = error?.name || '';
  const message = error?.message || String(error);

  if (!window.isSecureContext) {
    return `${message}。Web Bluetooth 需要 http://localhost 或 HTTPS，请不要直接双击 index.html 打开。`;
  }

  if (name === 'NotFoundError') {
    return `${message}。如果弹窗里没有 Sivy_ASC_V0，请确认板子正在 advertising、没有被手机/nRF Connect 占用连接，并保持“全部设备”模式重试。`;
  }

  if (name === 'SecurityError') {
    return `${message}。浏览器拒绝了蓝牙权限，请用 Chrome/Edge 打开 http://localhost:8080，并允许蓝牙访问。`;
  }

  if (name === 'NetworkError') {
    return `${message}。GATT 连接失败，通常是设备已被其他 central 连接、刚复位未重新广播，或 BLE 链路仍不稳定。`;
  }

  return message;
}

function ensureProfileEntries() {
  const host = $('profileEntries');
  if (host.children.length > 0) return;

  for (let i = 0; i < 8; i += 1) {
    const row = document.createElement('div');
    row.className = 'profile-entry';
    row.innerHTML = `
      <label class="toggle"><span>#${i + 1}</span><input id="profileEn${i}" type="checkbox"></label>
      <label>Reg<input id="profileReg${i}" type="text" value="0x00"></label>
      <label>Value<input id="profileVal${i}" type="text" value="0x0000"></label>
    `;
    host.appendChild(row);
  }
}

function setMode(mode) {
  state.config.inputMode = Number(mode);
  for (const button of document.querySelectorAll('.segment')) {
    button.classList.toggle('active', Number(button.dataset.mode) === state.config.inputMode);
  }
}

function configFromForm() {
  ensureProfileEntries();
  state.config.notify = $('notifyToggle').checked;
  state.config.sampleLog = $('sampleLogToggle').checked;
  state.config.dac = [
    clampMv($('dacA').value),
    clampMv($('dacB').value),
    clampMv($('dacC').value),
    clampMv($('dacD').value),
  ];
  state.config.profile.enable = $('profileEnableToggle').checked;
  state.config.profile.verify = $('profileVerifyToggle').checked;
  state.config.profile.entries = Array.from({ length: 8 }, (_, i) => ({
    enabled: $(`profileEn${i}`).checked,
    reg: parseNumber($(`profileReg${i}`).value) & 0xff,
    value: parseNumber($(`profileVal${i}`).value) & 0xffff,
  }));
  return state.config;
}

function applyConfigToForm(config) {
  ensureProfileEntries();
  setMode(config.inputMode);
  $('notifyToggle').checked = !!config.notify;
  $('sampleLogToggle').checked = config.sampleLog !== false;
  [$('dacA'), $('dacB'), $('dacC'), $('dacD')].forEach((input, index) => {
    input.value = config.dac[index];
  });
  $('profileEnableToggle').checked = !!config.profile?.enable;
  $('profileVerifyToggle').checked = config.profile?.verify !== false;
  const entries = config.profile?.entries || [];
  for (let i = 0; i < 8; i += 1) {
    const entry = entries[i] || { enabled: false, reg: 0, value: 0 };
    $(`profileEn${i}`).checked = !!entry.enabled;
    $(`profileReg${i}`).value = hex(entry.reg, 2);
    $(`profileVal${i}`).value = hex(entry.value, 4);
  }
}

function packConfig(config) {
  const profile = config.profile || {};
  const entries = profile.entries || [];
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  view.setUint8(0, 1);
  view.setUint8(1, config.inputMode);
  view.setUint8(2, config.notify ? 1 : 0);
  view.setUint8(3, config.sampleLog === false ? 0 : 1);
  for (let i = 0; i < 4; i += 1) {
    view.setUint16(4 + i * 2, config.dac[i], true);
  }
  view.setUint16(12, config.sampleIntervalMs || 0, true);
  view.setUint8(16, profile.enable ? 1 : 0);
  view.setUint8(17, profile.verify === false ? 0 : 1);
  view.setUint8(18, 8);
  let enabledMask = 0;
  for (let i = 0; i < 8; i += 1) {
    const entry = entries[i] || { enabled: false, reg: 0, value: 0 };
    if (entry.enabled) enabledMask |= (1 << i);
    view.setUint8(20 + i, entry.reg & 0xff);
    view.setUint16(28 + i * 2, entry.value & 0xffff, true);
  }
  view.setUint8(19, enabledMask);
  return buffer;
}

function parseConfig(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer || value);
  const config = {
    version: view.getUint8(0),
    inputMode: view.getUint8(1),
    notify: view.getUint8(2) !== 0,
    sampleLog: view.byteLength > 3 ? view.getUint8(3) !== 0 : true,
    dac: [
      view.getUint16(4, true),
      view.getUint16(6, true),
      view.getUint16(8, true),
      view.getUint16(10, true),
    ],
    sampleIntervalMs: view.getUint16(12, true),
    profile: {
      enable: false,
      verify: true,
      entries: Array.from({ length: 8 }, () => ({ enabled: false, reg: 0, value: 0 })),
    },
  };
  if (view.byteLength >= 44) {
    const enabledMask = view.getUint8(19);
    config.profile.enable = view.getUint8(16) !== 0;
    config.profile.verify = view.getUint8(17) !== 0;
    config.profile.entries = Array.from({ length: 8 }, (_, i) => ({
      enabled: (enabledMask & (1 << i)) !== 0,
      reg: view.getUint8(20 + i),
      value: view.getUint16(28 + i * 2, true),
    }));
  }
  return config;
}

function parseStatus(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer || value);
  const status = {
    version: view.getUint8(0),
    flags: view.getUint8(1),
    ledMode: view.getUint8(2),
    inputMode: view.getUint8(3),
    dac: [
      view.getUint16(4, true),
      view.getUint16(6, true),
      view.getUint16(8, true),
      view.getUint16(10, true),
    ],
    trigger0: view.getUint32(12, true),
    trigger1: view.getUint32(16, true),
    triggerDrop: view.getUint32(20, true),
    adcOk: view.getUint32(24, true),
    adcErr: view.getUint32(28, true),
    dacProbeOk: view.getUint32(32, true),
    dacWriteOk: view.getUint32(36, true),
    dacI2cErr: view.getUint32(40, true),
    ascI2cErr: view.getUint32(44, true),
    appState: 0xff,
    profileFlags: 0,
    sampleQueue: 0,
    bleCongested: 0,
    sampleDrop: 0,
    regReqOk: 0,
    regReqErr: 0,
    profileOk: 0,
    profileErr: 0,
    settingsSave: 0,
    settingsErr: 0,
  };
  if (view.byteLength >= 84) {
    status.appState = view.getUint8(48);
    status.profileFlags = view.getUint8(49);
    status.sampleQueue = view.getUint16(50, true);
    status.bleCongested = view.getUint32(52, true);
    status.sampleDrop = view.getUint32(56, true);
    status.regReqOk = view.getUint32(60, true);
    status.regReqErr = view.getUint32(64, true);
    status.profileOk = view.getUint32(68, true);
    status.profileErr = view.getUint32(72, true);
    status.settingsSave = view.getUint32(76, true);
    status.settingsErr = view.getUint32(80, true);
  }
  return status;
}

function parseSample(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer || value);
  return {
    version: view.getUint8(0),
    seq: view.getUint8(1),
    channel: view.getUint8(2),
    source: view.getUint8(3),
    flags: view.getUint8(4),
    raw: view.getInt16(6, true),
    timestampUs: view.getUint32(8, true),
    mv: view.getInt32(12, true),
    adcOk: view.getUint32(16, true),
  };
}

function describeSample(sample) {
  const mvText = (sample.flags & 0x01) ? `${sample.mv} mV` : 'raw-only';
  return `seq=${sample.seq} ch=${sample.channel} raw=${sample.raw} ${mvText}`;
}

function updateStatus(status) {
  const power = (status.flags & 0x01) !== 0;
  const connected = (status.flags & 0x02) !== 0;
  const advertising = (status.flags & 0x04) !== 0;
  const notify = (status.flags & 0x08) !== 0;
  const ledNames = ['safe', 'power', 'dac-ok', 'dac-error'];
  const appStateNames = [
    'boot-safe',
    'advertising',
    'connected-idle',
    'armed',
    'capturing',
    'low-power',
    'error',
  ];

  $('powerValue').textContent = power ? 'ON' : 'OFF';
  $('bleValue').textContent = connected ? 'connected' : (advertising ? 'advertising' : 'idle');
  $('ledValue').textContent = ledNames[status.ledMode] || `mode ${status.ledMode}`;
  $('notifyValue').textContent = notify ? 'ON' : 'OFF';
  $('adcOkValue').textContent = status.adcOk;
  $('adcErrValue').textContent = status.adcErr;
  $('dacOkValue').textContent = `${status.dacProbeOk}/${status.dacWriteOk}`;
  $('i2cErrValue').textContent = `${status.dacI2cErr}/${status.ascI2cErr}`;
  $('appStateValue').textContent = appStateNames[status.appState] || '--';
  $('profileValue').textContent = `${(status.profileFlags & 0x01) ? 'on' : 'off'}/${(status.profileFlags & 0x02) ? 'verify' : 'no-verify'}`;
  $('queueValue').textContent = status.sampleQueue;
  $('bleDropValue').textContent = `${status.bleCongested}/${status.sampleDrop}`;
}

async function connect() {
  if (!state.bluetoothReady) {
    throw new Error('Web Bluetooth requires HTTPS or localhost in desktop Chrome/Edge');
  }

  if (!window.isSecureContext) {
    throw new Error('当前页面不是安全上下文：请通过 http://localhost:8080 打开 Web Console');
  }

  if (!navigator.bluetooth) {
    throw new Error('当前浏览器不支持 Web Bluetooth，请使用桌面版 Chrome 或 Edge');
  }

  log(`Opening BLE chooser: ${describeDeviceFilter()}`);
  log('如果目标设备不出现：先确认手机/nRF Connect 已断开，再保持“全部设备”模式重新点击连接。');
  const device = await navigator.bluetooth.requestDevice(buildBluetoothRequestOptions());
  log(`Selected BLE device: ${device.name || '(unnamed)'} / ${device.id || 'no-id'}`);

  device.addEventListener('gattserverdisconnected', onDisconnected);
  const server = await device.gatt.connect();
  let ascService;
  try {
    ascService = await server.getPrimaryService(UUIDS.ascService);
  } catch (error) {
    device.gatt.disconnect();
    throw new Error('所选设备没有 ASC GATT service，请重新选择正确设备');
  }

  state.device = device;
  state.server = server;
  state.chars.status = await ascService.getCharacteristic(UUIDS.status);
  state.chars.config = await ascService.getCharacteristic(UUIDS.config);
  state.chars.ctrl = await ascService.getCharacteristic(UUIDS.ctrl);
  state.chars.regReq = await ascService.getCharacteristic(UUIDS.regReq);
  state.chars.regRsp = await ascService.getCharacteristic(UUIDS.regRsp);
  state.chars.adcData = await ascService.getCharacteristic(UUIDS.adcData);

  await state.chars.status.startNotifications();
  state.chars.status.addEventListener('characteristicvaluechanged', (event) => {
    updateStatus(parseStatus(event.target.value));
  });

  await state.chars.adcData.startNotifications();
  state.chars.adcData.addEventListener('characteristicvaluechanged', (event) => {
    const sample = parseSample(event.target.value);
    state.samples.push(sample);
    if (state.samples.length > 480) state.samples.shift();
    $('sampleCount').textContent = `${state.samples.length} samples`;
    $('latestSample').textContent = describeSample(sample);
    drawSamples();
  });

  await state.chars.regRsp.startNotifications();
  state.chars.regRsp.addEventListener('characteristicvaluechanged', (event) => {
    onRegRsp(parseRegRsp(event.target.value));
  });

  try {
    const smpService = await server.getPrimaryService(UUIDS.smpService);
    const smpChar = await smpService.getCharacteristic(UUIDS.smpChar);
    state.smp = new SmpClient(smpChar);
    await state.smp.init();
    log('SMP OTA service ready');
  } catch (error) {
    state.smp = null;
    log(`SMP OTA unavailable: ${error.message}`);
  }

  setConnected(true);
  log(`Connected to ${device.name || device.id || 'unnamed BLE device'}`);
  await readConfig();
  await readStatus();
}

function onDisconnected() {
  setConnected(false);
  state.server = null;
  state.chars = {};
  state.smp = null;
  for (const pending of state.pendingReg.values()) {
    pending.reject(new Error('Device disconnected'));
  }
  state.pendingReg.clear();
  log('Device disconnected');
}

async function disconnect() {
  if (state.device?.gatt?.connected) {
    state.device.gatt.disconnect();
  }
}

async function readStatus() {
  const value = await state.chars.status.readValue();
  updateStatus(parseStatus(value));
  log('STATUS read');
}

async function readConfig() {
  const value = await state.chars.config.readValue();
  state.config = parseConfig(value);
  applyConfigToForm(state.config);
  log('CONFIG read');
}

async function writeConfig() {
  const config = configFromForm();
  await state.chars.config.writeValueWithResponse(packConfig(config));
  log(`CONFIG write DAC=${config.dac.join('/')}`);
}

function packCtrl(opcode, arg0 = 0, arg1 = 0) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint8(0, state.ctrlSeq++ & 0xff);
  view.setUint8(1, opcode);
  view.setUint16(2, arg0, true);
  view.setUint32(4, arg1, true);
  return buffer;
}

async function ctrl(opcode, arg0 = 0, arg1 = 0) {
  await state.chars.ctrl.writeValueWithResponse(packCtrl(opcode, arg0, arg1));
  await delay(80);
  await readStatus();
}

function parseRegRsp(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer || value);
  return {
    seq: view.getUint8(0),
    op: view.getUint8(1),
    target: view.getUint8(2),
    status: view.getUint8(3),
    addr: view.getUint16(4, true),
    value: view.getUint16(6, true),
    mask: view.getUint16(8, true),
  };
}

function formatRegRsp(rsp) {
  const full32 = ((rsp.mask << 16) | rsp.value) >>> 0;
  return `seq=${rsp.seq} target=${hex(rsp.target, 2)} op=${hex(rsp.op, 2)} status=${regStatusName(rsp.status)} ` +
    `addr=${hex(rsp.addr, 4)} value=${hex(rsp.value, 4)} mask=${hex(rsp.mask, 4)} u32=${hex(full32, 8)}`;
}

function onRegRsp(rsp) {
  const pending = state.pendingReg.get(rsp.seq);
  if (pending) {
    clearTimeout(pending.timer);
    state.pendingReg.delete(rsp.seq);
    pending.resolve(rsp);
  }

  $('regResult').textContent = formatRegRsp(rsp);
}

function packRegReqPacket(req, seq) {
  const buffer = new ArrayBuffer(10);
  const view = new DataView(buffer);
  view.setUint8(0, seq);
  view.setUint8(1, req.op & 0xff);
  view.setUint8(2, req.target & 0xff);
  view.setUint8(3, req.width & 0xff);
  view.setUint16(4, req.addr & 0xffff, true);
  view.setUint16(6, req.value & 0xffff, true);
  view.setUint16(8, req.mask & 0xffff, true);
  return buffer;
}

function packRegReq(op) {
  return {
    target: parseNumber($('regTarget').value) & 0xff,
    op,
    width: parseNumber($('regWidth').value) & 0xff,
    addr: parseNumber($('regAddr').value) & 0xffff,
    value: parseNumber($('regValue').value) & 0xffff,
    mask: parseNumber($('regMask').value) & 0xffff,
  };
}

async function sendRegReq(req, timeoutMs = 3000) {
  const seq = state.regSeq++ & 0xff;
  const buffer = packRegReqPacket(req, seq);
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pendingReg.delete(seq);
      reject(new Error('REG_RSP timeout'));
    }, timeoutMs);
    state.pendingReg.set(seq, { resolve, reject, timer });
  });

  try {
    await state.chars.regReq.writeValueWithResponse(buffer);
  } catch (error) {
    const pending = state.pendingReg.get(seq);
    if (pending) {
      clearTimeout(pending.timer);
      state.pendingReg.delete(seq);
    }
    throw error;
  }
  return response;
}

async function regCommand(op) {
  const rsp = await sendRegReq(packRegReq(op));
  if (rsp.status !== REG.OK) {
    throw new Error(`REG ${regStatusName(rsp.status)}`);
  }
  await readStatus();
  return rsp;
}

function setAscPreset(preset) {
  if (preset === 'basic') {
    $('ascTestReadList').value = ASC_REG_TEST_PRESETS.basic.map((reg) => hex(reg, 2)).join(', ');
    return;
  }

  if (preset === 'profile') {
    const config = configFromForm();
    const regs = config.profile.entries
      .filter((entry) => entry.enabled)
      .map((entry) => entry.reg);
    $('ascTestReadList').value = regs.length > 0
      ? regs.map((reg) => hex(reg, 2)).join(', ')
      : ASC_REG_TEST_PRESETS.basic.map((reg) => hex(reg, 2)).join(', ');
  }
}

function clearAscTestResults() {
  state.ascRegTestRows = [];
  $('ascTestRows').textContent = '';
}

function appendAscTestResult(row) {
  const tbody = $('ascTestRows');
  const tr = document.createElement('tr');
  const statusClass = row.pass ? 'pass' : (row.warn ? 'warn' : 'fail');
  const cells = [
    row.step,
    row.op,
    row.addr,
    row.expected,
    row.actual,
    row.status,
    row.note,
  ];

  for (const value of cells) {
    const td = document.createElement('td');
    td.textContent = value ?? '';
    tr.appendChild(td);
  }
  tr.children[5].className = statusClass;
  tbody.appendChild(tr);
  state.ascRegTestRows.push({
    time: new Date().toISOString(),
    ...row,
  });
}

function appendAscRspResult(step, op, addr, rsp, expected = '', note = '') {
  appendAscTestResult({
    step,
    op,
    addr: hex(addr, 2),
    expected,
    actual: rsp.status === REG.OK ? hex(rsp.value, 4) : '--',
    status: regStatusName(rsp.status),
    note,
    pass: rsp.status === REG.OK,
  });
}

async function maybePowerOnForAscTest() {
  if ($('ascTestPowerOn').checked) {
    await ctrl(CTRL.POWER_ON);
  }
}

async function runAscRegisterReadSuite({ clear = true } = {}) {
  if (clear) clearAscTestResults();
  await maybePowerOnForAscTest();

  const regs = parseRegisterList($('ascTestReadList').value);
  log(`ASC register read test: ${regs.length} register(s)`);

  for (const addr of regs) {
    const rsp = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr,
      value: 0,
      mask: 0xffff,
    });
    appendAscRspResult('read-list', 'READ', addr, rsp);
  }

  await readStatus();
}

async function runAscRegisterWriteVerify({ clear = true } = {}) {
  if (clear) clearAscTestResults();
  if (!$('ascTestWriteEnable').checked) {
    appendAscTestResult({
      step: 'write-verify',
      op: 'SKIP',
      addr: '--',
      expected: '--',
      actual: '--',
      status: 'SKIPPED',
      note: 'write verify disabled',
      pass: false,
      warn: true,
    });
    return;
  }

  await maybePowerOnForAscTest();

  const addr = parseNumberStrict($('ascTestWriteAddr').value);
  const mask = parseNumberStrict($('ascTestWriteMask').value) & 0xffff;
  const testValue = parseNumberStrict($('ascTestWriteValue').value) & 0xffff;

  if (addr > 0x7f) throw new Error(`safe register out of range ${hex(addr, 2)}`);
  if (mask === 0) throw new Error('write mask must be non-zero');

  let original = 0;
  let originalKnown = false;
  let wrote = false;

  log(`ASC register write verify: addr=${hex(addr, 2)} mask=${hex(mask, 4)} value=${hex(testValue, 4)}`);

  try {
    const readRsp = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr,
      value: 0,
      mask: 0xffff,
    });
    appendAscRspResult('write-verify', 'READ_ORIG', addr, readRsp);
    if (readRsp.status !== REG.OK) return;

    original = readRsp.value;
    originalKnown = true;

    const expected = (original & ~mask) | (testValue & mask);
    const writeRsp = await sendRegReq({
      target: 1,
      op: REG.UPDATE_BITS,
      width: 2,
      addr,
      value: testValue,
      mask,
    });
    wrote = writeRsp.status === REG.OK;
    appendAscRspResult('write-verify', 'UPDATE', addr, writeRsp, hex(expected, 4));
    if (writeRsp.status !== REG.OK) return;

    const verifyRsp = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr,
      value: 0,
      mask: 0xffff,
    });
    const pass = verifyRsp.status === REG.OK && ((verifyRsp.value & mask) === (testValue & mask));
    appendAscTestResult({
      step: 'write-verify',
      op: 'VERIFY',
      addr: hex(addr, 2),
      expected: hex(expected, 4),
      actual: verifyRsp.status === REG.OK ? hex(verifyRsp.value, 4) : '--',
      status: pass ? 'OK' : regStatusName(verifyRsp.status),
      note: pass ? 'masked bits match' : 'masked bits mismatch',
      pass,
    });
  } finally {
    if (originalKnown && wrote) {
      const restoreRsp = await sendRegReq({
        target: 1,
        op: REG.UPDATE_BITS,
        width: 2,
        addr,
        value: original,
        mask,
      });
      appendAscRspResult('restore', 'RESTORE', addr, restoreRsp, hex(original, 4));

      const finalRsp = await sendRegReq({
        target: 1,
        op: REG.READ,
        width: 2,
        addr,
        value: 0,
        mask: 0xffff,
      });
      const restored = finalRsp.status === REG.OK && ((finalRsp.value & mask) === (original & mask));
      appendAscTestResult({
        step: 'restore',
        op: 'READ_BACK',
        addr: hex(addr, 2),
        expected: hex(original, 4),
        actual: finalRsp.status === REG.OK ? hex(finalRsp.value, 4) : '--',
        status: restored ? 'OK' : regStatusName(finalRsp.status),
        note: restored ? 'masked bits restored' : 'restore mismatch',
        pass: restored,
      });
    }
    await readStatus();
  }
}

async function runAscRegisterFullFlow() {
  clearAscTestResults();
  await runAscRegisterReadSuite({ clear: false });
  await runAscRegisterWriteVerify({ clear: false });
}

function exportAscRegisterCsv() {
  if (state.ascRegTestRows.length === 0) {
    log('ASC register CSV skipped: no rows');
    return;
  }

  const columns = ['time', 'step', 'op', 'addr', 'expected', 'actual', 'status', 'note'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.join(','),
    ...state.ascRegTestRows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `asc_register_test_${stamp}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`ASC register CSV exported: ${state.ascRegTestRows.length} row(s)`);
}

function drawSamples() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const pad = { left: 46, right: 18, top: 20, bottom: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.strokeStyle = 'rgba(29,29,31,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#6e6e73';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('3300 mV', 10, pad.top + 4);
  ctx.fillText('0 mV', 22, pad.top + plotH + 4);

  const samples = state.samples.slice(-240);
  drawChannel(samples.filter((s) => s.channel === 0), '#0071e3', pad, plotW, plotH);
  drawChannel(samples.filter((s) => s.channel === 1), '#24a148', pad, plotW, plotH);
}

function drawChannel(samples, color, pad, plotW, plotH) {
  if (samples.length === 0) return;
  const minT = samples[0].timestampUs;
  const maxT = samples[samples.length - 1].timestampUs;
  const span = Math.max(1, maxT - minT);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const value = (sample.flags & 0x01) ? sample.mv : sample.raw;
    const y = pad.top + plotH - (Math.max(0, Math.min(3300, value)) / 3300) * plotH;
    const x = pad.left + ((sample.timestampUs - minT) / span) * plotW;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function encodeType(major, value, out) {
  if (value < 24) out.push((major << 5) | value);
  else if (value <= 0xff) out.push((major << 5) | 24, value);
  else if (value <= 0xffff) out.push((major << 5) | 25, value >> 8, value & 0xff);
  else out.push((major << 5) | 26, (value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function cborEncode(value, out = []) {
  if (Number.isInteger(value) && value >= 0) {
    encodeType(0, value, out);
  } else if (typeof value === 'boolean') {
    out.push(value ? 0xf5 : 0xf4);
  } else if (value instanceof Uint8Array) {
    encodeType(2, value.length, out);
    out.push(...value);
  } else if (typeof value === 'string') {
    const encoded = new TextEncoder().encode(value);
    encodeType(3, encoded.length, out);
    out.push(...encoded);
  } else if (Array.isArray(value)) {
    encodeType(4, value.length, out);
    value.forEach((item) => cborEncode(item, out));
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    encodeType(5, entries.length, out);
    entries.forEach(([k, v]) => {
      cborEncode(k, out);
      cborEncode(v, out);
    });
  } else {
    out.push(0xf6);
  }
  return new Uint8Array(out);
}

function cborDecode(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let offset = 0;
  const textDecoder = new TextDecoder();

  function ensureAvailable(length) {
    if (offset + length > data.length) {
      throw new Error('Truncated CBOR payload');
    }
  }

  function readLength(add) {
    if (add < 24) return add;
    ensureAvailable(1);
    if (add === 24) return data[offset++];
    if (add === 25) {
      ensureAvailable(2);
      const v = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      return v;
    }
    if (add === 26) {
      ensureAvailable(4);
      const v = (data[offset] * 0x1000000) + ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]);
      offset += 4;
      return v >>> 0;
    }
    if (add === 27) {
      ensureAvailable(8);
      const high = (data[offset] * 0x1000000) + ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]);
      const low = (data[offset + 4] * 0x1000000) + ((data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7]);
      offset += 8;
      const value = (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
      return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
    }
    throw new Error(`Unsupported CBOR length ${add}`);
  }

  function readDefiniteBytes(expectedMajor, add) {
    const len = readLength(add);
    ensureAvailable(len);
    const value = data.slice(offset, offset + len);
    offset += len;
    return expectedMajor === 3 ? textDecoder.decode(value) : value;
  }

  function readIndefiniteBytes(expectedMajor) {
    const chunks = [];
    while (offset < data.length && data[offset] !== 0xff) {
      const head = data[offset++];
      const major = head >> 5;
      const add = head & 0x1f;
      if (major !== expectedMajor || add === 31) {
        throw new Error(`Invalid indefinite CBOR chunk 0x${head.toString(16)}`);
      }
      const chunk = readDefiniteBytes(expectedMajor, add);
      chunks.push(chunk);
    }
    if (offset >= data.length) throw new Error('Unterminated indefinite CBOR item');
    offset += 1;

    if (expectedMajor === 3) return chunks.join('');
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const value = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      value.set(chunk, cursor);
      cursor += chunk.length;
    }
    return value;
  }

  function readItem() {
    ensureAvailable(1);
    const head = data[offset++];
    const major = head >> 5;
    const add = head & 0x1f;
    if (major === 0) return readLength(add);
    if (major === 1) return -1 - readLength(add);
    if (major === 2) {
      return add === 31 ? readIndefiniteBytes(major) : readDefiniteBytes(major, add);
    }
    if (major === 3) {
      return add === 31 ? readIndefiniteBytes(major) : readDefiniteBytes(major, add);
    }
    if (major === 4) {
      if (add === 31) {
        const value = [];
        while (offset < data.length && data[offset] !== 0xff) {
          value.push(readItem());
        }
        if (offset >= data.length) throw new Error('Unterminated indefinite CBOR array');
        offset += 1;
        return value;
      }
      const len = readLength(add);
      return Array.from({ length: len }, () => readItem());
    }
    if (major === 5) {
      if (add === 31) {
        const obj = {};
        while (offset < data.length && data[offset] !== 0xff) {
          obj[readItem()] = readItem();
        }
        if (offset >= data.length) throw new Error('Unterminated indefinite CBOR map');
        offset += 1;
        return obj;
      }
      const len = readLength(add);
      const obj = {};
      for (let i = 0; i < len; i += 1) {
        obj[readItem()] = readItem();
      }
      return obj;
    }
    if (major === 7) {
      if (add === 20) return false;
      if (add === 21) return true;
      if (add === 22) return null;
    }
    throw new Error(`Unsupported CBOR item 0x${head.toString(16)}`);
  }

  return readItem();
}

class SmpClient {
  constructor(characteristic) {
    this.characteristic = characteristic;
    this.seq = 0;
    this.pending = new Map();
    this.rx = new Uint8Array();
  }

  async init() {
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
      this.onNotify(new Uint8Array(event.target.value.buffer.slice(0)));
    });
  }

  onNotify(chunk) {
    this.rx = concatBytes(this.rx, chunk);
    while (this.rx.length >= 8) {
      const len = (this.rx[2] << 8) | this.rx[3];
      const total = 8 + len;
      if (this.rx.length < total) return;
      const packet = this.rx.slice(0, total);
      this.rx = this.rx.slice(total);
      const seq = packet[6];
      const pending = this.pending.get(seq);
      if (pending) {
        this.pending.delete(seq);
        try {
          pending.resolve({
            op: packet[0],
            group: (packet[4] << 8) | packet[5],
            id: packet[7],
            body: cborDecode(packet.slice(8)),
          });
        } catch (error) {
          pending.reject(error);
        }
      }
    }
  }

  async command(group, id, op, body = {}, timeoutMs = 12000) {
    const seq = this.seq++ & 0xff;
    const payload = cborEncode(body);
    const packet = new Uint8Array(8 + payload.length);
    packet[0] = op;
    packet[1] = 0;
    packet[2] = (payload.length >> 8) & 0xff;
    packet[3] = payload.length & 0xff;
    packet[4] = (group >> 8) & 0xff;
    packet[5] = group & 0xff;
    packet[6] = seq;
    packet[7] = id;
    packet.set(payload, 8);

    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error('SMP response timeout'));
      }, timeoutMs);
      this.pending.set(seq, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });

    if (this.characteristic.properties.writeWithoutResponse) {
      await this.characteristic.writeValueWithoutResponse(packet);
    } else {
      await this.characteristic.writeValueWithResponse(packet);
    }

    const result = await response;
    const err = result.body?.err;
    const rc = result.body?.rc ?? err?.rc ?? 0;
    if (rc !== 0) {
      const name = SMP_RC_NAMES[rc] || `RC_${rc}`;
      const group = err?.group !== undefined ? ` group=${err.group}` : '';
      throw new Error(`SMP rc=${rc} (${name})${group}`);
    }
    return result.body;
  }
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return '--';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return 'mtime unknown';
  return new Date(value).toLocaleString();
}

function setOtaProgress(done, total, status = '') {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
  const percent = (safeDone / safeTotal) * 100;
  $('otaProgress').max = safeTotal;
  $('otaProgress').value = safeDone;
  $('otaProgressText').textContent =
    `${formatBytes(safeDone)} / ${formatBytes(safeTotal)} (${percent.toFixed(1)}%)${status ? ` - ${status}` : ''}`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  return null;
}

function bytesToHex(bytes) {
  const data = normalizeBytes(bytes);
  if (!data) return '';
  return Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function flagSet(value) {
  return value === true || value === 1 || value === 'true';
}

function flagClear(value) {
  return value === false || value === 0 || value === 'false';
}

function isValidImageHash(hash) {
  return hash?.length === 32 || hash?.length === 48 || hash?.length === 64;
}

function imageStateSummary(body) {
  const images = Array.isArray(body?.images) ? body.images : [];
  if (images.length === 0) return 'no images';
  return images.map((image) => {
    const hash = normalizeBytes(image.hash);
    const slot = image.image !== undefined ? `${image.image}:${image.slot}` : `${image.slot}`;
    const flags = [
      flagSet(image.active) ? 'active' : '',
      flagSet(image.pending) ? 'pending' : '',
      flagSet(image.confirmed) ? 'confirmed' : '',
      flagSet(image.permanent) ? 'permanent' : '',
      flagClear(image.bootable) ? 'not-bootable' : '',
    ].filter(Boolean).join(',');
    return `slot=${slot} version=${image.version || '--'} ${flags || 'idle'} hash=${bytesToHex(hash).slice(0, 16)}... len=${hash?.length || 0}`;
  }).join(' | ');
}

function findTestBootImage(body) {
  const images = Array.isArray(body?.images) ? body.images : [];
  const normalized = images.map((image) => ({
    ...image,
    hash: normalizeBytes(image.hash),
    hashHex: bytesToHex(image.hash),
  }));
  const activeHashes = new Set(normalized
    .filter((image) => flagSet(image.active))
    .map((image) => image.hashHex)
    .filter(Boolean));
  const candidates = normalized.filter((image) => (
    isValidImageHash(image.hash) &&
    !flagSet(image.active) &&
    !flagClear(image.bootable)
  ));
  const unique = candidates.find((image) => !activeHashes.has(image.hashHex));
  if (unique) return { image: unique };

  const duplicateActive = candidates.find((image) => activeHashes.has(image.hashHex));
  if (duplicateActive) return { duplicateActive };

  return { image: null };
}

async function readImageStateBody() {
  return state.smp.command(SMP.GROUP_IMAGE, SMP.IMG_STATE, SMP.OP_READ, {});
}

function parseMcuBootImageInfo(bytes) {
  const data = normalizeBytes(bytes);
  if (!data || data.length < 32) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x96f3b83d) return null;

  const major = view.getUint8(20);
  const minor = view.getUint8(21);
  const revision = view.getUint16(22, true);
  const build = view.getUint32(24, true);
  return {
    magic,
    version: `${major}.${minor}.${revision}+${build}`,
  };
}

function otaVersionLabel(info) {
  return info?.version ? `v${info.version}` : 'version unknown';
}

async function readOtaFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith('.zip')) {
    const extracted = await extractBinFromZip(bytes);
    return {
      bytes: extracted.bytes,
      name: `${file.name} / ${extracted.name}`,
      info: parseMcuBootImageInfo(extracted.bytes),
      sourceModifiedMs: file.lastModified,
    };
  }
  return {
    bytes,
    name: file.name,
    info: parseMcuBootImageInfo(bytes),
    sourceModifiedMs: file.lastModified,
  };
}

function findEocd(bytes) {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 0xffff - 22); i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  throw new Error('ZIP EOCD not found');
}

async function extractBinFromZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const eocd = findEocd(bytes);
  const entries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const files = [];
  let ptr = cdOffset;

  for (let i = 0; i < entries; i += 1) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLength = view.getUint16(ptr + 28, true);
    const extraLength = view.getUint16(ptr + 30, true);
    const commentLength = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + fileNameLength));
    files.push({ name, method, compressedSize, localOffset });
    ptr += 46 + fileNameLength + extraLength + commentLength;
  }

  let target = files.find((file) => file.name.toLowerCase().endsWith('.bin'));
  const manifest = files.find((file) => file.name.toLowerCase().endsWith('manifest.json'));
  if (manifest) {
    try {
      const manifestText = decoder.decode(await extractZipEntry(bytes, view, manifest));
      const json = JSON.parse(manifestText);
      const manifestBin = json.files?.map((item) => item.file).find((name) => name?.endsWith('.bin'));
      if (manifestBin) {
        target = files.find((file) => file.name.endsWith(manifestBin)) || target;
      }
    } catch (error) {
      log(`Manifest ignored: ${error.message}`);
    }
  }

  if (!target) throw new Error('No .bin image found in ZIP');
  return { name: target.name, bytes: await extractZipEntry(bytes, view, target) };
}

async function extractZipEntry(bytes, view, entry) {
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`Invalid local header for ${entry.name}`);
  const fileNameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const start = local + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) {
    if (!('DecompressionStream' in window)) {
      throw new Error('This browser cannot inflate ZIP entries');
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`Unsupported ZIP compression method ${entry.method}`);
}

async function uploadOta() {
  if (!state.smp) throw new Error('SMP OTA characteristic is not ready');
  if (!state.otaBytes) throw new Error('Please choose an OTA .bin or dfu_application.zip');

  const image = state.otaBytes;
  let offset = 0;
  const chunkSize = 128;
  let lastLoggedPercent = -1;
  const versionLabel = otaVersionLabel(state.otaInfo);

  $('otaUploadBtn').disabled = true;
  try {
    setOtaProgress(0, image.length, `hashing image ${versionLabel}`);
    await nextFrame();
    const hash = await sha256(image);

    log(`OTA upload start: ${state.otaName}, ${formatBytes(image.length)}, ${versionLabel}, selected ${formatTimestamp(state.otaSourceModifiedMs)}`);
    while (offset < image.length) {
      const chunk = image.slice(offset, Math.min(image.length, offset + chunkSize));
      const body = offset === 0
        ? { off: offset, len: image.length, sha: hash, data: chunk }
        : { off: offset, data: chunk };

      setOtaProgress(offset, image.length, `sending chunk @ ${formatBytes(offset)}`);
      await nextFrame();
      const response = await state.smp.command(SMP.GROUP_IMAGE, SMP.IMG_UPLOAD, SMP.OP_WRITE, body, 20000);
      const nextOffset = Number(response.off ?? (offset + chunk.length));
      if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
        throw new Error(`Invalid SMP upload offset ${response.off}`);
      }

      offset = Math.min(nextOffset, image.length);
      const percent = Math.floor((offset / image.length) * 100);
      setOtaProgress(offset, image.length, 'uploading');
      if (percent >= lastLoggedPercent + 5 || offset === image.length) {
        lastLoggedPercent = percent;
        log(`OTA upload ${percent}% (${offset}/${image.length})`);
      }
      await delay(18);
    }

    setOtaProgress(image.length, image.length, 'reading image state');
    await nextFrame();
    const imageStateBody = await readImageStateBody();
    log(`Image state after upload: ${imageStateSummary(imageStateBody)}`);
    const testSelection = findTestBootImage(imageStateBody);
    if (testSelection.duplicateActive) {
      setOtaProgress(image.length, image.length, 'complete - image matches active; no test boot marked');
      log(`OTA upload complete, but slot=${testSelection.duplicateActive.slot} hash matches the active image. Build/sign a different firmware image before testing reboot swap.`);
      if (state.otaInfo?.version && testSelection.duplicateActive.version && state.otaInfo.version !== testSelection.duplicateActive.version) {
        log(`Selected OTA file is ${otaVersionLabel(state.otaInfo)}, but image state still reports ${testSelection.duplicateActive.version}. Reselect the rebuilt zip/bin and retry.`);
      }
      return;
    }
    if (!testSelection.image) {
      throw new Error('No non-active bootable image hash found in image state');
    }

    const testImage = testSelection.image;
    setOtaProgress(image.length, image.length, 'marking test boot');
    await nextFrame();
    await state.smp.command(SMP.GROUP_IMAGE, SMP.IMG_STATE, SMP.OP_WRITE, {
      hash: testImage.hash,
      confirm: false,
    });
    setOtaProgress(image.length, image.length, 'complete - press Reset to boot test image');
    log(`OTA image marked for test boot: slot=${testImage.slot}, hash=${bytesToHex(testImage.hash).slice(0, 16)}...; press Reset to reboot into it`);
  } catch (error) {
    setOtaProgress(offset, image.length, `failed: ${error.message}`);
    throw error;
  } finally {
    $('otaUploadBtn').disabled = false;
  }
}

async function resetBySmp() {
  if (!state.smp) throw new Error('SMP OTA characteristic is not ready');
  try {
    $('otaProgressText').textContent = 'reset command sent - reconnect after reboot';
    await state.smp.command(SMP.GROUP_OS, SMP.OS_RESET, SMP.OP_WRITE, {}, 2000);
  } catch (error) {
    $('otaProgressText').textContent = 'reset command sent - reconnect after reboot';
    log(`Reset command sent: ${error.message}`);
  }
}

async function imageState() {
  if (!state.smp) throw new Error('SMP OTA characteristic is not ready');
  const body = await readImageStateBody();
  $('otaProgressText').textContent = 'image state read - see event log';
  log(`Image state: ${imageStateSummary(body)}`);
}

function bindUi() {
  ensureProfileEntries();
  updateDeviceFilterUi();
  updateRuntimeEnvironment();
  setConnected(false);
  log(`Web Console build ${WEB_CONSOLE_BUILD}`);
  $('deviceFilterMode').addEventListener('change', updateDeviceFilterUi);
  $('connectBtn').addEventListener('click', () => run(connect));
  $('disconnectBtn').addEventListener('click', () => run(disconnect));
  $('refreshBtn').addEventListener('click', () => run(readStatus));
  $('readConfigBtn').addEventListener('click', () => run(readConfig));
  $('writeConfigBtn').addEventListener('click', () => run(writeConfig));
  $('applyDacBtn').addEventListener('click', () => run(async () => { await writeConfig(); await ctrl(CTRL.APPLY_DAC); }));
  $('applyConfigBtn').addEventListener('click', () => run(async () => { await writeConfig(); await ctrl(CTRL.APPLY_CONFIG); }));
  $('dacDefaultBtn').addEventListener('click', () => run(() => ctrl(CTRL.DAC_DEFAULT)));
  $('powerOnBtn').addEventListener('click', () => run(() => ctrl(CTRL.POWER_ON)));
  $('powerOffBtn').addEventListener('click', () => run(() => ctrl(CTRL.POWER_OFF)));
  $('startArmBtn').addEventListener('click', () => run(async () => { await writeConfig(); await ctrl(CTRL.START_ARM); }));
  $('stopArmBtn').addEventListener('click', () => run(() => ctrl(CTRL.STOP_ARM, 0)));
  $('lowPowerBtn').addEventListener('click', () => run(() => ctrl(CTRL.ENTER_LOW_POWER)));
  $('dacProbeBtn').addEventListener('click', () => run(() => ctrl(CTRL.DAC_PROBE)));
  $('clearDiagBtn').addEventListener('click', () => run(() => ctrl(CTRL.CLEAR_DIAG)));
  $('applyProfileBtn').addEventListener('click', () => run(async () => { await writeConfig(); await ctrl(CTRL.APPLY_PROFILE); }));
  $('regReadBtn').addEventListener('click', () => run(() => regCommand(REG.READ)));
  $('regWriteBtn').addEventListener('click', () => run(() => regCommand(REG.WRITE)));
  $('regUpdateBtn').addEventListener('click', () => run(() => regCommand(REG.UPDATE_BITS)));
  $('ascTestPreset').addEventListener('change', () => setAscPreset($('ascTestPreset').value));
  $('ascTestReadBtn').addEventListener('click', () => run(() => runAscRegisterReadSuite()));
  $('ascTestWriteBtn').addEventListener('click', () => run(() => runAscRegisterWriteVerify()));
  $('ascTestFullBtn').addEventListener('click', () => run(() => runAscRegisterFullFlow()));
  $('ascTestClearBtn').addEventListener('click', clearAscTestResults);
  $('ascTestExportBtn').addEventListener('click', exportAscRegisterCsv);
  $('sampleCh0Btn').addEventListener('click', () => run(() => ctrl(CTRL.FORCE_SAMPLE, 0)));
  $('sampleCh1Btn').addEventListener('click', () => run(() => ctrl(CTRL.FORCE_SAMPLE, 1)));
  $('resetBtn').addEventListener('click', () => run(resetBySmp));
  $('imageStateBtn').addEventListener('click', () => run(imageState));
  $('otaUploadBtn').addEventListener('click', () => run(uploadOta));
  $('clearLogBtn').addEventListener('click', () => { logView.textContent = ''; });
  $('clearSamplesBtn').addEventListener('click', () => {
    state.samples = [];
    $('sampleCount').textContent = '0 samples';
    $('latestSample').textContent = 'latest --';
    drawSamples();
  });
  for (const button of document.querySelectorAll('.segment')) {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  }
  $('regTarget').addEventListener('change', () => {
    $('regWidth').value = $('regTarget').value === '5' ? '4' : '2';
  });
  $('otaFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const image = await readOtaFile(file);
      state.otaBytes = image.bytes;
      state.otaName = image.name;
      state.otaInfo = image.info;
      state.otaSourceModifiedMs = image.sourceModifiedMs || 0;
      const versionLabel = otaVersionLabel(image.info);
      $('otaFileName').textContent = image.name;
      $('otaFileSize').textContent = `${formatBytes(image.bytes.length)} / ${versionLabel}`;
      setOtaProgress(0, image.bytes.length, `ready - ${versionLabel}`);
      log(`OTA image loaded: ${image.name}, ${formatBytes(image.bytes.length)}, ${versionLabel}, selected ${formatTimestamp(state.otaSourceModifiedMs)}`);
    } catch (error) {
      $('otaProgressText').textContent = `load failed: ${error.message}`;
      log(`OTA load failed: ${error.message}`);
    }
  });
  window.addEventListener('resize', drawSamples);
  drawSamples();
}

async function run(task) {
  try {
    await task();
  } catch (error) {
    log(`Error: ${webBluetoothHint(error)}`);
  }
}

bindUi();
