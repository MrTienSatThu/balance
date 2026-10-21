import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decodePolyline,
  haversine,
  bearing,
  simplify,
  cumulativeDistances,
  locateOnRoute
} from '../shared/geo.js'

// Mã hoá polyline chuẩn (dùng để tạo dữ liệu kiểm thử cho decodePolyline).
function encodePolyline(points, precision = 6) {
  const factor = Math.pow(10, precision)
  let out = ''
  let pLat = 0
  let pLon = 0
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1
    let s = ''
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    return s + String.fromCharCode(v + 63)
  }
  for (const [lat, lon] of points) {
    const iLat = Math.round(lat * factor)
    const iLon = Math.round(lon * factor)
    out += enc(iLat - pLat) + enc(iLon - pLon)
    pLat = iLat
    pLon = iLon
  }
  return out
}

test('decodePolyline giải mã đúng polyline precision 5 của ví dụ Google', () => {
  // Ví dụ chuẩn trong tài liệu thuật toán polyline: _p~iF~ps|U_ulLnnqC_mqNvxq`@
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)
  assert.deepEqual(pts, [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453]
  ])
})

test('decodePolyline khứ hồi với precision 6, toạ độ Hà Nội', () => {
  const src = [
    [21.028511, 105.854167],
    [21.029, 105.8501],
    [21.036812, 105.834712]
  ]
  assert.deepEqual(decodePolyline(encodePolyline(src, 6), 6), src)
})

test('haversine: 1 độ kinh tuyến tại xích đạo xấp xỉ 111.2 km', () => {
  const d = haversine([0, 0], [0, 1])
  assert.ok(Math.abs(d - 111195) < 50, String(d))
})

test('bearing: hướng Bắc là 0, hướng Đông là 90', () => {
  assert.ok(Math.abs(bearing([21, 105], [21.01, 105]) - 0) < 0.01)
  assert.ok(Math.abs(bearing([0, 105], [0, 105.01]) - 90) < 0.01)
})

test('simplify bỏ điểm thẳng hàng, giữ điểm góc', () => {
  const pts = [
    [21.0, 105.0],
    [21.0, 105.001],
    [21.0, 105.002],
    [21.001, 105.002]
  ]
  assert.deepEqual(simplify(pts, 2), [0, 2, 3])
})

test('locateOnRoute tìm đúng đoạn, khoảng cách lệch và quãng đã đi', () => {
  const pts = [
    [21.0, 105.0],
    [21.0, 105.01],
    [21.01, 105.01]
  ]
  const cum = cumulativeDistances(pts)
  // Điểm nằm cách giữa đoạn đầu khoảng 11 m về phía Bắc.
  const pos = locateOnRoute(pts, cum, [21.0001, 105.005])
  assert.equal(pos.segment, 0)
  assert.ok(Math.abs(pos.offRouteM - 11.1) < 0.5, String(pos.offRouteM))
  assert.ok(Math.abs(pos.alongM - cum[1] / 2) < 2, String(pos.alongM))
})
