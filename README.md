# Tflow v2.0

Tflow là một **local-first Smart Study OS**: ứng dụng web chạy trên máy người dùng để lập kế hoạch học tập, thực hiện các phiên tập trung, lưu kết quả, theo dõi tiến độ và điều chỉnh nhịp học. Ứng dụng không có backend và không yêu cầu tài khoản; dữ liệu được lưu trong `localStorage` của trình duyệt hiện tại.

README này mô tả cả cách sử dụng và cấu trúc để coder khác hoặc AI có thể tiếp tục phát triển Tflow mà không phải đọc toàn bộ codebase từ đầu.

## 1. Phạm vi dự án

Tflow v2.0 hiện là một ứng dụng web tĩnh gồm:

- `index.html`: toàn bộ layout, các view, modal, CSS token và cấu hình Tailwind.
- `app.js`: state, logic nghiệp vụ, router view, timer, render và event handlers.
- `icons/`: icon PWA và logo Tflow.
- `manifest.webmanifest`: cấu hình cài đặt dạng standalone/PWA.
- `sw.js`: service worker được đăng ký khi ứng dụng không chạy bằng `file://`.
- `Start-Tflow.ps1`: tạo local HTTP server bằng `HttpListener`, sau đó mở Edge app mode.
- `Launch-Tflow.vbs`: shortcut Windows chạy PowerShell ở chế độ ẩn.

Ứng dụng ưu tiên hoạt động local, phản hồi nhanh và giữ dữ liệu trong máy. Không được giả định rằng có API, database server, authentication hoặc đồng bộ cloud.

## 2. Toàn bộ tính năng người dùng

### Dashboard — Command Center

Dashboard là màn hình tổng quan mặc định. Nó hiển thị nhịp học và các việc cần làm thay vì chỉ hiển thị một danh sách task đơn giản.

Các khu vực chính gồm:

- đồng hồ và ngày hiện tại;
- streak học liên tục;
- tổng số giờ học và XP;
- study rank theo tổng số giờ;
- readiness/progress tổng hợp;
- các task hôm nay hoặc task quá hạn;
- active milestones;
- weak areas;
- quick actions để mở timer, Today's Focus, Calendar hoặc Neuro/Review;
- heatmap hoạt động học;
- Zeigarnik hook để ghim bước tiếp theo;
- Pace Predictor;
- reward/combo status và streak-freeze status.

Task trên Dashboard có thể được đánh dấu hoàn thành hoặc nạp trực tiếp vào Study Timer. Tflow không tự tạo dữ liệu demo khi khởi động phiên mới.

### Today's Focus

View này tập trung vào việc thực thi trong ngày:

- liệt kê planned task của hôm nay và task quá hạn;
- tạo task mới với topic, subject, thời lượng, ngày, goal và resource liên kết;
- bắt đầu task bằng timer;
- đánh dấu task hoàn thành;
- chuyển task sang ngày mai;
- sử dụng Spread Across để phân bổ lại các task bị bỏ lỡ;
- mở manual session log cho thời gian học đã diễn ra ngoài timer.

Task mới không được tạo trong quá khứ. Để ghi nhận thời gian học trong quá khứ, dùng Manual Log.

### Calendar

Calendar hỗ trợ hai chế độ:

- Week view: xem availability, task, session và trạng thái từng ngày.
- Month view: xem lịch theo tháng, có thể chuyển tháng.

Calendar tôn trọng blackout dates và availability do người dùng cấu hình trong Planning Setup. Khi chọn một ngày, Tflow hiển thị chi tiết session của ngày đó, gồm subject, thời lượng, topic, focus score và output.

### Plan & Goals

View này dùng để lập kế hoạch học dài hơn một ngày:

- tạo planned task theo ngày;
- chọn subject và resource;
- đặt thời lượng dự kiến;
- nhập goal hoặc outcome;
- liên kết kế hoạch với milestone/target;
- xem danh sách các plan hiện tại;
- xóa plan;
- chạy auto-planning dựa trên deadline, availability, blackout dates, review đến hạn và milestone còn thiếu;
- dùng Spread Across khi kế hoạch bị trễ.

Auto-planning chỉ sử dụng dữ liệu local hiện có. Nó không gọi AI hay dịch vụ bên ngoài.

### Study Timer

Study Timer là Pomodoro engine của Tflow. Timer có ba mode:

- `focus`: phiên học chính;
- `short`: nghỉ ngắn;
- `long`: nghỉ dài.

Người dùng có thể:

