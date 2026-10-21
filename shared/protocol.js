// Tên phương thức và khoá lưu trữ dùng chung giữa đồng hồ, Side Service và trang cài đặt.

export const METHOD = {
  PING: 'ping',
  BENCH: 'bench',
  ROUTE: 'route.get',
  DESTINATION_CHANGED: 'destination.changed'
}

export const SETTINGS_KEY = {
  DESTINATION: 'destination',
  MODE: 'mode'
}

// Ánh xạ phương tiện sang costing của Valhalla.
export const MODES = {
  motorbike: { costing: 'motor_scooter', label: 'Xe máy' },
  car: { costing: 'auto', label: 'Ô tô' },
  walk: { costing: 'pedestrian', label: 'Đi bộ' }
}

export const DEFAULT_MODE = 'motorbike'
