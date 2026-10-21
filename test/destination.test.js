import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseDestination } from '../shared/destination.js'

test('đọc toạ độ dạng "lat, lon"', () => {
  assert.deepEqual(parseDestination('21.0285, 105.8542'), { lat: 21.0285, lon: 105.8542 })
  assert.deepEqual(parseDestination('  -33.86 151.21 '), { lat: -33.86, lon: 151.21 })
})

test('đọc link Google Maps dạng dài', () => {
  assert.deepEqual(
    parseDestination(
      'https://www.google.com/maps/place/H%E1%BB%93+G%C6%B0%C6%A1m/@21.0287797,105.8495366,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.0287747!4d105.8521115'
    ),
    { lat: 21.0287747, lon: 105.8521115 }
  )
  assert.deepEqual(parseDestination('https://maps.google.com/?q=21.03,105.85'), {
    lat: 21.03,
    lon: 105.85
  })
  assert.deepEqual(parseDestination('https://www.google.com/maps/@21.02,105.84,15z'), {
    lat: 21.02,
    lon: 105.84
  })
})

test('từ chối chuỗi không có toạ độ hoặc toạ độ sai', () => {
  assert.equal(parseDestination('https://maps.app.goo.gl/abc123'), null)
  assert.equal(parseDestination('Hồ Gươm'), null)
  assert.equal(parseDestination('95, 105'), null)
  assert.equal(parseDestination(undefined), null)
})

import { readPlace } from '../shared/destination.js'

test('readPlace đọc JSON địa điểm đã chọn', () => {
  assert.deepEqual(readPlace('{"name":"Hồ Gươm","lat":21.0287,"lon":105.8521}'), {
    name: 'Hồ Gươm',
    lat: 21.0287,
    lon: 105.8521
  })
})

test('readPlace vẫn đọc toạ độ dạng cũ và từ chối dữ liệu hỏng', () => {
  assert.deepEqual(readPlace('21.03, 105.85'), { name: '', lat: 21.03, lon: 105.85 })
  assert.equal(readPlace('{"name":"x"}'), null)
  assert.equal(readPlace('{hỏng'), null)
  assert.equal(readPlace(''), null)
  assert.equal(readPlace(null), null)
})
