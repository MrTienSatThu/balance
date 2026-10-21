// Gọi Valhalla và rút gọn kết quả để gửi sang đồng hồ qua Bluetooth.
// Máy chủ demo công cộng của FOSSGIS chỉ dùng cho thử nghiệm, gọi thưa.

import { decodePolyline, simplify } from '../shared/geo.js'

export const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'

// Ngưỡng giản lược tuyến (mét). Nhỏ hơn 1 px ở mức thu phóng 2 m/px.
const SIMPLIFY_TOLERANCE_M = 2

export function buildRouteRequest(from, to, costing) {
  return {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon }
    ],
    costing,
    units: 'kilometers'
  }
}

// Đổi phản hồi Valhalla thành dạng gọn:
// { points: [[lat, lon], ...], maneuvers: [{ type, index, street }], lengthM, timeS, rawPoints }
// `index` là chỉ số trong `points` (sau giản lược) nơi maneuver bắt đầu.
export function parseRouteResponse(json) {
  const trip = json && json.trip
  if (!trip || !trip.legs || !trip.legs.length) {
    throw new Error('Phản hồi Valhalla không có tuyến')
  }

  const raw = []
  const maneuvers = []
  trip.legs.forEach((leg) => {
    const offset = raw.length ? raw.length - 1 : 0
    const pts = decodePolyline(leg.shape, 6)
    // Nối các chặng: bỏ điểm đầu trùng với điểm cuối chặng trước.
    pts.forEach((p, i) => {
      if (raw.length && i === 0) return
      raw.push(p)
    })
    ;(leg.maneuvers || []).forEach((m) => {
      maneuvers.push({
        type: m.type,
        rawIndex: offset + (m.begin_shape_index || 0),
        street: (m.street_names && m.street_names[0]) || ''
      })
    })
  })

  const keptIdx = simplify(raw, SIMPLIFY_TOLERANCE_M)
  // Bảo đảm các điểm bắt đầu maneuver luôn được giữ lại.
  const keepSet = new Set(keptIdx)
  maneuvers.forEach((m) => keepSet.add(Math.min(m.rawIndex, raw.length - 1)))
  const kept = Array.from(keepSet).sort((a, b) => a - b)
  const rawToKept = new Map()
  kept.forEach((rawIdx, i) => rawToKept.set(rawIdx, i))

  const round5 = (v) => Math.round(v * 1e5) / 1e5
  const points = kept.map((i) => [round5(raw[i][0]), round5(raw[i][1])])

  return {
    points,
    maneuvers: maneuvers.map((m) => ({
      type: m.type,
      index: rawToKept.get(Math.min(m.rawIndex, raw.length - 1)),
      street: m.street
    })),
    lengthM: Math.round((trip.summary && trip.summary.length ? trip.summary.length : 0) * 1000),
    timeS: Math.round(trip.summary && trip.summary.time ? trip.summary.time : 0),
    rawPoints: raw.length
  }
}
