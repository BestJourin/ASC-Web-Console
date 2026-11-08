'use strict';

const WEB_CONSOLE_BUILD = '20261105-rigol-secure-manual';

const UUIDS = {
  ascService: '41534300-7a6d-4ef9-9c6b-5c5940000001',
  status: '41534301-7a6d-4ef9-9c6b-5c5940000001',
  ctrl: '41534302-7a6d-4ef9-9c6b-5c5940000001',
  config: '41534303-7a6d-4ef9-9c6b-5c5940000001',
  adcData: '41534304-7a6d-4ef9-9c6b-5c5940000001',
  regReq: '41534305-7a6d-4ef9-9c6b-5c5940000001',
  regRsp: '41534306-7a6d-4ef9-9c6b-5c5940000001',
  sivyTestCtrl: '41534307-7a6d-4ef9-9c6b-5c5940000001',
  sivyTestResult: '41534308-7a6d-4ef9-9c6b-5c5940000001',
  smpService: '8d53dc1d-1db7-4cd3-868b-8a527460aa84',
  smpChar: 'da2e7828-fbce-4e01-ae9e-261174997c48',
};

const DEFAULT_NAME_PREFIX = 'Sivy_ASC_Test';
const DEFAULT_DEVICE_NAME = 'Sivy_ASC_Test';
const DEFAULT_FILTER_MODE = 'allDevices';
const AUTOMATION_DEVICE_NAME_PREFIX = 'Sivy';
const AUTOMATION_TARGET_ADDRESS = 'C3:09:E1:7D:0D:08';
const AUTOMATION_SIVY_TIMEOUT_MS = 30000;
const DEFAULT_SCOPE_IP = '192.168.110.10';
const DEFAULT_SCOPE_MAC = '00:19:AF:AD:06:A4';
const DEFAULT_SCOPE_PORT = 5025;
const DEFAULT_GENERATOR_IP = '192.168.110.11';
const DEFAULT_GENERATOR_PORT = 5555;
const DEFAULT_SCOPE_BRIDGE_URL = 'ws://127.0.0.1:8765';
const SCOPE_SETTINGS_STORAGE_KEY = 'sivy-rigol-scope-settings';
const SCOPE_ACCESS_KEY_STORAGE_KEY = 'sivy-rigol-bridge-access-key';
const GENERATOR_SETTINGS_STORAGE_KEY = 'sivy-rigol-generator-settings';

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
  '正常',
  '参数无效',
  '状态无效',
  '不支持',
  'I2C 错误',
  '拒绝执行',
];

const SIVY_TEST = {
  SNAPSHOT: 0x01,
  SELECTED_INIT_WRITE: 0x02,
  RESULT_REGISTER: 0x01,
  RESULT_INIT_WRITE: 0x02,
  RESULT_SUMMARY: 0x03,
  PASS: 0x00,
  MISMATCH: 0x01,
  IO_ERROR: 0x02,
};

const SIVY_REGISTER_NAMES = new Map([
  [0x00, 'GLB_CTRL0'], [0x02, 'GLB_CTRL1'], [0x04, 'PLL_CTRL'], [0x06, 'HSI_CTRL'],
  [0x0a, 'QSPI_CTRL'], [0x0c, 'MULTI_CHIP_CTRL'], [0x0e, 'CH0_CTRL'], [0x10, 'CH0_FEAT'],
  [0x12, 'CH0_AVG_WORKWIN'], [0x14, 'CH0_AVG_WAITWIN'], [0x16, 'CH1_CTRL'], [0x18, 'CH1_FEAT'],
  [0x1a, 'CH1_AVG_WORKWIN'], [0x1c, 'CH1_AVG_WAITWIN'], [0x1e, 'CH2_CTRL'], [0x20, 'CH2_FEAT'],
  [0x22, 'CH2_AVG_WORKWIN'], [0x24, 'CH2_AVG_WAITWIN'], [0x26, 'CH3_CTRL'], [0x28, 'CH3_FEAT'],
  [0x2a, 'CH3_AVG_WORKWIN'], [0x2c, 'CH3_AVG_WAITWIN'], [0x2e, 'COMP0_TRIM'], [0x30, 'COMP1_TRIM'],
  [0x32, 'COMP2_TRIM'], [0x34, 'COMP3_TRIM'], [0x36, 'SAMP_AMP_TRIM'], [0x38, 'PW_CTRL（CPW_CTRL）'],
  [0x3a, 'CO_CTRL'],
]);

const SIVY_REGISTER_EXPECTED = new Map([
  [0x00, 0x000c], [0x02, 0x0000], [0x04, 0x4021], [0x06, 0x1001],
  [0x0a, 0x0000], [0x0c, 0x0000], [0x0e, 0x000d], [0x10, 0x0000],
  [0x12, 0x0000], [0x14, 0x0000], [0x16, 0x000d], [0x18, 0x0000],
  [0x1a, 0x0000], [0x1c, 0x0000], [0x1e, 0x000d], [0x20, 0x0000],
  [0x22, 0x0000], [0x24, 0x0000], [0x26, 0x000d], [0x28, 0x0000],
  [0x2a, 0x0000], [0x2c, 0x0000], [0x2e, 0x0077], [0x30, 0x0077],
  [0x32, 0x0077], [0x34, 0x0077], [0x36, 0x8888], [0x38, 0x36db],
  [0x3a, 0x0000],
]);

const CHANNEL_COUNT = 4;
const CHANNEL_REGISTERS = Object.freeze(Array.from({ length: CHANNEL_COUNT }, (_, channel) => {
  const baseAddress = 0x0e + (channel * 0x08);
  return Object.freeze([
    { key: 'ctrl', name: `CH${channel}_CTRL`, addr: baseAddress, mask: 0xff3d, formula: 'CH_EN[0] | PGA_GAIN[5:2] | VTH[15:8]' },
    { key: 'feature', name: `CH${channel}_FEAT`, addr: baseAddress + 0x02, mask: 0x000f, formula: 'FEAT_SEL[0] | AVG_TRG_EN[1] | AVG_TRG_HA[3:2]' },
    { key: 'workWindow', name: `CH${channel}_AVG_WORKWIN`, addr: baseAddress + 0x04, mask: 0x0fff, formula: 'WORK_WINDOW[11:0]' },
    { key: 'waitWindow', name: `CH${channel}_AVG_WAITWIN`, addr: baseAddress + 0x06, mask: 0x0fff, formula: 'WAIT_WINDOW[11:0]' },
  ]);
}));

const CHANNEL_VTH = Object.freeze({
  minimumMillivolts: 8,
  maximumMillivolts: 2048,
  stepMillivolts: 8,
});

const FREQUENCY_REGISTERS = Object.freeze([
  { key: 'glbCtrl0', name: 'GLB_CTRL0', addr: 0x00, mask: 0x061d },
  { key: 'glbCtrl1', name: 'GLB_CTRL1', addr: 0x02, mask: 0x45ff },
  { key: 'pllCtrl', name: 'PLL_CTRL', addr: 0x04, mask: 0xffff },
  { key: 'hsiCtrl', name: 'HSI_CTRL', addr: 0x06, mask: 0x1fff },
  { key: 'qspiCtrl', name: 'QSPI_CTRL', addr: 0x0a, mask: 0x0060 },
  { key: 'coCtrl', name: 'CO_CTRL', addr: 0x3a, mask: 0x0038 },
]);

const FREQUENCY_WRITE_ORDER = Object.freeze([0x06, 0x04, 0x0a, 0x3a, 0x00, 0x02]);
const PULSE_WIDTH_CYCLES = Object.freeze([1, 2, 3, 4, 5, 6, 10, 20]);
const PLL_INPUT_DIVISORS = Object.freeze([1, 2, 3, 4]);
const PLL_VCO_MULTIPLIERS = Object.freeze([32, 48, 64, 80, 96, 112, 128, 144]);
const PLL_OUTPUT_DIVISORS = Object.freeze([1, 2, 4, 8]);

const POWER_CONTROL_REGISTER = Object.freeze({
  name: 'PW_CTRL（CPW_CTRL）',
  addr: 0x38,
  mask: 0x7fff,
  fields: Object.freeze([
    { key: 'pwrCtl', name: 'PWR_CTL', label: '全局', shift: 0, element: 'PwrCtl', bits: '2:0' },
    { key: 'ampIn', name: 'PW_AMPIN', label: '输入运放', shift: 3, element: 'AmpIn', bits: '5:3' },
    { key: 'pga', name: 'PW_PGA', label: 'PGA', shift: 6, element: 'Pga', bits: '8:6' },
    { key: 'sampAmp', name: 'PW_SAMPAMP', label: '采样运放', shift: 9, element: 'SampAmp', bits: '11:9' },
    { key: 'comp', name: 'PW_COMP', label: '比较器', shift: 12, element: 'Comp', bits: '14:12' },
  ]),
});

const POWER_LEVELS = Object.freeze([
  { percent: 25, binary: '0b000' }, { percent: 50, binary: '0b001' },
  { percent: 75, binary: '0b010' }, { percent: 100, binary: '0b011' },
  { percent: 125, binary: '0b100' }, { percent: 150, binary: '0b101' },
  { percent: 175, binary: '0b110' }, { percent: 200, binary: '0b111' },
]);

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
  1: '未知错误',
  2: '内存不足',
  3: '参数无效',
  4: '超时',
  5: '不存在',
  6: '状态错误',
  7: '响应过大',
  8: '不支持',
  9: '数据损坏',
  10: '忙',
  11: '访问被拒绝',
};

const state = {
  device: null,
  server: null,
  chars: {},
  smp: null,
  ctrlSeq: 0,
  regSeq: 0,
  sivyTestSeq: 0,
  sivyTestActiveSeq: null,
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
  sivyTestRows: [],
  channelRows: Array.from({ length: CHANNEL_COUNT }, () => []),
  frequencyRows: [],
  powerRows: [],
  sivyTestReferenceOutOfSync: false,
  sivyTestCompletion: null,
  otaBytes: null,
  otaName: '',
  otaInfo: null,
  otaSourceModifiedMs: 0,
  bluetoothReady: false,
  bleKeepConnected: false,
  bleReconnectTimer: 0,
  bleReconnectAttempt: 0,
  autoTest: {
    running: false,
    currentStep: null,
  },
  scope: {
    source: 'video',
    socket: null,
    keepConnected: false,
    reconnectTimer: 0,
    reconnectAttempt: 0,
    frame: null,
    screenshot: null,
    frameCount: 0,
    videoDecoder: null,
    videoGeneration: 0,
    videoQueue: [],
    videoPumping: false,
    videoParameterBytes: null,
    videoFrameCount: 0,
    videoFpsCounter: { startedAt: performance.now(), frames: 0, fps: 0 },
    pendingVideoFrame: null,
    videoFrameRequest: 0,
  },
};

const $ = (id) => document.getElementById(id);
const logView = $('logView');
const canvas = $('sampleCanvas');
const ctx = canvas.getContext('2d');
const scopeCanvas = $('scopeCanvas');
const scopeCtx = scopeCanvas.getContext('2d');

const LANGUAGE_STORAGE_KEY = 'sivy-asc-console-language';
const LANGUAGE_TEXT_EN = Object.freeze({
  'Sivy ASC 寄存器控制台': 'Sivy ASC Register Console',
  'Sivy ASC 寄存器位域配置': 'Sivy ASC Register Bitfield Configuration',
  'ASC 寄存器控制台': 'ASC Register Console',
  'Sivy ASC CH0 寄存器控制台': 'Sivy ASC CH0 Test Console',
  'Sivy ASC CH0 位域配置': 'Sivy ASC CH0 Bitfield Configuration',
  '通道零寄存器控制台': 'Channel 0 Register Console',
  '未连接': 'Disconnected', '已连接': 'Connected', '扫描范围': 'Scan scope', '全部设备': 'All devices',
  '名称前缀': 'Name prefix', '目标服务': 'Target service', '前缀': 'Prefix', '连接设备': 'Connect device',
  '断开': 'Disconnect', '运行环境': 'Runtime environment', '页面来源': 'Page origin', '安全上下文': 'Secure context',
  '网页蓝牙': 'Web Bluetooth', '蓝牙适配器': 'Bluetooth adapter', '本机蓝牙': 'Local Bluetooth',
  '网页蓝牙不可用：请通过 HTTPS 或 http://localhost 提供此目录，不要直接打开 index.html。': 'Web Bluetooth unavailable: serve this directory over HTTPS or http://localhost instead of opening index.html directly.',
  '网页蓝牙不可用：请通过 HTTPS 或本地主机打开此页面。': 'Web Bluetooth unavailable: open this page over HTTPS or from localhost.',
  '网页蓝牙不可用：iPhone/iPad 的 Safari 和 iOS Chrome 不提供网页蓝牙。请使用 Android Chrome/Edge/Samsung Internet 或桌面版 Chrome/Edge。': 'Web Bluetooth is unavailable in Safari and Chrome on iPhone/iPad. Use Android Chrome, Edge, Samsung Internet, or desktop Chrome/Edge.',
  '网页蓝牙不可用：请使用带本机蓝牙适配器的 Android Chrome/Edge/Samsung Internet 或桌面版 Chrome/Edge。': 'Web Bluetooth unavailable: use Android Chrome, Edge, Samsung Internet, or desktop Chrome/Edge on a device with a Bluetooth adapter.',
  '状态': 'Status', '刷新状态': 'Refresh status', '电源': 'Power', '蓝牙': 'Bluetooth', '指示灯': 'LED',
  '采样通知': 'Sample notifications', 'ADC 成功': 'ADC OK', 'ADC 错误': 'ADC errors', 'DAC 成功': 'DAC OK',
  'I2C 错误': 'I2C errors', '应用状态': 'Application state', '配置档': 'Profile', '队列': 'Queue',
  '蓝牙丢弃': 'Bluetooth drops', '打开电源': 'Power on', '关闭电源': 'Power off', '开始布防': 'Start arm',
  '停止布防': 'Stop arm', '低功耗': 'Low power', '探测 DAC': 'Probe DAC', '清计数': 'Clear counters',
  '参数': 'Configuration', '读取': 'Read', '输入模式': 'Input mode', '双极性': 'Bipolar', '单边': 'Single-ended',
  'ADC 数据通知': 'ADC data notifications', 'UART 采样日志': 'UART sample log', 'A 脉冲下阈值': 'A pulse low threshold',
  'B 脉冲上阈值': 'B pulse high threshold', 'C 偏置': 'C bias', 'D 差分': 'D differential',
  '写入配置': 'Write configuration', '应用 DAC': 'Apply DAC', '应用配置': 'Apply configuration', '默认值': 'Defaults',
  'ASC 配置档': 'ASC profile', '应用配置档': 'Apply profile', '启用寄存器配置档': 'Enable register profile',
  '写入后校验': 'Verify after write', '寄存器': 'Register', '目标': 'Target', 'DAC 配置': 'DAC configuration',
  'MCU 状态': 'MCU status', '诊断计数': 'Diagnostics', '数据宽度': 'Data width', '16 位': '16-bit',
  '32 位': '32-bit', '8 位': '8-bit', '地址': 'Address', '数值': 'Value', '掩码': 'Mask',
  '写入': 'Write', '更新位': 'Update bits', 'ASC 寄存器测试': 'ASC Register Test', '导出 CSV': 'Export CSV',
  '清空': 'Clear', '预设': 'Preset', '基础读取': 'Basic reads', '当前配置档': 'Current profile', '自定义': 'Custom',
  '读取寄存器': 'Registers to read', '执行读取': 'Run reads', '执行完整流程': 'Run full flow',
  '启用写入校验': 'Enable write verification', '安全寄存器': 'Safe register', '测试值': 'Test value',
  '写入校验': 'Write verification', '步骤': 'Step', '操作': 'Operation', '期望值': 'Expected', '实际值': 'Actual',
  '说明': 'Notes', 'Sivy I2C 参考测试': 'Sivy I2C Reference Test',
  '由固件读取参考文件中的全部 29 个寄存器并在设备侧比较；网页显示逐项通知和最终通过/失败汇总。': 'The firmware reads all 29 reference registers and compares them on the device. This page shows each result notification and the final pass/fail summary.',
  '执行只读快照': 'Run read-only snapshot', '允许写 PW_CTRL（CPW_CTRL）[0x38] = 0x36DB': 'Allow PW_CTRL (CPW_CTRL) [0x38] = 0x36DB write',
  '请先确认允许写入 PW_CTRL（CPW_CTRL）[0x38] = 0x36DB': 'Confirm that writing PW_CTRL (CPW_CTRL) [0x38] = 0x36DB is allowed first.',
  '执行选定的初始化写入': 'Run selected initialization write', '等待固件测试结果': 'Waiting for firmware test results',
  '序号': 'Index', '名称': 'Name', '结果': 'Result', '匹配/不匹配/I2C 错误': 'Match / mismatch / I2C errors',
  'ASC 四通道寄存器配置': 'ASC Four-Channel Register Configuration',
  'CH0 至 CH3 使用相同的使能、PGA、阈值和特征提取位域；每个通道独立计算、掩码写入、回读反解和导出结果。': 'CH0 through CH3 use the same enable, PGA, threshold, and feature-extraction bitfields. Each channel calculates, writes masked bits, decodes readback, and exports results independently.',
  '确认写入当前通道可写位': 'Confirm writable-bit changes for this channel',
  'CH0 寄存器配置': 'CH0 Register Configuration', '读取 CH0 并反解': 'Read and decode CH0',
  '写入并回读校验': 'Write and verify readback', '清空结果': 'Clear results',
  '控件只覆盖 CH0 的可写位：CH0_CTRL[0x0E]、CH0_FEAT[0x10]、CH0_AVG_WORKWIN[0x12]、CH0_AVG_WAITWIN[0x14]。 页面实时计算位域值，并使用掩码更新保留位不变。': 'Controls cover only CH0 writable bits: CH0_CTRL[0x0E], CH0_FEAT[0x10], CH0_AVG_WORKWIN[0x12], and CH0_AVG_WAITWIN[0x14]. Values are calculated live and masked updates preserve reserved bits.',
  '阈值电压 VTH（mV，bits 15:8）': 'VTH threshold voltage (mV, bits 15:8)',
  '仅支持 8 mV 整数档；页面会自动换算 VTH 原始码': 'Only 8 mV steps are supported; the page calculates the VTH register code automatically.',
  '特征模式（FEAT_SEL，bit 0）': 'Feature mode (FEAT_SEL, bit 0)', '脉冲时间戳': 'Pulse timestamp',
  '窗口内周期均值': 'In-window periodic average', '均值触发（AVG_TRG_EN，bit 1）': 'Average trigger (AVG_TRG_EN, bit 1)',
  '均值触发边沿（AVG_TRG_HA，bits 3:2）': 'Average trigger edge (AVG_TRG_HA, bits 3:2)',
  '上升沿': 'Rising edge', '下降沿': 'Falling edge', '上升沿或下降沿': 'Rising or falling edge',
  '工作窗口（bits 11:0）': 'Work window (bits 11:0)', '等待窗口（bits 11:0）': 'Wait window (bits 11:0)',
  '读写前打开 ASC 外部电源': 'Power ASC externally before read/write', '确认写入 CH0 可写位': 'Confirm CH0 writable-bit write',
  '可写掩码': 'Writable mask', '计算值': 'Calculated value', '位域计算': 'Bitfield calculation',
  '调整控件后会实时显示计算寄存器值；写入前需要勾选确认。': 'Adjust controls to calculate register values live; confirmation is required before writing.',
  'ASC 时钟与频率控制': 'ASC Clock and Frequency Control',
  '控件来自寄存器表 v4p4，覆盖系统时钟、PLL/HSI、MC 分频、输出脉宽、输入带宽、QSPI 分频和 CO 时钟输出。 页面只更新对应位域，其他控制位与保留位保持不变。': 'Controls are based on register table v4p4 and cover the system clock, PLL/HSI, MC divider, output pulse width, input bandwidth, QSPI divider, and CO clock output. Only the listed bitfields are updated; all other control and reserved bits are preserved.',
  '系统时钟与输出脉冲': 'System clock and output pulse',
  '工作频率（CLK_SEL，bit 0）': 'Operating frequency (CLK_SEL, bit 0)',
  '主时钟来源（CLK_IN_SEL，bit 0）': 'Main clock source (CLK_IN_SEL, bit 0)',
  'HSI 内部振荡器': 'HSI internal oscillator',
  'MC 输入分频（MC_SEL，bits 8:1）': 'MC input divider (MC_SEL, bits 8:1)',
  '0：不分频；2 至 254：偶数分频': '0: no division; 2 to 254: even-number divisors',
  '输出脉宽（SAMP_CTRL，bits 4:2）': 'Output pulse width (SAMP_CTRL, bits 4:2)',
  '4 MC（默认）': '4 MC (default)',
  '通道输入带宽（CC_SEL，bits 10:9）': 'Channel input bandwidth (CC_SEL, bits 10:9)',
  '> 2 MHz（默认）': '> 2 MHz (default)', '1 MHz 至 2 MHz': '1 MHz to 2 MHz',
  '800 kHz 至 1 MHz': '800 kHz to 1 MHz',
  '采样开关（SAMPSW_SEL，bit 10）': 'Sampling switch (SAMPSW_SEL, bit 10)',
  '低速开关（默认）': 'Low-speed switch (default)', '高速开关（输入 > 1 MHz）': 'High-speed switch (input > 1 MHz)',
  'PLL 输入与调节': 'PLL input and tuning',
  'PLL 输入来源（PLL_CLK_SEL，bit 14）': 'PLL input source (PLL_CLK_SEL, bit 14)',
  'ECLK / HSE 外部晶振': 'ECLK / HSE external crystal',
  '外部输入频率（MHz，仅用于预计）': 'External input frequency (MHz, estimate only)',
  '选择 ECLK/HSE 时填写；不会写入寄存器': 'Required for ECLK/HSE; this value is not written to a register',
  'PLL 预计输出频率：--': 'Estimated PLL output frequency: --',
  'PLL 使能（PLL_EN，bit 0）': 'PLL enable (PLL_EN, bit 0)',
  '电荷泵增益（PLL_DICP，bit 1）': 'Charge-pump gain (PLL_DICP, bit 1)', '0（默认）': '0 (default)',
  'KVCO 调节（RES_PLL_CTR，bits 5:2）': 'KVCO tuning (RES_PLL_CTR, bits 5:2)',
  '0：频率较大；8：默认；15：频率较小': '0: higher frequency; 8: default; 15: lower frequency',
  '输入分频 M（PLL_DM，bits 7:6）': 'Input divider M (PLL_DM, bits 7:6)',
  'VCO 倍频 N（PLL_DN，bits 10:8）': 'VCO multiplier N (PLL_DN, bits 10:8)',
  '输出分频 P（PLL_DP，bits 12:11）': 'Output divider P (PLL_DP, bits 12:11)',
  'PLL 旁路（PLL_BYPASS，bit 13）': 'PLL bypass (PLL_BYPASS, bit 13)',
  'PLL 功耗（PLL_PW，bits 15:14）': 'PLL power (PLL_PW, bits 15:14)', '100%（默认）': '100% (default)',
  'HSI 使能（HSI_EN，bit 0）': 'HSI enable (HSI_EN, bit 0)',
  'HSI 标称频率（HSI_SEL，bit 1）': 'HSI nominal frequency (HSI_SEL, bit 1)',
  '48 MHz（默认）': '48 MHz (default)',
  'HSI 粗调（HSI_TRIM[10:6]）': 'HSI coarse trim (HSI_TRIM[10:6])',
  'HSI 细调（HSI_TRIM[5:0]）': 'HSI fine trim (HSI_TRIM[5:0])',
  '接口与时钟输出': 'Interface and clock output',
  'QSPI 主模式时钟分频（SCLK_FRQ，bits 6:5）': 'QSPI master clock divider (SCLK_FRQ, bits 6:5)',
  '不分频': 'No division',
  'CO 时钟输出（COSEL，bits 5:3）': 'CO clock output (COSEL, bits 5:3)',
  '关闭': 'Disabled', 'ECLK 外部晶振': 'ECLK external crystal', '系统时钟': 'System clock',
  '保留值 0b101': 'Reserved value 0b101', '保留值 0b110': 'Reserved value 0b110', '保留值 0b111': 'Reserved value 0b111',
  '确认写入时钟与频率位域': 'Confirm clock and frequency bitfield write',
  '调整控件后会实时显示频率相关寄存器值；写入前需要勾选确认。': 'Adjust controls to calculate frequency-related registers live; confirmation is required before writing.',
  'ASC 功耗控制器': 'ASC Power Controller', '读取并反解': 'Read and decode', '应用挡位并回读': 'Apply level and read back',
  '写入，不修改保留的 bit 15。': 'to write without changing reserved bit 15.',
  'bits 2:0 · 全局': 'bits 2:0 · Global', 'bits 5:3 · 输入运放': 'bits 5:3 · Input amplifier',
  'bits 11:9 · 采样运放': 'bits 11:9 · Sampling amplifier', 'bits 14:12 · 比较器': 'bits 14:12 · Comparator',
  '五个滑块分别配置 PW_CTRL（旧名 CPW_CTRL）[0x38] 的全局、输入运放、PGA、采样运放和比较器功耗。 每个字段可独立选择 25% 至 200%；页面通过 UPDATE_BITS 掩码 0x7FFF 写入，不修改保留的 bit 15。': 'Five sliders independently configure global, input-amplifier, PGA, sampling-amplifier, and comparator power in PW_CTRL (formerly CPW_CTRL) [0x38]. Each field can be set from 25% to 200%. UPDATE_BITS uses mask 0x7FFF and preserves bit 15.',
  '五个滑块分别配置 PW_CTRL（旧名 CPW_CTRL）[0x38] 的全局、输入运放、PGA、采样运放和比较器功耗。 每个字段可独立选择 25% 至 200%；页面通过 UPDATE_BITS 掩码': 'Five sliders independently configure global, input-amplifier, PGA, sampling-amplifier, and comparator power in PW_CTRL (formerly CPW_CTRL) [0x38]. Each field can be set from 25% to 200%. UPDATE_BITS uses mask',
  '确认写入 PW_CTRL 的五个独立功耗字段': 'Confirm the five independent PW_CTRL power fields',
  '五个滑块可独立调整；写入前需要勾选确认。': 'The five sliders can be adjusted independently; confirmation is required before writing.',
  '采样': 'Sampling', '清图': 'Clear plot', '0 个采样': '0 samples', '最新值：--': 'Latest: --',
  '镜像状态': 'Image state', '未选择文件': 'No file selected', '空闲': 'Idle', '上传并测试': 'Upload and test',
  '选择 OTA 文件': 'Choose OTA file',
  '重启': 'Restart', '事件': 'Events', '0x3：1x（默认）': '0x3: 1x (default)',
  '一键自动测试': 'One-Click Automatic Test', '一键连接并测试': 'Connect and run all tests',
  '依次连接 Sivy 蓝牙设备、执行 I²C 参考测试，并只配置 CH0 的 32 mV 阈值。 浏览器出于安全限制要求在选择器中人工点选一次 Sivy 设备，其余步骤自动完成。':
    'Connect to the Sivy Bluetooth device, run the I²C reference test, and configure only CH0 with a 32 mV threshold. Browser security requires selecting the Sivy device once in the picker; all remaining steps run automatically.',
  '连接目标蓝牙设备': 'Connect target Bluetooth device', '待执行': 'Pending',
  '名称以 Sivy 开头；目标地址 C3:09:E1:7D:0D:08': 'Name starts with Sivy; target address C3:09:E1:7D:0D:08',
  '等待上一步': 'Waiting for previous step', 'Sivy I²C 参考测试': 'Sivy I²C Reference Test',
  '仅数值不匹配时给出警告并继续；I²C 通信错误会中止流程。':
    'Value-only mismatches produce a warning and continue; I²C communication errors stop the workflow.',
  '配置 CH0 并回读校验': 'Configure CH0 and verify readback',
  '勾选可写位确认，设置阈值 32 mV，执行掩码写入和四项寄存器回读。':
    'Confirm writable bits, set the threshold to 32 mV, then perform masked writes and readback verification for four registers.',
  '实时波形监视': 'Live Waveform Monitor', 'BLE 待连接': 'BLE disconnected', '等待 RIGOL 实时画面': 'Waiting for the RIGOL live view',
  '连接示波器后直接显示原厂 H.264 图像流。': 'Connect the oscilloscope to show its native H.264 stream directly.',
  '数据源：ASC BLE ADC': 'Source: ASC BLE ADC', '尚无数据帧': 'No data frames',
  '显示源': 'Display source', 'RIGOL 高帧率实时画面': 'RIGOL high-frame-rate live view',
  'RIGOL 截图兼容模式': 'RIGOL screenshot compatibility mode',
  '示波器 IP': 'Oscilloscope IP', '截图刷新间隔': 'Screenshot interval', '数据桥地址': 'Data bridge URL',
  '访问密钥': 'Access key', '本机桥可留空': 'Leave empty for the local bridge',
  '本机使用保持 ws://127.0.0.1:8765；公网桥应填写 wss:// 地址和访问密钥。使用前请手动运行 start-scope-bridge.cmd。':
    'Keep ws://127.0.0.1:8765 locally. A public bridge requires a wss:// URL and access key. Run start-scope-bridge.cmd manually before use.',
  'BLE 数据已接入': 'BLE data ready', '原厂高帧率画面': 'Native high-frame-rate view',
  '全屏显示': 'Fullscreen', '退出全屏': 'Exit fullscreen',
  '连接数据源': 'Connect data source', '断开数据源': 'Disconnect data source',
  'RIGOL MHO 5054 · 192.168.110.10': 'RIGOL MHO 5054 · 192.168.110.10',
  '默认直接播放示波器 H.264 实时画面；截图模式仅用于兼容排查。MAC 仅用于核对，连接使用 IP。':
    'The default view plays the oscilloscope H.264 stream directly. Screenshot mode is only a compatibility fallback. MAC is for identification only; the IP is used to connect.',
  '信号发生器 RIGOL DG4102': 'RIGOL DG4102 Signal Generator',
  '默认 CH1、三角波、1 Vpp、1 kHz。调整后点击一次即可写入并打开输出。':
    'Defaults to CH1, triangle, 1 Vpp, 1 kHz. Click once to apply the settings and enable the output.',
  '信号发生器 IP': 'Signal-generator IP', '输出通道': 'Output channel', '波形': 'Waveform',
  '三角波': 'Triangle', '正弦波': 'Sine', '方波': 'Square', '脉冲': 'Pulse',
  '幅值（Vpp）': 'Amplitude (Vpp)', '频率（Hz）': 'Frequency (Hz)', '输出负载': 'Output load',
  '高阻（High-Z）': 'High-Z', '应用并打开输出': 'Apply and enable output',
  '读取当前设置': 'Read current settings', '关闭当前通道': 'Disable current channel',
  '方波和脉冲默认使用 50% 占空比；三角波使用固定 50% 对称度。该操作不会加入一键自动测试。':
    'Square and pulse use 50% duty by default; triangle uses 50% symmetry. This operation is not part of the one-click workflow.',
  '0x8：0.25x（低噪声档）': '0x8: 0.25x (low-noise)', '0x9：0.333x（低噪声档）': '0x9: 0.333x (low-noise)',
  '0xA：0.4x（低噪声档）': '0xA: 0.4x (low-noise)', '0xB：0.5x（低噪声档）': '0xB: 0.5x (low-noise)',
  '0xC：0.667x（低噪声档）': '0xC: 0.667x (low-noise)', '0xD：1x（低噪声档）': '0xD: 1x (low-noise)',
  '0xE：1.333x（低噪声档）': '0xE: 1.333x (low-noise)', '0xF：2x（低噪声档）': '0xF: 2x (low-noise)',
});

