// 公共费用库 - 所有模块共享的费用项定义
// 版本: 1.0 | 更新日期: 2026-04-22

const FEE_LIBRARY = {
  // ========== 仓库服务 ==========
  warehouse: {
    p0: [
      { code: 'WH_P0_STUFFING_20', name: '内装费 (20GP)', unit: '元/20GP', default: 800, deletable: false },
      { code: 'WH_P0_STUFFING_40', name: '内装费 (40GP/HQ)', unit: '元/40GP', default: 1200, deletable: false },
      { code: 'WH_P0_STUFFING_LCL', name: '内装费 (拼箱)', unit: '元/方或吨', default: 20, deletable: true },
      { code: 'WH_P0_STORAGE', name: '仓储费', unit: '元/天/方', default: 3, deletable: true },
      { code: 'WH_P0_UNSTUFFING_20', name: '拆箱费 (20GP)', unit: '元/20GP', default: 500, deletable: true },
      { code: 'WH_P0_UNSTUFFING_40', name: '拆箱费 (40GP)', unit: '元/40GP', default: 800, deletable: true },
      { code: 'WH_P0_TALLY', name: '理货费', unit: '元/票', default: 200, deletable: true }
    ],
    p1: [
      { code: 'WH_P1_SECURITY', name: '港口/场站安保费', unit: '元/箱', default: 50, deletable: false },
      { code: 'WH_P1_VGM', name: 'VGM称重费', unit: '元/箱', default: 50, deletable: false },
      { code: 'WH_P1_DOC', name: '系统录入费/单证费', unit: '元/票', default: 100, deletable: false },
      { code: 'WH_P1_GATE', name: '进门费', unit: '元/车', default: 50, deletable: false },
      { code: 'WH_P1_EDI', name: 'EDI传输费', unit: '元/箱', default: 30, deletable: false },
      { code: 'WH_P1_SEAL', name: '铅封费', unit: '元/箱', default: 50, deletable: false }
    ],
    p2: [
      { code: 'WH_P2_NIGHT', name: '夜间作业费', unit: '元/箱', default: 300, deletable: true },
      { code: 'WH_P2_WAITING', name: '待时费/压车费', unit: '元/小时', default: 100, deletable: true },
      { code: 'WH_P2_PACKING', name: '加固包装费', unit: '元/托', default: 50, deletable: true },
      { code: 'WH_P2_LABELING', name: '贴唛/换唛费', unit: '元/件', default: 3, deletable: true },
      { code: 'WH_P2_FUMIGATION', name: '熏蒸服务费', unit: '元/票', default: 1500, deletable: true },
      { code: 'WH_P2_FORKLIFT', name: '叉车租赁费', unit: '元/小时', default: 200, deletable: true },
      { code: 'WH_P2_SUPERVISION', name: '监装服务费', unit: '元/人/小时', default: 150, deletable: true },
      { code: 'WH_P2_PHOTO', name: '拍照/视频服务', unit: '元/箱', default: 80, deletable: true }
    ]
  },
  
  // 预留其他服务类型扩展...
};

// 获取指定服务类型的费用库
function getFeeLibrary(serviceType = 'warehouse') {
  return FEE_LIBRARY[serviceType] || FEE_LIBRARY.warehouse;
}
