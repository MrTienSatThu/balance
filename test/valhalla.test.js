import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildRouteRequest, parseRouteResponse } from '../app-side/valhalla.js'

function encode6(points) {
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
    const iLat = Math.round(lat * 1e6)
    const iLon = Math.round(lon * 1e6)
    out += enc(iLat - pLat) + enc(iLon - pLon)
    pLat = iLat
    pLon = iLon
  }
  return out
}

test('buildRouteRequest dùng costing và đơn vị km', () => {
  const body = buildRouteRequest({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, 'motor_scooter')
  assert.deepEqual(body, {
    locations: [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 }
    ],
    costing: 'motor_scooter',
    units: 'kilometers'
  })
})

test('parseRouteResponse giản lược nhưng giữ điểm bắt đầu maneuver', () => {
  // Đi thẳng về phía Đông 4 điểm thẳng hàng rồi rẽ trái lên Bắc.
  const shape = [
    [21.0, 105.0],
    [21.0, 105.001],
    [21.0, 105.002],
    [21.0, 105.003],
    [21.001, 105.003]
  ]
  const json = {
    trip: {
      summary: { length: 0.42, time: 75.4 },
      legs: [
        {
          shape: encode6(shape),
          maneuvers: [
            { type: 1, begin_shape_index: 0, street_names: ['Phố A'] },
            { type: 8, begin_shape_index: 1 },
            { type: 15, begin_shape_index: 3, street_names: ['Phố B'] },
            { type: 4, begin_shape_index: 4 }
          ]
        }
      ]
    }
  }
  const r = parseRouteResponse(json)
  // Điểm 2 thẳng hàng và không phải điểm maneuver nên bị bỏ; điểm 1 được giữ vì là maneuver.
  assert.deepEqual(r.points, [
    [21.0, 105.0],
    [21.0, 105.001],
    [21.0, 105.003],
    [21.001, 105.003]
  ])
  assert.deepEqual(
    r.maneuvers.map((m) => [m.type, m.index, m.street]),
    [
      [1, 0, 'Phố A'],
      [8, 1, ''],
      [15, 2, 'Phố B'],
      [4, 3, '']
    ]
  )
  assert.equal(r.lengthM, 420)
  assert.equal(r.timeS, 75)
  assert.equal(r.rawPoints, 5)
})

test('parseRouteResponse báo lỗi khi không có tuyến', () => {
  assert.throws(() => parseRouteResponse({ error: 'No path' }), /không có tuyến/)
})