const LANGUAGE_FRAGMENT_EN = Object.freeze([
  ['自动测试正在执行', 'Automated test is running'],
  ['自动测试已完成', 'Automated test completed'],
  ['自动测试已中止', 'Automated test stopped'],
  ['蓝牙连接步骤', 'Bluetooth connection step'],
  ['正在打开 Sivy 设备选择器', 'Opening the Sivy device picker'],
  ['浏览器选择器中，请选择名称以 Sivy 开头的设备', 'In the browser picker, select the device whose name starts with Sivy'],
  ['浏览器不提供蓝牙 MAC 地址，选择时请核对目标地址', 'Browsers do not expose the Bluetooth MAC address; verify the target address in the picker'],
  ['当前连接不是 Sivy 设备', 'The current connection is not a Sivy device'],
  ['正在执行 Sivy I²C 参考测试', 'Running the Sivy I²C reference test'],
  ['参考测试完成', 'Reference test completed'],
  ['数值不匹配，按流程继续', 'Value mismatches found; continuing as configured'],
  ['I²C 通信错误，流程已停止', 'I²C communication errors found; workflow stopped'],
  ['参考表不一致，流程已停止', 'Reference table mismatch; workflow stopped'],
  ['测试结果不完整，流程已停止', 'Incomplete test results; workflow stopped'],
  ['正在配置 CH0', 'Configuring CH0'],
  ['阈值 32 mV，准备掩码写入', 'Threshold is 32 mV; preparing masked writes'],
  ['CH0 已写入并回读校验通过', 'CH0 writes and readback verification passed'],
  ['CH0 回读校验失败，流程已停止', 'CH0 readback verification failed; workflow stopped'],
  ['后续步骤已锁定', 'Remaining steps are blocked'],
  ['已完成全部自动步骤，可以查看下方波形', 'All automated steps completed; review the waveform below'],
  ['连接数据源失败', 'Unable to connect data source'],
  ['外部示波器数据源已连接', 'External oscilloscope data source connected'],
  ['外部示波器数据源已断开', 'External oscilloscope data source disconnected'],
  ['外部示波器数据格式无效', 'Invalid external oscilloscope data format'],
  ['收到波形帧', 'Waveform frame received'],
  ['收到示波器截图', 'Oscilloscope screenshot received'],
  ['等待外部示波器数据', 'Waiting for external oscilloscope data'],
  ['正在显示 ASC BLE 实时采样', 'Showing ASC BLE live samples'],
  ['尚无波形数据', 'No waveform data yet'],
  ['数据源地址必须使用 ws:// 或 wss://', 'The data-source URL must use ws:// or wss://'],
  ['固定 MAC 地址无法由网页直接校验', 'The web page cannot directly verify the fixed MAC address'],
  ['设备名称', 'Device name'], ['设备标识', 'Device ID'], ['匹配', 'match'], ['不匹配', 'mismatch'],
  ['I²C 错误', 'I²C errors'], ['自动流程', 'Automated workflow'], ['配置 CH0', 'Configure CH0'],
  ['正在读取频率相关寄存器并反解位域', 'Reading frequency-related registers and decoding bitfields'],
  ['正在按安全顺序写入时钟与频率位域', 'Writing clock and frequency bitfields in source-safe order'],
  ['全部频率相关寄存器均已写入并回读校验通过。', 'All frequency-related registers passed write and readback verification.'],
  ['已读取六个频率相关寄存器，并已反解到配置控件。', 'Read six frequency-related registers and decoded them into the controls.'],
  ['调整控件后会实时显示频率相关寄存器值', 'Adjust controls to calculate frequency-related register values live'],
  ['频率寄存器计算失败', 'Frequency register calculation failed'],
  ['当前时钟链路依赖 HSI，但 HSI_EN 已关闭', 'The current clock path depends on HSI, but HSI_EN is disabled'],
  ['主时钟已选择 PLL，但 PLL_EN 已关闭且未旁路', 'PLL is selected as the main clock, but PLL_EN is disabled and bypass is off'],
  ['频率位域与计算值一致', 'Frequency bitfields match the calculated value'],
  ['个寄存器的频率位域与计算值不匹配', ' frequency register bitfields differ from the calculated values'],
  ['非目标位不参与比较', 'Non-target bits are excluded from comparison'],
  ['确认允许写入时钟与频率位域', 'Confirm that writing clock and frequency bitfields is allowed'],
  ['MC_SEL 只能为 0 或 2 至 254 的偶数', 'MC_SEL must be 0 or an even divisor from 2 to 254'],
  ['是保留值，请选择 0 至 4', 'is reserved; select a value from 0 through 4'],
  ['PLL 输出跟随', 'PLL output follows'], ['未计 HSI_TRIM 偏移', 'excluding HSI_TRIM offset'],
  ['PLL 预计输出频率：请输入 ECLK/HSE 输入频率。', 'Estimated PLL output frequency: enter the ECLK/HSE input frequency.'],
  ['PLL 预计输出频率：', 'Estimated PLL output frequency: '], ['请输入输入频率', 'enter the input frequency'],
  ['旁路', 'bypass'], ['必须是大于 0 的有效频率', 'must be a valid frequency greater than 0'],
  ['不参与输出频率', 'do not affect the output frequency'],
  ['按寄存器分频定义', 'Using the register divider definitions'], ['PLL 输出', 'PLL output'], ['倍率', 'ratio'],
  ['粗调码', 'coarse code'], ['细调码', 'fine code'],
  ['切换或调节频率后芯片至少需要 1 µs 稳定时间', 'The device needs at least 1 µs to settle after switching or tuning the frequency'],
  ['粗调', 'coarse trim'], ['细调', 'fine trim'], ['不分频', 'no division'], ['系统时钟', 'system clock'], ['关闭', 'Disabled'],
  ['频率控制 CSV 未导出：没有读写结果', 'Frequency-control CSV not exported: there are no results'],
  ['频率控制 CSV 已导出：', 'Frequency-control CSV exported: '],
  ['五个独立功耗字段已回读校验', 'Five independent power fields passed readback verification'],
  ['PW_CTRL 的五个独立功耗字段已写入并回读校验通过。', 'The five independent PW_CTRL power fields passed write and readback verification.'],
  ['PW_CTRL 回读值与所选独立功耗挡位不一致。', 'PW_CTRL readback differs from the selected independent power levels.'],
  ['已读取 PW_CTRL，并已反解到五个独立滑块。', 'Read PW_CTRL and decoded it into five independent sliders.'],
  ['已反解到五个独立滑块', 'Decoded into five independent sliders'],
  ['正在写入五个独立功耗字段', 'Writing five independent power fields'],
  ['确认允许写入 PW_CTRL 的五个独立功耗字段', 'Confirm that writing the five independent PW_CTRL power fields is allowed'],
  ['五路独立', 'Five independent fields'], ['功耗挡位', 'power level'], ['档位', 'level'],
  ['五个滑块分别配置', 'Five sliders independently configure'],
  ['每个字段可独立选择', 'Each field can independently select'],
  ['目标 PW_CTRL', 'Target PW_CTRL'], ['bit 15 保留', 'bit 15 is preserved'],
  ['将通过本机扫描附近设备', 'will scan nearby devices using the local Bluetooth adapter'],
  ['设备扫描附近设备', 'device to scan nearby devices'], ['移动', 'mobile'], ['本地主机', 'localhost'],
  ['网页测试控制台版本', 'Web test console version'], ['网页蓝牙不可用', 'Web Bluetooth unavailable'],
  ['网页蓝牙已就绪', 'Web Bluetooth is ready'], ['当前页面不是安全上下文', 'The current page is not a secure context'],
  ['固件期望值不一致', 'Firmware reference mismatch'], ['固件参考值与 Excel 不一致', 'Firmware reference differs from Excel'],
  ['等待固件测试结果', 'Waiting for firmware test results'], ['正在执行测试并回传结果', 'The firmware is running the test and returning results'],
  ['初始化写入', 'Initialization write'], ['数值不匹配', 'Value mismatch'], ['已读取并等待反解', 'Read; waiting for decode'],
  ['已读取并反解到配置控件', 'Read and decoded into controls'],
  ['正在读取 CH0 寄存器并反解位域', 'Reading CH0 registers and decoding bitfields'],
  ['正在读取 CH1 寄存器并反解位域', 'Reading CH1 registers and decoding bitfields'],
  ['正在读取 CH2 寄存器并反解位域', 'Reading CH2 registers and decoding bitfields'],
  ['正在读取 CH3 寄存器并反解位域', 'Reading CH3 registers and decoding bitfields'],
  ['正在按位域掩码写入 CH0 寄存器', 'Writing CH0 registers with bitfield masks'],
  ['正在按位域掩码写入 CH1 寄存器', 'Writing CH1 registers with bitfield masks'],
  ['正在按位域掩码写入 CH2 寄存器', 'Writing CH2 registers with bitfield masks'],
  ['正在按位域掩码写入 CH3 寄存器', 'Writing CH3 registers with bitfield masks'],
  ['正在读取 PW_CTRL 并反解五个功耗字段', 'Reading PW_CTRL and decoding five power fields'],
  ['写入后的四个 CH0 寄存器均已回读校验通过。', 'All four CH0 registers passed readback verification.'],
  ['写入后的四个 CH1 寄存器均已回读校验通过。', 'All four CH1 registers passed readback verification.'],
  ['写入后的四个 CH2 寄存器均已回读校验通过。', 'All four CH2 registers passed readback verification.'],
  ['写入后的四个 CH3 寄存器均已回读校验通过。', 'All four CH3 registers passed readback verification.'],
  ['已读取四个 CH0 寄存器，并已反解到配置控件。', 'Read four CH0 registers and decoded them into the controls.'],
  ['已读取四个 CH1 寄存器，并已反解到配置控件。', 'Read four CH1 registers and decoded them into the controls.'],
  ['已读取四个 CH2 寄存器，并已反解到配置控件。', 'Read four CH2 registers and decoded them into the controls.'],
  ['已读取四个 CH3 寄存器，并已反解到配置控件。', 'Read four CH3 registers and decoded them into the controls.'],
  ['请先确认允许写入 CH0 的可写位', 'Confirm CH0 writable-bit changes first'],
  ['请先确认允许写入 CH1 的可写位', 'Confirm CH1 writable-bit changes first'],
  ['请先确认允许写入 CH2 的可写位', 'Confirm CH2 writable-bit changes first'],
  ['请先确认允许写入 CH3 的可写位', 'Confirm CH3 writable-bit changes first'],
  ['读回保留值 0b11；控件保留为上升沿，写入前请确认芯片状态。', 'read back reserved value 0b11; the control remains on rising edge, so verify the device state before writing.'],
  ['CSV 未导出：没有读写结果', 'CSV not exported: there are no read/write results'],
  ['读写 CSV 已导出：', 'read/write CSV exported: '], [' 行', ' rows'],
  ['REG_REQ 读取失败', 'REG_REQ read failed'], ['REG_REQ 更新失败', 'REG_REQ update failed'], ['等待 REG_RSP 响应超时', 'Timed out waiting for REG_RSP'],
  ['请先确认允许写入', 'Confirm that writing is allowed first'], ['写入前需要勾选确认', 'confirmation is required before writing'],
  ['可写位与计算值一致', 'Writable bits match the calculated value'], ['保留位未参与比较', 'Reserved bits are excluded from comparison'],
  ['掩码位匹配', 'Masked bits match'], ['掩码位不匹配', 'Masked bits do not match'], ['掩码位已恢复', 'Masked bits restored'],
  ['恢复值不匹配', 'Restored value mismatch'], ['读取完成：', 'Read complete: '], ['写入失败', 'Write failed'],
  ['读取失败', 'Read failed'], ['回读值与所选功耗挡位不一致', 'Readback differs from selected power level'],
  ['功耗字段不匹配', 'Power fields do not match'], ['位域不匹配', 'Bitfields do not match'], ['I2C/REG 错误', 'I2C/REG errors'],
  ['通过', 'Pass'], ['已接受', 'Accepted'], ['已跳过', 'Skipped'], ['跳过', 'Skip'], ['掩码写入', 'Masked write'], ['校验', 'Verify'], ['恢复', 'Restore'],
  ['读取原值', 'Read original'], ['更新位', 'Update bits'], ['恢复原值', 'Restore original'], ['回读', 'Readback'],
  ['寄存器操作失败', 'Register operation failed'], ['寄存器计算失败', 'Register calculation failed'], ['功耗寄存器计算失败', 'Power register calculation failed'],
  ['功耗挡位必须是', 'Power level must be'], ['必须是', 'must be'], ['整数', 'an integer'], ['数值不能为空', 'Value is required'],
  ['数值格式无效', 'Invalid numeric format'], ['寄存器超出范围', 'Register is out of range'], ['范围格式无效', 'Invalid range format'],
  ['寄存器列表不能为空', 'Register list is required'], ['寄存器数量不能超过', 'Register count cannot exceed'],
  ['设备已断开连接', 'Device disconnected'], ['所选设备没有 ASC GATT 服务', 'The selected device does not provide the ASC GATT service'],
  ['正在打开蓝牙设备选择器', 'Opening Bluetooth device chooser'], ['已选择蓝牙设备', 'Selected Bluetooth device'], ['已连接到', 'Connected to'],
  ['已读取状态', 'Status read'], ['已读取配置', 'Configuration read'], ['已写入配置', 'Configuration written'],
  ['SMP OTA 服务已就绪', 'SMP OTA service ready'], ['SMP OTA 不可用', 'SMP OTA unavailable'],
  ['正在上传', 'Uploading'], ['上传后的镜像状态', 'Image state after upload'], ['正在读取镜像状态', 'Reading image state'],
  ['正在计算镜像哈希', 'Calculating image hash'], ['正在发送分块', 'Sending chunk'], ['已完成：', 'Complete: '],
  ['失败：', 'Failed: '], ['已就绪：', 'Ready: '], ['加载失败：', 'Load failed: '], ['错误：', 'Error: '],
  ['本地文件', 'Local file'], ['本地主机', 'Localhost'], ['可用', 'Available'], ['不可用', 'Unavailable'],
  ['已打开', 'On'], ['已关闭', 'Off'], ['正在广播', 'Advertising'], ['安全启动', 'Boot safe'], ['已连接空闲', 'Connected idle'],
  ['已布防', 'Armed'], ['正在采集', 'Capturing'], ['未知状态', 'Unknown status'], ['未知错误', 'Unknown error'],
  ['内存不足', 'Out of memory'], ['参数无效', 'Invalid parameter'], ['状态无效', 'Invalid state'], ['状态错误', 'Invalid state'],
  ['不支持', 'Unsupported'], ['超时', 'Timeout'], ['不存在', 'Not found'], ['响应过大', 'Response too large'],
  ['数据损坏', 'Data corrupted'], ['访问被拒绝', 'Access denied'], ['忙', 'Busy'], ['正常', 'OK'], ['拒绝执行', 'Denied'],
]);

