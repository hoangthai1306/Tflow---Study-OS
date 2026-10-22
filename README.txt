TFLOW — SMART STUDY OS & POMODORO TRACKER

CÁCH MỞ APP
1. Giải nén toàn bộ thư mục Tflow nếu bạn nhận thư mục này trong file ZIP.
2. Giữ index.html, app.js và các tài nguyên trong cùng thư mục.
3. Nhấp đúp Launch-Tflow.vbs.
4. Tflow sẽ mở trong một cửa sổ ứng dụng riêng bằng Microsoft Edge.

Ứng dụng lưu dữ liệu trên máy trong hồ sơ ứng dụng Tflow của Edge. Bản này bắt
đầu với dữ liệu học tập trống; các môn học gợi ý có thể xóa trong Cài đặt.

NHẬP DỮ LIỆU CỦA BẠN
1. Mở Tflow, chọn “Lưu trữ Local” ở đầu màn hình.
2. Chọn “Khôi phục từ File (.json)” và chọn file sao lưu JSON đã xuất từ Tflow.
3. Tflow sẽ nạp dữ liệu và lưu trên máy. Dữ liệu hiện có sẽ được thay bằng
   nội dung trong file JSON.

Tflow hiện nhận file sao lưu JSON theo cấu trúc của Tflow. File Excel/CSV hoặc
file từ ứng dụng khác chưa thể nạp trực tiếp; có thể thêm nội dung thủ công
trong các mục của app hoặc chuyển dữ liệu sang định dạng Tflow JSON trước.

XP VÀ HỌC BÁ RANKING
XP giờ được tính bằng tổng thời lượng các phiên học đã lưu: 60 phút = 1 giờ
XP. Quà ngẫu nhiên không cộng XP. Bấm lưu phiên Pomodoro hoàn tất sẽ nhận 1 vé rút quà.
Mở mục Assessment & Neuro, chọn “Tùy chỉnh phần thưởng” để sửa tên/nội dung,
thêm hoặc xóa quà. Các quà hiện có cơ hội xuất hiện như nhau.

Rank dựa trên tổng giờ học: Newbie 0–50, Pupil 50–100, Specialist 100–500,
Expert 500–1.000, Candidate Master 1.000–2.000, Master 2.000–3.000,
International Master 3.000–4.000, Grandmaster 4.000–5.500,
International Grandmaster 5.500–7.000, Legendary Grandmaster 7.000–8.500,
Mythical Grandmaster 8.500–10.000 và Học Bá từ 10.000 giờ.
Mục Học bá Ranking nằm cùng cấp với Command Center trong nhóm Overview, tô sáng cấp
hiện tại và hiện tổng giờ đã học cùng số giờ còn lại. Các chữ nhấn của ba rank cao
nhất có màu vàng. Toàn bộ khu vực thành tựu/huy hiệu như Interleaving,
Deep Work 20+ và Ebbinghaus Pro đã được gỡ bỏ; hộp thưởng RPE và Học bá
Ranking vẫn được giữ lại.

LOGIC DỮ LIỆU
Logic ứng dụng được tách riêng trong app.js; dữ liệu cá nhân được lưu cục bộ
trong localStorage của Edge trên máy bạn, không có máy chủ/backend từ xa.
XP chỉ được tính từ số phút trong Study Sessions đã lưu. Đánh dấu hoàn thành một
Plan không tự tạo phiên học, số phút, focus hay sản lượng giả. Không có phiên nào
được đánh giá thì điểm focus hiện “—”; XP và Ranking tự cập nhật khi thêm hoặc xóa
phiên. Dữ liệu được chuẩn hóa khi mở app hoặc khôi phục JSON.

TÍNH NĂNG HỌC TẬP
Mỗi phiên học lưu môn, chủ đề, mục tiêu, kết quả, mức tập trung, yếu tố gây
gián đoạn và bước tiếp theo. Planning Setup lưu loại kỳ thi, ngày thi, giai đoạn,
thời gian rảnh theo thứ trong tuần và ngày blackout.