- bắt đầu, tạm dừng và tiếp tục timer;
- chuyển mode;
- tùy chỉnh Focus Duration, Short Break và Long Break;
- liên kết timer với planned task;
- chọn một hoặc nhiều subject cho session;
- nhập topic, goal, note, output unit và resource;
- bật âm thanh completion bell;
- bật brainwave audio như alpha, gamma hoặc brown noise;
- mở NSDR/box breathing sau phiên;
- kết thúc phiên sớm nhưng vẫn ghi nhận phần thời gian hợp lệ.

Timer được lưu riêng trong `localStorage` bằng key `${STORAGE_KEY}_active_timer`, nên có thể phục hồi sau khi reload. Khi timer focus hoàn thành, Tflow mở Complete Pomodoro Modal thay vì tự lưu mù dữ liệu.

### Complete Pomodoro Modal

Đây là bước xác nhận kết quả của một phiên focus. Người dùng có thể ghi:

- active recall hoặc note kết quả;
- actual output count;
- focus score từ 1 đến 5;
- blocker hoặc lý do bị gián đoạn;
- next step;
- resource đã sử dụng;
- planned task liên kết.

Khi lưu, Tflow:

- tạo session trong `state.sessions`;
- cập nhật XP theo tổng phút học;
- cập nhật resource progress nếu có resource;
- cập nhật milestone theo minutes, sessions hoặc output;
- cập nhật reward progress;
- cập nhật focus combo và streak-freeze shard;
- đánh dấu planned task hoàn thành nếu session được liên kết phù hợp;
- chuyển sang short/long break nếu người dùng chọn.

Một completed session chưa được xác nhận được lưu tạm bằng `PENDING_COMPLETION_KEY` để tránh mất dữ liệu nếu trang bị reload giữa bước xác nhận.

### Tasks & Milestones

View này quản lý hai loại dữ liệu:

#### Milestones

Milestone có:

- title;
- subject;
- type: `minutes`, `sessions` hoặc `output`;
- current value;
- target value;
- unit;
- deadline;
- resource liên kết tùy chọn.

Progress của milestone được cập nhật khi session hoàn thành. Nếu session có nhiều subject, phút và output được chia đều cho các subject hợp lệ.

#### Resource Library

Resource là tài liệu hoặc tập nội dung cần theo dõi. Resource có:

- name;
- subject;
- type;
- unit, ví dụ `chapters`, `pages`, `problems`, `words`;
- completed;
- total;
- accuracy;
- file name/type/size/data nếu có file đính kèm.

File đính kèm được lưu local, giới hạn 3 MB mỗi file. Resource có thể được liên kết với planned task, timer session, milestone hoặc target. Khi session được lưu, output thực tế có thể làm tăng `completed` của resource liên kết.

### Review & Assess

View này dành cho việc phát hiện lỗ hổng và ôn tập:

- weak areas: chủ đề yếu, accuracy, action và status;
- spaced review items: topic, question, subject, stage và next review date;
- checkpoints: mốc kiểm tra, ngày, score và trạng thái done;
- neuro/recovery tools như box breathing và NSDR;
- tạo hoặc cập nhật các mục review sau khi làm bài hoặc hoàn thành session.

Review đến hạn được tính theo `nextReviewDate <= TODAY_KEY` và được hiển thị trong badge ở sidebar cũng như trong auto-planning.

### Analytics

Analytics tổng hợp dữ liệu planned và actual theo ngày/tuần/tháng. Các phân tích chính gồm:

- actual minutes và planned minutes;
- completion rate;
- focus score trung bình;
- daily/weekly trend;
- subject balance;
- topic balance;
- subject bị thiếu thời lượng so với kế hoạch;
- biểu đồ thời gian thực tế theo subject;
- heatmap theo minutes, completion, sessions hoặc focus.

Chart được tạo bằng Chart.js. Khi render lại analytics, chart cũ phải được destroy trước để tránh canvas bị đăng ký nhiều lần.

### Study ranking

Ranking tính theo tổng số giờ học từ `state.sessions`. Các rank hiện có gồm Newbie, Pupil, Specialist, Expert, Candidate Master, Master, International Master, Grandmaster và Scholar. Rank chỉ là lớp gamification local, không ảnh hưởng đến việc lập kế hoạch.

### Reward Lab

Reward Lab tạo phần thưởng cho sự đều đặn:

- cấu hình số focus session cần để nhận một ticket;
- chỉnh sửa tên và nội dung reward;
- chọn rarity: common, uncommon, rare hoặc legendary;
- chỉnh trọng số rarity;
- spin reward khi có ticket;
- theo dõi combo focus;
- nhận streak-freeze shard.

Ba phiên liên tiếp có focus score từ 4 trở lên và không bị blocker sẽ tạo một reward ticket cùng một streak-freeze shard. Shard có thể tự bảo vệ streak cho một ngày bỏ lỡ nếu ngày trước đó đã có hoạt động học.