const languageOriginalText = new WeakMap();
let activeLanguage = 'en';
let languageObserver = null;

function normalizeLanguageText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function englishText(value) {
  const leading = String(value ?? '').match(/^\s*/)?.[0] || '';
  const trailing = String(value ?? '').match(/\s*$/)?.[0] || '';
  const normalized = normalizeLanguageText(value);
  if (!normalized) return value;
  if (LANGUAGE_TEXT_EN[normalized]) return `${leading}${LANGUAGE_TEXT_EN[normalized]}${trailing}`;

  let translated = normalized;
  for (const [source, target] of LANGUAGE_FRAGMENT_EN) {
    translated = translated.replaceAll(source, target);
  }
  return /[\p{Script=Han}]/u.test(translated) ? `${leading}Status updated${trailing}` : `${leading}${translated}${trailing}`;
}

function textNodeCanBeLocalized(node) {
  const tagName = node.parentElement?.tagName;
  return tagName !== 'SCRIPT' && tagName !== 'STYLE' && tagName !== 'PRE';
}

function localizeTextNode(node) {
  if (!textNodeCanBeLocalized(node)) return;
  if (!languageOriginalText.has(node)) languageOriginalText.set(node, node.nodeValue);
  const original = languageOriginalText.get(node);
  const next = activeLanguage === 'en' ? englishText(original) : original;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function localizeDocumentText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) localizeTextNode(node);
}

function localizeAttributes() {
  document.documentElement.lang = activeLanguage === 'en' ? 'en' : 'zh-CN';
  document.title = activeLanguage === 'en' ? 'Sivy ASC Register Console' : 'Sivy ASC 寄存器控制台';
  document.querySelector('.brand-logo').alt = activeLanguage === 'en' ? 'Sivy logo' : 'Sivy 标志';
  $('refreshBtn').title = activeLanguage === 'en' ? 'Refresh status' : '刷新状态';
  for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
    $(channelElementId(channel, 'VthMv')).title = activeLanguage === 'en'
      ? 'Only 8 mV steps are supported; the page calculates the VTH register code automatically.'
      : '仅支持 8 mV 整数档；页面会自动换算 VTH 原始码';
  }
  $('frequencyExternalClockMHz').placeholder = activeLanguage === 'en' ? 'e.g. 50' : '例如 50';
  $('languageLabel').textContent = activeLanguage === 'en' ? 'Language' : '语言';
  $('languageSelect').setAttribute('aria-label', activeLanguage === 'en' ? 'Language' : '语言');
  $('languageSelect').options[0].textContent = activeLanguage === 'en' ? 'English' : '英文';
  $('languageSelect').options[1].textContent = activeLanguage === 'en' ? 'Chinese' : '中文';
  for (const field of POWER_CONTROL_REGISTER.fields) {
    $(`power${field.element}Level`).setAttribute(
      'aria-label',
      activeLanguage === 'en' ? `${field.name} power level` : `${field.name} 功耗挡位`,
    );
  }
}

function localizeOtaPanel() {
  const english = activeLanguage === 'en';
  $('imageStateBtn').textContent = english ? 'Image state' : '镜像状态';
  $('otaChooseFileBtn').textContent = english ? 'Choose OTA file' : '选择 OTA 文件';
  $('otaUploadBtn').textContent = english ? 'Upload and test' : '上传并测试';
  $('resetBtn').textContent = english ? 'Restart' : '重启';
  if (!$('otaFile').files?.length) $('otaFileName').textContent = english ? 'No file selected' : '未选择文件';
  if (normalizeLanguageText($('otaProgressText').textContent) === (english ? '空闲' : 'Idle')) {
    $('otaProgressText').textContent = english ? 'Idle' : '空闲';
  }
}

function applyLanguage(language, persist = true) {
  activeLanguage = language === 'zh' ? 'zh' : 'en';
  localizeAttributes();
  localizeDocumentText();
  localizeOtaPanel();
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLanguage);
    } catch (_) {
      return;
    }
  }
}

function initLanguageControl() {
  const selector = $('languageSelect');
  let savedLanguage = 'en';
  try {
    savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
  } catch (_) {
    savedLanguage = 'en';
  }
  selector.value = savedLanguage === 'zh' ? 'zh' : 'en';
  languageObserver = new MutationObserver((records) => {
    if (activeLanguage !== 'en') return;
    for (const record of records) {
      if (record.type === 'characterData') localizeTextNode(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node);
        if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) localizeTextNode(walker.currentNode);
        }
      }
    }
  });
  languageObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
  selector.addEventListener('change', () => applyLanguage(selector.value));
  applyLanguage(selector.value, false);
}

function log(message) {
  const localizedMessage = activeLanguage === 'en' ? englishText(message) : message;
  const line = `[${new Date().toLocaleTimeString()}] ${localizedMessage}`;
  logView.textContent = `${line}\n${logView.textContent}`.slice(0, 12000);
}

function setConnected(connected) {
  $('connectionDot').classList.toggle('connected', connected);
  $('connectionText').textContent = connected ? '已连接' : '未连接';
  const alwaysEnabled = new Set([
    'clearLogBtn',
    'ascTestClearBtn',
    'ascTestExportBtn',
    'sivyTestClearBtn',
    'sivyTestExportBtn',
    'frequencyClearBtn',
    'frequencyExportBtn',
    'powerClearBtn',
    'powerExportBtn',
    'scopeSourceOption',
    'scopeStreamUrl',
    'scopeConnectBtn',
    'scopeClearBtn',
    'scopeFullscreenBtn',
    'generatorApplyBtn',
    'generatorReadBtn',
    'generatorOutputOffBtn',
  ]);
  for (const button of document.querySelectorAll('button')) {
    if (button.id === 'autoRunBtn') continue;
    if (button.id !== 'connectBtn') {
      button.disabled = !connected && !alwaysEnabled.has(button.id);
    }
  }
  $('connectBtn').disabled = connected || !state.bluetoothReady;
  syncAutomationControls();
  syncScopeControls();
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
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1') return '本地主机';
  if (location.protocol === 'https:') return 'HTTPS';
  if (location.protocol === 'http:') return 'HTTP';
  return location.protocol.replace(':', '') || '--';
}

function detectClientPlatform() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPadOS;
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|Tablet/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isEdge = /EdgA|EdgiOS|Edg\//i.test(ua);
  const isChrome = /Chrome|CriOS|Chromium/i.test(ua) && !isEdge && !isSamsung;

  return { isIOS, isAndroid, isMobile, isSamsung, isEdge, isChrome };
}

function updateRuntimeEnvironment() {
  const secure = window.isSecureContext === true;
  const hasBluetooth = !!navigator.bluetooth;
  const origin = runtimeOriginLabel();
  const insecureHttp = location.protocol === 'http:' && origin !== 'localhost';
  const localFile = location.protocol === 'file:';
  const platform = detectClientPlatform();

  state.bluetoothReady = secure && hasBluetooth && !localFile;
  setRuntimeItem('runtimeOrigin', origin, insecureHttp || localFile ? 'warn' : 'ok');
  setRuntimeItem('runtimeSecurity', secure && !localFile ? '可用' : '不可用', secure && !localFile ? 'ok' : 'error');
  setRuntimeItem('runtimeBluetooth', hasBluetooth ? '可用' : '不可用', hasBluetooth ? 'ok' : 'error');
  setRuntimeItem(
    'runtimeAdapter',
    platform.isIOS && !hasBluetooth ? 'iOS 不支持' : platform.isAndroid ? 'Android 本机蓝牙' : '本机蓝牙',
    platform.isIOS && !hasBluetooth ? 'error' : 'ok',
  );

  if (localFile) {
    log('网页蓝牙不可用：请通过 HTTPS 或 http://localhost 提供此目录，不要直接打开 index.html。');
  } else if (!secure) {
    log('网页蓝牙不可用：请通过 HTTPS 或本地主机打开此页面。');
  } else if (platform.isIOS && !hasBluetooth) {
    log('网页蓝牙不可用：iPhone/iPad 的 Safari 和 iOS Chrome 不提供网页蓝牙。请使用 Android Chrome/Edge/Samsung Internet 或桌面版 Chrome/Edge。');
  } else if (!hasBluetooth) {
    log('网页蓝牙不可用：请使用带本机蓝牙适配器的 Android Chrome/Edge/Samsung Internet 或桌面版 Chrome/Edge。');
  } else if (platform.isMobile) {
    log(`网页蓝牙已就绪：将通过此${platform.isAndroid ? ' Android' : '移动'}设备扫描附近设备（${origin}）。`);
  } else {
    log(`网页蓝牙已就绪：将通过本机扫描附近设备（${origin}）。`);
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
  if (!text) throw new Error('数值不能为空');
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text, 16);
  if (/^[0-9]+$/.test(text)) return Number.parseInt(text, 10);
  throw new Error(`数值格式无效：${text}`);
}

function parseRegisterList(text) {
  const regs = [];
  const seen = new Set();
  const tokens = String(text ?? '').split(/[\s,;]+/).filter(Boolean);

  for (const token of tokens) {
    const range = token.split('-');
    if (range.length === 1) {
      const reg = parseNumberStrict(range[0]);
      if (reg > 0x7f) throw new Error(`寄存器超出范围：${hex(reg, 2)}`);
      if (!seen.has(reg)) {
        seen.add(reg);
        regs.push(reg);
      }
      continue;
    }

    if (range.length !== 2) throw new Error(`范围格式无效：${token}`);
    const start = parseNumberStrict(range[0]);
    const end = parseNumberStrict(range[1]);
    if (start > end || end > 0x7f || (end - start) > 31) {
      throw new Error(`范围格式无效：${token}`);
    }
    for (let reg = start; reg <= end; reg += 1) {
      if (!seen.has(reg)) {
        seen.add(reg);
        regs.push(reg);
      }
    }
  }

  if (regs.length === 0) throw new Error('寄存器列表不能为空');
  if (regs.length > 64) throw new Error('寄存器数量不能超过 64 个');
  return regs;
}

function regStatusName(status) {
  return REG_STATUS_NAMES[status] || `未知状态_${status}`;
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
  if (mode === 'ascService') return `目标服务/名称（${UUIDS.ascService}、SMP、${getDeviceNamePrefix()}）`;
  if (mode === 'allDevices') return '附近的全部蓝牙设备';
  return `名称前缀“${getDeviceNamePrefix()}”`;
}

function isSivyDeviceName(name) {
  return typeof name === 'string' && name.startsWith(AUTOMATION_DEVICE_NAME_PREFIX);
}

function exposedBluetoothAddress(device) {
  const addressPattern = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
  return [device?.id, device?.name].find((value) => addressPattern.test(String(value || ''))) || null;
}

function normalizeBluetoothAddress(address) {
  return String(address || '').replace(/[:-]/g, '').toUpperCase();
}

function buildAutomationBluetoothRequestOptions() {
  return {
    filters: [{ namePrefix: AUTOMATION_DEVICE_NAME_PREFIX }],
    optionalServices: [UUIDS.ascService, UUIDS.smpService],
  };
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
    return `${message}。网页蓝牙需要 http://localhost 或 HTTPS，请不要直接双击 index.html 打开。`;
  }

  if (name === 'NotFoundError') {
    return `${message}。如果弹窗里没有 Sivy_ASC_Test，请确认板子正在广播、没有被手机/nRF Connect 占用连接，并保持“全部设备”模式重试。`;
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
      <label>寄存器<input id="profileReg${i}" type="text" value="0x00"></label>
      <label>数值<input id="profileVal${i}" type="text" value="0x0000"></label>
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
  const mvText = (sample.flags & 0x01) ? `${sample.mv} mV` : '仅原始值';
  return `序号=${sample.seq} 通道=${sample.channel} 原始值=${sample.raw} ${mvText}`;
}

function updateStatus(status) {
  const power = (status.flags & 0x01) !== 0;
  const connected = (status.flags & 0x02) !== 0;
  const advertising = (status.flags & 0x04) !== 0;
  const notify = (status.flags & 0x08) !== 0;
  const ledNames = ['安全', '电源已打开', 'DAC 正常', 'DAC 错误'];
  const appStateNames = [
    '安全启动',
    '正在广播',
    '已连接空闲',
    '已布防',
    '正在采集',
    '低功耗',
    '错误',
  ];

  $('powerValue').textContent = power ? '已打开' : '已关闭';
  $('bleValue').textContent = connected ? '已连接' : (advertising ? '正在广播' : '空闲');
  $('ledValue').textContent = ledNames[status.ledMode] || `模式 ${status.ledMode}`;
  $('notifyValue').textContent = notify ? '已启用' : '已关闭';
  $('adcOkValue').textContent = status.adcOk;
  $('adcErrValue').textContent = status.adcErr;
  $('dacOkValue').textContent = `${status.dacProbeOk}/${status.dacWriteOk}`;
  $('i2cErrValue').textContent = `${status.dacI2cErr}/${status.ascI2cErr}`;
  $('appStateValue').textContent = appStateNames[status.appState] || '--';
  $('profileValue').textContent = `${(status.profileFlags & 0x01) ? '已启用' : '已关闭'}/${(status.profileFlags & 0x02) ? '校验' : '不校验'}`;
  $('queueValue').textContent = status.sampleQueue;
  $('bleDropValue').textContent = `${status.bleCongested}/${status.sampleDrop}`;
}

async function connect({ requestOptions = null, requireSivyName = false, deviceOverride = null } = {}) {
  if (!state.bluetoothReady) {
    throw new Error('网页蓝牙需要使用桌面版 Chrome/Edge 的 HTTPS 或本地主机页面');
  }

  if (!window.isSecureContext) {
    throw new Error('当前页面不是安全上下文：请通过 http://localhost:8080 打开测试控制台');
  }

  if (!navigator.bluetooth) {
    throw new Error('当前浏览器不支持网页蓝牙，请使用 Android Chrome/Edge/Samsung Internet 或桌面版 Chrome/Edge');
  }

  let device = deviceOverride;
  if (!device) {
    log(`正在打开蓝牙设备选择器：${requestOptions ? `名称前缀“${AUTOMATION_DEVICE_NAME_PREFIX}”` : describeDeviceFilter()}`);
    if (requireSivyName) {
      log(`浏览器选择器中，请选择名称以 ${AUTOMATION_DEVICE_NAME_PREFIX} 开头的设备；浏览器不提供 MAC 地址，选择时请核对目标地址 ${AUTOMATION_TARGET_ADDRESS}。`);
    } else {
      log('如果目标设备不出现：先确认手机/nRF Connect 已断开，再保持“全部设备”模式重新点击连接。');
    }
    device = await navigator.bluetooth.requestDevice(requestOptions || buildBluetoothRequestOptions());
  }
  if (requireSivyName && !isSivyDeviceName(device.name)) {
    throw new Error(`当前连接不是 Sivy 设备：${device.name || '未命名设备'}。请重新选择名称以 Sivy 开头的目标板。`);
  }
  if (requireSivyName) {
    const exposedAddress = exposedBluetoothAddress(device);
    if (exposedAddress && normalizeBluetoothAddress(exposedAddress) !== normalizeBluetoothAddress(AUTOMATION_TARGET_ADDRESS)) {
      throw new Error(`所选设备地址 ${exposedAddress} 与目标地址 ${AUTOMATION_TARGET_ADDRESS} 不一致`);
    }
  }
  state.bleKeepConnected = true;
  log(`已选择蓝牙设备：${device.name || '未命名'} / ${device.id || '无标识'}`);

  if (state.device !== device) {
    device.addEventListener('gattserverdisconnected', onDisconnected);
  }
  const server = await device.gatt.connect();
  let ascService;
  try {
    ascService = await server.getPrimaryService(UUIDS.ascService);
  } catch (error) {
    device.gatt.disconnect();
    throw new Error('所选设备没有 ASC GATT 服务，请重新选择正确设备');
  }

  state.device = device;
  state.server = server;
  state.chars.status = await ascService.getCharacteristic(UUIDS.status);
  state.chars.config = await ascService.getCharacteristic(UUIDS.config);
  state.chars.ctrl = await ascService.getCharacteristic(UUIDS.ctrl);
  state.chars.regReq = await ascService.getCharacteristic(UUIDS.regReq);
  state.chars.regRsp = await ascService.getCharacteristic(UUIDS.regRsp);
  state.chars.sivyTestCtrl = await ascService.getCharacteristic(UUIDS.sivyTestCtrl);
  state.chars.sivyTestResult = await ascService.getCharacteristic(UUIDS.sivyTestResult);

  await state.chars.status.startNotifications();
  state.chars.status.addEventListener('characteristicvaluechanged', (event) => {
    updateStatus(parseStatus(event.target.value));
  });

  await state.chars.regRsp.startNotifications();
  state.chars.regRsp.addEventListener('characteristicvaluechanged', (event) => {
    onRegRsp(parseRegRsp(event.target.value));
  });

  await state.chars.sivyTestResult.startNotifications();
  state.chars.sivyTestResult.addEventListener('characteristicvaluechanged', (event) => {
    onSivyTestResult(parseSivyTestResult(event.target.value));
  });

  try {
    const smpService = await server.getPrimaryService(UUIDS.smpService);
    const smpChar = await smpService.getCharacteristic(UUIDS.smpChar);
    state.smp = new SmpClient(smpChar);
    await state.smp.init();
    log('SMP OTA 服务已就绪');
  } catch (error) {
    state.smp = null;
    log(`SMP OTA 不可用：${error.message}`);
  }

  setConnected(true);
  state.bleReconnectAttempt = 0;
  log(`已连接到 ${device.name || device.id || '未命名蓝牙设备'}`);
  await readConfig();
  await readStatus();
  return device;
}

function onDisconnected() {
  setConnected(false);
  state.server = null;
  state.chars = {};
  state.smp = null;
  state.sivyTestActiveSeq = null;
  if (state.sivyTestCompletion) {
    clearTimeout(state.sivyTestCompletion.timer);
    state.sivyTestCompletion.reject(new Error('设备已断开连接'));
    state.sivyTestCompletion = null;
  }
  for (const pending of state.pendingReg.values()) {
    pending.reject(new Error('设备已断开连接'));
  }
  state.pendingReg.clear();
  log('设备已断开连接');
  if (state.bleKeepConnected && state.device) scheduleBleReconnect();
}

function scheduleBleReconnect() {
  if (!state.bleKeepConnected || !state.device || state.bleReconnectTimer) return;
  const attempt = state.bleReconnectAttempt + 1;
  state.bleReconnectAttempt = attempt;
  const delayMs = Math.min(10000, 1000 * (2 ** Math.min(attempt - 1, 3)));
  log(`设备连接已中断，将在 ${Math.round(delayMs / 1000)} 秒后自动重连（第 ${attempt} 次）`);
  state.bleReconnectTimer = window.setTimeout(async () => {
    state.bleReconnectTimer = 0;
    if (!state.bleKeepConnected || !state.device) return;
    try {
      await connect({ deviceOverride: state.device });
      log('设备已自动重连');
    } catch (error) {
      log(`设备自动重连失败：${error.message}`);
      scheduleBleReconnect();
    }
  }, delayMs);
}

async function disconnect() {
  state.bleKeepConnected = false;
  state.bleReconnectAttempt = 0;
  if (state.bleReconnectTimer) {
    clearTimeout(state.bleReconnectTimer);
    state.bleReconnectTimer = 0;
  }
  if (state.device?.gatt?.connected) {
    state.device.gatt.disconnect();
  }
}

