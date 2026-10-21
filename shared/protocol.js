// Tên phương thức và khoá lưu trữ dùng chung giữa đồng hồ, Side Service và trang cài đặt.

export const METHOD = {
  PING: 'ping',
  BENCH: 'bench',
  ROUTE: 'route.get',
  DESTINATION_CHANGED: 'destination.changed'
}

export const SETTINGS_KEY = {
  // Địa điểm đã chọn, lưu dạng JSON { name, lat, lon }. Điểm đi để trống = vị trí GPS hiện tại.
  ORIGIN: 'origin',
  DESTINATION: 'destination',
  // Chuỗi tìm kiếm người dùng gõ trong trang cài đặt; Side Service tìm rồi ghi kết quả.
  ORIGIN_QUERY: 'origin.query',
  DESTINATION_QUERY: 'destination.query',
  // Kết quả tìm, JSON { query, status: 'loading' | 'ok' | 'empty' | 'error', items, error }
  ORIGIN_RESULTS: 'origin.results',
  DESTINATION_RESULTS: 'destination.results',
  // Vị trí gần nhất đồng hồ gửi lên, dùng để ưu tiên kết quả tìm ở gần.
  LAST_POSITION: 'lastPosition',
  MODE: 'mode'
}

// Ánh xạ phương tiện sang costing của Valhalla.
export const MODES = {
  motorbike: { costing: 'motor_scooter', label: 'Xe máy' },
  car: { costing: 'auto', label: 'Ô tô' },
  walk: { costing: 'pedestrian', label: 'Đi bộ' }
}

export const DEFAULT_MODE = 'motorbike'
