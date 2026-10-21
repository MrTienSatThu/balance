// Tìm địa điểm theo tên bằng Nominatim (OpenStreetMap).
// Chính sách sử dụng (https://operations.osmfoundation.org/policies/nominatim/):
// tối đa 1 yêu cầu/giây, phải có User-Agent riêng, không làm tìm-khi-gõ, phải lưu đệm kết quả.

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
export const MAX_RESULTS = 5

// Độ rộng vùng ưu tiên quanh vị trí gần nhất (độ). Chỉ để xếp hạng, không giới hạn kết quả.
const BIAS_DEG = 0.5

export function buildSearchUrl(query, near) {
  const params = [
    'q=' + encodeURIComponent(query),
    'format=jsonv2',
    'limit=' + MAX_RESULTS,
    'accept-language=vi'
  ]
  if (near) {
    const left = near.lon - BIAS_DEG
    const right = near.lon + BIAS_DEG
    const top = near.lat + BIAS_DEG
    const bottom = near.lat - BIAS_DEG
    params.push('viewbox=' + [left, top, right, bottom].map((v) => v.toFixed(4)).join(','))
  }
  return NOMINATIM_URL + '?' + params.join('&')
}

// Rút gọn tên hiển thị: tên chính + tối đa hai cấp địa chỉ tiếp theo.
export function shortName(displayName) {
  const parts = String(displayName || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.slice(0, 3).join(', ')
}

// Trả về [{ name, lat, lon }]
export function parseSearchResponse(json) {
  if (!Array.isArray(json)) return []
  return json
    .map((item) => ({
      name: shortName(item.display_name),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .slice(0, MAX_RESULTS)
}