function setAutoStep(step, level, statusText, detailText = null) {
  const element = $(`autoStep${step[0].toUpperCase()}${step.slice(1)}`);
  if (!element) return;
  element.classList.remove('pending', 'running', 'pass', 'warn', 'fail');
  element.classList.add(level);
  const status = $(`auto${step[0].toUpperCase()}${step.slice(1)}Status`);
  if (status) {
    status.textContent = statusText;
    status.classList.remove('pending', 'running', 'pass', 'warn', 'fail', 'blocked');
    status.classList.add(level);
  }
  const detail = $(`auto${step[0].toUpperCase()}${step.slice(1)}Detail`);
  if (detail && detailText !== null) detail.textContent = detailText;
}

function setAutoOverall(level, text) {
  const status = $('autoOverallStatus');
  status.textContent = text;
  status.classList.remove('idle', 'running', 'pass', 'warn', 'fail');
  status.classList.add(level);
}

function resetAutomationUi() {
  $('autoProgress').value = 0;
  setAutoStep('connect', 'pending', '待执行', `名称以 Sivy 开头；目标地址 ${AUTOMATION_TARGET_ADDRESS}`);
  setAutoStep('iic', 'pending', '等待上一步', '仅数值不匹配时给出警告并继续；I²C 通信错误会中止流程。');
  setAutoStep('ch0', 'pending', '等待上一步', '勾选可写位确认，设置阈值 32 mV，执行掩码写入和四项寄存器回读。');
  setAutoOverall('idle', '待执行。蓝牙连接、测试结果和 CH0 回读会依次显示在这里。');
}

function syncAutomationControls() {
  const button = $('autoRunBtn');
  if (!button) return;
  button.disabled = !state.bluetoothReady || state.autoTest.running;
  button.textContent = state.autoTest.running
    ? '自动执行中…'
    : state.device?.gatt?.connected
      ? '重新执行自动测试'
      : '一键连接并测试';
}

function blockAutoStepsAfter(step) {
  const order = ['connect', 'iic', 'ch0'];
  const start = order.indexOf(step);
  for (let i = start + 1; i < order.length; i += 1) {
    setAutoStep(order[i], 'pending', '已锁定', '前序步骤未完成，本步骤未执行。');
    const status = $(`auto${order[i][0].toUpperCase()}${order[i].slice(1)}Status`);
    status?.classList.add('blocked');
  }
}

async function runAutomatedWorkflow() {
  if (state.autoTest.running) return;
  if (!state.bluetoothReady) {
    throw new Error('网页蓝牙不可用：请通过 HTTPS 或 localhost 使用 Chrome/Edge 打开页面');
  }

  state.autoTest.running = true;
  state.autoTest.currentStep = 'connect';
  resetAutomationUi();
  syncAutomationControls();
  setAutoOverall('running', '自动测试正在执行：连接设备并校验目标名称。');
  log('自动测试已开始：Sivy 蓝牙连接 → I²C 参考测试 → CH0 32 mV 配置。');
  let iicHadValueDifferences = false;

  try {
    setAutoStep('connect', 'running', '连接中', '正在打开 Sivy 设备选择器；请在浏览器窗口中点选目标板。');
    let device = state.device;
    if (!device?.gatt?.connected) {
      device = await connect({
        requestOptions: buildAutomationBluetoothRequestOptions(),
        requireSivyName: true,
      });
    } else if (!isSivyDeviceName(device.name)) {
      log(`当前连接设备“${device.name || '未命名'}”不是 Sivy，自动断开后重新选择。`);
      await disconnect();
      await delay(250);
      device = await connect({
        requestOptions: buildAutomationBluetoothRequestOptions(),
        requireSivyName: true,
      });
    }
    $('autoProgress').value = 1;
    const exposedAddress = exposedBluetoothAddress(device);
    setAutoStep(
      'connect',
      'pass',
      '已连接',
      exposedAddress
        ? `设备：${device.name || 'Sivy'}；浏览器提供地址 ${exposedAddress}，已与目标地址匹配。`
        : `设备：${device.name || 'Sivy'}；浏览器未提供 MAC 地址，选择器中需自行核对 ${AUTOMATION_TARGET_ADDRESS}。`,
    );
    setAutoOverall('running', '蓝牙连接完成。正在执行 Sivy I²C 29 项参考测试。');

    state.autoTest.currentStep = 'iic';
    setAutoStep('iic', 'running', '测试中', '正在等待固件逐项回传 29 个寄存器结果和最终汇总。');
    const sivyResult = await runSivySnapshot();
    if (sivyResult.totalCount !== SIVY_REGISTER_EXPECTED.size) {
      throw new Error(`测试结果不完整：收到 ${sivyResult.totalCount}/${SIVY_REGISTER_EXPECTED.size} 项`);
    }
    if (sivyResult.ioErrorCount > 0 || sivyResult.status === SIVY_TEST.IO_ERROR) {
      throw new Error(`I²C 通信错误 ${sivyResult.ioErrorCount} 项，不能进入 CH0 配置`);
    }
    if (sivyResult.referenceOutOfSync) {
      throw new Error('固件参考表与网页参考表不一致，不能把该差异视为单纯的测试数值差异');
    }

    $('autoProgress').value = 2;
    if (sivyResult.mismatchCount > 0 || sivyResult.status !== SIVY_TEST.PASS) {
      iicHadValueDifferences = true;
      setAutoStep(
        'iic',
        'warn',
        '数值差异，已继续',
        `匹配 ${sivyResult.matchCount} 项，数值不匹配 ${sivyResult.mismatchCount} 项，I²C 错误 0 项；按规则继续 CH0。`,
      );
      setAutoOverall('warn', 'I²C 参考测试只有数值差异，已按设定继续。正在配置 CH0 32 mV。');
    } else {
      setAutoStep('iic', 'pass', '通过', `29 项寄存器全部匹配，I²C 错误 0 项。`);
      setAutoOverall('running', 'I²C 参考测试通过。正在配置 CH0 32 mV。');
    }

    state.autoTest.currentStep = 'ch0';
    $('ch0VthMv').value = '32';
    $('ch0WriteConfirm').checked = true;
    $('ch0PowerOn').checked = true;
    renderChannelRegisterPlan(0);
    setAutoStep('ch0', 'running', '写入中', '阈值 32 mV，确认位已勾选；正在写入 CH0 四项寄存器并回读。');
    const channelResult = await writeChannelRegisters(0);
    if (!channelResult?.submitted || channelResult.ioErrors > 0 || channelResult.mismatches > 0) {
      const ioErrors = channelResult?.ioErrors ?? 0;
      const mismatches = channelResult?.mismatches ?? 0;
      throw new Error(`CH0 写入或回读校验失败：I/O 错误 ${ioErrors} 项，位域不匹配 ${mismatches} 项`);
    }

    $('autoProgress').value = 3;
    setAutoStep('ch0', 'pass', '通过', 'CH0_CTRL、FEAT、WORKWIN、WAITWIN 已写入，可写位回读全部通过。');
    setAutoOverall(
      iicHadValueDifferences ? 'warn' : 'pass',
      `${iicHadValueDifferences ? '自动测试已完成，但 I²C 存在数值差异。' : '自动测试已完成：'}Sivy 已连接，CH0 阈值 32 mV 写入并回读通过。可以查看下方实时波形。`,
    );
    log(`自动测试已完成${iicHadValueDifferences ? '（I²C 有数值差异）' : ''}：Sivy 已连接，CH0 32 mV 写入并回读通过。`);
  } catch (error) {
    const step = state.autoTest.currentStep || 'connect';
    const friendly = webBluetoothHint(error);
    setAutoStep(step, 'fail', '失败', friendly);
    blockAutoStepsAfter(step);
    setAutoOverall('fail', `自动测试已中止：${friendly}`);
    log(`自动测试已中止（${step}）：${friendly}`);
  } finally {
    state.autoTest.running = false;
    state.autoTest.currentStep = null;
    syncAutomationControls();
  }
}

function setScopeStatus(text, level = 'pending') {
  const status = $('scopeConnectionStatus');
  status.textContent = text;
  status.classList.remove('pending', 'running', 'pass', 'warn', 'fail', 'blocked');
  status.classList.add(level);
}

function normalizedScopeIp() {
  const value = $('scopeInstrumentIp').value.trim();
  const parts = value.split('.');
  const valid = parts.length === 4 && parts.every((part) => (
    /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255
  ));
  if (!valid) throw new Error('请输入有效的示波器 IPv4 地址');
  return parts.map((part) => String(Number(part))).join('.');
}

function restoreScopeSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCOPE_SETTINGS_STORAGE_KEY) || '{}');
    if (saved.ip) $('scopeInstrumentIp').value = saved.ip;
    if (saved.intervalMs) $('scopeRefreshInterval').value = String(saved.intervalMs);
    if (saved.bridgeUrl) {
      const bridgeUrl = new URL(saved.bridgeUrl);
      if (bridgeUrl.pathname === '/scope' || bridgeUrl.pathname === '/video') {
        bridgeUrl.pathname = '/';
      }
      $('scopeStreamUrl').value = bridgeUrl.href.replace(/\/$/, '');
    }
    $('scopeAccessKey').value = sessionStorage.getItem(SCOPE_ACCESS_KEY_STORAGE_KEY) || '';
  } catch (_) {
    $('scopeInstrumentIp').value = DEFAULT_SCOPE_IP;
    $('scopeStreamUrl').value = DEFAULT_SCOPE_BRIDGE_URL.replace(/\/scope$/, '');
  }
}

function saveScopeSettings() {
  try {
    localStorage.setItem(SCOPE_SETTINGS_STORAGE_KEY, JSON.stringify({
      ip: $('scopeInstrumentIp').value.trim(),
      intervalMs: Number($('scopeRefreshInterval').value),
      bridgeUrl: $('scopeStreamUrl').value.trim(),
    }));
    sessionStorage.setItem(SCOPE_ACCESS_KEY_STORAGE_KEY, $('scopeAccessKey').value);
  } catch (_) {
    // Local storage can be disabled; the current form values still work.
  }
}

function syncScopeControls() {
  const external = state.scope.source === 'video' || state.scope.source === 'websocket';
  const socketReady = state.scope.keepConnected || (state.scope.socket
    && (state.scope.socket.readyState === WebSocket.OPEN || state.scope.socket.readyState === WebSocket.CONNECTING));
  const videoMode = state.scope.source === 'video';
  const sourceOption = $('scopeSourceOption');
  if (!sourceOption) return;

  $('scopeInstrumentIp').disabled = Boolean(socketReady);
  $('scopeAccessKey').disabled = Boolean(socketReady);
  $('scopeRefreshInterval').disabled = Boolean(socketReady) || videoMode;
  $('scopeRefreshLabel').classList.toggle('muted-control', videoMode);
  $('scopeStreamUrl').disabled = Boolean(socketReady);
  $('scopeConnectBtn').disabled = !external;
  $('scopeSourceLabel').textContent = external
    ? `数据源：RIGOL MHO 5054 · ${$('scopeInstrumentIp').value.trim() || DEFAULT_SCOPE_IP}`
    : '数据源：ASC BLE ADC';

  if (!external) {
    $('scopeConnectBtn').textContent = '连接示波器';
    setScopeStatus('RIGOL 待连接', 'pending');
    return;
  }

  if (socketReady) {
    $('scopeConnectBtn').textContent = '断开示波器';
    if (state.scope.socket?.readyState === WebSocket.OPEN) {
      setScopeStatus('示波器在线', 'pass');
    } else if (state.scope.socket?.readyState === WebSocket.CONNECTING) {
      setScopeStatus('连接中', 'running');
    } else {
      setScopeStatus('示波器重连中', 'running');
    }
  } else {
    $('scopeConnectBtn').textContent = '连接示波器';
    setScopeStatus('RIGOL 待连接', 'pending');
  }
}

function updateScopeBleStatus() {
  if (state.scope.source !== 'ble') return;
  if (!state.device?.gatt?.connected) {
    setScopeStatus('BLE 待连接', 'pending');
    $('scopeFrameInfo').textContent = '尚无数据帧';
    return;
  }
  const count = state.samples.length;
  setScopeStatus(count > 0 ? `${count} 个采样 · 实时` : 'BLE 已连接 · 等待采样', count > 0 ? 'pass' : 'running');
  $('scopeFrameInfo').textContent = count > 0
    ? `ASC BLE 最近 ${Math.min(300, count)} 个采样`
    : 'BLE 已连接，等待 ADC_DATA';
}

function setScopeSource(source) {
  if (source !== 'video' && source !== 'websocket') return;
  if (state.scope.socket || state.scope.keepConnected) disconnectScopeStream();
  closeVideoDecoder();
  state.scope.source = source;
  state.scope.frame = null;
  state.scope.screenshot = null;
  state.scope.frameCount = 0;
  $('scopeFrameInfo').textContent = '尚无数据帧';
  setScopeStatus('RIGOL 待连接', 'pending');
  syncScopeControls();
  drawScopeMonitor();
}

function scheduleScopeReconnect() {
  if (!state.scope.keepConnected || state.scope.socket || state.scope.reconnectTimer) return;
  const attempt = state.scope.reconnectAttempt + 1;
  state.scope.reconnectAttempt = attempt;
  const delayMs = Math.min(10000, 1000 * (2 ** Math.min(attempt - 1, 3)));
  setScopeStatus('示波器重连中', 'running');
  log(`示波器连接已中断，将在 ${Math.round(delayMs / 1000)} 秒后自动重连（第 ${attempt} 次）`);
  state.scope.reconnectTimer = window.setTimeout(() => {
    state.scope.reconnectTimer = 0;
    if (!state.scope.keepConnected || state.scope.socket) return;
    connectScopeStream().catch((error) => {
      log(`示波器自动重连失败：${error.message}`);
      scheduleScopeReconnect();
    });
  }, delayMs);
}

function disconnectScopeStream(manual = true) {
  if (manual) state.scope.keepConnected = false;
  if (manual) state.scope.reconnectAttempt = 0;
  if (manual && state.scope.reconnectTimer) {
    clearTimeout(state.scope.reconnectTimer);
    state.scope.reconnectTimer = 0;
  }
  const socket = state.scope.socket;
  state.scope.socket = null;
  if (socket && socket.readyState < WebSocket.CLOSING) {
    socket.close(1000, 'User disconnected');
  }
  state.scope.frame = null;
  state.scope.screenshot = null;
  state.scope.frameCount = 0;
  closeVideoDecoder();
  $('scopeFrameInfo').textContent = '尚无数据帧';
  setScopeStatus('示波器已断开', 'pending');
  drawScopeMonitor();
  syncScopeControls();
  log('外部示波器数据源已断开');
}

async function connectScopeStream() {
  if (state.scope.socket) {
    disconnectScopeStream();
    return;
  }
  if (state.scope.source !== 'video' && state.scope.source !== 'websocket') return;

  const source = $('scopeStreamUrl').value.trim();
  let url;
  try {
    url = new URL(source);
  } catch (_) {
    throw new Error('请填写有效的外部示波器 WebSocket 数据地址');
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('数据源地址必须使用 ws:// 或 wss://');
  }

  const scopeIp = normalizedScopeIp();
  const intervalMs = Number($('scopeRefreshInterval').value);
  url.pathname = state.scope.source === 'video' ? '/video' : '/scope';
  url.search = state.scope.source === 'video' ? `?ip=${encodeURIComponent(scopeIp)}` : '';
  const accessKey = $('scopeAccessKey').value;
  if (accessKey) url.searchParams.set('key', accessKey);
  saveScopeSettings();
  const socket = new WebSocket(url.href);
  if (state.scope.reconnectTimer) {
    clearTimeout(state.scope.reconnectTimer);
    state.scope.reconnectTimer = 0;
  }
  if (state.scope.source === 'video') socket.binaryType = 'arraybuffer';
  state.scope.socket = socket;
  state.scope.frame = null;
  state.scope.screenshot = null;
  state.scope.frameCount = 0;
  closeVideoDecoder();
  state.scope.videoFrameCount = 0;
  state.scope.videoFpsCounter = { startedAt: performance.now(), frames: 0, fps: 0 };
  setScopeStatus('连接中', 'running');
  syncScopeControls();
  let socketOpened = false;

  socket.addEventListener('open', () => {
    if (state.scope.socket !== socket) return;
    socketOpened = true;
    if (state.scope.source === 'video') {
      state.scope.reconnectAttempt = 0;
      setScopeStatus('等待 H.264 视频流', 'running');
      log(`高帧率视频桥已连接：RIGOL MHO 5054 / ${scopeIp}:9001`);
    } else {
      socket.send(JSON.stringify({
        type: 'configure',
        ip: scopeIp,
        port: DEFAULT_SCOPE_PORT,
        intervalMs,
        mode: 'screenshot',
      }));
      setScopeStatus('等待示波器响应', 'running');
      log(`示波器截图桥已连接：RIGOL MHO 5054 / ${scopeIp}:${DEFAULT_SCOPE_PORT}，刷新间隔 ${intervalMs} ms`);
    }
    syncScopeControls();
  });
  socket.addEventListener('message', (event) => {
    if (state.scope.socket !== socket) return;
    if (state.scope.source === 'video') {
      void handleScopeVideoMessage(event.data).catch((error) => {
        setScopeStatus('视频数据错误', 'fail');
        log(`RIGOL H.264 数据错误：${error.message}`);
      });
    } else {
      void handleScopeStreamMessage(event.data).catch((error) => {
        setScopeStatus('数据格式错误', 'fail');
        log(`外部示波器数据格式无效：${error.message}`);
      });
    }
  });
  socket.addEventListener('error', () => {
    if (state.scope.socket !== socket) return;
    setScopeStatus('示波器重连中', 'running');
    log(`示波器连接暂时中断，将自动重连（${scopeIp}）`);
  });
  socket.addEventListener('close', () => {
    if (state.scope.socket !== socket) return;
    state.scope.socket = null;
    closeVideoDecoder();
    syncScopeControls();
    if (!socketOpened) {
      setScopeStatus('示波器重连中', 'running');
    } else {
      setScopeStatus('示波器重连中', 'running');
    }
    scheduleScopeReconnect();
  });
}

async function handleScopeStreamMessage(data) {
  let text;
  if (typeof data === 'string') {
    text = data;
  } else if (data instanceof Blob) {
    text = await data.text();
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  } else {
    throw new Error('外部示波器数据格式无效：仅支持 JSON 文本消息');
  }

  let message;
  try {
    message = JSON.parse(text);
  } catch (_) {
    throw new Error('外部示波器数据格式无效：消息不是 JSON');
  }
  if (!message || typeof message !== 'object') {
    throw new Error('外部示波器数据格式无效：消息必须为对象');
  }

  if (message.type === 'status') {
    if (message.state === 'error') {
      setScopeStatus('示波器连接失败', 'fail');
      $('scopeFrameInfo').textContent = String(message.message || '无法读取示波器画面');
      log(`RIGOL MHO 5054 读取失败：${message.message || '未知错误'}`);
    } else if (message.state === 'configured') {
      setScopeStatus('等待示波器画面', 'running');
    } else {
      setScopeStatus('正在连接示波器', 'running');
    }
    return;
  }

  if (message.type === 'waveform') {
    const channels = normalizeScopeChannels(message);
    state.scope.frame = message;
    state.scope.screenshot = null;
    state.scope.frameCount += 1;
    $('scopeFrameInfo').textContent = `波形帧 ${state.scope.frameCount} · ${channels.length} 通道`;
    setScopeStatus('示波器在线 · 实时', 'pass');
    drawScopeMonitor();
    return;
  }

  if (message.type === 'screenshot') {
    const dataUrl = typeof message.dataUrl === 'string'
      ? message.dataUrl
      : typeof message.data === 'string'
        ? (message.data.startsWith('data:')
          ? message.data
          : `data:${message.mimeType || 'image/png'};base64,${message.data}`)
        : '';
    if (!dataUrl.startsWith('data:image/')) {
      throw new Error('外部示波器截图格式无效：dataUrl 必须为 image/* data URL');
    }
    const image = new Image();
    image.addEventListener('load', () => {
      state.scope.screenshot = image;
      state.scope.frame = null;
      state.scope.frameCount += 1;
      const captureTime = Number(message.capturedAt);
      const timeLabel = Number.isFinite(captureTime)
        ? new Date(captureTime * 1000).toLocaleTimeString()
        : '';
      $('scopeFrameInfo').textContent =
        `截图帧 ${state.scope.frameCount} · ${image.naturalWidth}×${image.naturalHeight}${timeLabel ? ` · ${timeLabel}` : ''}`;
      setScopeStatus('示波器在线 · 实时截图', 'pass');
      drawScopeMonitor();
    });
    image.addEventListener('error', () => log('收到示波器截图，但图像解码失败'));
    image.src = dataUrl;
  }
}

function closeVideoDecoder() {
  state.scope.videoGeneration += 1;
  state.scope.videoQueue = [];
  state.scope.videoParameterBytes = null;
  state.scope.videoPumping = false;
  if (state.scope.videoFrameRequest) {
    cancelAnimationFrame(state.scope.videoFrameRequest);
    state.scope.videoFrameRequest = 0;
  }
  try {
    state.scope.pendingVideoFrame?.close();
  } catch (_) {
    // A newly closed VideoFrame can be released by the browser first.
  }
  state.scope.pendingVideoFrame = null;
  try {
    if (state.scope.videoDecoder?.state !== 'closed') {
      state.scope.videoDecoder?.close();
    }
  } catch (_) {
    // Ignore decoder cleanup after a transport failure.
  }
  state.scope.videoDecoder = null;
}

function h264NalInfo(bytes) {
  const nals = [];
  for (let index = 0; index + 3 < bytes.length; index += 1) {
    let headerIndex = -1;
    if (bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 1) {
      headerIndex = index + 3;
    } else if (
      bytes[index] === 0
      && bytes[index + 1] === 0
      && bytes[index + 2] === 0
      && bytes[index + 3] === 1
    ) {
      headerIndex = index + 4;
    }
    if (headerIndex >= 0) {
      nals.push({ start: index, header: headerIndex, type: bytes[headerIndex] & 0x1f });
      index = headerIndex;
    }
  }
  return nals;
}

