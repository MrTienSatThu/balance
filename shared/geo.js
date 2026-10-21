// Hàm hình học thuần (không phụ thuộc Zepp OS), dùng chung cho đồng hồ và Side Service.
// Toạ độ: WGS-84, độ thập phân. Khoảng cách: mét.

const EARTH_RADIUS_M = 6371008.8
const DEG = Math.PI / 180

// Giải mã encoded polyline của Valhalla (độ chính xác 6 chữ số thập phân).
// Trả về mảng [lat, lon].
export function decodePolyline(encoded, precision = 6) {
  const factor = Math.pow(10, precision)
  const points = []
  let index = 0
  let lat = 0
  let lon = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lon += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / factor, lon / factor])
  }
  return points
}

export function haversine(a, b) {
  const dLat = (b[0] - a[0]) * DEG
  const dLon = (b[1] - a[1]) * DEG
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a[0] * DEG) * Math.cos(b[0] * DEG) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Hướng đi từ a tới b, độ, 0 = Bắc, theo chiều kim đồng hồ.
export function bearing(a, b) {
  const lat1 = a[0] * DEG
  const lat2 = b[0] * DEG
  const dLon = (b[1] - a[1]) * DEG
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) / DEG + 360) % 360
}

// Chiếu phẳng cục bộ quanh `origin` (equirectangular). Đủ chính xác trong vài km.
// Trả về [x, y] mét, x hướng Đông, y hướng Bắc.
export function toLocalMeters(origin, p) {
  const x = (p[1] - origin[1]) * DEG * EARTH_RADIUS_M * Math.cos(origin[0] * DEG)
  const y = (p[0] - origin[0]) * DEG * EARTH_RADIUS_M
  return [x, y]
}

// Giản lược polyline bằng Douglas-Peucker, ngưỡng `toleranceM` mét.
// Giữ lại chỉ số gốc của các điểm còn lại để ánh xạ begin_shape_index của maneuver.
export function simplify(points, toleranceM) {
  const n = points.length
  if (n <= 2) return points.map((_, i) => i)

  const origin = points[0]
  const xy = points.map((p) => toLocalMeters(origin, p))
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack = [[0, n - 1]]
  const tol2 = toleranceM * toleranceM

  while (stack.length) {
    const [first, last] = stack.pop()
    let maxD2 = 0
    let maxIdx = -1
    for (let i = first + 1; i < last; i++) {
      const d2 = segmentDistance2(xy[i], xy[first], xy[last])
      if (d2 > maxD2) {
        maxD2 = d2
        maxIdx = i
      }
    }
    if (maxIdx !== -1 && maxD2 > tol2) {
      keep[maxIdx] = 1
      stack.push([first, maxIdx], [maxIdx, last])
    }
  }

  const kept = []
  for (let i = 0; i < n; i++) if (keep[i]) kept.push(i)
  return kept
}

// Bình phương khoảng cách từ p tới đoạn ab (toạ độ phẳng), kèm tham số t ∈ [0, 1].
function segmentProjection(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = a[0] + t * dx
  const qy = a[1] + t * dy
  const ex = p[0] - qx
  const ey = p[1] - qy
  return { d2: ex * ex + ey * ey, t }
}

function segmentDistance2(p, a, b) {
  return segmentProjection(p, a, b).d2
}

// Độ dài cộng dồn (mét) tại từng điểm của tuyến.
export function cumulativeDistances(points) {
  const cum = new Array(points.length)
  cum[0] = 0
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i])
  return cum
}

// Tìm điểm gần nhất trên tuyến so với vị trí `pos`.
// `fromIndex` cho phép chỉ tìm từ đoạn hiện tại trở đi để tránh nhảy ngược ở đoạn đường vòng,
// `maxSegments` giới hạn số đoạn duyệt để tiết kiệm CPU trên đồng hồ.
// Trả về { segment, t, offRouteM, alongM } với alongM là quãng đường đã đi dọc tuyến.
export function locateOnRoute(points, cum, pos, fromIndex = 0, maxSegments = Infinity) {
  let best = { segment: 0, t: 0, d2: Infinity }
  const start = Math.max(0, Math.min(fromIndex, points.length - 2))
  const end = Math.min(points.length - 1, start + maxSegments)
  for (let i = start; i < end; i++) {
    const a = toLocalMeters(pos, points[i])
    const b = toLocalMeters(pos, points[i + 1])
    const { d2, t } = segmentProjection([0, 0], a, b)
    if (d2 < best.d2) best = { segment: i, t, d2 }
  }
  const segLen = cum[best.segment + 1] - cum[best.segment]
  return {
    segment: best.segment,
    t: best.t,
    offRouteM: Math.sqrt(best.d2),
    alongM: cum[best.segment] + best.t * segLen
  }
}