Heatmap 52 tuần có lớp phút thực tế, hoàn thành mục tiêu, số phiên và focus;
bạn có thể lọc môn, đổi bảng màu, mục tiêu ngày và ba ngưỡng màu. Analytics so
sánh theo hôm nay, 7 ngày hoặc 30 ngày, xem theo môn/chủ đề và chọn xu hướng
4, 8 hoặc 12 tuần.

Smart Planner tạo phiên dựa trên thời gian rảnh, ngày blackout, mục tiêu/cột mốc
và lịch ôn tập đến hạn. Spread Across tự chuyển phiên trễ sang ngày còn sức chứa.

PLAN VÀ TARGET
Mở Master Plan, nhập thông tin ở thẻ Plans hoặc Targets rồi chọn “Thêm Plan”
hoặc “Thêm Target”. Plan xuất hiện trong danh sách kế hoạch; Target tự cộng
tiến độ theo phiên học, sản lượng hoặc số phút tùy loại bạn chọn.

Tflow cần kết nối Internet ở lần mở đầu tiên để tải Tailwind CSS, Chart.js và
phông chữ. Sau khi đã tải và lưu bộ nhớ đệm, giao diện có thể tiếp tục mở khi
ngoại tuyến; một số tài nguyên bên ngoài phụ thuộc vào bộ nhớ đệm của trình duyệt.

Để cài Tflow từ Edge như một ứng dụng, mở trang tại http://127.0.0.1:43871/
trong hồ sơ trình duyệt Tflow khi máy chủ đang chạy, rồi chọn mục cài đặt ứng
dụng trong menu Edge. Lối tắt Launch-Tflow.vbs luôn mở cửa sổ ứng dụng trực tiếp.

BIỂU TƯỢNG SHORTCUT TRÊN DESKTOP
Sau khi tạo shortcut từ Launch-Tflow.vbs, nhấp phải shortcut > Properties
> Change Icon > Browse, chọn tflow.ico trong thư mục Tflow, rồi Apply và OK.
Logo Tflow được đóng gói sẵn dưới dạng biểu tượng Windows tflow.ico.

ĐỒNG HỒ POMODORO
Đồng hồ tính thời gian còn lại theo mốc thời gian thực, nên không bị chậm khi
cửa sổ Tflow chạy nền hoặc bị Windows giảm tần suất cập nhật giao diện. Nếu
để app nền qua hết phiên, thông báo hoàn tất sẽ hiện khi app được đánh thức lại.

RÀ SOÁT LOGIC & BẢO VỆ DỮ LIỆU
Timer dùng mốc giờ kết thúc thực tế thay vì đếm từng nhịp giao diện; phiên đang
chạy được khôi phục khi mở lại app. Nếu Pomodoro vừa hết nhưng chưa lưu, app
khôi phục hộp xác nhận để bạn vẫn ghi nhận phiên. Hoàn thành sớm trong giờ nghỉ
không tạo XP. Timer theo Plan dùng thời lượng riêng, không sửa cài đặt Pomodoro
chung.

Dữ liệu nhập được kiểm tra và giới hạn trước khi dùng; file khôi phục tối đa
10 MB và chỉ thay dữ liệu hiện tại sau khi lưu thành công. Nếu dữ liệu cục bộ
không đọc được, Tflow thử giữ bản gốc trước khi mở bộ dữ liệu mặc định. Nút reset
có xác nhận và đặt lại cả môn học lẫn cài đặt. Hãy xuất JSON định kỳ: dữ liệu
chỉ lưu trong hồ sơ Edge trên thiết bị này, không đồng bộ giữa máy và có thể mất
nếu xóa dữ liệu trình duyệt hoặc hồ sơ Tflow.

HOÀN THÀNH FOCUS SỚM
Nếu bấm nghỉ ngắn/dài trước khi Pomodoro kết thúc, Tflow ghi nhận chính xác số giây Focus đã trôi qua (không tính thời gian tạm dừng) và mở hộp lưu phiên. XP bằng số giờ học thực tế; XP và vé thưởng được cộng khi bấm Lưu phiên. Chọn Đóng hộp xác nhận sẽ hủy phiên chưa lưu.