function h264Codec(bytes) {
  const sps = h264NalInfo(bytes).find((nal) => nal.type === 7);
  if (!sps || sps.header + 3 >= bytes.length) return '';
  const byteHex = (value) => value.toString(16).padStart(2, '0');
  return `avc1.${byteHex(bytes[sps.header + 1])}${byteHex(bytes[sps.header + 2])}${byteHex(bytes[sps.header + 3])}`;
}

function drawVideoFrame(frame) {
  const layout = prepareScopeCanvas();
  scopeCtx.fillStyle = '#0d1726';
  scopeCtx.fillRect(0, 0, layout.width, layout.height);
  const scale = Math.min(layout.width / frame.displayWidth, layout.height / frame.displayHeight);
  const width = frame.displayWidth * scale;
  const height = frame.displayHeight * scale;
  scopeCtx.drawImage(frame, (layout.width - width) / 2, (layout.height - height) / 2, width, height);
  $('scopeEmpty').classList.add('hidden');
}

function renderVideoFrame() {
  state.scope.videoFrameRequest = 0;
  const frame = state.scope.pendingVideoFrame;
  if (!frame) return;
  state.scope.pendingVideoFrame = null;
  try {
    drawVideoFrame(frame);
  } finally {
    frame.close();
  }
}

async function configureVideoDecoder(bytes, generation) {
  if (typeof VideoDecoder !== 'function' || typeof EncodedVideoChunk !== 'function') {
    throw new Error('当前浏览器不支持 H.264 WebCodecs，请使用最新版 Chrome 或 Edge');
  }
  const codec = h264Codec(bytes);
  if (!codec) throw new Error('没有从 RIGOL 视频流中识别到 H.264 SPS');
  const config = { codec, optimizeForLatency: true };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error(`当前浏览器不支持示波器视频编码 ${codec}`);
  }
  if (generation !== state.scope.videoGeneration) return false;
  const decoder = new VideoDecoder({
    output(frame) {
      if (generation !== state.scope.videoGeneration) {
        frame.close();
        return;
      }
      try {
        state.scope.pendingVideoFrame?.close();
      } catch (_) {
        // Replacing an unconsumed frame is normal at high input rates.
      }
      state.scope.pendingVideoFrame = frame;
      if (!state.scope.videoFrameRequest) {
        state.scope.videoFrameRequest = requestAnimationFrame(renderVideoFrame);
      }
      state.scope.videoFrameCount += 1;
      if (state.scope.videoFrameCount === 1) {
        setScopeStatus('示波器在线 · H.264 高帧率', 'pass');
        $('scopeFrameInfo').textContent =
          `H.264 第 1 帧 · ${frame.displayWidth}×${frame.displayHeight}`;
      }
      const counter = state.scope.videoFpsCounter;
      counter.frames += 1;
      const now = performance.now();
      const elapsed = now - counter.startedAt;
      if (elapsed >= 1000) {
        counter.fps = counter.frames * 1000 / elapsed;
        counter.frames = 0;
        counter.startedAt = now;
        $('scopeFrameInfo').textContent =
          `H.264 ${state.scope.videoFrameCount} 帧 · ${frame.displayWidth}×${frame.displayHeight} · ${counter.fps.toFixed(1)} 帧/秒`;
      }
    },
    error(error) {
      if (generation !== state.scope.videoGeneration) return;
      setScopeStatus('视频解码失败', 'fail');
      log(`RIGOL H.264 解码失败：${error.message || error}`);
    },
  });
  decoder.configure(config);
  state.scope.videoDecoder = decoder;
  return true;
}

async function pumpVideoFrames() {
  if (state.scope.videoPumping) return;
  state.scope.videoPumping = true;
  const generation = state.scope.videoGeneration;
  try {
    while (state.scope.videoQueue.length > 0 && generation === state.scope.videoGeneration) {
      const bytes = state.scope.videoQueue.shift();
      const nals = h264NalInfo(bytes);
      const hasIdr = nals.some((nal) => nal.type === 5);
      const hasParameterSet = nals.some((nal) => nal.type === 7 || nal.type === 8);
      if (!state.scope.videoDecoder) {
        if (h264Codec(bytes)) {
          const configured = await configureVideoDecoder(bytes, generation);
          if (!configured || generation !== state.scope.videoGeneration) return;
        }
        if (!hasIdr) {
          if (hasParameterSet) state.scope.videoParameterBytes = bytes;
          continue;
        }
      }
      if (!hasIdr && !state.scope.videoFrameCount) continue;
      const payload = hasIdr && state.scope.videoParameterBytes
        ? concatBytes(state.scope.videoParameterBytes, bytes)
        : bytes;
      state.scope.videoDecoder.decode(new EncodedVideoChunk({
        type: hasIdr ? 'key' : 'delta',
        timestamp: Math.round(performance.now() * 1000),
        data: payload,
      }));
      if (hasIdr) state.scope.videoParameterBytes = null;
    }
  } catch (error) {
    setScopeStatus('视频解码失败', 'fail');
    log(`RIGOL H.264 解码失败：${error.message}`);
  } finally {
    if (generation === state.scope.videoGeneration) {
      state.scope.videoPumping = false;
      if (state.scope.videoQueue.length > 0) {
        void pumpVideoFrames();
      }
    }
  }
}

async function handleScopeVideoMessage(data) {
  if (typeof data === 'string') {
    try {
      const message = JSON.parse(data);
      if (message.type === 'status' && message.state === 'error') {
        setScopeStatus('示波器连接失败', 'fail');
        $('scopeFrameInfo').textContent = String(message.message || '无法读取 RIGOL 视频流');
        log(`RIGOL 视频流失败：${message.message || '未知错误'}`);
      } else if (message.action === 'init') {
        setScopeStatus('已接收视频流 · 解码中', 'running');
      }
    } catch (_) {
      // Ignore unrelated control text from the RIGOL stream.
    }
    return;
  }
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  if (!(buffer instanceof ArrayBuffer)) return;
  state.scope.videoQueue.push(new Uint8Array(buffer));
  void pumpVideoFrames();
}

function clearScopeMonitor() {
  if (state.scope.source === 'ble') {
    state.samples = [];
    $('sampleCount').textContent = '0 个采样';
    $('latestSample').textContent = '最新值：--';
    drawSamples();
  }
  state.scope.frame = null;
  state.scope.screenshot = null;
  state.scope.frameCount = 0;
  $('scopeFrameInfo').textContent = '尚无数据帧';
  if (state.scope.source === 'ble') updateScopeBleStatus();
  drawScopeMonitor();
}

async function toggleScopeStream() {
  if (state.scope.socket || state.scope.keepConnected) {
    disconnectScopeStream();
  } else {
    state.scope.keepConnected = true;
    state.scope.reconnectAttempt = 0;
    await connectScopeStream();
  }
}

async function toggleScopeFullscreen() {
  const stage = $('scopeStage');
  try {
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen();
    }
  } catch (error) {
    log(`无法切换全屏：${error.message}`);
  }
}

function updateScopeFullscreenButton() {
  const fullscreen = document.fullscreenElement === $('scopeStage');
  $('scopeFullscreenBtn').textContent = fullscreen ? '退出全屏' : '全屏显示';
  requestAnimationFrame(drawScopeMonitor);
}

function setGeneratorStatus(text, level = 'pending') {
  const status = $('generatorStatus');
  status.textContent = text;
  status.classList.remove('pending', 'running', 'pass', 'warn', 'fail', 'blocked');
  status.classList.add(level);
}

function generatorWaveformLabel(waveform) {
  return {
    triangle: '三角波',
    sine: '正弦波',
    square: '方波',
    pulse: '脉冲',
  }[waveform] || waveform;
}

function formatGeneratorFrequency(value) {
  const frequency = Number(value);
  if (!Number.isFinite(frequency)) return '--';
  if (frequency >= 1_000_000) return `${(frequency / 1_000_000).toFixed(6).replace(/\.?0+$/, '')} MHz`;
  if (frequency >= 1000) return `${(frequency / 1000).toFixed(6).replace(/\.?0+$/, '')} kHz`;
  return `${frequency} Hz`;
}

function generatorFormConfig() {
  const ipText = $('generatorIp').value.trim();
  const octets = ipText.split('.');
  if (
    octets.length !== 4
    || !octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  ) {
    throw new Error('请填写有效的 RIGOL DG4102 IPv4 地址');
  }
  const channel = Number($('generatorChannel').value);
  const waveform = $('generatorWaveform').value;
  const amplitudeVpp = Number($('generatorAmplitude').value);
  const frequencyHz = Number($('generatorFrequency').value);
  const load = $('generatorLoad').value;
  if (![1, 2].includes(channel)) throw new Error('输出通道必须是 CH1 或 CH2');
  if (!['triangle', 'sine', 'square', 'pulse'].includes(waveform)) throw new Error('请选择有效波形');
  if (!Number.isFinite(amplitudeVpp) || amplitudeVpp < 0.001 || amplitudeVpp > 20) {
    throw new Error('幅值必须在 0.001 到 20 Vpp 之间');
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0.001 || frequencyHz > 50_000_000) {
    throw new Error('频率必须在 0.001 Hz 到 50 MHz 之间');
  }
  if (!['INF', '50'].includes(load)) throw new Error('请选择有效输出负载');
  return {
    ip: octets.map((part) => String(Number(part))).join('.'),
    port: DEFAULT_GENERATOR_PORT,
    channel,
    waveform,
    amplitudeVpp,
    frequencyHz,
    load,
  };
}

function saveGeneratorSettings() {
  try {
    localStorage.setItem(GENERATOR_SETTINGS_STORAGE_KEY, JSON.stringify({
      ip: $('generatorIp').value.trim(),
      channel: $('generatorChannel').value,
      waveform: $('generatorWaveform').value,
      amplitudeVpp: $('generatorAmplitude').value,
      frequencyHz: $('generatorFrequency').value,
      load: $('generatorLoad').value,
    }));
  } catch (_) {
    // The current form values remain usable when local storage is unavailable.
  }
}

function restoreGeneratorSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GENERATOR_SETTINGS_STORAGE_KEY) || '{}');
    if (saved.ip) $('generatorIp').value = saved.ip;
    if (saved.channel) $('generatorChannel').value = String(saved.channel);
    if (saved.waveform) $('generatorWaveform').value = saved.waveform;
    if (saved.amplitudeVpp) $('generatorAmplitude').value = String(saved.amplitudeVpp);
    if (saved.frequencyHz) $('generatorFrequency').value = String(saved.frequencyHz);
    if (saved.load) $('generatorLoad').value = saved.load;
  } catch (_) {
    // Defaults are already present in the markup.
  }
}

function renderGeneratorPreview() {
  const channel = $('generatorChannel').value === '2' ? 'CH2' : 'CH1';
  const waveform = generatorWaveformLabel($('generatorWaveform').value);
  const amplitude = $('generatorAmplitude').value || '--';
  const frequency = formatGeneratorFrequency($('generatorFrequency').value);
  const load = $('generatorLoad').value === '50' ? '50 Ω' : '高阻';
  $('generatorSummary').textContent =
    `${channel} · ${waveform} · ${amplitude} Vpp · ${frequency} · ${load}；等待发送。`;
  $('generatorSummary').classList.remove('running', 'pass', 'fail');
  $('generatorSummary').classList.add('idle');
}

function sendGeneratorCommand(command) {
  let bridgeUrl;
  try {
    bridgeUrl = new URL($('scopeStreamUrl').value.trim());
  } catch (_) {
    return Promise.reject(new Error('本机数据桥地址无效'));
  }
  if (bridgeUrl.protocol !== 'ws:' && bridgeUrl.protocol !== 'wss:') {
    return Promise.reject(new Error('本机数据桥地址必须使用 ws:// 或 wss://'));
  }
  bridgeUrl.pathname = '/generator';
  bridgeUrl.search = '';
  const accessKey = $('scopeAccessKey').value;
  if (accessKey) bridgeUrl.searchParams.set('key', accessKey);
  const socket = new WebSocket(bridgeUrl.href);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch (_) {
        // The server may already have closed the socket.
      }
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('信号发生器操作超时，请检查 IP 和网络')), 12000);
    socket.addEventListener('open', () => socket.send(JSON.stringify(command)));
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type !== 'generator') return;
        if (message.state === 'ok') finish(resolve, message);
        else finish(reject, new Error(message.message || '信号发生器操作失败'));
      } catch (error) {
        finish(reject, error);
      }
    });
    socket.addEventListener('error', () => finish(reject, new Error(
      '无法连接信号发生器数据桥，请检查桥程序、数据桥地址和访问密钥',
    )));
    socket.addEventListener('close', () => {
      if (!settled) finish(reject, new Error('信号发生器数据桥已断开'));
    });
  });
}

function describeGeneratorSettings(settings, channel) {
  const waveform = {
    SIN: '正弦波',
    SQU: '方波',
    RAMP: '三角波',
    PULS: '脉冲',
  }[settings.waveform] || settings.waveform;
  const load = String(settings.load).toUpperCase().startsWith('INF') ? '高阻' : `${settings.load} Ω`;
  return `CH${channel} · ${waveform} · ${Number(settings.amplitudeVpp).toFixed(3)} Vpp · ` +
    `${formatGeneratorFrequency(settings.frequencyHz)} · ${load} · 输出 ${settings.output === 'ON' ? '已打开' : '已关闭'}`;
}

async function applyGenerator() {
  const config = generatorFormConfig();
  saveGeneratorSettings();
  setGeneratorStatus('正在发送', 'running');
  $('generatorSummary').textContent = `正在连接 ${config.ip}:${config.port} 并配置 CH${config.channel}…`;
  $('generatorSummary').classList.remove('idle', 'pass', 'fail');
  $('generatorSummary').classList.add('running');
  try {
    const response = await sendGeneratorCommand({ ...config, type: 'apply', output: true });
    setGeneratorStatus('输出已打开', 'pass');
    $('generatorSummary').textContent =
      `已应用并回读：${describeGeneratorSettings(response.settings, config.channel)}`;
    $('generatorSummary').classList.remove('running', 'fail');
    $('generatorSummary').classList.add('pass');
    log(`DG4102 配置成功：${response.settings.identity || config.ip}`);
  } catch (error) {
    setGeneratorStatus('发送失败', 'fail');
    $('generatorSummary').textContent = `信号发生器配置失败：${error.message}`;
    $('generatorSummary').classList.remove('running', 'pass');
    $('generatorSummary').classList.add('fail');
    log(`DG4102 配置失败：${error.message}`);
  }
}

async function readGenerator() {
  const config = generatorFormConfig();
  setGeneratorStatus('正在读取', 'running');
  try {
    const response = await sendGeneratorCommand({ ...config, type: 'read' });
    const settings = response.settings;
    if (settings.waveform?.startsWith('SIN')) $('generatorWaveform').value = 'sine';
    else if (settings.waveform?.startsWith('SQU')) $('generatorWaveform').value = 'square';
    else if (settings.waveform?.startsWith('PULS')) $('generatorWaveform').value = 'pulse';
    else if (settings.waveform?.startsWith('RAMP')) $('generatorWaveform').value = 'triangle';
    $('generatorAmplitude').value = String(settings.amplitudeVpp);
    $('generatorFrequency').value = String(settings.frequencyHz);
    $('generatorLoad').value = String(settings.load).toUpperCase().startsWith('INF') ? 'INF' : '50';
    setGeneratorStatus(settings.output === 'ON' ? '已连接 · 输出开' : '已连接 · 输出关', 'pass');
    $('generatorSummary').textContent = `当前设置：${describeGeneratorSettings(settings, config.channel)}`;
    $('generatorSummary').classList.remove('running', 'idle', 'fail');
    $('generatorSummary').classList.add('pass');
    saveGeneratorSettings();
  } catch (error) {
    setGeneratorStatus('读取失败', 'fail');
    $('generatorSummary').textContent = `读取信号发生器失败：${error.message}`;
    $('generatorSummary').classList.remove('running', 'pass');
    $('generatorSummary').classList.add('fail');
  }
}

async function disableGeneratorOutput() {
  const config = generatorFormConfig();
  setGeneratorStatus('正在关闭输出', 'running');
  try {
    const response = await sendGeneratorCommand({
      type: 'output',
      ip: config.ip,
      port: config.port,
      channel: config.channel,
      enabled: false,
    });
    setGeneratorStatus('输出已关闭', 'pass');
    $('generatorSummary').textContent = `CH${config.channel} 输出已关闭（${config.ip}）`;
    $('generatorSummary').classList.remove('running', 'idle', 'fail');
    $('generatorSummary').classList.add('pass');
    log(`DG4102 CH${config.channel} 输出已关闭：${response.settings.output}`);
  } catch (error) {
    setGeneratorStatus('关闭失败', 'fail');
    $('generatorSummary').textContent = `关闭信号发生器输出失败：${error.message}`;
    $('generatorSummary').classList.remove('running', 'pass');
    $('generatorSummary').classList.add('fail');
  }
}

async function readStatus() {
  const value = await state.chars.status.readValue();
  updateStatus(parseStatus(value));
  log('已读取状态');
}

async function readConfig() {
  const value = await state.chars.config.readValue();
  state.config = parseConfig(value);
  applyConfigToForm(state.config);
  log('已读取配置');
}

async function writeConfig() {
  const config = configFromForm();
  await state.chars.config.writeValueWithResponse(packConfig(config));
  log(`已写入配置，DAC=${config.dac.join('/')}`);
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
  return `序号=${rsp.seq} 目标=${hex(rsp.target, 2)} 操作=${hex(rsp.op, 2)} 状态=${regStatusName(rsp.status)} ` +
    `地址=${hex(rsp.addr, 4)} 数值=${hex(rsp.value, 4)} 掩码=${hex(rsp.mask, 4)} 32位=${hex(full32, 8)}`;
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

function parseSivyTestResult(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer || value);
  return {
    seq: view.getUint8(0),
    type: view.getUint8(1),
    status: view.getUint8(2),
    index: view.getUint8(3),
    reg: view.getUint8(4),
    expected: view.getUint16(6, true),
    actual: view.getUint16(8, true),
    matchCount: view.getUint16(10, true),
    mismatchCount: view.getUint16(12, true),
    ioErrorCount: view.getUint16(14, true),
  };
}

function sivyTestStatusName(status) {
  if (status === SIVY_TEST.PASS) return '通过';
  if (status === SIVY_TEST.MISMATCH) return '数值不匹配';
  if (status === SIVY_TEST.IO_ERROR) return 'I2C 错误';
  return `未知状态（${hex(status, 2)}）`;
}

function setSivyTestSummary(text, level = 'idle') {
  const summary = $('sivyTestSummary');
  summary.textContent = text;
  summary.classList.remove('pass', 'fail', 'running', 'idle');
  summary.classList.add(level);
}

function clearSivyTestResults() {
  state.sivyTestRows = [];
  state.sivyTestReferenceOutOfSync = false;
  $('sivyTestRows').textContent = '';
  setSivyTestSummary('等待固件测试结果', 'idle');
}

function evaluateSivyTestResult(result) {
  const expected = SIVY_REGISTER_EXPECTED.get(result.reg) ?? result.expected;
  const firmwareReferenceMatches = result.expected === expected;
  const actualAvailable = result.status !== SIVY_TEST.IO_ERROR;
  const valueMatches = actualAvailable && result.actual === expected;

  if (!firmwareReferenceMatches) {
    return {
      expected,
      pass: false,
      status: `固件期望值不一致（设备：${hex(result.expected, 4)}）`,
      firmwareReferenceMatches,
    };
  }

  if (result.status === SIVY_TEST.IO_ERROR) {
    return {
      expected,
      pass: false,
      status: 'I2C 错误',
      firmwareReferenceMatches,
    };
  }

  return {
    expected,
    pass: valueMatches,
    status: valueMatches ? '通过' : '数值不匹配',
    firmwareReferenceMatches,
  };
}

function appendSivyTestResult(result) {
  const tbody = $('sivyTestRows');
  const tr = document.createElement('tr');
  const evaluation = evaluateSivyTestResult(result);
  const isInitWrite = result.type === SIVY_TEST.RESULT_INIT_WRITE;

  if (!evaluation.firmwareReferenceMatches) {
    if (!state.sivyTestReferenceOutOfSync) {
      log(`Sivy 固件参考值与 Excel 不一致：${hex(result.reg, 2)} 设备=${hex(result.expected, 4)}，网页=${hex(evaluation.expected, 4)}`);
    }
    state.sivyTestReferenceOutOfSync = true;
  }

  const cells = [
    isInitWrite ? '初始化写入' : String(result.index),
    SIVY_REGISTER_NAMES.get(result.reg) || '--',
    hex(result.reg, 2),
    hex(evaluation.expected, 4),
    result.status === SIVY_TEST.IO_ERROR ? '--' : hex(result.actual, 4),
    evaluation.status,
    `${result.matchCount}/${result.mismatchCount}/${result.ioErrorCount}`,
  ];

  for (const value of cells) {
    const td = document.createElement('td');
    td.textContent = value;
    tr.appendChild(td);
  }
  tr.children[5].className = evaluation.pass ? 'pass' : 'fail';
  tbody.appendChild(tr);
  state.sivyTestRows.push({
    time: new Date().toISOString(),
    index: isInitWrite ? '初始化写入' : result.index,
    name: SIVY_REGISTER_NAMES.get(result.reg) || '--',
    reg: hex(result.reg, 2),
    expected: hex(evaluation.expected, 4),
    firmwareExpected: hex(result.expected, 4),
    actual: result.status === SIVY_TEST.IO_ERROR ? '--' : hex(result.actual, 4),
    status: evaluation.status,
    matchCount: result.matchCount,
    mismatchCount: result.mismatchCount,
    ioErrorCount: result.ioErrorCount,
  });
}

