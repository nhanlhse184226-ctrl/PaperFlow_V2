# PaperFlow Mobile

Ứng dụng Flutter native dùng **cùng backend và tài khoản với web**. Thư mục `mobile/` độc lập, nằm cạnh `FE/` và `BE/`. Không sửa logic backend để chạy bản này.

## Chạy nhanh trên máy hiện tại

Máy Windows đã có Flutter và Visual Studio. Trong PowerShell:

```powershell
cd C:\PaperFlow\mobile
flutter pub get
flutter run -d windows
```

App mặc định kết nối `https://paperflow-api.onrender.com`. Đăng nhập tài khoản **đã đăng ký trên web** hoặc tự tạo tài khoản mới. Không có admin/demo password cài cứng. Render có thể khởi động chậm sau khi ngủ. Các tính năng phân tích cần Gemini trên backend hoạt động/còn quota.

Đây là cửa sổ Flutter native để test nhanh logic và bố cục, **không phải giả lập Android/iPhone**. Build Windows không xác minh được hành vi các plugin trên điện thoại.

## Android

Cần Android SDK và máy Android bật USB debugging hoặc emulator. Kiểm tra bằng `flutter doctor` và `flutter devices`.

```powershell
flutter run -d <android-device-id>
flutter build apk --debug
```

APK debug: `build/app/outputs/flutter-apk/app-debug.apk`. Hiện project dùng signing debug mặc định cho local; không gửi bản đó lên cửa hàng.

## iPhone/iPad

Cần macOS, Xcode, signing team và thiết bị/simulator. Mở `ios/Runner.xcworkspace` trên Mac, chọn team, kiểm tra entitlement Keychain rồi `flutter run -d <device-id>`. iOS tối thiểu 15.0 theo project hiện tại. Không thể build/cài iOS từ Windows.

## Backend local tùy chọn

Không cần file `.env` hoặc API key trong app. URL công khai truyền lúc build/run:

```powershell
flutter run -d windows --dart-define=API_BASE_URL=http://127.0.0.1:8000
# Android emulator: máy host là 10.0.2.2
flutter run -d <emulator-id> --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

`API_BASE_URL` chỉ gồm protocol + host + port, không thêm `/api`. Backend local phải chạy sẵn. Android debug cho phép HTTP; release bắt buộc HTTPS. Dùng điện thoại thật với server LAN cần cấu hình mạng/allowed hosts riêng; cách nhanh nhất hiện tại là dùng Render HTTPS.

## Tính năng

- Đăng ký/đăng nhập, kiểm tra phiên trước khi mở workspace, khôi phục phiên và đăng xuất. Cookie phiên cũ của backend lưu trong kho bảo mật hệ điều hành; không dùng WebView hoặc cookie bên thứ ba của Safari.
- Dự án: tạo, danh sách/tìm kiếm, đổi tên, xóa có xác nhận; đồng bộ khi mở/làm mới.
- Đề tài: toàn bộ context/nguồn lực, ngôn ngữ phân tích EN/VI, phân tích/phân tích lại, dịch kết quả đề tài sang Việt, xác nhận.
- Tài liệu: picker PDF, upload có tiến độ, đánh giá/trích xuất, retry kết quả partial, xem facts và AI analysis riêng, xóa có xác nhận.
- Bằng chứng: lọc nguồn/loại/từ khóa; so sánh nguồn đã chọn; quote/page/text; xem PDF gốc đúng trang; chia sẻ CSV có bảo vệ formula injection.
- Bài viết: tạo/sửa text, upload PDF/TXT/MD, kiểm tra/tiếp tục/kiểm tra lại; 5 trạng thái; claim → evidence → source/page/quote.
- Hub: tìm và đăng ghi chú công khai có xác nhận. Tài khoản và thông báo cách dùng dữ liệu.
- UI tiếng Việt, minh họa vector nội bộ, font đi kèm, animation nhẹ có reduced motion, bố cục phone/tablet.

Nguyên văn bằng chứng không được dịch. Backend hiện chỉ có API dịch riêng cho kết quả Topic; nhận định ở module khác có thể vẫn theo ngôn ngữ provider. Không có realtime push hoặc offline editing. Role admin, payment, account deletion và Hub moderation chưa có trong backend hiện tại, nên app không giả lập các chức năng này.

## Kiểm thử

```powershell
flutter analyze
flutter test
```

Test tự động không gọi Gemini thật. UI fixture chỉ nằm trong test. Test luồng API và native session dùng FastAPI thật với AI giả ở boundary, DB riêng trong `artifacts/mobile/fixture-data`:

Terminal 1 (root repo, không cần thay đổi BE):

```powershell
cd C:\PaperFlow
cd BE
..\.venv\Scripts\python.exe -m tests.prepare_e2e
cd ..
.\.venv\Scripts\python.exe mobile\tools\test_server.py
```

Terminal 2:

```powershell
cd C:\PaperFlow\mobile
flutter test integration_test/workflow_test.dart -d windows
```

Backend test chỉ lắng nghe `127.0.0.1:8011`; không có key thật. Tài khoản test được tạo trong DB fixture riêng. Chỉ xóa fixture DB khi server test đã dừng và chắc chắn không cần dữ liệu test.

## Trước khi gửi CH Play/App Store (giai đoạn riêng)

Bản này phục vụ local, chưa tuyên bố sẵn sàng duyệt store. Cần hoàn thành:

- Quy trình xóa tài khoản và dữ liệu từ app, với backend hỗ trợ.
- Privacy policy/support URL công khai, khai báo dữ liệu và cách AI xử lý tài liệu chính xác.
- Hub là nội dung người dùng: cần báo cáo, chặn người dùng, moderation và điều khoản sử dụng; hiện backend chưa hỗ trợ.
- Chốt application/bundle ID, app icon, screenshots, signing/release keys và tài khoản cửa hàng.
- Kiểm tra plugin upload/PDF/share/secure storage, TalkBack/VoiceOver, mạng yếu và session expiry trên thiết bị Android/iOS thật.
- Nếu thêm bán tính năng số, review yêu cầu thanh toán của từng store trước khi đưa checkout từ web vào app.
- Kiểm tra chính sách store hiện hành tại thời điểm nộp. Không thể bảo đảm được duyệt chỉ bằng việc build thành công.

Không đưa Gemini key, database URL, service-role key vào assets hoặc Dart defines. App chỉ cần API URL; bí mật vẫn thuộc Render/BE.
