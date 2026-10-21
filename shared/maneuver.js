// Câu chỉ dẫn tiếng Việt theo mã maneuver type của Valhalla
// (bảng mã: https://valhalla.github.io/valhalla/api/route/api-reference/).
// Valhalla không có ngôn ngữ tiếng Việt nên app tự dựng câu.

const TEXT = {
  1: 'Xuất phát',
  2: 'Xuất phát, rẽ phải',
  3: 'Xuất phát, rẽ trái',
  4: 'Đã đến nơi',
  5: 'Đến nơi, bên phải',
  6: 'Đến nơi, bên trái',
  7: 'Đi tiếp',
  8: 'Đi thẳng',
  9: 'Chếch phải',
  10: 'Rẽ phải',
  11: 'Rẽ gắt phải',
  12: 'Quay đầu',
  13: 'Quay đầu',
  14: 'Rẽ gắt trái',
  15: 'Rẽ trái',
  16: 'Chếch trái',
  17: 'Vào đường dẫn',
  18: 'Vào đường dẫn bên phải',
  19: 'Vào đường dẫn bên trái',
  20: 'Ra lối bên phải',
  21: 'Ra lối bên trái',
  22: 'Giữ thẳng',
  23: 'Giữ bên phải',
  24: 'Giữ bên trái',
  25: 'Nhập làn',
  26: 'Vào vòng xuyến',
  27: 'Ra khỏi vòng xuyến',
  28: 'Lên phà',
  29: 'Xuống phà',
  37: 'Nhập làn bên phải',
  38: 'Nhập làn bên trái'
}

export function maneuverText(type) {
  return TEXT[type] || 'Đi tiếp'
}

export function isArrival(type) {
  return type === 4 || type === 5 || type === 6
}

export function formatDistance(m) {
  if (m < 1000) return Math.max(0, Math.round(m / 10) * 10) + ' m'
  return (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'
}