function onSivyTestResult(result) {
  if (state.sivyTestActiveSeq !== null && result.seq !== state.sivyTestActiveSeq) {
    log(`已忽略过期的 Sivy 测试结果，序号=${result.seq}`);
    return;
  }

  if (result.type === SIVY_TEST.RESULT_SUMMARY) {
    const firmwarePassed = result.status === SIVY_TEST.PASS;
    const passed = firmwarePassed && !state.sivyTestReferenceOutOfSync;
    const status = state.sivyTestReferenceOutOfSync ? '固件参考值不一致' : sivyTestStatusName(result.status);
    const referenceNotice = state.sivyTestReferenceOutOfSync ? '；请升级为当前测试固件' : '';
    setSivyTestSummary(
      `${status}：匹配 ${result.matchCount} 项，不匹配 ${result.mismatchCount} 项，I2C 错误 ${result.ioErrorCount} 项${referenceNotice}`,
      passed ? 'pass' : 'fail',
    );
    state.sivyTestActiveSeq = null;
    log(`Sivy I2C 测试完成：${status}，匹配=${result.matchCount}，不匹配=${result.mismatchCount}，I2C 错误=${result.ioErrorCount}`);
    void readStatus().catch((error) => log(`Sivy 测试后刷新状态失败：${error.message}`));
    const completion = state.sivyTestCompletion;
    if (completion?.seq === result.seq) {
      clearTimeout(completion.timer);
      state.sivyTestCompletion = null;
      completion.resolve({
        status: result.status,
        firmwarePassed,
        referenceOutOfSync: state.sivyTestReferenceOutOfSync,
        matchCount: result.matchCount,
        mismatchCount: result.mismatchCount,
        ioErrorCount: result.ioErrorCount,
        totalCount: result.matchCount + result.mismatchCount + result.ioErrorCount,
        result,
      });
    }
    return;
  }

  if (result.type !== SIVY_TEST.RESULT_REGISTER && result.type !== SIVY_TEST.RESULT_INIT_WRITE) {
    log(`已忽略不支持的 Sivy 测试事件类型 ${hex(result.type, 2)}`);
    return;
  }

  appendSivyTestResult(result);
}

function packSivyTestCmd(seq, opcode) {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, seq);
  view.setUint8(1, opcode);
  return buffer;
}

async function startSivyTest(opcode) {
  if (state.sivyTestActiveSeq !== null) {
    throw new Error('Sivy I2C 测试正在执行');
  }

  const seq = state.sivyTestSeq++ & 0xff;
  clearSivyTestResults();
  state.sivyTestActiveSeq = seq;
  setSivyTestSummary('固件正在执行测试并回传结果…', 'running');
  let resolveCompletion;
  let rejectCompletion;
  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const timer = setTimeout(() => {
    if (state.sivyTestCompletion?.seq !== seq) return;
    state.sivyTestCompletion = null;
    state.sivyTestActiveSeq = null;
    setSivyTestSummary('等待 Sivy 测试汇总超时，请检查设备状态后重试。', 'fail');
    rejectCompletion(new Error('等待 Sivy I2C 测试汇总超时'));
  }, AUTOMATION_SIVY_TIMEOUT_MS);
  state.sivyTestCompletion = {
    seq,
    resolve: resolveCompletion,
    reject: rejectCompletion,
    timer,
  };

  try {
    await state.chars.sivyTestCtrl.writeValueWithResponse(packSivyTestCmd(seq, opcode));
  } catch (error) {
    clearTimeout(timer);
    state.sivyTestCompletion = null;
    state.sivyTestActiveSeq = null;
    setSivyTestSummary(`启动失败：${error.message}`, 'fail');
    throw error;
  }

  log(`Sivy I2C 测试已开始：序号=${seq}，操作码=${hex(opcode, 2)}`);
  return completion;
}

async function runSivySnapshot() {
  return startSivyTest(SIVY_TEST.SNAPSHOT);
}

async function runSivySelectedInitWrite() {
  if (!$('sivyTestInitConfirm').checked) {
    throw new Error('请先确认允许写入 PW_CTRL（CPW_CTRL）[0x38] = 0x36DB');
  }
  return startSivyTest(SIVY_TEST.SELECTED_INIT_WRITE);
}

function exportSivyTestCsv() {
  if (state.sivyTestRows.length === 0) {
    log('Sivy I2C 测试 CSV 未导出：没有结果行');
    return;
  }

  const columns = [
    ['time', '时间'],
    ['index', '序号'],
    ['name', '名称'],
    ['reg', '寄存器'],
    ['expected', '期望值'],
    ['firmwareExpected', '固件期望值'],
    ['actual', '实际值'],
    ['status', '状态'],
    ['matchCount', '匹配数'],
    ['mismatchCount', '不匹配数'],
    ['ioErrorCount', 'I2C 错误数'],
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([, label]) => label).join(','),
    ...state.sivyTestRows.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `sivy_i2c_test_${stamp}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`Sivy I2C 测试 CSV 已导出：${state.sivyTestRows.length} 行`);
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
      reject(new Error('等待 REG_RSP 响应超时'));
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
    throw new Error(`寄存器操作失败：${regStatusName(rsp.status)}`);
  }
  await readStatus();
  return rsp;
}

function channelLabel(channel) {
  if (!Number.isInteger(channel) || channel < 0 || channel >= CHANNEL_COUNT) {
    throw new Error(`通道编号必须是 0 到 ${CHANNEL_COUNT - 1} 的整数`);
  }
  return `CH${channel}`;
}

function channelElementId(channel, suffix) {
  channelLabel(channel);
  return `ch${channel}${suffix}`;
}

function channelConfigNumber(channel, suffix, maximum) {
  const id = channelElementId(channel, suffix);
  const text = String($(id).value ?? '').trim();
  const value = Number(text);
  if (!text || !Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${id} 必须是 0 到 ${maximum} 的整数`);
  }
  return value;
}

function channelVthCodeFromMillivolts(channel) {
  const id = channelElementId(channel, 'VthMv');
  const text = String($(id).value ?? '').trim();
  const millivolts = Number(text);
  const { minimumMillivolts, maximumMillivolts, stepMillivolts } = CHANNEL_VTH;
  if (!text
      || !Number.isInteger(millivolts)
      || millivolts < minimumMillivolts
      || millivolts > maximumMillivolts
      || millivolts % stepMillivolts !== 0) {
    throw new Error(`${id} 必须是 ${minimumMillivolts} 到 ${maximumMillivolts} mV 之间、步进 ${stepMillivolts} mV 的整数`);
  }
  return (millivolts / stepMillivolts) - 1;
}

function channelVthMillivoltsFromCode(code) {
  return (code + 1) * CHANNEL_VTH.stepMillivolts;
}

function getChannelRegisterPlan(channel) {
  const registers = CHANNEL_REGISTERS[channel];
  const channelEnabled = $(channelElementId(channel, 'Enable')).checked ? 1 : 0;
  const pgaGain = channelConfigNumber(channel, 'PgaGain', 15);
  const thresholdMillivolts = channelConfigNumber(channel, 'VthMv', CHANNEL_VTH.maximumMillivolts);
  const threshold = channelVthCodeFromMillivolts(channel);
  const featureSelect = channelConfigNumber(channel, 'FeatSel', 1);
  const averageTriggerEnabled = $(channelElementId(channel, 'AvgTriggerEnable')).checked ? 1 : 0;
  const averageTriggerEdge = channelConfigNumber(channel, 'AvgTriggerEdge', 2);
  const workWindow = channelConfigNumber(channel, 'WorkWindow', 0x0fff);
  const waitWindow = channelConfigNumber(channel, 'WaitWindow', 0x0fff);

  return [
    {
      ...registers[0],
      value: channelEnabled | (pgaGain << 2) | (threshold << 8),
      detail: `CH_EN=${channelEnabled}, PGA_GAIN=${hex(pgaGain, 1)}, VTH=${thresholdMillivolts} mV (${hex(threshold, 2)})`,
    },
    {
      ...registers[1],
      value: featureSelect | (averageTriggerEnabled << 1) | (averageTriggerEdge << 2),
      detail: `FEAT_SEL=${featureSelect}, AVG_TRG_EN=${averageTriggerEnabled}, AVG_TRG_HA=${averageTriggerEdge}`,
    },
    { ...registers[2], value: workWindow, detail: `WORK_WINDOW=${workWindow}` },
    { ...registers[3], value: waitWindow, detail: `WAIT_WINDOW=${waitWindow}` },
  ];
}

function setChannelSummary(channel, text, level = 'idle') {
  const summary = $(channelElementId(channel, 'Summary'));
  summary.textContent = text;
  summary.classList.remove('pass', 'fail', 'running', 'idle');
  summary.classList.add(level);
}

function renderChannelRegisterPlan(channel) {
  const tbody = $(channelElementId(channel, 'PreviewRows'));
  const warning = $(channelElementId(channel, 'DecodeWarning'));
  tbody.textContent = '';
  warning.textContent = '';

  try {
    for (const entry of getChannelRegisterPlan(channel)) {
      const row = document.createElement('tr');
      const cells = [entry.name, hex(entry.addr, 2), hex(entry.mask, 4), hex(entry.value, 4), entry.detail];
      for (const value of cells) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
  } catch (error) {
    warning.textContent = `寄存器计算失败：${error.message}`;
  }
}

function clearChannelResults(channel) {
  state.channelRows[channel] = [];
  $(channelElementId(channel, 'ResultRows')).textContent = '';
  setChannelSummary(channel, '调整控件后会实时显示计算寄存器值；写入前需要勾选确认。');
}

function appendChannelResult(channel, row) {
  const tbody = $(channelElementId(channel, 'ResultRows'));
  const tr = document.createElement('tr');
  const cells = [row.step, row.name, row.addr, row.mask, row.expected, row.actual, row.status, row.note];

  for (const value of cells) {
    const cell = document.createElement('td');
    cell.textContent = value;
    tr.appendChild(cell);
  }
  tr.children[6].className = row.pass ? 'pass' : 'fail';
  tbody.appendChild(tr);
  state.channelRows[channel].push({ time: new Date().toISOString(), ...row });
}

async function maybePowerOnForChannel(channel) {
  if ($(channelElementId(channel, 'PowerOn')).checked) {
    await ctrl(CTRL.POWER_ON);
  }
}

function applyChannelReadback(channel, readbacks) {
  const registers = CHANNEL_REGISTERS[channel];
  const ctrlValue = readbacks.get(registers[0].addr);
  const featureValue = readbacks.get(registers[1].addr);
  const workWindow = readbacks.get(registers[2].addr);
  const waitWindow = readbacks.get(registers[3].addr);
  const triggerEdge = (featureValue >> 2) & 0x03;

  $(channelElementId(channel, 'Enable')).checked = (ctrlValue & 0x0001) !== 0;
  $(channelElementId(channel, 'PgaGain')).value = String((ctrlValue >> 2) & 0x0f);
  $(channelElementId(channel, 'VthMv')).value = String(channelVthMillivoltsFromCode((ctrlValue >> 8) & 0xff));
  $(channelElementId(channel, 'FeatSel')).value = String(featureValue & 0x01);
  $(channelElementId(channel, 'AvgTriggerEnable')).checked = (featureValue & 0x02) !== 0;
  $(channelElementId(channel, 'WorkWindow')).value = String(workWindow & 0x0fff);
  $(channelElementId(channel, 'WaitWindow')).value = String(waitWindow & 0x0fff);
  $(channelElementId(channel, 'AvgTriggerEdge')).value = triggerEdge <= 2 ? String(triggerEdge) : '0';

  renderChannelRegisterPlan(channel);
  if (triggerEdge > 2) {
    $(channelElementId(channel, 'DecodeWarning')).textContent = `${channelLabel(channel)}_FEAT[3:2] 读回保留值 0b11；控件保留为上升沿，写入前请确认芯片状态。`;
  }
}

async function readChannelRegisters(channel, { clear = true, expectedPlan = null, skipPowerOn = false } = {}) {
  const label = channelLabel(channel);
  const registers = CHANNEL_REGISTERS[channel];
  if (clear) clearChannelResults(channel);
  if (!skipPowerOn) await maybePowerOnForChannel(channel);

  setChannelSummary(channel, `正在读取 ${label} 寄存器并反解位域…`, 'running');
  const expectedByAddress = new Map((expectedPlan || []).map((entry) => [entry.addr, entry]));
  const readbacks = new Map();
  let ioErrors = 0;
  let mismatches = 0;

  for (const entry of registers) {
    const response = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr: entry.addr,
      value: 0,
      mask: 0xffff,
    });
    const expected = expectedByAddress.get(entry.addr);

    if (response.status !== REG.OK) {
      ioErrors += 1;
      appendChannelResult(channel, {
        step: '读取', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
        expected: expected ? hex(expected.value, 4) : '--', actual: '--', status: regStatusName(response.status),
        note: 'REG_REQ 读取失败', pass: false,
      });
      continue;
    }

    readbacks.set(entry.addr, response.value);
    const matches = !expected || ((response.value & entry.mask) === (expected.value & entry.mask));
    if (!matches) mismatches += 1;
    appendChannelResult(channel, {
      step: '读取', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
      expected: expected ? hex(expected.value, 4) : '--', actual: hex(response.value, 4),
      status: matches ? '通过' : '位域不匹配',
      note: expected ? (matches ? '可写位与计算值一致' : '保留位未参与比较') : '已读取并等待反解',
      pass: matches,
    });
  }

  if (readbacks.size === registers.length) applyChannelReadback(channel, readbacks);

  if (ioErrors > 0) {
    setChannelSummary(channel, `读取完成：${ioErrors} 个 I2C/REG 错误。`, 'fail');
  } else if (mismatches > 0) {
    setChannelSummary(channel, `读取完成：${mismatches} 个寄存器的可写位与计算值不匹配。`, 'fail');
  } else if (expectedPlan) {
    setChannelSummary(channel, `写入后的四个 ${label} 寄存器均已回读校验通过。`, 'pass');
  } else {
    setChannelSummary(channel, `已读取四个 ${label} 寄存器，并已反解到配置控件。`, 'pass');
  }
  return { readbacks, ioErrors, mismatches };
}

async function writeChannelRegisters(channel) {
  const label = channelLabel(channel);
  if (!$(channelElementId(channel, 'WriteConfirm')).checked) {
    throw new Error(`请先确认允许写入 ${label} 的可写位`);
  }

  const plan = getChannelRegisterPlan(channel);
  clearChannelResults(channel);
  await maybePowerOnForChannel(channel);
  setChannelSummary(channel, `正在按位域掩码写入 ${label} 寄存器…`, 'running');

  for (const entry of plan) {
    const response = await sendRegReq({
      target: 1,
      op: REG.UPDATE_BITS,
      width: 2,
      addr: entry.addr,
      value: entry.value,
      mask: entry.mask,
    });
    const accepted = response.status === REG.OK;
    appendChannelResult(channel, {
      step: '掩码写入', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
      expected: hex(entry.value, 4), actual: accepted ? hex(response.value, 4) : '--',
      status: accepted ? '已接受' : regStatusName(response.status),
      note: accepted ? entry.detail : 'REG_REQ 更新失败', pass: accepted,
    });
    if (!accepted) {
      setChannelSummary(channel, `${entry.name} 写入失败，未继续后续寄存器。`, 'fail');
      return {
        submitted: false,
        ioErrors: 1,
        mismatches: 0,
        failedRegister: entry.name,
        status: response.status,
      };
    }
  }

  const readback = await readChannelRegisters(channel, { clear: false, expectedPlan: plan, skipPowerOn: true });
  return { submitted: true, ...readback };
}

function exportChannelResults(channel) {
  const label = channelLabel(channel);
  const rows = state.channelRows[channel];
  if (rows.length === 0) {
    log(`${label} CSV 未导出：没有读写结果`);
    return;
  }
  const columns = [
    ['time', '时间'], ['step', '步骤'], ['name', '寄存器'], ['addr', '地址'],
    ['mask', '掩码'], ['expected', '期望值'], ['actual', '实际值'], ['status', '结果'], ['note', '说明'],
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([, columnLabel]) => columnLabel).join(','),
    ...rows.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sivy_ch${channel}_register_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`${label} 读写 CSV 已导出：${rows.length} 行`);
}

function frequencyConfigNumber(id, maximum) {
  const text = String($(id).value ?? '').trim();
  const value = Number(text);
  if (!text || !Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${id} 必须是 0 到 ${maximum} 的整数`);
  }
  return value;
}

function getFrequencyRegisterPlan() {
  const clockSelect = frequencyConfigNumber('frequencyClockSelect', 1);
  const mainSource = frequencyConfigNumber('frequencyMainSource', 1);
  const mcDivider = frequencyConfigNumber('frequencyMcDivider', 0xfe);
  const pulseWidthCode = frequencyConfigNumber('frequencyPulseWidth', 7);
  const bandwidth = frequencyConfigNumber('frequencyBandwidth', 3);
  const sampleSwitch = frequencyConfigNumber('frequencySampleSwitch', 1);
  const pllSource = frequencyConfigNumber('frequencyPllSource', 1);
  const pllEnabled = $('frequencyPllEnable').checked ? 1 : 0;
  const pllDicp = frequencyConfigNumber('frequencyPllDicp', 1);
  const pllKvco = frequencyConfigNumber('frequencyPllKvco', 15);
  const pllDm = frequencyConfigNumber('frequencyPllDm', 3);
  const pllDn = frequencyConfigNumber('frequencyPllDn', 7);
  const pllDp = frequencyConfigNumber('frequencyPllDp', 3);
  const pllBypass = $('frequencyPllBypass').checked ? 1 : 0;
  const pllPower = frequencyConfigNumber('frequencyPllPower', 3);
  const hsiEnabled = $('frequencyHsiEnable').checked ? 1 : 0;
  const hsiSelect = frequencyConfigNumber('frequencyHsiSelect', 1);
  const hsiCoarse = frequencyConfigNumber('frequencyHsiCoarse', 31);
  const hsiFine = frequencyConfigNumber('frequencyHsiFine', 63);
  const qspiDivider = frequencyConfigNumber('frequencyQspiDivider', 3);
  const clockOutput = frequencyConfigNumber('frequencyClockOutput', 7);

  if (mcDivider !== 0 && mcDivider % 2 !== 0) {
    throw new Error('MC_SEL 只能为 0 或 2 至 254 的偶数');
  }
  if (clockOutput > 4) {
    throw new Error(`COSEL=${clockOutput} 是保留值，请选择 0 至 4`);
  }

  const hsiTrim = (hsiCoarse << 6) | hsiFine;
  const inputDivider = PLL_INPUT_DIVISORS[pllDm];
  const vcoMultiplier = PLL_VCO_MULTIPLIERS[pllDn];
  const outputDivider = PLL_OUTPUT_DIVISORS[pllDp];
  const pulseWidth = PULSE_WIDTH_CYCLES[pulseWidthCode];
  const bandwidthLabels = ['>2 MHz', '1 MHz~2 MHz', '800 kHz~1 MHz', '<800 kHz'];
  const qspiDivisors = [1, 2, 4, 8];
  const clockOutputLabels = ['关闭', 'ECLK', 'HSI', 'PLL', '系统时钟'];

  return [
    {
      ...FREQUENCY_REGISTERS[0],
      value: clockSelect | (pulseWidthCode << 2) | (bandwidth << 9),
      detail: `CLK_SEL=${clockSelect ? '50 MHz' : '5 MHz'}, SAMP_CTRL=${pulseWidth} MC, CC_SEL=${bandwidthLabels[bandwidth]}`,
    },
    {
      ...FREQUENCY_REGISTERS[1],
      value: mainSource | (mcDivider << 1) | (sampleSwitch << 10) | (pllSource << 14),
      detail: `CLK_IN_SEL=${mainSource ? 'PLL' : 'HSI'}, MC_SEL=${mcDivider || '不分频'}, SAMPSW_SEL=${sampleSwitch}, PLL_CLK_SEL=${pllSource ? 'ECLK/HSE' : 'HSI'}`,
    },
    {
      ...FREQUENCY_REGISTERS[2],
      value: pllEnabled | (pllDicp << 1) | (pllKvco << 2) | (pllDm << 6)
        | (pllDn << 8) | (pllDp << 11) | (pllBypass << 13) | (pllPower << 14),
      detail: `PLL_EN=${pllEnabled}, DICP=${pllDicp}, KVCO=${pllKvco}, M=÷${inputDivider}, N=×${vcoMultiplier}, P=÷${outputDivider}, BYPASS=${pllBypass}, PW=${[75, 100, 125, 150][pllPower]}%`,
    },
    {
      ...FREQUENCY_REGISTERS[3],
      value: hsiEnabled | (hsiSelect << 1) | (hsiTrim << 2),
      detail: `HSI_EN=${hsiEnabled}, HSI_SEL=${hsiSelect ? '72 MHz' : '48 MHz'}, HSI_TRIM=${hex(hsiTrim, 3)}（粗调=${hsiCoarse}, 细调=${hsiFine}）`,
    },
    {
      ...FREQUENCY_REGISTERS[4],
      value: qspiDivider << 5,
      detail: `SCLK_FRQ=÷${qspiDivisors[qspiDivider]}`,
    },
    {
      ...FREQUENCY_REGISTERS[5],
      value: clockOutput << 3,
      detail: `COSEL=${clockOutputLabels[clockOutput]}`,
    },
  ];
}

function setFrequencySummary(text, level = 'idle') {
  const summary = $('frequencySummary');
  summary.textContent = text;
  summary.classList.remove('pass', 'fail', 'running', 'idle');
  summary.classList.add(level);
}

function frequencyOptionalPositiveNumber(id) {
  const text = String($(id).value ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${id} 必须是大于 0 的有效频率`);
  }
  return value;
}

function formatFrequencyMHz(value) {
  return Number(value.toFixed(6)).toString();
}