### Settings & Subjects Manager

Settings quản lý subject và backup:

- tạo subject mới;
- đặt tên subject;
- chọn accent color;
- chọn icon subject;
- xóa subject, nhưng luôn phải giữ lại ít nhất một subject;
- chọn subject đang hoạt động cho timer;
- export JSON backup;
- restore JSON backup;
- reset toàn bộ dữ liệu.

Từ bản cập nhật icon, subject dùng key SVG ổn định như `trophy`, `code`, `calculator`, `language`, `book`, `atom` thay vì lưu emoji trực tiếp.

## 3. Kiến trúc frontend

Tflow dùng mô hình single-page app đơn giản, không dùng framework.

### Router view

Biến `activeView` xác định view hiện tại. `switchView(viewName)` sẽ:

1. thêm class `hidden` cho mọi `.sf-view`;
2. bỏ `hidden` ở `#view-${viewName}`;
3. cập nhật class `active` trên các button có `data-nav`;
4. gọi `refreshAllViews()`.

Danh sách view hiện tại:

```text
command
 today
 calendar
 master
 timer
 tasks
 ranking
 assessments
 sessions
 setup
 analytics
 settings
```

`refreshAllViews()` luôn render subject/chrome dùng chung, sau đó chỉ render view đang hiển thị để tránh làm chậm thao tác timer và nhập dữ liệu.

### Render model

Các hàm `render...` tạo HTML trực tiếp bằng template string rồi gắn event listener sau khi thay DOM. Những render function chính:

```text
renderCommandCenter()
renderTodayExecution()
renderStudyCalendar()
renderMasterPlan()
renderTasksAndMilestonesView()
renderAssessmentsAndNeuro()
renderSessionsLog()
renderPlanningSetup()
renderAnalytics()
renderSubjects()
renderHokBaRanking()
```

Khi thêm một component động, cần kiểm tra:

- có escape nội dung người dùng bằng `escapeHtml()`;
- event listener được gắn lại sau mỗi lần `innerHTML`;
- render không vô tình reset giá trị form;
- state được save trước khi refresh;
- view không render dữ liệu demo hoặc dữ liệu giả.

## 4. State và data model

State gốc nằm ở đầu `app.js` và được chuẩn hóa qua `normalizeAppState()`.

Các key quan trọng:

```js
state = {
  subjects: [],
  selectedSubjectIds: [],
  sessions: [],
  plannedTasks: [],
  milestones: [],
  resources: [],
  weakAreas: [],
  checkpoints: [],
  spacedItems: [],
  onboarding: {
    examName: '',
    examType: '',
    examDate: '',
    phase: 'intensive',
    availability: [120, 120, 100, 120, 120, 180, 150],
    blackoutDates: []
  },
  heatmapConfig: {
    layer: 'minutes',
    palette: 'cyan',
    dailyTargetMinutes: 100,
    thresholds: [35, 70, 100]
  },
  protocol: {
    focus: 50,
    short: 10,
    long: 20,
    label: 'Deep Work 50/10'
  },
  xp: 0,
  lootTickets: 0,
  rewardProgressPomodoros: 0,
  rewardConfig: {},
  rpeRewards: [],
  focusCombo: {},
  streakFreezeShards: 0,
  streakFreezeDates: [],
  zeigarnikHook: '',
  schemaVersion: 6
}
```

Một số field quan trọng của `session`:

```text
id, date, timestamp, minutes, subjectIds, topic, goal, note,
protocolLabel, blocker, nextStep, outputUnit, outputCount,
focusScore, resourceId, linkedPlanId
```

Một `plannedTask` thường có:

```text
id, date, topic, goal, plannedMinutes, subjectId,
resourceId, status, rescheduled
```

`milestones`, `resources`, `weakAreas`, `checkpoints` và `spacedItems` đều có `id` riêng và được normalize để loại bỏ item trùng hoặc item không hợp lệ.

## 5. Persistence, validation và recovery

Storage key chính là:

```text
stepflow_neurofocus_v3
```

Các key phụ:

```text
stepflow_neurofocus_v3_active_timer
stepflow_neurofocus_v3_pending_completion
stepflow_neurofocus_v3_recovery_<timestamp>
```

Luồng load:

1. `loadState()` đọc JSON từ `localStorage`.
2. Kiểm tra snapshot có phải object hợp lệ và có `subjects`, `sessions` hay không.
3. Gọi `normalizeAppState()` để giới hạn dữ liệu, chuẩn hóa ngày, id, subject, số lượng và các collection.
4. Loại bỏ các record demo cũ nếu snapshot legacy còn sót dữ liệu mẫu.
5. Ghi lại state đã normalize.
6. Nếu JSON hỏng, giữ recovery copy nếu có thể rồi mở state sạch.

