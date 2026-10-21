import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSearchUrl, parseSearchResponse, shortName } from '../app-side/nominatim.js'

test('buildSearchUrl mã hoá chuỗi tìm, giới hạn 5 kết quả, ưu tiên tiếng Việt', () => {
  const url = buildSearchUrl('Hồ Gươm, Hà Nội')
  assert.ok(url.startsWith('https://nominatim.openstreetmap.org/search?'))
  assert.ok(url.includes('q=H%E1%BB%93%20G%C6%B0%C6%A1m%2C%20H%C3%A0%20N%E1%BB%99i'))
  assert.ok(url.includes('format=jsonv2'))
  assert.ok(url.includes('limit=5'))
  assert.ok(url.includes('accept-language=vi'))
  assert.ok(!url.includes('viewbox'))
})

test('buildSearchUrl thêm viewbox quanh vị trí gần nhất theo thứ tự trái,trên,phải,dưới', () => {
  const url = buildSearchUrl('cafe', { lat: 21, lon: 105.8 })
  assert.ok(url.includes('viewbox=105.3000,21.5000,106.3000,20.5000'), url)
})

test('shortName giữ tối đa 3 phần đầu', () => {
  assert.equal(
    shortName('Hồ Hoàn Kiếm, Phố Đinh Tiên Hoàng, Hàng Trống, Hoàn Kiếm, Hà Nội, 11000, Việt Nam'),
    'Hồ Hoàn Kiếm, Phố Đinh Tiên Hoàng, Hàng Trống'
  )
})

test('parseSearchResponse đọc lat/lon dạng chuỗi và bỏ phần tử lỗi', () => {
  const items = parseSearchResponse([
    { display_name: 'A, B, C, D', lat: '21.0287', lon: '105.8521' },
    { display_name: 'Hỏng', lat: 'x', lon: '1' }
  ])
  assert.deepEqual(items, [{ name: 'A, B, C', lat: 21.0287, lon: 105.8521 }])
  assert.deepEqual(parseSearchResponse({ error: 'x' }), [])
})
