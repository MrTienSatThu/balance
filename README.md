# Balance Nav

Mini program Zepp OS hiển thị bản đồ và dẫn đường theo thời gian thực trên Amazfit Balance
(API_LEVEL 3.7, màn tròn 480x480), dùng dữ liệu OpenStreetMap và tính tuyến bằng Valhalla.

Ứng dụng dùng riêng, không phát hành, không thương mại.

## Cấu trúc

| Thư mục | Chạy ở đâu | Vai trò |
|---|---|---|
| `page/nav/` | Đồng hồ | GPS, vẽ tuyến lên Canvas, chỉ dẫn kế tiếp, rung báo, số đo bản thử |
| `app-side/` | App Zepp trên điện thoại (Side Service) | Gọi Valhalla, giản lược tuyến, trả lời đồng hồ qua Bluetooth |
| `setting/` | App Zepp trên điện thoại (trang cài đặt) | Nhập điểm đến, chọn phương tiện |
| `shared/` | Cả hai | Hàm thuần: giải mã polyline, khoảng cách, đọc toạ độ, câu chỉ dẫn |
| `test/` | Máy tính | Test cho các hàm thuần (`npm test`) |

## Cài lên đồng hồ (chế độ nhà phát triển)

Cần máy tính có Node.js 18 trở lên.

1. Cài Zeus CLI: `npm i -g @zeppos/zeus-cli`
2. Trong thư mục dự án: `npm install`
3. Trên điện thoại, mở app Zepp, vào Hồ sơ > Cài đặt > Giới thiệu, chạm biểu tượng Zepp 7 lần để bật
   chế độ nhà phát triển.
4. Chạy `zeus preview`, đăng nhập tài khoản Zepp khi được hỏi, chọn thiết bị Amazfit Balance.
5. Dùng chức năng Quét (Scan) trong app Zepp để quét mã QR hiện trong terminal.

Nguồn: https://docs.zepp.com/docs/guides/quick-start/preview/

`appId` trong `app.json` (24183) nằm trong khoảng 20000–30000 mà `zeus create` tự sinh cho app thử
nghiệm. Nếu vẫn bị từ chối, hãy tạo mini program trên trang nhà phát triển Zepp để lấy `appId` thật.

## Dùng thử

1. Trong app Zepp, mở trang cài đặt của Balance Nav.
2. **Điểm đi:** để trống thì dùng vị trí GPS hiện tại của đồng hồ. Muốn đi từ nơi khác, gõ tên địa điểm
   vào ô tìm rồi chạm chọn một kết quả.
3. **Điểm đến:** gõ tên địa điểm (ví dụ `Hồ Gươm, Hà Nội`), chờ kết quả hiện ra rồi chạm để chọn.
   Ô tìm cũng nhận toạ độ `21.0285, 105.8542` hoặc link Google Maps dạng dài.
4. Chọn phương tiện: Xe máy, Ô tô hoặc Đi bộ.
5. Mở app trên đồng hồ ở ngoài trời, chờ GPS. Tuyến được tính tự động khi có vị trí.
6. Chạm vào bản đồ để đổi mức thu phóng (1, 2, 4, 8 m/px).

Tìm địa điểm dùng Nominatim của OpenStreetMap: mỗi lần tìm là một yêu cầu, không tìm-khi-gõ, tối đa
1 yêu cầu/giây, kết quả được lưu đệm. Địa chỉ số nhà ở Việt Nam trên OpenStreetMap còn thiếu nhiều, nên
tìm theo tên địa điểm, tên đường hoặc thêm tên quận, thành phố sẽ dễ ra kết quả hơn.

Khi lệch tuyến, tuyến được tính lại từ vị trí hiện tại tới điểm đến.

## Số đo của bản thử M1

Dòng chữ nhỏ ở cuối màn hình đồng hồ:

- `GPS n lần, TB x s, max y s, vẽ z ms`: số lần có vị trí, khoảng cách trung bình và lớn nhất giữa hai lần
  cập nhật, thời gian vẽ một khung hình.
- `ĐT ok a lỗi b (giờ) rtt c ms, chạy d s`: kiểm tra Side Service mỗi 15 giây. Khoá màn hình điện thoại
  vài phút rồi xem số lỗi có tăng không và Side Service có bị khởi động lại không (`chạy` quay về 0).
- `Tuyến ...`: số điểm, dung lượng, thời gian nhận tuyến.
- `BT: ...`: thời gian truyền 1 KB, 10 KB, 50 KB qua Bluetooth.

## Dữ liệu và điều khoản

- Dữ liệu bản đồ © OpenStreetMap contributors (ODbL).
- Tìm địa điểm: Nominatim (`nominatim.openstreetmap.org`), theo chính sách sử dụng của OSMF.
- Tính tuyến: máy chủ demo Valhalla của FOSSGIS (`valhalla1.openstreetmap.de`), chỉ dùng thử nghiệm,
  gọi thưa.
- Không dùng dữ liệu hay API của Google Maps.