function renderFrequencyControl() {
  const tbody = $('frequencyPreviewRows');
  const warning = $('frequencyDecodeWarning');
  tbody.textContent = '';
  warning.textContent = '';

  try {
    const plan = getFrequencyRegisterPlan();
    for (const entry of plan) {
      const row = document.createElement('tr');
      const cells = [entry.name, hex(entry.addr, 2), hex(entry.mask, 4), hex(entry.value, 4), entry.detail];
      for (const value of cells) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }

    const pllSource = frequencyConfigNumber('frequencyPllSource', 1);
    const hsiSelect = frequencyConfigNumber('frequencyHsiSelect', 1);
    const pllDm = frequencyConfigNumber('frequencyPllDm', 3);
    const pllDn = frequencyConfigNumber('frequencyPllDn', 7);
    const pllDp = frequencyConfigNumber('frequencyPllDp', 3);
    const pllBypass = $('frequencyPllBypass').checked;
    const ratio = PLL_VCO_MULTIPLIERS[pllDn] / (PLL_INPUT_DIVISORS[pllDm] * PLL_OUTPUT_DIVISORS[pllDp]);
    const hsiInputMHz = hsiSelect ? 72 : 48;
    const externalInputMHz = frequencyOptionalPositiveNumber('frequencyExternalClockMHz');
    const inputMHz = pllSource ? externalInputMHz : hsiInputMHz;
    const sourceText = pllSource
      ? (externalInputMHz === null ? 'ECLK/HSE（请输入输入频率）' : `ECLK/HSE ${formatFrequencyMHz(externalInputMHz)} MHz`)
      : `${hsiInputMHz} MHz HSI（未计 HSI_TRIM 偏移）`;
    $('frequencyPllPreview').textContent = pllBypass
      ? `PLL_BYPASS=1：PLL 输出跟随 ${sourceText}，M/N/P 不参与输出频率。`
      : `按寄存器分频定义：PLL 输出 = ${sourceText} × ${PLL_VCO_MULTIPLIERS[pllDn]} ÷ ${PLL_INPUT_DIVISORS[pllDm]} ÷ ${PLL_OUTPUT_DIVISORS[pllDp]}（倍率 ${ratio}）。`;
    $('frequencyPllOutput').textContent = inputMHz === null
      ? 'PLL 预计输出频率：请输入 ECLK/HSE 输入频率。'
      : `PLL 预计输出频率：${formatFrequencyMHz(pllBypass ? inputMHz : inputMHz * ratio)} MHz${pllBypass ? '（旁路）' : ''}`;

    const coarse = frequencyConfigNumber('frequencyHsiCoarse', 31);
    const fine = frequencyConfigNumber('frequencyHsiFine', 63);
    const trim = (coarse << 6) | fine;
    $('frequencyHsiPreview').textContent = `HSI_TRIM = ${hex(trim, 3)}；粗调码 ${coarse}，细调码 ${fine}。切换或调节频率后芯片至少需要 1 µs 稳定时间。`;

    const mainSource = frequencyConfigNumber('frequencyMainSource', 1);
    const pllEnabled = $('frequencyPllEnable').checked;
    const hsiEnabled = $('frequencyHsiEnable').checked;
    const warnings = [];
    if (!hsiEnabled && (mainSource === 0 || (mainSource === 1 && pllSource === 0))) {
      warnings.push('当前时钟链路依赖 HSI，但 HSI_EN 已关闭');
    }
    if (mainSource === 1 && !pllEnabled && !pllBypass) {
      warnings.push('主时钟已选择 PLL，但 PLL_EN 已关闭且未旁路');
    }
    warning.textContent = warnings.join('；');
  } catch (error) {
    warning.textContent = `频率寄存器计算失败：${error.message}`;
    $('frequencyPllPreview').textContent = '';
    $('frequencyPllOutput').textContent = '';
    $('frequencyHsiPreview').textContent = '';
  }
}

function clearFrequencyResults() {
  state.frequencyRows = [];
  $('frequencyResultRows').textContent = '';
  setFrequencySummary('调整控件后会实时显示频率相关寄存器值；写入前需要勾选确认。');
}

function appendFrequencyResult(row) {
  const tbody = $('frequencyResultRows');
  const tr = document.createElement('tr');
  const cells = [row.step, row.name, row.addr, row.mask, row.expected, row.actual, row.status, row.note];
  for (const value of cells) {
    const cell = document.createElement('td');
    cell.textContent = value;
    tr.appendChild(cell);
  }
  tr.children[6].className = row.pass ? 'pass' : 'fail';
  tbody.appendChild(tr);
  state.frequencyRows.push({ time: new Date().toISOString(), ...row });
}

async function maybePowerOnForFrequencyControl() {
  if ($('frequencyPowerOn').checked) {
    await ctrl(CTRL.POWER_ON);
  }
}

function applyFrequencyReadback(readbacks) {
  const glbCtrl0 = readbacks.get(0x00);
  const glbCtrl1 = readbacks.get(0x02);
  const pllCtrl = readbacks.get(0x04);
  const hsiCtrl = readbacks.get(0x06);
  const qspiCtrl = readbacks.get(0x0a);
  const coCtrl = readbacks.get(0x3a);
  const hsiTrim = (hsiCtrl >> 2) & 0x07ff;

  $('frequencyClockSelect').value = String(glbCtrl0 & 0x01);
  $('frequencyPulseWidth').value = String((glbCtrl0 >> 2) & 0x07);
  $('frequencyBandwidth').value = String((glbCtrl0 >> 9) & 0x03);
  $('frequencyMainSource').value = String(glbCtrl1 & 0x01);
  $('frequencyMcDivider').value = String((glbCtrl1 >> 1) & 0xff);
  $('frequencySampleSwitch').value = String((glbCtrl1 >> 10) & 0x01);
  $('frequencyPllSource').value = String((glbCtrl1 >> 14) & 0x01);
  $('frequencyPllEnable').checked = (pllCtrl & 0x0001) !== 0;
  $('frequencyPllDicp').value = String((pllCtrl >> 1) & 0x01);
  $('frequencyPllKvco').value = String((pllCtrl >> 2) & 0x0f);
  $('frequencyPllDm').value = String((pllCtrl >> 6) & 0x03);
  $('frequencyPllDn').value = String((pllCtrl >> 8) & 0x07);
  $('frequencyPllDp').value = String((pllCtrl >> 11) & 0x03);
  $('frequencyPllBypass').checked = (pllCtrl & 0x2000) !== 0;
  $('frequencyPllPower').value = String((pllCtrl >> 14) & 0x03);
  $('frequencyHsiEnable').checked = (hsiCtrl & 0x0001) !== 0;
  $('frequencyHsiSelect').value = String((hsiCtrl >> 1) & 0x01);
  $('frequencyHsiCoarse').value = String((hsiTrim >> 6) & 0x1f);
  $('frequencyHsiFine').value = String(hsiTrim & 0x3f);
  $('frequencyQspiDivider').value = String((qspiCtrl >> 5) & 0x03);
  $('frequencyClockOutput').value = String((coCtrl >> 3) & 0x07);
  renderFrequencyControl();
}

async function readFrequencyControl({ clear = true, expectedPlan = null, skipPowerOn = false } = {}) {
  if (clear) clearFrequencyResults();
  if (!skipPowerOn) await maybePowerOnForFrequencyControl();

  setFrequencySummary('正在读取频率相关寄存器并反解位域…', 'running');
  const expectedByAddress = new Map((expectedPlan || []).map((entry) => [entry.addr, entry]));
  const readbacks = new Map();
  let ioErrors = 0;
  let mismatches = 0;

  for (const entry of FREQUENCY_REGISTERS) {
    const response = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr: entry.addr,
      value: 0,
      mask: 0xffff,
    });
    const expected = expectedByAddress.get(entry.addr);
    if (response.status !== REG.OK) {
      ioErrors += 1;
      appendFrequencyResult({
        step: '读取', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
        expected: expected ? hex(expected.value, 4) : '--', actual: '--', status: regStatusName(response.status),
        note: 'REG_REQ 读取失败', pass: false,
      });
      continue;
    }

    readbacks.set(entry.addr, response.value);
    const matches = !expected || ((response.value & entry.mask) === (expected.value & entry.mask));
    if (!matches) mismatches += 1;
    appendFrequencyResult({
      step: '读取', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
      expected: expected ? hex(expected.value, 4) : '--', actual: hex(response.value, 4),
      status: matches ? '通过' : '位域不匹配',
      note: expected ? (matches ? '频率位域与计算值一致' : '非目标位不参与比较') : '已读取并等待反解',
      pass: matches,
    });
  }

  if (readbacks.size === FREQUENCY_REGISTERS.length) applyFrequencyReadback(readbacks);

  if (ioErrors > 0) {
    setFrequencySummary(`读取完成：${ioErrors} 个 I2C/REG 错误。`, 'fail');
  } else if (mismatches > 0) {
    setFrequencySummary(`读取完成：${mismatches} 个寄存器的频率位域与计算值不匹配。`, 'fail');
  } else if (expectedPlan) {
    setFrequencySummary('全部频率相关寄存器均已写入并回读校验通过。', 'pass');
  } else {
    setFrequencySummary('已读取六个频率相关寄存器，并已反解到配置控件。', 'pass');
  }
  return { readbacks, ioErrors, mismatches };
}

async function writeFrequencyControl() {
  if (!$('frequencyWriteConfirm').checked) {
    throw new Error('请先确认允许写入时钟与频率位域');
  }

  const plan = getFrequencyRegisterPlan();
  const planByAddress = new Map(plan.map((entry) => [entry.addr, entry]));
  clearFrequencyResults();
  await maybePowerOnForFrequencyControl();
  setFrequencySummary('正在按安全顺序写入时钟与频率位域…', 'running');

  for (const addr of FREQUENCY_WRITE_ORDER) {
    const entry = planByAddress.get(addr);
    const response = await sendRegReq({
      target: 1,
      op: REG.UPDATE_BITS,
      width: 2,
      addr: entry.addr,
      value: entry.value,
      mask: entry.mask,
    });
    const accepted = response.status === REG.OK;
    appendFrequencyResult({
      step: '掩码写入', name: entry.name, addr: hex(entry.addr, 2), mask: hex(entry.mask, 4),
      expected: hex(entry.value, 4), actual: accepted ? hex(response.value, 4) : '--',
      status: accepted ? '已接受' : regStatusName(response.status),
      note: accepted ? entry.detail : 'REG_REQ 更新失败', pass: accepted,
    });
    if (!accepted) {
      setFrequencySummary(`${entry.name} 写入失败，未继续后续寄存器。`, 'fail');
      return;
    }
    if (entry.addr === 0x06) await delay(1);
  }

  await readFrequencyControl({ clear: false, expectedPlan: plan, skipPowerOn: true });
}

function exportFrequencyResults() {
  if (state.frequencyRows.length === 0) {
    log('频率控制 CSV 未导出：没有读写结果');
    return;
  }
  const columns = [
    ['time', '时间'], ['step', '步骤'], ['name', '寄存器'], ['addr', '地址'],
    ['mask', '掩码'], ['expected', '期望值'], ['actual', '实际值'], ['status', '结果'], ['note', '说明'],
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([, label]) => label).join(','),
    ...state.frequencyRows.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sivy_frequency_control_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`频率控制 CSV 已导出：${state.frequencyRows.length} 行`);
}

function powerLevelCode(field) {
  const level = parseNumber($(`power${field.element}Level`).value);
  if (!Number.isInteger(level) || level < 0 || level >= POWER_LEVELS.length) {
    throw new Error(`${field.name} 功耗挡位必须是 0 到 7 的整数`);
  }
  return level;
}

function powerLevelText(level) {
  const detail = POWER_LEVELS[level];
  return `${detail.percent}%（档位 ${level}）`;
}

function getPowerControlPlan() {
  const fields = POWER_CONTROL_REGISTER.fields.map((field) => ({
    ...field,
    level: powerLevelCode(field),
  }));
  return {
    ...POWER_CONTROL_REGISTER,
    fields,
    value: fields.reduce((value, field) => value | (field.level << field.shift), 0),
    detail: `五路独立：${fields.map((field) => `${field.name}=${POWER_LEVELS[field.level].binary}（${POWER_LEVELS[field.level].percent}%）`).join('，')}`,
  };
}

function decodePowerControlValue(value) {
  return POWER_CONTROL_REGISTER.fields.map((field) => ({
    ...field,
    level: (value >> field.shift) & 0x07,
  }));
}

function setPowerSummary(text, level = 'idle') {
  const summary = $('powerSummary');
  summary.textContent = text;
  summary.classList.remove('pass', 'fail', 'running', 'idle');
  summary.classList.add(level);
}

function renderPowerControl() {
  $('powerDecodeWarning').textContent = '';
  try {
    const plan = getPowerControlPlan();
    $('powerRegisterPreview').textContent = `目标 PW_CTRL[0x38] = ${hex(plan.value, 4)}；UPDATE_BITS mask = ${hex(plan.mask, 4)}；bit 15 保留。`;

    for (const field of plan.fields) {
      const detail = POWER_LEVELS[field.level];
      $(`power${field.element}Value`).textContent = powerLevelText(field.level);
      $(`power${field.element}Code`).textContent = detail.binary;
      const stage = $(`powerStage${field.element}`);
      stage.style.setProperty('--power-level', `${((field.level + 1) / POWER_LEVELS.length) * 100}%`);
      stage.dataset.level = String(field.level);
    }
  } catch (error) {
    $('powerDecodeWarning').textContent = `功耗寄存器计算失败：${error.message}`;
  }
}

function applyPowerReadback(value) {
  const fields = decodePowerControlValue(value);
  for (const field of fields) {
    $(`power${field.element}Level`).value = String(field.level);
  }
  renderPowerControl();
}

function clearPowerResults() {
  state.powerRows = [];
  $('powerResultRows').textContent = '';
  setPowerSummary('五个滑块可独立调整；写入前需要勾选确认。');
}

function appendPowerResult(row) {
  const tbody = $('powerResultRows');
  const tr = document.createElement('tr');
  const cells = [row.step, row.name, row.addr, row.mask, row.expected, row.actual, row.status, row.note];

  for (const value of cells) {
    const cell = document.createElement('td');
    cell.textContent = value;
    tr.appendChild(cell);
  }
  tr.children[6].className = row.pass ? 'pass' : 'fail';
  tbody.appendChild(tr);
  state.powerRows.push({ time: new Date().toISOString(), ...row });
}

async function maybePowerOnForPowerControl() {
  if ($('powerControlPowerOn').checked) {
    await ctrl(CTRL.POWER_ON);
  }
}

async function readPowerControl({ clear = true, expectedPlan = null, skipPowerOn = false } = {}) {
  if (clear) clearPowerResults();
  if (!skipPowerOn) await maybePowerOnForPowerControl();

  setPowerSummary('正在读取 PW_CTRL 并反解五个功耗字段…', 'running');
  const response = await sendRegReq({
    target: 1,
    op: REG.READ,
    width: 2,
    addr: POWER_CONTROL_REGISTER.addr,
    value: 0,
    mask: 0xffff,
  });

  if (response.status !== REG.OK) {
    appendPowerResult({
      step: '读取',
      name: POWER_CONTROL_REGISTER.name,
      addr: hex(POWER_CONTROL_REGISTER.addr, 2),
      mask: hex(POWER_CONTROL_REGISTER.mask, 4),
      expected: expectedPlan ? hex(expectedPlan.value, 4) : '--',
      actual: '--',
      status: regStatusName(response.status),
      note: 'REG_REQ 读取失败',
      pass: false,
    });
    setPowerSummary('读取 PW_CTRL 失败，请检查 ASC 外部电源、I2C 和 BLE 连接。', 'fail');
    return { response, matched: false };
  }

  applyPowerReadback(response.value);
  const matched = !expectedPlan
    || ((response.value & POWER_CONTROL_REGISTER.mask) === (expectedPlan.value & POWER_CONTROL_REGISTER.mask));
  appendPowerResult({
    step: '读取',
    name: POWER_CONTROL_REGISTER.name,
    addr: hex(POWER_CONTROL_REGISTER.addr, 2),
    mask: hex(POWER_CONTROL_REGISTER.mask, 4),
    expected: expectedPlan ? hex(expectedPlan.value, 4) : '--',
    actual: hex(response.value, 4),
    status: matched ? '通过' : '功耗字段不匹配',
    note: expectedPlan ? (matched ? '五个独立功耗字段已回读校验' : 'bit 15 保留，未参与比较') : '已反解到五个独立滑块',
    pass: matched,
  });
  setPowerSummary(
    expectedPlan
      ? (matched ? 'PW_CTRL 的五个独立功耗字段已写入并回读校验通过。' : 'PW_CTRL 回读值与所选独立功耗挡位不一致。')
      : '已读取 PW_CTRL，并已反解到五个独立滑块。',
    matched ? 'pass' : 'fail',
  );
  return { response, matched };
}

async function writePowerControl() {
  if (!$('powerWriteConfirm').checked) {
    throw new Error('请先确认允许写入 PW_CTRL 的五个独立功耗字段');
  }

  const plan = getPowerControlPlan();
  clearPowerResults();
  await maybePowerOnForPowerControl();
  setPowerSummary('正在写入五个独立功耗字段…', 'running');
  const response = await sendRegReq({
    target: 1,
    op: REG.UPDATE_BITS,
    width: 2,
    addr: plan.addr,
    value: plan.value,
    mask: plan.mask,
  });

  const accepted = response.status === REG.OK;
  appendPowerResult({
    step: '掩码写入',
    name: plan.name,
    addr: hex(plan.addr, 2),
    mask: hex(plan.mask, 4),
    expected: hex(plan.value, 4),
    actual: accepted ? hex(response.value, 4) : '--',
    status: accepted ? '已接受' : regStatusName(response.status),
    note: accepted ? plan.detail : 'REG_REQ 更新失败',
    pass: accepted,
  });
  if (!accepted) {
    setPowerSummary('PW_CTRL 写入失败。', 'fail');
    return;
  }

  await readPowerControl({ clear: false, expectedPlan: plan, skipPowerOn: true });
}

function exportPowerResults() {
  if (state.powerRows.length === 0) {
    log('功耗控制 CSV 未导出：没有读写结果');
    return;
  }
  const columns = [
    ['time', '时间'], ['step', '步骤'], ['name', '寄存器'], ['addr', '地址'],
    ['mask', '掩码'], ['expected', '期望值'], ['actual', '实际值'], ['status', '结果'], ['note', '说明'],
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([, label]) => label).join(','),
    ...state.powerRows.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sivy_power_control_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`功耗控制 CSV 已导出：${state.powerRows.length} 行`);
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
  log(`ASC 寄存器读取测试：${regs.length} 个寄存器`);

  for (const addr of regs) {
    const rsp = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr,
      value: 0,
      mask: 0xffff,
    });
    appendAscRspResult('读取列表', '读取', addr, rsp);
  }

  await readStatus();
}

