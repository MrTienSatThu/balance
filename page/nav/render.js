// Vẽ bản đồ dẫn đường lên CANVAS. Bản M1: bản đồ hướng Bắc lên trên.

import { toLocalMeters } from '../../shared/geo.js'

export const SCREEN = 480
const CENTER = SCREEN / 2
// Chấm vị trí đặt thấp hơn tâm để nhìn được xa phía trước.
const ME_Y = Math.round(SCREEN * 0.62)

const COLOR = {
  background: 0x000000,
  routeDone: 0x455a64,
  route: 0x29b6f6,
  me: 0xffffff,
  meRing: 0x0288d1,
  heading: 0xffeb3b,
  destination: 0xef5350,
  ring: 0x263238
}

// Chuyển điểm [lat, lon] sang toạ độ màn hình quanh vị trí `me`.
export function project(me, p, metersPerPx) {
  const [x, y] = toLocalMeters(me, p)
  return [CENTER + x / metersPerPx, ME_Y - y / metersPerPx]
}

function inView(a, b, margin) {
  const lo = -margin
  const hi = SCREEN + margin
  if (a[0] < lo && b[0] < lo) return false
  if (a[0] > hi && b[0] > hi) return false
  if (a[1] < lo && b[1] < lo) return false
  if (a[1] > hi && b[1] > hi) return false
  return true
}

// Vẽ lại toàn bộ khung hình. Trả về số đoạn tuyến đã vẽ (để đo hiệu năng).
export function drawFrame(canvas, { me, headingDeg, route, passedSegment, metersPerPx }) {
  canvas.clear({ x: 0, y: 0, w: SCREEN, h: SCREEN })

  // Vòng tham chiếu 100 m quanh vị trí, giúp ước lượng khoảng cách.
  canvas.strokeCircle({
    center_x: CENTER,
    center_y: ME_Y,
    radius: Math.round(100 / metersPerPx),
    color: COLOR.ring,
    line_width: 2
  })

  let drawn = 0
  if (me && route && route.points.length > 1) {
    const pts = route.points
    let prev = project(me, pts[0], metersPerPx)
    for (let i = 1; i < pts.length; i++) {
      const cur = project(me, pts[i], metersPerPx)
      if (inView(prev, cur, 20)) {
        canvas.drawLine({
          x1: Math.round(prev[0]),
          y1: Math.round(prev[1]),
          x2: Math.round(cur[0]),
          y2: Math.round(cur[1]),
          color: i - 1 < passedSegment ? COLOR.routeDone : COLOR.route,
          line_width: 10
        })
        drawn++
      }
      prev = cur
    }

    const dest = project(me, pts[pts.length - 1], metersPerPx)
    if (inView(dest, dest, 0)) {
      canvas.drawCircle({
        center_x: Math.round(dest[0]),
        center_y: Math.round(dest[1]),
        radius: 12,
        color: COLOR.destination
      })
    }
  }

  if (me) {
    if (headingDeg !== null) {
      const rad = (headingDeg * Math.PI) / 180
      canvas.drawLine({
        x1: CENTER,
        y1: ME_Y,
        x2: Math.round(CENTER + Math.sin(rad) * 34),
        y2: Math.round(ME_Y - Math.cos(rad) * 34),
        color: COLOR.heading,
        line_width: 6
      })
    }
    canvas.drawCircle({ center_x: CENTER, center_y: ME_Y, radius: 14, color: COLOR.meRing })
    canvas.drawCircle({ center_x: CENTER, center_y: ME_Y, radius: 9, color: COLOR.me })
  }

  return drawn
}