Luồng save:

- cập nhật `TODAY_KEY`;
- tính lại `xp` từ tổng phút trong sessions;
- đặt `schemaVersion = 6`;
- stringify state vào localStorage.

Không được đưa secret, token, thông tin nhạy cảm hoặc dữ liệu cần bảo mật vào state vì localStorage không phải storage bảo mật.

## 6. Hệ thống icon v2.0

Icon không còn phụ thuộc vào Font Awesome CDN. `app.js` định nghĩa `ICON_DEFS`, mỗi icon gồm label và SVG body. `iconSvg(key, className, attrs)` tạo SVG inline.

Subject icon được normalize qua:

```js
normalizeIconKey(value)
```

Hàm này hỗ trợ cả key mới và emoji cũ thông qua `ICON_ALIASES`, vì vậy dữ liệu cũ vẫn được migrate khi load.

Các icon static legacy trong HTML được chuyển đổi bởi `hydrateFontAwesomeIcons()`. Khi thêm icon mới:

1. thêm definition vào `ICON_DEFS`;
2. thêm alias nếu cần tương thích tên cũ;
3. thêm key vào `AVAILABLE_ICONS` nếu icon dùng trong Subject Manager;
4. kiểm tra `aria-label`, kích thước và màu `currentColor`;
5. không thêm lại dependency icon font cho một icon đơn lẻ.

## 7. Cách chạy

### Windows shortcut

Mở `Launch-Tflow.vbs`. Script này gọi `Start-Tflow.ps1`, tạo server local ở port `43871` và mở Edge ở app mode.

### PowerShell

```powershell
.\Start-Tflow.ps1
```

### Local server thủ công

```bash
python -m http.server 8000
```

Mở `http://127.0.0.1:8000/`.

Không nên dùng `file://` nếu muốn service worker, manifest hoặc một số asset hoạt động đầy đủ.

## 8. Dependencies và offline behavior

Các dependency hiện được tải từ CDN trong `index.html`:

- Tailwind CSS CDN;
- Chart.js CDN;
- Google Fonts: Inter và JetBrains Mono.

Icon SVG và logic ứng dụng nằm local. Vì vậy icon vẫn render được khi CDN icon không có hoặc bị lỗi. Lần mở đầu nên có internet để tải Tailwind, Chart.js và font. Sau khi browser cache asset, khả năng offline phụ thuộc vào cache và service worker của trình duyệt.

## 9. Quy tắc phát triển tiếp theo

Khi sửa Tflow:

- giữ ứng dụng local-first, không tự thêm backend nếu chưa có yêu cầu;
- không đưa dữ liệu demo vào state mặc định;
- mọi dữ liệu người dùng nhập từ HTML phải đi qua `escapeHtml()` trước khi render vào template;
- mọi thay đổi state quan trọng phải gọi `saveState()`;
- sử dụng `TODAY_KEY` và các helper date thay vì tự xử lý ngày rải rác;
- giữ `normalizeAppState()` tương thích với backup cũ;
- nếu đổi schema, tăng `schemaVersion` và viết migration/normalization tương ứng;
- khi thêm view, thêm section `view-*`, nav button, renderer và mapping trong `refreshAllViews()`;
- khi thêm modal, thêm markup trong `index.html`, event wiring trong `initEvents()` và xử lý trạng thái đóng/mở rõ ràng;
- không reset timer hoặc form chỉ vì một view khác được render;
- kiểm tra reduced-motion và responsive layout trước khi hoàn tất.

## 10. Kiểm tra nhanh trước khi bàn giao

```bash
node --check app.js
git diff --check
```

Ngoài syntax, nên kiểm tra thủ công các luồng sau:

- mở app và chuyển qua toàn bộ sidebar view;
- tạo, chọn và xóa subject;
- reload khi timer đang chạy;
- hoàn thành một focus session và lưu modal;
- tạo resource, link resource với task/session và kiểm tra progress;
- tạo milestone và kiểm tra cập nhật progress;
- export rồi restore JSON backup;
- nhập dữ liệu cũ có emoji subject icon;
- kiểm tra giao diện ở desktop và viewport hẹp;
- kiểm tra icon khi CDN không tải được.

## 11. Phiên bản

**Tflow v2.0 — Smart Study OS & Pomodoro Tracker**

Bản v2.0 tập trung vào workflow học hoàn chỉnh: lập kế hoạch → tập trung → ghi nhận kết quả → cập nhật milestone/resource → review → phân tích → điều chỉnh nhịp học. 