async function runAscRegisterWriteVerify({ clear = true } = {}) {
  if (clear) clearAscTestResults();
  if (!$('ascTestWriteEnable').checked) {
    appendAscTestResult({
      step: '写入校验',
      op: '跳过',
      addr: '--',
      expected: '--',
      actual: '--',
      status: '已跳过',
      note: '未启用写入校验',
      pass: false,
      warn: true,
    });
    return;
  }

  await maybePowerOnForAscTest();

  const addr = parseNumberStrict($('ascTestWriteAddr').value);
  const mask = parseNumberStrict($('ascTestWriteMask').value) & 0xffff;
  const testValue = parseNumberStrict($('ascTestWriteValue').value) & 0xffff;

  if (addr > 0x7f) throw new Error(`安全寄存器超出范围：${hex(addr, 2)}`);
  if (mask === 0) throw new Error('写入掩码不能为零');

  let original = 0;
  let originalKnown = false;
  let wrote = false;

  log(`ASC 寄存器写入校验：地址=${hex(addr, 2)} 掩码=${hex(mask, 4)} 数值=${hex(testValue, 4)}`);

  try {
    const readRsp = await sendRegReq({
      target: 1,
      op: REG.READ,
      width: 2,
      addr,
      value: 0,
      mask: 0xffff,
    });
    appendAscRspResult('写入校验', '读取原值', addr, readRsp);
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
    appendAscRspResult('写入校验', '更新位', addr, writeRsp, hex(expected, 4));
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
      step: '写入校验',
      op: '校验',
      addr: hex(addr, 2),
      expected: hex(expected, 4),
      actual: verifyRsp.status === REG.OK ? hex(verifyRsp.value, 4) : '--',
      status: pass ? '正常' : regStatusName(verifyRsp.status),
      note: pass ? '掩码位匹配' : '掩码位不匹配',
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
      appendAscRspResult('恢复', '恢复原值', addr, restoreRsp, hex(original, 4));

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
        step: '恢复',
        op: '回读',
        addr: hex(addr, 2),
        expected: hex(original, 4),
        actual: finalRsp.status === REG.OK ? hex(finalRsp.value, 4) : '--',
        status: restored ? '正常' : regStatusName(finalRsp.status),
        note: restored ? '掩码位已恢复' : '恢复值不匹配',
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
    log('ASC 寄存器 CSV 未导出：没有结果行');
    return;
  }

  const columns = [
    ['time', '时间'],
    ['step', '步骤'],
    ['op', '操作'],
    ['addr', '地址'],
    ['expected', '期望值'],
    ['actual', '实际值'],
    ['status', '状态'],
    ['note', '说明'],
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([, label]) => label).join(','),
    ...state.ascRegTestRows.map((row) => columns.map(([key]) => escape(row[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `asc_register_test_${stamp}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`ASC 寄存器 CSV 已导出：${state.ascRegTestRows.length} 行`);
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

function prepareScopeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = scopeCanvas.getBoundingClientRect();
  const pixelWidth = Math.max(1, Math.floor(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.floor(rect.height * dpr));
  if (scopeCanvas.width !== pixelWidth) scopeCanvas.width = pixelWidth;
  if (scopeCanvas.height !== pixelHeight) scopeCanvas.height = pixelHeight;
  scopeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {
    width: rect.width,
    height: rect.height,
    pad: { left: 54, right: 18, top: 18, bottom: 30 },
  };
}

function drawScopeGrid({ width, height, pad }) {
  scopeCtx.clearRect(0, 0, width, height);
  scopeCtx.fillStyle = '#0d1726';
  scopeCtx.fillRect(0, 0, width, height);
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = Math.max(1, height - pad.top - pad.bottom);

  scopeCtx.strokeStyle = 'rgba(139, 176, 220, 0.15)';
  scopeCtx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const x = pad.left + (plotW * i) / 10;
    scopeCtx.beginPath();
    scopeCtx.moveTo(x, pad.top);
    scopeCtx.lineTo(x, pad.top + plotH);
    scopeCtx.stroke();
  }
  for (let i = 0; i <= 8; i += 1) {
    const y = pad.top + (plotH * i) / 8;
    scopeCtx.beginPath();
    scopeCtx.moveTo(pad.left, y);
    scopeCtx.lineTo(width - pad.right, y);
    scopeCtx.stroke();
  }

  return { plotW, plotH };
}

function drawScopeBleSamples() {
  const layout = prepareScopeCanvas();
  const { plotW, plotH } = drawScopeGrid(layout);
  const samples = state.samples.slice(-300);

  scopeCtx.fillStyle = 'rgba(229, 236, 247, 0.7)';
  scopeCtx.font = '11px "SF Mono", Consolas, monospace';
  scopeCtx.fillText('3300 mV', 7, layout.pad.top + 4);
  scopeCtx.fillText('0 mV', 22, layout.pad.top + plotH + 4);

  const drawChannel = (channelSamples, color) => {
    if (channelSamples.length === 0) return;
    const minT = channelSamples[0].timestampUs;
    const maxT = channelSamples[channelSamples.length - 1].timestampUs;
    const span = Math.max(1, maxT - minT);
    scopeCtx.strokeStyle = color;
    scopeCtx.lineWidth = 2;
    scopeCtx.beginPath();
    channelSamples.forEach((sample, index) => {
      const value = (sample.flags & 0x01) ? sample.mv : sample.raw;
      const y = layout.pad.top + plotH - (Math.max(0, Math.min(3300, value)) / 3300) * plotH;
      const x = layout.pad.left + ((sample.timestampUs - minT) / span) * plotW;
      if (index === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    });
    scopeCtx.stroke();
  };

  drawChannel(samples.filter((sample) => sample.channel === 0), '#4ea1ff');
  drawChannel(samples.filter((sample) => sample.channel === 1), '#4ed08b');
  scopeCtx.fillStyle = '#4ea1ff';
  scopeCtx.fillText('CH0', layout.pad.left + 8, layout.pad.top + 14);
  scopeCtx.fillStyle = '#4ed08b';
  scopeCtx.fillText('CH1', layout.pad.left + 52, layout.pad.top + 14);
}

function normalizeScopeChannels(frame) {
  const rawChannels = Array.isArray(frame?.channels)
    ? frame.channels
    : Array.isArray(frame?.traces)
      ? frame.traces
      : [];
  const channels = [];

  for (const [index, rawChannel] of rawChannels.entries()) {
    if (!rawChannel || typeof rawChannel !== 'object') continue;
    const rawPoints = Array.isArray(rawChannel.samples)
      ? rawChannel.samples
      : Array.isArray(rawChannel.points)
        ? rawChannel.points
        : null;
    if (!rawPoints || rawPoints.length < 2) continue;

    const xStart = Number(rawChannel.xStart ?? rawChannel.t0 ?? 0);
    const xStep = Number(rawChannel.xStep ?? rawChannel.dt ?? 1);
    const points = [];
    for (const [pointIndex, point] of rawPoints.entries()) {
      let x;
      let y;
      if (Array.isArray(point)) {
        x = Number(point[0]);
        y = Number(point[1]);
      } else if (point && typeof point === 'object') {
        x = Number(point.x ?? (xStart + pointIndex * xStep));
        y = Number(point.y);
      } else {
        x = xStart + pointIndex * xStep;
        y = Number(point);
      }
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
    if (points.length < 2) continue;
    channels.push({
      label: String(rawChannel.name || rawChannel.label || `CH${index + 1}`),
      unit: String(rawChannel.unit || frame.unit || ''),
      color: String(rawChannel.color || ['#4ea1ff', '#4ed08b', '#ffd166', '#ff7a90'][index % 4]),
      points,
    });
  }

  if (channels.length === 0) {
    throw new Error('外部示波器数据格式无效：channels[].samples 或 channels[].points 至少需要两个数值');
  }
  return channels;
}

function drawExternalScopeFrame(frame) {
  const channels = normalizeScopeChannels(frame);
  const layout = prepareScopeCanvas();
  const { plotW, plotH } = drawScopeGrid(layout);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const channel of channels) {
    for (const point of channel.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (minX === maxX) maxX = minX + 1;
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }
  const yPadding = (maxY - minY) * 0.08;
  minY -= yPadding;
  maxY += yPadding;

  scopeCtx.fillStyle = 'rgba(229, 236, 247, 0.7)';
  scopeCtx.font = '10px "SF Mono", Consolas, monospace';
  scopeCtx.fillText(maxY.toPrecision(4), 5, layout.pad.top + 4);
  scopeCtx.fillText(minY.toPrecision(4), 5, layout.pad.top + plotH + 4);

  for (const channel of channels) {
    scopeCtx.strokeStyle = channel.color;
    scopeCtx.lineWidth = 1.8;
    scopeCtx.beginPath();
    channel.points.forEach((point, index) => {
      const x = layout.pad.left + ((point.x - minX) / (maxX - minX)) * plotW;
      const y = layout.pad.top + plotH - ((point.y - minY) / (maxY - minY)) * plotH;
      if (index === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    });
    scopeCtx.stroke();
  }

  let legendX = layout.pad.left + 8;
  for (const channel of channels) {
    scopeCtx.fillStyle = channel.color;
    scopeCtx.fillText(`${channel.label}${channel.unit ? ` (${channel.unit})` : ''}`, legendX, layout.pad.top + 14);
    legendX += Math.max(68, channel.label.length * 9 + 28);
  }
}

function drawScopeScreenshot(image) {
  const layout = prepareScopeCanvas();
  drawScopeGrid(layout);
  const scale = Math.min(
    layout.width / image.naturalWidth,
    layout.height / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  scopeCtx.drawImage(
    image,
    (layout.width - drawWidth) / 2,
    (layout.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawScopeMonitor() {
  const hasBleSamples = state.scope.source === 'ble' && state.samples.length > 0;
  const hasExternalFrame = state.scope.source === 'websocket' && state.scope.frame;
  const hasScreenshot = state.scope.source === 'websocket' && state.scope.screenshot;
  $('scopeEmpty').classList.toggle('hidden', Boolean(hasBleSamples || hasExternalFrame || hasScreenshot));

  if (hasBleSamples) {
    drawScopeBleSamples();
  } else if (hasScreenshot) {
    drawScopeScreenshot(state.scope.screenshot);
  } else if (hasExternalFrame) {
    try {
      drawExternalScopeFrame(state.scope.frame);
    } catch (error) {
      log(error.message);
      state.scope.frame = null;
      const layout = prepareScopeCanvas();
      drawScopeGrid(layout);
      $('scopeEmpty').classList.remove('hidden');
    }
  } else {
    const layout = prepareScopeCanvas();
    drawScopeGrid(layout);
  }
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
      throw new Error('CBOR 数据不完整');
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
    throw new Error(`不支持的 CBOR 长度：${add}`);
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
        throw new Error(`不合法的不定长 CBOR 数据块：0x${head.toString(16)}`);
      }
      const chunk = readDefiniteBytes(expectedMajor, add);
      chunks.push(chunk);
    }
    if (offset >= data.length) throw new Error('不定长 CBOR 数据项未结束');
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
        if (offset >= data.length) throw new Error('不定长 CBOR 数组未结束');
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
        if (offset >= data.length) throw new Error('不定长 CBOR 映射未结束');
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
    throw new Error(`不支持的 CBOR 数据项：0x${head.toString(16)}`);
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
        reject(new Error('等待 SMP 响应超时'));
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
      const name = SMP_RC_NAMES[rc] || `未知返回码_${rc}`;
      const group = err?.group !== undefined ? `，分组=${err.group}` : '';
      throw new Error(`SMP 返回码=${rc}（${name}）${group}`);
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
  if (!Number.isFinite(value) || value <= 0) return '修改时间未知';
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
  if (images.length === 0) return '没有镜像';
  return images.map((image) => {
    const hash = normalizeBytes(image.hash);
    const slot = image.image !== undefined ? `${image.image}:${image.slot}` : `${image.slot}`;
    const flags = [
      flagSet(image.active) ? '当前运行' : '',
      flagSet(image.pending) ? '待启动' : '',
      flagSet(image.confirmed) ? '已确认' : '',
      flagSet(image.permanent) ? '永久' : '',
      flagClear(image.bootable) ? '不可启动' : '',
    ].filter(Boolean).join(',');
    return `槽位=${slot} 版本=${image.version || '--'} ${flags || '空闲'} 哈希=${bytesToHex(hash).slice(0, 16)}… 长度=${hash?.length || 0}`;
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
  return info?.version ? `版本 ${info.version}` : '版本未知';
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
  throw new Error('未找到 ZIP 文件结束记录');
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
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('ZIP 中央目录无效');
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
      log(`已忽略清单文件：${error.message}`);
    }
  }

  if (!target) throw new Error('ZIP 文件中没有找到 .bin 镜像');
  return { name: target.name, bytes: await extractZipEntry(bytes, view, target) };
}

async function extractZipEntry(bytes, view, entry) {
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`${entry.name} 的本地文件头无效`);
  const fileNameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const start = local + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) {
    if (!('DecompressionStream' in window)) {
      throw new Error('当前浏览器无法解压 ZIP 文件项');
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`);
}

async function uploadOta() {
  if (!state.smp) throw new Error('SMP OTA 特征尚未就绪');
  if (!state.otaBytes) throw new Error('请选择 OTA .bin 或 dfu_application.zip 文件');

  const image = state.otaBytes;
  let offset = 0;
  const chunkSize = 128;
  let lastLoggedPercent = -1;
  const versionLabel = otaVersionLabel(state.otaInfo);

  $('otaUploadBtn').disabled = true;
  try {
    setOtaProgress(0, image.length, `正在计算镜像哈希：${versionLabel}`);
    await nextFrame();
    const hash = await sha256(image);

    log(`OTA 开始上传：${state.otaName}，${formatBytes(image.length)}，${versionLabel}，选择时间 ${formatTimestamp(state.otaSourceModifiedMs)}`);
    while (offset < image.length) {
      const chunk = image.slice(offset, Math.min(image.length, offset + chunkSize));
      const body = offset === 0
        ? { off: offset, len: image.length, sha: hash, data: chunk }
        : { off: offset, data: chunk };

      setOtaProgress(offset, image.length, `正在发送分块：${formatBytes(offset)}`);
      await nextFrame();
      const response = await state.smp.command(SMP.GROUP_IMAGE, SMP.IMG_UPLOAD, SMP.OP_WRITE, body, 20000);
      const nextOffset = Number(response.off ?? (offset + chunk.length));
      if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
        throw new Error(`SMP 上传偏移量无效：${response.off}`);
      }

      offset = Math.min(nextOffset, image.length);
      const percent = Math.floor((offset / image.length) * 100);
      setOtaProgress(offset, image.length, '正在上传');
      if (percent >= lastLoggedPercent + 5 || offset === image.length) {
        lastLoggedPercent = percent;
        log(`OTA 上传 ${percent}%（${offset}/${image.length}）`);
      }
      await delay(18);
    }

    setOtaProgress(image.length, image.length, '正在读取镜像状态');
    await nextFrame();
    const imageStateBody = await readImageStateBody();
    log(`上传后的镜像状态：${imageStateSummary(imageStateBody)}`);
    const testSelection = findTestBootImage(imageStateBody);
    if (testSelection.duplicateActive) {
      setOtaProgress(image.length, image.length, '已完成：镜像与当前运行镜像相同，未标记测试启动');
      log(`OTA 上传完成，但槽位=${testSelection.duplicateActive.slot} 的哈希与当前运行镜像相同。请重新构建/签名不同的固件镜像后再测试重启切换。`);
      if (state.otaInfo?.version && testSelection.duplicateActive.version && state.otaInfo.version !== testSelection.duplicateActive.version) {
        log(`所选 OTA 文件为 ${otaVersionLabel(state.otaInfo)}，但镜像状态仍显示 ${testSelection.duplicateActive.version}。请重新选择新构建的 zip/bin 后重试。`);
      }
      return;
    }
    if (!testSelection.image) {
      throw new Error('镜像状态中没有找到可启动的非当前镜像哈希');
    }

    const testImage = testSelection.image;
    setOtaProgress(image.length, image.length, '正在标记测试启动');
    await nextFrame();
    await state.smp.command(SMP.GROUP_IMAGE, SMP.IMG_STATE, SMP.OP_WRITE, {
      hash: testImage.hash,
      confirm: false,
    });
    setOtaProgress(image.length, image.length, '已完成：请点击“重启”启动测试镜像');
    log(`OTA 镜像已标记为测试启动：槽位=${testImage.slot}，哈希=${bytesToHex(testImage.hash).slice(0, 16)}…；点击“重启”后进入该镜像`);
  } catch (error) {
    setOtaProgress(offset, image.length, `失败：${error.message}`);
    throw error;
  } finally {
    $('otaUploadBtn').disabled = false;
  }
}

async function resetBySmp() {
  if (!state.smp) throw new Error('SMP OTA 特征尚未就绪');
  try {
    $('otaProgressText').textContent = '已发送重启命令，请在设备重启后重新连接';
    await state.smp.command(SMP.GROUP_OS, SMP.OS_RESET, SMP.OP_WRITE, {}, 2000);
  } catch (error) {
    $('otaProgressText').textContent = '已发送重启命令，请在设备重启后重新连接';
    log(`已发送重启命令：${error.message}`);
  }
}

async function imageState() {
  if (!state.smp) throw new Error('SMP OTA 特征尚未就绪');
  const body = await readImageStateBody();
  $('otaProgressText').textContent = '已读取镜像状态，请查看事件日志';
  log(`镜像状态：${imageStateSummary(body)}`);
}

function initializeChannelControls() {
  const list = $('channelControlList');
  const template = $('channelControlTemplate');
  if (list.children.length > 0) return;

  for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
    const fragment = template.content.cloneNode(true);
    const block = fragment.querySelector('.channel-control-block');
    const registers = CHANNEL_REGISTERS[channel];
    block.open = channel === 0;
    block.dataset.channel = String(channel);
    block.querySelector('[data-channel-title]').textContent = channelLabel(channel);
    block.querySelector('[data-channel-addresses]').textContent = [
      `CTRL ${hex(registers[0].addr, 2)}`,
      `FEAT ${hex(registers[1].addr, 2)}`,
      `WORK ${hex(registers[2].addr, 2)}`,
      `WAIT ${hex(registers[3].addr, 2)}`,
    ].join(' · ');
    for (const element of block.querySelectorAll('[data-channel-id]')) {
      element.id = channelElementId(channel, element.dataset.channelId);
    }
    list.appendChild(fragment);
  }
}

function bindUi() {
  initializeChannelControls();
  initLanguageControl();
  ensureProfileEntries();
  restoreScopeSettings();
  restoreGeneratorSettings();
  updateDeviceFilterUi();
  updateRuntimeEnvironment();
  setConnected(false);
  resetAutomationUi();
  log(`网页测试控制台版本 ${WEB_CONSOLE_BUILD}`);
  $('deviceFilterMode').addEventListener('change', updateDeviceFilterUi);
  $('connectBtn').addEventListener('click', () => run(connect));
  $('disconnectBtn').addEventListener('click', () => run(disconnect));
  $('autoRunBtn').addEventListener('click', () => run(runAutomatedWorkflow));
  $('scopeSourceOption').addEventListener('change', () => setScopeSource($('scopeSourceOption').value));
  $('scopeConnectBtn').addEventListener('click', () => run(toggleScopeStream));
  $('scopeClearBtn').addEventListener('click', clearScopeMonitor);
  $('scopeFullscreenBtn').addEventListener('click', () => run(toggleScopeFullscreen));
  $('scopeInstrumentIp').addEventListener('input', () => {
    saveScopeSettings();
    if (!state.scope.socket) syncScopeControls();
  });
  $('scopeRefreshInterval').addEventListener('change', saveScopeSettings);
  $('scopeStreamUrl').addEventListener('change', saveScopeSettings);
  $('scopeAccessKey').addEventListener('change', saveScopeSettings);
  $('scopeAccessKey').addEventListener('input', saveScopeSettings);
  $('generatorApplyBtn').addEventListener('click', () => run(applyGenerator));
  $('generatorReadBtn').addEventListener('click', () => run(readGenerator));
  $('generatorOutputOffBtn').addEventListener('click', () => run(disableGeneratorOutput));
  for (const id of [
    'generatorIp', 'generatorChannel', 'generatorWaveform',
    'generatorAmplitude', 'generatorFrequency', 'generatorLoad',
  ]) {
    $(id).addEventListener('input', () => {
      saveGeneratorSettings();
      renderGeneratorPreview();
    });
    $(id).addEventListener('change', () => {
      saveGeneratorSettings();
      renderGeneratorPreview();
    });
  }
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
  $('sivyTestSnapshotBtn').addEventListener('click', () => run(runSivySnapshot));
  $('sivyTestInitWriteBtn').addEventListener('click', () => run(runSivySelectedInitWrite));
  $('sivyTestClearBtn').addEventListener('click', clearSivyTestResults);
  $('sivyTestExportBtn').addEventListener('click', exportSivyTestCsv);
  const channelControlSuffixes = [
    'Enable', 'PgaGain', 'VthMv', 'FeatSel', 'AvgTriggerEnable',
    'AvgTriggerEdge', 'WorkWindow', 'WaitWindow',
  ];
  for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
    for (const suffix of channelControlSuffixes) {
      const input = $(channelElementId(channel, suffix));
      input.addEventListener('input', () => renderChannelRegisterPlan(channel));
      input.addEventListener('change', () => renderChannelRegisterPlan(channel));
    }
    $(channelElementId(channel, 'ReadBtn')).addEventListener('click', () => run(() => readChannelRegisters(channel)));
    $(channelElementId(channel, 'WriteBtn')).addEventListener('click', () => run(() => writeChannelRegisters(channel)));
    $(channelElementId(channel, 'ClearBtn')).addEventListener('click', () => clearChannelResults(channel));
    $(channelElementId(channel, 'ExportBtn')).addEventListener('click', () => exportChannelResults(channel));
    renderChannelRegisterPlan(channel);
  }
  const frequencyControlIds = [
    'frequencyClockSelect', 'frequencyMainSource', 'frequencyMcDivider', 'frequencyPulseWidth',
    'frequencyBandwidth', 'frequencySampleSwitch', 'frequencyPllSource', 'frequencyExternalClockMHz', 'frequencyPllEnable',
    'frequencyPllDicp', 'frequencyPllKvco', 'frequencyPllDm', 'frequencyPllDn', 'frequencyPllDp',
    'frequencyPllBypass', 'frequencyPllPower', 'frequencyHsiEnable', 'frequencyHsiSelect',
    'frequencyHsiCoarse', 'frequencyHsiFine', 'frequencyQspiDivider', 'frequencyClockOutput',
  ];
  for (const id of frequencyControlIds) {
    $(id).addEventListener('input', renderFrequencyControl);
    $(id).addEventListener('change', renderFrequencyControl);
  }
  $('frequencyReadBtn').addEventListener('click', () => run(() => readFrequencyControl()));
  $('frequencyWriteBtn').addEventListener('click', () => run(writeFrequencyControl));
  $('frequencyClearBtn').addEventListener('click', clearFrequencyResults);
  $('frequencyExportBtn').addEventListener('click', exportFrequencyResults);
  renderFrequencyControl();
  for (const field of POWER_CONTROL_REGISTER.fields) {
    const input = $(`power${field.element}Level`);
    input.addEventListener('input', renderPowerControl);
    input.addEventListener('change', renderPowerControl);
  }
  $('powerReadBtn').addEventListener('click', () => run(() => readPowerControl()));
  $('powerWriteBtn').addEventListener('click', () => run(writePowerControl));
  $('powerClearBtn').addEventListener('click', clearPowerResults);
  $('powerExportBtn').addEventListener('click', exportPowerResults);
  renderPowerControl();
  $('sampleCh0Btn').addEventListener('click', () => run(() => ctrl(CTRL.FORCE_SAMPLE, 0)));
  $('sampleCh1Btn').addEventListener('click', () => run(() => ctrl(CTRL.FORCE_SAMPLE, 1)));
  $('resetBtn').addEventListener('click', () => run(resetBySmp));
  $('imageStateBtn').addEventListener('click', () => run(imageState));
  $('otaChooseFileBtn').addEventListener('click', () => $('otaFile').click());
  $('otaUploadBtn').addEventListener('click', () => run(uploadOta));
  $('clearLogBtn').addEventListener('click', () => { logView.textContent = ''; });
  $('clearSamplesBtn').addEventListener('click', () => {
    state.samples = [];
    $('sampleCount').textContent = '0 个采样';
    $('latestSample').textContent = '最新值：--';
    drawSamples();
    updateScopeBleStatus();
    drawScopeMonitor();
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
      setOtaProgress(0, image.bytes.length, `已就绪：${versionLabel}`);
      log(`OTA 镜像已加载：${image.name}，${formatBytes(image.bytes.length)}，${versionLabel}，选择时间 ${formatTimestamp(state.otaSourceModifiedMs)}`);
    } catch (error) {
      $('otaProgressText').textContent = `加载失败：${error.message}`;
      log(`OTA 加载失败：${error.message}`);
    }
  });
  window.addEventListener('resize', () => {
    drawSamples();
    drawScopeMonitor();
  });
  document.addEventListener('fullscreenchange', updateScopeFullscreenButton);
  window.addEventListener('beforeunload', () => {
    state.scope.socket?.close();
    closeVideoDecoder();
  });
  drawSamples();
  drawScopeMonitor();
  syncScopeControls();
  renderGeneratorPreview();
  localizeDocumentText();
}

async function run(task) {
  try {
    await task();
  } catch (error) {
    log(`错误：${webBluetoothHint(error)}`);
  }
}

bindUi();
