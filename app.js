    (function () {
      'use strict';

      // ==================== CONSTANTS & PALETTES ====================
      const STORAGE_KEY = 'stepflow_neurofocus_v3';
      const AVAILABLE_ICONS = [
        '🏆', '💻', '📐', '🧠', '🇬🇧', '📚', '✍️', '🔬',
        '📊', '🎨', '⚛️', '🧬', '🎵', '🏛️', '🌍', '🧮',
        '⚡', '🤖', '📈', '🧪', '🩺', '⚖️', '🏋️', '🚀'
      ];

      const HEATMAP_PALETTES = {
        cyan:    ['#0b111a', '#0c3542', '#0b5f73', '#0e8ea8', '#22d3ee'],
        emerald: ['#0b111a', '#0e4429', '#006d32', '#26a641', '#39d353'],
        amber:   ['#0b111a', '#78350f', '#b45309', '#f59e0b', '#fde047'],
        violet:  ['#0b111a', '#4c1d95', '#6d28d9', '#8b5cf6', '#c4b5fd']
      };

      const DEFAULT_SUBJECTS = [
        { id: 'subj_cp', name: 'Competitive Programming', icon: '🏆', color: '#22d3ee' },
        { id: 'subj_code', name: 'Lập trình & CS', icon: '💻', color: '#10b981' },
        { id: 'subj_math', name: 'Toán & Giải tích', icon: '📐', color: '#3b82f6' },
        { id: 'subj_eng', name: 'Tiếng Anh (IELTS)', icon: '🇬🇧', color: '#f59e0b' },
        { id: 'subj_read', name: 'Đọc sách Chuyên ngành', icon: '📚', color: '#8b5cf6' },
        { id: 'subj_sci', name: 'Khoa học & AI', icon: '🧠', color: '#ec4899' }
      ];

      const RPE_REWARDS = [
        { id: 'reward_1', title: '🔥 JACKPOT NEURON', msg: 'Bạn đã hoàn thành một phiên học tập trung tốt!' },
        { id: 'reward_2', title: '⚡ Siêu Tập Trung', msg: 'Một bước tiến nữa trên hành trình của bạn.' },
        { id: 'reward_3', title: '🌱 Củng cố kiến thức', msg: 'Hãy nghỉ ngắn và ghi nhớ điều vừa học.' },
        { id: 'reward_4', title: '💎 Kho báu Bền bỉ', msg: 'Kỷ luật hôm nay tạo nên tiến bộ dài hạn.' }
      ];

      function toDateKey(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function addDays(dateKey, days) {
        const parts = dateKey.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        dt.setDate(dt.getDate() + days);
        return toDateKey(dt);
      }

      function getDayOfWeekIndex(dateKey) {
        const parts = dateKey.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const jsDay = dt.getDay();
        return jsDay === 0 ? 6 : jsDay - 1;
      }

      let TODAY_KEY = toDateKey(new Date());
      function refreshTodayKey() {
        const current = toDateKey(new Date());
        if (current === TODAY_KEY) return false;
        TODAY_KEY = current;
        return true;
      }
      const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      // ==================== STATE ====================
      let state = {
        subjects: [...DEFAULT_SUBJECTS],
        selectedSubjectIds: ['subj_cp'],
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
        xp: 0,
        schemaVersion: 4,
        lootTickets: 0,
        rpeRewards: RPE_REWARDS.map(reward => ({ ...reward })),
        zeigarnikHook: '',
        demoMode: false,
        protocol: { focus: 50, short: 10, long: 20, label: 'Deep Work 50/10' }
      };
      const DEFAULT_STATE = JSON.parse(JSON.stringify(state));

      let activeView = 'command';
      let activeLinkedPlanId = null;
      let currentPlanFilter = 'all';
      let currentAnalyticsRange = 'week';
      let calendarMode = 'week'; // 'week' | 'month'
      let calendarOffsetWeeks = 0;
      let calendarOffsetMonths = 0;
      let stateRecoveryWarning = '';
      let storageWarningShown = false;

      function isValidDateKey(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      }

      function calendarDaysBetween(fromKey, toKey) {
        const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
        const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
        return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000);
      }

      function boundedNumber(value, fallback, min, max) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
      }

      function safeId(value, fallback) {
        const id = String(value || '');
        return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : fallback;
      }

      function safeObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).filter(([key]) => !['__proto__', 'prototype', 'constructor'].includes(key)));
      }

      // State is initialized with empty user collections; no demo-content generators are kept.
      function normalizeAppState(input = {}, baseState = DEFAULT_STATE) {
        const source = safeObject(input);
        const next = Object.assign({}, baseState, source);
        next.onboarding = Object.assign({}, baseState.onboarding, safeObject(source.onboarding));
        next.onboarding.availability = Array.from({ length: 7 }, (_, index) => boundedNumber(next.onboarding.availability?.[index], 0, 0, 600));
        next.onboarding.blackoutDates = Array.isArray(next.onboarding.blackoutDates) ? [...new Set(next.onboarding.blackoutDates.filter(isValidDateKey))] : [];
        next.onboarding.examDate = isValidDateKey(next.onboarding.examDate) ? next.onboarding.examDate : '';
        next.onboarding.examName = String(next.onboarding.examName || '').slice(0, 160);
        next.onboarding.examType = String(next.onboarding.examType || '').slice(0, 120);
        next.onboarding.phase = ['foundation', 'intensive', 'sprint'].includes(next.onboarding.phase) ? next.onboarding.phase : 'foundation';
        next.heatmapConfig = Object.assign({}, baseState.heatmapConfig, safeObject(source.heatmapConfig));
        next.heatmapConfig.dailyTargetMinutes = boundedNumber(next.heatmapConfig.dailyTargetMinutes, 100, 25, 1440);
        next.heatmapConfig.thresholds = Array.isArray(next.heatmapConfig.thresholds) && next.heatmapConfig.thresholds.length === 3
          ? next.heatmapConfig.thresholds.map(value => Math.max(1, Math.min(100, Number(value) || 1))).sort((a, b) => a - b)
          : [35, 70, 100];
        ['sessions', 'plannedTasks', 'milestones', 'resources', 'weakAreas', 'checkpoints', 'spacedItems'].forEach(key => {
          if (!Array.isArray(next[key])) next[key] = [];
        });
        if (!Array.isArray(next.subjects) || !next.subjects.length) next.subjects = baseState.subjects;
        const seenSubjectIds = new Set();
        next.subjects = next.subjects.filter(subject => {
          if (!subject || typeof subject.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(subject.id) || typeof subject.name !== 'string' || seenSubjectIds.has(subject.id)) return false;
          seenSubjectIds.add(subject.id);
          return true;
        });
        next.subjects = next.subjects.map(subject => ({
          ...subject,
          name: String(subject.name).trim().slice(0, 100),
          icon: String(subject.icon || '📚').slice(0, 8),
          color: /^#[0-9a-f]{6}$/i.test(String(subject.color || '')) ? subject.color : '#22d3ee'
        })).filter(subject => subject.name);
        if (!next.subjects.length) next.subjects = baseState.subjects;
        next.selectedSubjectIds = Array.isArray(next.selectedSubjectIds)
          ? [...new Set(next.selectedSubjectIds.filter(id => next.subjects.some(subject => subject.id === id)))] : [];
        if (!next.selectedSubjectIds.length) next.selectedSubjectIds = [next.subjects[0].id];
        next.protocol = Object.assign({}, baseState.protocol, safeObject(source.protocol));
        ['focus', 'short', 'long'].forEach(key => { next.protocol[key] = Math.min(180, Math.max(1, Math.round(Number(next.protocol[key]) || 1))); });
        next.protocol.label = String(next.protocol.label || 'Pomodoro').slice(0, 80);
        next.heatmapConfig.layer = ['minutes', 'completion', 'sessions', 'focus'].includes(next.heatmapConfig.layer) ? next.heatmapConfig.layer : 'minutes';
        next.heatmapConfig.palette = Object.prototype.hasOwnProperty.call(HEATMAP_PALETTES, next.heatmapConfig.palette) ? next.heatmapConfig.palette : 'cyan';
        const seenSessionIds = new Set();
        next.sessions = next.sessions.filter(item => item && typeof item === 'object').map((session, index) => ({
          ...session,
          id: safeId(session.id, `session_${index}`),
          minutes: getSessionMinutes(session),
          subjectIds: Array.isArray(session.subjectIds) ? session.subjectIds.filter(id => typeof id === 'string') : [],
          focusScore: getValidFocusScore(session)
        })).filter(session => {
          if (session.minutes <= 0 || !isValidDateKey(session.date) || session.date > TODAY_KEY || seenSessionIds.has(session.id)) return false;
          seenSessionIds.add(session.id);
          session.subjectIds = [...new Set(session.subjectIds.filter(id => next.subjects.some(subject => subject.id === id)))];
          ['topic', 'goal', 'note', 'protocolLabel', 'blocker', 'nextStep', 'outputUnit'].forEach(key => { session[key] = String(session[key] || '').slice(0, 500); });
          session.outputCount = boundedNumber(session.outputCount, 0, 0, 100000);
          session.timestamp = Number.isFinite(Number(session.timestamp)) ? Number(session.timestamp) : 0;
          return true;
        });
        const seenPlanIds = new Set();
        next.plannedTasks = next.plannedTasks.filter(item => item && typeof item === 'object').map((task, index) => ({
          ...task,
          id: safeId(task.id, `plan_${index}`),
          plannedMinutes: boundedNumber(task.plannedMinutes, 50, 5, 1440),
          status: task.status === 'completed' ? 'completed' : 'pending'
        })).filter(task => {
          if (!isValidDateKey(task.date) || seenPlanIds.has(task.id)) return false;
          seenPlanIds.add(task.id);
          task.topic = String(task.topic || '').trim().slice(0, 200);
          task.goal = String(task.goal || '').slice(0, 500);
          task.subjectId = next.subjects.some(subject => subject.id === task.subjectId) ? task.subjectId : next.subjects[0].id;
          task.rescheduled = Boolean(task.rescheduled);
          if (!task.topic) return false;
          return true;
        });
        const usedIds = new Set();
        const uniqueCollection = (items, idPrefix, normalize, validate = () => true) => items
          .filter(item => item && typeof item === 'object' && !Array.isArray(item))
          .map((item, index) => normalize({ ...item, id: safeId(item.id, `${idPrefix}_${index}`) }))
          .filter(item => item.id && !usedIds.has(item.id) && validate(item) && usedIds.add(item.id));
        next.milestones = uniqueCollection(next.milestones, 'target', item => ({
          ...item, title: String(item.title || '').trim().slice(0, 200), subjectId: next.subjects.some(subject => subject.id === item.subjectId) ? item.subjectId : next.subjects[0].id,
          type: ['minutes', 'sessions', 'output'].includes(item.type) ? item.type : 'output', current: boundedNumber(item.current, 0, 0, 100000000),
          target: boundedNumber(item.target, 1, 0.01, 100000000), unit: String(item.unit || 'đơn vị').slice(0, 40), deadline: isValidDateKey(item.deadline) ? item.deadline : ''
        }), item => Boolean(item.title));
        next.resources = uniqueCollection(next.resources, 'resource', item => ({
          ...item, name: String(item.name || '').trim().slice(0, 200), subjectId: next.subjects.some(subject => subject.id === item.subjectId) ? item.subjectId : next.subjects[0].id,
          type: String(item.type || 'Tài liệu').slice(0, 60), completed: boundedNumber(item.completed, 0, 0, 100000000), total: boundedNumber(item.total, 1, 1, 100000000), accuracy: boundedNumber(item.accuracy, 0, 0, 100)
        }), item => Boolean(item.name));
        next.weakAreas = uniqueCollection(next.weakAreas, 'weak', item => ({
          ...item, subtopic: String(item.subtopic || '').trim().slice(0, 200), subjectId: next.subjects.some(subject => subject.id === item.subjectId) ? item.subjectId : next.subjects[0].id,
          accuracy: boundedNumber(item.accuracy, 0, 0, 100), action: String(item.action || '').slice(0, 500), status: String(item.status || 'active').slice(0, 30)
        }), item => Boolean(item.subtopic));
        next.checkpoints = uniqueCollection(next.checkpoints, 'checkpoint', item => ({
          ...item, name: String(item.name || '').trim().slice(0, 200), date: isValidDateKey(item.date) ? item.date : TODAY_KEY,
          score: String(item.score || '').slice(0, 100), done: Boolean(item.done)
        }), item => Boolean(item.name));
        next.spacedItems = uniqueCollection(next.spacedItems, 'review', item => ({
          ...item, topic: String(item.topic || '').trim().slice(0, 300), question: String(item.question || '').slice(0, 500),
          subjectId: next.subjects.some(subject => subject.id === item.subjectId) ? item.subjectId : next.subjects[0].id,
          createdDate: isValidDateKey(item.createdDate) ? item.createdDate : TODAY_KEY,
          stageIndex: Math.round(boundedNumber(item.stageIndex, 0, 0, 4)), nextReviewDate: isValidDateKey(item.nextReviewDate) ? item.nextReviewDate : TODAY_KEY
        }), item => Boolean(item.topic));
        next.rpeRewards = Array.isArray(next.rpeRewards) ? next.rpeRewards.filter(reward => reward && typeof reward === 'object').map((reward, index) => ({
          id: safeId(reward.id, `reward_${index}`), title: String(reward.title || '').slice(0, 80), msg: String(reward.msg || '').slice(0, 240)
        })) : RPE_REWARDS.map(reward => ({ ...reward }));
        next.lootTickets = Math.floor(boundedNumber(next.lootTickets, 0, 0, 1000000000));
        next.zeigarnikHook = String(next.zeigarnikHook || '').slice(0, 500);
        next.schemaVersion = 4;
        next.xp = next.sessions.reduce((sum, session) => sum + session.minutes, 0) / 60;
        return next;
      }

      function loadState() {
        let rawSnapshot = null;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          rawSnapshot = raw;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
              || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.sessions)) {
              throw new Error('Stored Tflow data is not a supported data object.');
            }
            state = normalizeAppState(parsed);
            if (!Array.isArray(state.rpeRewards)) state.rpeRewards = RPE_REWARDS.map(reward => ({ ...reward }));
            const sampleTaskIds = new Set(['plan_missed_1', 'plan_missed_2', 'plan_today_1', 'plan_today_2', 'plan_today_3', 'plan_tmr_1', 'plan_tmr_2']);
            const sampleIds = {
              milestones: new Set(['ms_1', 'ms_2', 'ms_3', 'ms_4']),
              resources: new Set(['res_1', 'res_2', 'res_3', 'res_4']),
              weakAreas: new Set(['weak_1', 'weak_2', 'weak_3']),
              checkpoints: new Set(['cp_1', 'cp_2', 'cp_3']),
              spacedItems: new Set(['sr_1', 'sr_2'])
            };
            const isGeneratedSession = item => String(item.id).startsWith('demo_') || String(item.id).startsWith('sess_plan_') || item.protocolLabel === 'Planned Task';
            const hadSampleData = (state.sessions || []).some(isGeneratedSession)
              || (state.plannedTasks || []).some(item => sampleTaskIds.has(item.id))
              || Object.keys(sampleIds).some(key => (state[key] || []).some(item => sampleIds[key].has(item.id)));
            state.sessions = (state.sessions || []).filter(item => !isGeneratedSession(item));
            state.plannedTasks = (state.plannedTasks || []).filter(item => !sampleTaskIds.has(item.id));
            Object.keys(sampleIds).forEach(key => { state[key] = (state[key] || []).filter(item => !sampleIds[key].has(item.id)); });
            state.demoMode = false;
            if (hadSampleData) {
              if (state.zeigarnikHook === 'Cài đặt tiếp nhánh truy vết đường đi cho bài Shortest Path #2 trên Codeforces') state.zeigarnikHook = '';
              if (state.onboarding && state.onboarding.examName === 'ICPC Regional & Học kỳ Thuật toán') {
                state.onboarding.examName = '';
                state.onboarding.examDate = '';
                state.onboarding.blackoutDates = [];
              }
            }
            saveState();
          } else {
            saveState();
          }
        } catch (e) {
          console.error('Tflow could not restore local data; defaults are being restored.', e);
          if (rawSnapshot) {
            try {
              localStorage.setItem(`${STORAGE_KEY}_recovery_${Date.now()}`, rawSnapshot);
              stateRecoveryWarning = 'Dữ liệu cũ không đọc được. Tflow đã giữ bản gốc trong bộ nhớ trình duyệt và mở dữ liệu trống để tránh lỗi.';
            } catch (backupError) {
              console.error('Tflow could not preserve the unreadable local data.', backupError);
              stateRecoveryWarning = 'Dữ liệu cũ không đọc được và trình duyệt không thể tạo bản sao lưu tự động. Hãy tránh reset dữ liệu hoặc xóa bộ nhớ trình duyệt.';
            }
          }
          state = normalizeAppState({}, DEFAULT_STATE);
          state.demoMode = false;
          saveState();
        }
      }

      function saveState() {
        try {
          refreshTodayKey();
          state.xp = getStudyHours();
          state.schemaVersion = 4;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return true;
        } catch (e) {
          console.error('Tflow could not save local data.', e);
          if (!storageWarningShown && document.getElementById('toastContainer')) {
            storageWarningShown = true;
            showToast('Không thể lưu dữ liệu trên thiết bị. Hãy xuất bản sao lưu và kiểm tra dung lượng trình duyệt.', '⚠️');
          }
          return false;
        }
      }

      function getSessionMinutes(session) {
        const minutes = Number(session?.minutes);
        return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
      }

      function getStreak() {
        const uniqueDates = new Set((state.sessions || []).map(session => session.date));
        let streak = 0;
        let checkDate = TODAY_KEY;
        if (!uniqueDates.has(checkDate)) checkDate = addDays(TODAY_KEY, -1);
        while (uniqueDates.has(checkDate)) {
          streak++;
          checkDate = addDays(checkDate, -1);
        }
        return streak;
      }

      function updateGlobalChrome() {
        const streak = getStreak();
        const dueCount = (state.spacedItems || []).filter(item => item.nextReviewDate <= TODAY_KEY).length;
        const pendingToday = (state.plannedTasks || []).filter(task => task.status === 'pending' && (task.date === TODAY_KEY || task.date < TODAY_KEY)).length;
        const streakEls = ['headerStreakCount', 'cmdKpiStreak'];
        streakEls.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = String(streak); });
        const xp = document.getElementById('headerXpCount');
        if (xp) xp.textContent = Number(getStudyHours()).toFixed(1);
        const todayBadge = document.getElementById('navBadgeToday');
        if (todayBadge) todayBadge.textContent = String(pendingToday);
        const srBadge = document.getElementById('navBadgeSr');
        if (srBadge) srBadge.textContent = String(dueCount);
      }

      function createId(prefix) {
        const value = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        return `${prefix}_${value}`;
      }

      function getValidFocusScore(session) {
        const score = Number(session?.focusScore);
        return Number.isFinite(score) && score >= 1 && score <= 5 ? score : null;
      }

      function getAverageFocus(sessions) {
        const scores = sessions.map(getValidFocusScore).filter(score => score !== null);
        return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
      }

      function getStudyHours() {
        const minutes = (state.sessions || []).reduce((sum, session) => sum + getSessionMinutes(session), 0);
        return minutes / 60;
      }

      function getStudyRanks() {
        return [
          { name: 'Newbie', min: 0, next: 50, color: '#9ca3af' },
          { name: 'Pupil', min: 50, next: 100, color: '#22c55e' },
          { name: 'Specialist', min: 100, next: 500, color: '#22d3ee' },
          { name: 'Expert', min: 500, next: 1000, color: '#3b82f6' },
          { name: 'Candidate Master', min: 1000, next: 2000, color: '#a78bfa' },
          { name: 'Master', min: 2000, next: 3000, color: '#fb923c' },
          { name: 'International Master', min: 3000, next: 4000, color: '#fb923c' },
          { name: 'Grandmaster', min: 4000, next: 5500, color: '#ef4444' },
          { name: 'International Grandmaster', min: 5500, next: 7000, color: '#ef4444' },
          { name: 'Legendary Grandmaster', min: 7000, next: 8500, color: '#ef4444' },
          { name: 'Mythical Grandmaster', min: 8500, next: 10000, color: '#ef4444' },
          { name: 'Học Bá', min: 10000, next: Infinity, color: '#ef4444' }
        ];
      }

      function getRankNameHtml(name) {
        if (name === 'Legendary Grandmaster') return `<span style="color:#facc15">L</span>egendary Grandmaster`;
        if (name === 'Mythical Grandmaster') return `<span style="color:#facc15">Mythical</span> Grandmaster`;
        if (name === 'Học Bá') return `<span style="color:#facc15">H</span>ọc <span style="color:#facc15">B</span>á`;
        return escapeHtml(name);
      }

      function getStudyRank(hours) {
        const ranks = getStudyRanks();
        const rank = [...ranks].reverse().find(item => hours >= item.min) || ranks[0];
        return { ...rank, nameHtml: getRankNameHtml(rank.name) };
      }

      function renderRankingList(hours, currentRank) {
        const list = document.getElementById('rankingList');
        if (!list) return;
        list.innerHTML = '';
        getStudyRanks().forEach(rank => {
          const isCurrent = rank.name === currentRank.name;
          const range = Number.isFinite(rank.next)
            ? `${rank.min.toLocaleString('vi-VN')}–${rank.next.toLocaleString('vi-VN')} giờ`
            : `${rank.min.toLocaleString('vi-VN')}+ giờ`;
          const row = document.createElement('div');
          row.className = `flex items-center justify-between gap-3 rounded-lg px-3 py-2 border ${isCurrent ? 'border-[#22d3ee]/70 bg-[#0c2631]' : 'border-transparent bg-[#090d14]'}`;
          row.innerHTML = `<span class="text-xs font-semibold truncate" style="color:${rank.color}">${getRankNameHtml(rank.name)}</span><span class="text-[10px] font-mono text-slate-400 whitespace-nowrap">${range}</span>${isCurrent ? '<span class="text-[9px] font-bold text-[#22d3ee] whitespace-nowrap">BẠN ĐANG Ở ĐÂY</span>' : ''}`;
          list.appendChild(row);
        });
      }

      function renderHokBaRanking() {
        const hours = getStudyHours();
        const rank = getStudyRank(hours);
        const name = document.getElementById('rankingCurrentName');
        if (name) {
          name.innerHTML = rank.nameHtml;
          name.style.color = rank.color;
        }
        const currentHours = document.getElementById('rankingCurrentHours');
        if (currentHours) currentHours.textContent = `${hours.toFixed(1)} giờ`;
        const remaining = document.getElementById('rankingHoursToNext');
        if (remaining) {
          const nextRank = getStudyRanks().find(item => item.min === rank.next);
          remaining.textContent = Number.isFinite(rank.next)
            ? `Còn ${Math.max(0, rank.next - hours).toFixed(1)} giờ · ${nextRank?.name || ''}`
            : 'Đã đạt rank cao nhất';
        }
        renderRankingList(hours, rank);
      }

      function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      }

      function renderRpeRewardsEditor() {
        const list = document.getElementById('rpeRewardsList');
        if (!list) return;
        list.innerHTML = '';
        (state.rpeRewards || []).forEach((reward, index) => {
          const row = document.createElement('div');
          row.className = 'space-y-2 pb-3 border-b border-[#182332] last:border-0';
          row.innerHTML = `
            <div class="flex items-center gap-2">
              <input data-reward-title="${index}" value="${escapeHtml(reward.title || '')}" maxlength="80" placeholder="Tên phần thưởng" class="sf-input flex-1 px-2.5 py-1.5 text-xs" />
              <button type="button" data-reward-remove="${index}" class="text-slate-500 hover:text-rose-400 px-2" title="Xóa phần thưởng">✕</button>
            </div>
            <textarea data-reward-msg="${index}" rows="2" maxlength="240" placeholder="Mô tả phần thưởng" class="sf-input w-full p-2 text-xs">${escapeHtml(reward.msg || '')}</textarea>`;
          list.appendChild(row);
        });
        list.querySelectorAll('[data-reward-remove]').forEach(button => button.addEventListener('click', () => {
          state.rpeRewards.splice(Number(button.getAttribute('data-reward-remove')), 1);
          renderRpeRewardsEditor();
        }));
      }

      function showToast(message, icon = '✨') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1017] border border-[#22d3ee]/40 text-slate-100 text-xs font-medium shadow-xl transition-all duration-300';
        toast.innerHTML = `<span>${escapeHtml(icon)}</span><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 300);
        }, 3200);
      }

      // ==================== NAVIGATION ROUTER ====================
      function switchView(viewName) {
        activeView = viewName;
        document.querySelectorAll('.sf-view').forEach(sec => sec.classList.add('hidden'));
        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('button[data-nav]').forEach(btn => {
          if (btn.getAttribute('data-nav') === viewName) btn.classList.add('active');
          else btn.classList.remove('active');
        });

        refreshAllViews();
      }

      // ==================== WEB AUDIO SYNTHESIZER ====================
      let audioCtx = null;
      let activeNoiseNodes = [];

      function ensureAudioContext() {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      }

      function stopBrainwaveAudio() {
        activeNoiseNodes.forEach(node => {
          try {
            if (node.stop) node.stop();
            if (node.disconnect) node.disconnect();
          } catch (e) {}
        });
        activeNoiseNodes = [];
      }

      function startBrainwaveAudio(preset) {
        stopBrainwaveAudio();
        if (preset === 'off') return;
        ensureAudioContext();
        if (!audioCtx) return;

        const volSlider = document.getElementById('audioVolumeSlider');
        const volume = (Number(volSlider.value) || 35) / 400;
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(audioCtx.destination);
        activeNoiseNodes.push(masterGain);

        if (preset === 'gamma40' || preset === 'alpha10') {
          const beatFreq = preset === 'gamma40' ? 40 : 10;
          const baseFreq = 210;
          const merger = audioCtx.createChannelMerger(2);
          const oscL = audioCtx.createOscillator();
          const oscR = audioCtx.createOscillator();
          oscL.type = 'sine';
          oscR.type = 'sine';
          oscL.frequency.value = baseFreq;
          oscR.frequency.value = baseFreq + beatFreq;
          oscL.connect(merger, 0, 0);
          oscR.connect(merger, 0, 1);
          merger.connect(masterGain);
          oscL.start();
          oscR.start();
          activeNoiseNodes.push(oscL, oscR, merger);
        } else if (preset === 'brown') {
          const bufferSize = audioCtx.sampleRate * 3;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 2.5;
          }
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;
          noise.loop = true;
          noise.connect(masterGain);
          noise.start();
          activeNoiseNodes.push(noise);
        }
      }

      function playCompletionBell() {
        const chk = document.getElementById('chkSoundBell');
        if (!chk || !chk.checked) return;
        ensureAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.11);
          gain.gain.setValueAtTime(0.18, now + idx * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 1.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.11);
          osc.stop(now + idx * 0.11 + 1.45);
        });
      }

      // ==================== POMODORO TIMER ENGINE ====================
      const TIMER_STORAGE_KEY = `${STORAGE_KEY}_active_timer`;
      const PENDING_COMPLETION_KEY = `${STORAGE_KEY}_pending_completion`;
      let timerMode = 'focus';
      let totalSeconds = 50 * 60;
      let remainingSeconds = 50 * 60;
      let timerInterval = null;
      let timerEndsAt = null;
      let isRunning = false;
      let cycleCount = 1;
      const CIRCLE_CIRCUMFERENCE = 603.18;

      function persistTimerState() {
        try {
          localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
            mode: timerMode, totalSeconds, remainingSeconds, isRunning,
            endsAt: timerEndsAt, cycleCount, linkedPlanId: activeLinkedPlanId
          }));
        } catch (error) {
          console.error('Tflow could not persist timer state.', error);
        }
      }

      function restoreTimerState() {
        try {
          const raw = localStorage.getItem(TIMER_STORAGE_KEY);
          if (!raw) {
            timerMode = 'focus';
            totalSeconds = state.protocol.focus * 60;
            remainingSeconds = totalSeconds;
            updateTimerUI();
            return;
          }
          const saved = JSON.parse(raw);
          if (!saved || !['focus', 'short', 'long'].includes(saved.mode)) throw new Error('Invalid timer state');
          timerMode = saved.mode;
          totalSeconds = Math.round(boundedNumber(saved.totalSeconds, state.protocol.focus * 60, 1, 10800));
          remainingSeconds = Math.round(boundedNumber(saved.remainingSeconds, totalSeconds, 0, totalSeconds));
          cycleCount = Math.round(boundedNumber(saved.cycleCount, 1, 1, 4));
          activeLinkedPlanId = state.plannedTasks.some(task => task.id === saved.linkedPlanId) ? saved.linkedPlanId : null;
          isRunning = Boolean(saved.isRunning) && saved.endsAt !== null && saved.endsAt !== undefined && Number.isFinite(Number(saved.endsAt));
          timerEndsAt = isRunning ? Number(saved.endsAt) : null;
          if (isRunning) timerInterval = setInterval(syncTimerClock, 1000);
          updateTimerUI();
          if (isRunning) syncTimerClock();
        } catch (error) {
          console.error('Tflow discarded an invalid saved timer state.', error);
          try { localStorage.removeItem(TIMER_STORAGE_KEY); } catch (_) {}
          timerMode = 'focus';
          totalSeconds = state.protocol.focus * 60;
          remainingSeconds = totalSeconds;
          timerEndsAt = null;
          isRunning = false;
          updateTimerUI();
        }
      }

      function updateTimerUI() {
        if (isRunning && timerEndsAt !== null) {
          remainingSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        }
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        document.getElementById('timerDisplay').textContent = formatted;
        document.getElementById('todayMiniTimerDisplay').textContent = formatted;
        document.getElementById('topbarTimerText').textContent = formatted;

        const topbarPill = document.getElementById('topbarActiveTimerPill');
        if (isRunning) {
          topbarPill.classList.remove('hidden');
          topbarPill.classList.add('flex');
        } else {
          topbarPill.classList.add('hidden');
          topbarPill.classList.remove('flex');
        }

        const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
        const offset = CIRCLE_CIRCUMFERENCE * (1 - progress);
        document.getElementById('timerProgressCircle').style.strokeDashoffset = String(offset);

        document.getElementById('lblFocusMins').textContent = String(timerMode === 'focus' ? Math.round(totalSeconds / 60) : state.protocol.focus);
        document.getElementById('lblShortMins').textContent = String(state.protocol.short);
        document.getElementById('lblLongMins').textContent = String(state.protocol.long);

        const btnF = document.getElementById('modeBtnFocus');
        const btnS = document.getElementById('modeBtnShort');
        const btnL = document.getElementById('modeBtnLong');
        [btnF, btnS, btnL].forEach(b => {
          b.className = 'px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#0f1620] text-slate-400 hover:text-white border border-[#192534] transition';
        });

        const phaseLabel = document.getElementById('timerPhaseLabel');
        if (timerMode === 'focus') {
          btnF.className = 'px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#1cc5dc] text-slate-950 transition';
          phaseLabel.textContent = isRunning ? 'Deep Focus in progress...' : 'Ready to focus';
        } else if (timerMode === 'short') {
          btnS.className = 'px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#1cc5dc] text-slate-950 transition';
          phaseLabel.textContent = isRunning ? 'Short break recovery...' : 'Short Break Ready';
        } else {
          btnL.className = 'px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#1cc5dc] text-slate-950 transition';
          phaseLabel.textContent = isRunning ? 'NSDR Deep Rest...' : 'Long Break Ready';
        }

        document.getElementById('cycleCounterText').textContent = `Session #${cycleCount} / 4`;
        document.getElementById('startPauseIcon').textContent = isRunning ? '⏸' : '▶';
        document.getElementById('startPauseText').textContent = isRunning ? 'Đang chạy đồng hồ tập trung...' : 'Nhấn nút ▶ để bắt đầu phiên tập trung';
        document.getElementById('btnTodayMiniStart').textContent = isRunning ? '⏸ Pause' : '▶ Start';
      }

      function setTimerMode(mode, durationOverride = null) {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        timerEndsAt = null;
        isRunning = false;
        if (durationOverride === null && activeLinkedPlanId) {
          activeLinkedPlanId = null;
          document.getElementById('activePlanLinkedBadge')?.classList.add('hidden');
        }
        timerMode = mode;
        const configuredMins = mode === 'focus' ? state.protocol.focus : (mode === 'short' ? state.protocol.short : state.protocol.long);
        const mins = durationOverride === null ? configuredMins : boundedNumber(durationOverride, configuredMins, 1, 1440);
        totalSeconds = mins * 60;
        remainingSeconds = totalSeconds;
        updateTimerUI();
        persistTimerState();
      }

      function toggleTimer() {
        if (isRunning) {
          remainingSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
          if (remainingSeconds === 0) { syncTimerClock(); return; }
          clearInterval(timerInterval);
          timerInterval = null;
          timerEndsAt = null;
          isRunning = false;
          updateTimerUI();
          persistTimerState();
        } else {
          if (timerMode === 'focus' && state.selectedSubjectIds.length === 0) {
            showToast('Hãy chọn ít nhất 1 môn học!', '⚠️');
            return;
          }
          isRunning = true;
          timerEndsAt = Date.now() + remainingSeconds * 1000;
          updateTimerUI();
          persistTimerState();
          timerInterval = setInterval(syncTimerClock, 1000);
        }
      }

      function syncTimerClock() {
        if (!isRunning || timerEndsAt === null) return;
        remainingSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
        if (remainingSeconds > 0) {
          updateTimerUI();
          return;
        }
        clearInterval(timerInterval);
        timerInterval = null;
        timerEndsAt = null;
        isRunning = false;
        try { localStorage.removeItem(TIMER_STORAGE_KEY); } catch (_) {}
        updateTimerUI();
        playCompletionBell();
        if (timerMode === 'focus') {
          openCompletePomodoroModal(Math.round(totalSeconds / 60));
        } else {
          showToast('Đã hết giờ nghỉ! Quay lại trạng thái Focus.', '🚀');
          setTimerMode('focus');
        }
      }

      function finishFocusEarly(breakMode = null) {
        if (!['short', 'long'].includes(breakMode)) breakMode = null;
        if (isRunning && timerEndsAt !== null) {
          remainingSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
          if (remainingSeconds === 0) { syncTimerClock(); return; }
        }
        if (timerMode !== 'focus') {
          if (breakMode) setTimerMode(breakMode);
          else {
            setTimerMode('focus');
            showToast('Đã kết thúc giờ nghỉ. Chưa tạo phiên học hoặc XP.', '🧘');
          }
          return;
        }
        const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
        if (elapsedSeconds <= 0) {
          if (breakMode) setTimerMode(breakMode);
          else {
            setTimerMode('focus');
            showToast('Phiên chưa có thời gian học nên chưa cộng XP.', 'ℹ️');
          }
          return;
        }
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerEndsAt = null;
        isRunning = false;
        try { localStorage.removeItem(TIMER_STORAGE_KEY); } catch (_) {}
        updateTimerUI();
        playCompletionBell();
        openCompletePomodoroModal(elapsedSeconds / 60, breakMode);
      }

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          syncTimerClock();
          if (refreshTodayKey()) refreshAllViews();
        }
      });

      // ==================== SUBJECTS & ICONS ====================
      let newSubjectPickedIcon = AVAILABLE_ICONS[0];

      function renderIconPicker() {
        const grid = document.getElementById('iconPickerGrid');
        if (!grid) return;
        grid.innerHTML = '';
        AVAILABLE_ICONS.forEach(ic => {
          const btn = document.createElement('button');
          btn.type = 'button';
          const isSelected = ic === newSubjectPickedIcon;
          btn.className = `w-8 h-8 rounded-lg flex items-center justify-center text-base transition border ${
            isSelected ? 'bg-[#0c2631] border-[#22d3ee] scale-110' : 'bg-[#090d14] border-[#192534] hover:border-slate-600'
          }`;
          btn.textContent = ic;
          btn.addEventListener('click', () => {
            newSubjectPickedIcon = ic;
            renderIconPicker();
          });
          grid.appendChild(btn);
        });
      }

      function renderSubjects() {
        const container = document.getElementById('subjectChipsContainer');
        if (container) {
          container.innerHTML = '';
          state.subjects.forEach(subj => {
            const isSelected = state.selectedSubjectIds.includes(subj.id);
            const card = document.createElement('div');
            card.className = `rounded-xl p-2.5 border transition cursor-pointer flex items-center gap-2.5 select-none ${
              isSelected
                ? 'bg-[#0d222e] border-[#22d3ee] shadow-sm'
                : 'bg-[#090d14] border-[#182332] opacity-75 hover:opacity-100'
            }`;
            card.innerHTML = `
              <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style="background-color:${subj.color}22; border:1px solid ${subj.color}66">${escapeHtml(subj.icon)}</span>
              <div class="min-w-0">
                <div class="text-xs font-semibold text-white truncate">${escapeHtml(subj.name)}</div>
                <div class="text-[10px] ${isSelected ? 'text-[#22d3ee]' : 'text-slate-500'}">${isSelected ? '✓ Selected' : 'Click to tag'}</div>
              </div>
            `;
            card.addEventListener('click', () => {
              const idx = state.selectedSubjectIds.indexOf(subj.id);
              if (idx >= 0) {
                if (state.selectedSubjectIds.length > 1) state.selectedSubjectIds.splice(idx, 1);
                else showToast('Cần giữ ít nhất 1 môn học cho phiên Pomodoro!', '💡');
              } else {
                state.selectedSubjectIds.push(subj.id);
              }
              saveState();
              renderSubjects();
            });
            container.appendChild(card);
          });
        }

        // Active preview
        const preview = document.getElementById('activeSubjectsPreview');
        if (preview) {
          preview.innerHTML = '';
          const names = [];
          state.selectedSubjectIds.forEach(id => {
            const s = state.subjects.find(x => x.id === id);
            if (!s) return;
            names.push(`${s.icon} ${s.name}`);
            const span = document.createElement('span');
            span.className = 'px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0c2631] text-[#22d3ee] border border-[#164e63]';
            span.textContent = `${s.icon} ${s.name}`;
            preview.appendChild(span);
          });
          const miniSubj = document.getElementById('todayMiniTimerSubj');
          if (miniSubj) miniSubj.textContent = names.join(' + ') || '📚 Study Session';
        }

        // Settings Subjects List
        const setList = document.getElementById('settingsSubjectsList');
        if (setList) {
          setList.innerHTML = '';
          state.subjects.forEach(s => {
            const row = document.createElement('div');
            row.className = 'sf-inner p-3 flex items-center justify-between';
            row.innerHTML = `
              <div class="flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style="background-color:${s.color}22; border:1px solid ${s.color}66">${escapeHtml(s.icon)}</span>
                <span class="font-semibold text-white">${escapeHtml(s.name)}</span>
              </div>
              <button type="button" data-del-subj="${s.id}" class="text-slate-500 hover:text-rose-400 text-xs">Xóa</button>
            `;
            setList.appendChild(row);
          });
          setList.querySelectorAll('button[data-del-subj]').forEach(btn => {
            btn.addEventListener('click', () => {
              if (state.subjects.length <= 1) {
                showToast('Cần giữ lại ít nhất 1 môn học!', '⚠️');
                return;
              }
              const id = btn.getAttribute('data-del-subj');
              state.subjects = state.subjects.filter(x => x.id !== id);
              state.selectedSubjectIds = state.selectedSubjectIds.filter(x => x !== id);
              if (state.selectedSubjectIds.length === 0) state.selectedSubjectIds = [state.subjects[0].id];
              saveState();
              renderSubjects();
            });
          });
        }

        // Populate select dropdowns
        const filterSel = document.getElementById('heatmapSubjectFilter');
        if (filterSel) {
          const prev = filterSel.value || 'all';
          filterSel.innerHTML = `<option value="all">Tất cả môn học (${state.subjects.length})</option>`;
          state.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.icon} ${s.name}`;
            filterSel.appendChild(opt);
          });
          filterSel.value = prev;
        }

        ['planSubjSelect', 'msSubjSelect', 'resSubjSelect', 'srSubjectSelect', 'weakSubjSelect'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const prev = el.value;
          el.innerHTML = '';
          state.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.icon} ${s.name}`;
            el.appendChild(opt);
          });
          if (prev && state.subjects.some(x => x.id === prev)) el.value = prev;
        });
      }

      // ==================== LOAD PLANNED TASK INTO TIMER ====================
      function loadPlannedTaskIntoTimer(planId) {
        const task = state.plannedTasks.find(t => t.id === planId);
        if (!task) return;
        activeLinkedPlanId = task.id;
        state.selectedSubjectIds = [task.subjectId];
        document.getElementById('sessionTopicInput').value = task.topic;
        document.getElementById('sessionNoteInput').value = task.goal;
        setTimerMode('focus', task.plannedMinutes || 50);
        document.getElementById('activePlanLinkedBadge').classList.remove('hidden');
        renderSubjects();
        switchView('timer');
        showToast(`Đã nạp "${task.topic}" (${task.plannedMinutes}m) vào Study Timer!`, '🎯');
      }

      // ==================== 🔥 ADAPTIVE RECOVERY: SPREAD ACROSS ====================
      function executeSpreadAcross() {
        const missed = state.plannedTasks.filter(t => t.status === 'pending' && t.date < TODAY_KEY);
        const todayPending = state.plannedTasks.filter(t => t.status === 'pending' && t.date === TODAY_KEY);
        let tasksToSpread = [...missed];
        if (tasksToSpread.length === 0 && todayPending.length > 1) {
          tasksToSpread = todayPending.slice(1);
        }
        if (tasksToSpread.length === 0) {
          showToast('Không có phiên học nào bị trễ cần phân bổ lại!', '✨');
          return;
        }

        let cursorDate = tasksToSpread[0].date < TODAY_KEY ? TODAY_KEY : addDays(TODAY_KEY, 1);
        let count = 0;
        tasksToSpread.forEach(task => {
          const duration = Number(task.plannedMinutes) || 50;
          for (let step = 0; step < 28; step++) {
            const cand = addDays(cursorDate, step);
            if (state.onboarding.blackoutDates.includes(cand)) continue;
            const dow = getDayOfWeekIndex(cand);
            const maxAvail = Math.max(0, Number(state.onboarding.availability[dow]) || 0);
            const curMins = state.plannedTasks
              .filter(t => t.status === 'pending' && t.date === cand && t.id !== task.id)
              .reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);
            if (maxAvail > 0 && curMins + duration <= maxAvail) {
              task.date = cand;
              task.rescheduled = true;
              cursorDate = cand;
              count++;
              break;
            }
          }
        });

        saveState();
        refreshAllViews();
        showToast(`🔥 Spread Across: Đã tự động phân bổ lại ${count} phiên học vào các ngày trống!`, '🔥');
      }

      // ==================== VIEW 1: COMMAND CENTER RENDERER ====================
      function renderCommandCenter() {
        const todaySessions = state.sessions.filter(s => s.date === TODAY_KEY);
        const todayMins = todaySessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0);

        // Streak calculation
        const uniqueDates = new Set(state.sessions.map(s => s.date));
        let streak = 0;
        let checkDate = TODAY_KEY;
        if (!uniqueDates.has(checkDate)) checkDate = addDays(TODAY_KEY, -1);
        while (uniqueDates.has(checkDate)) {
          streak++;
          checkDate = addDays(checkDate, -1);
        }

        // Exam countdown: distinguish an exam that has already passed.
        const hasExamDate = Boolean(state.onboarding.examDate);
        const examDiffDays = hasExamDate ? calendarDaysBetween(TODAY_KEY, state.onboarding.examDate) : null;
        const diffDays = examDiffDays === null ? null : Math.max(0, examDiffDays);

        // Readiness score
        const readinessInputs = [];
        if (state.milestones.length) readinessInputs.push(state.milestones.reduce((sum, m) => sum + Math.min(1, Math.max(0, Number(m.current) || 0) / Math.max(1, Number(m.target) || 1)), 0) / state.milestones.length);
        if (state.resources.length) readinessInputs.push(state.resources.reduce((sum, r) => sum + Math.min(1, Math.max(0, Number(r.completed) || 0) / Math.max(1, Number(r.total) || 1)), 0) / state.resources.length);
        const readinessPct = readinessInputs.length ? Math.min(100, Math.round(readinessInputs.reduce((sum, value) => sum + value, 0) / readinessInputs.length * 100)) : 0;

        // Topbar & KPI cards
        document.getElementById('headerStreakCount').textContent = String(streak);
        document.getElementById('headerXpCount').textContent = Number(state.xp || 0).toFixed(1);
        document.getElementById('cmdKpiExamDays').textContent = diffDays === null ? '—' : examDiffDays < 0 ? 'Đã qua' : String(diffDays);
        document.getElementById('cmdKpiExamSub').textContent = hasExamDate
          ? examDiffDays < 0 ? `Đã qua ngày thi (${state.onboarding.examDate})` : (state.onboarding.examName || state.onboarding.examType || 'ngày còn lại')
          : 'Chưa đặt ngày thi';
        document.getElementById('cmdKpiReadiness').textContent = `${readinessPct}%`;
        document.getElementById('cmdKpiPhaseSub').textContent = `Phase: ${state.onboarding.phase.toUpperCase()}`;
        document.getElementById('cmdKpiStreak').textContent = String(streak);
        document.getElementById('cmdKpiTodayTime').textContent = `${Math.floor(todayMins / 60)}h ${todayMins % 60}m`;

        const currentRank = getStudyRank(getStudyHours());
        const rankName = document.getElementById('cmdRankName');
        if (rankName) { rankName.innerHTML = currentRank.nameHtml; rankName.style.color = currentRank.color; }
        const rankProgress = document.getElementById('cmdRankProgressText');
        if (rankProgress) rankProgress.textContent = `${getStudyHours().toFixed(1)} giờ đã học${Number.isFinite(currentRank.next) ? ` · còn ${(currentRank.next - getStudyHours()).toFixed(1)} giờ` : ''}`;

        // Timer bottom strip
        document.getElementById('timerStatPomodorosToday').textContent = String(todaySessions.length);
        document.getElementById('timerStatMinutesToday').textContent = `${todayMins}m`;
        document.getElementById('timerStatStreak').textContent = `${streak} days`;

        // Adaptive Recovery Banner visibility
        const missedTasks = state.plannedTasks.filter(t => t.status === 'pending' && t.date < TODAY_KEY);
        const banner = document.getElementById('cmdAdaptiveBanner');
        if (missedTasks.length > 0) {
          banner.classList.remove('hidden');
          const mMins = missedTasks.reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);
          document.getElementById('cmdAdaptiveText').innerHTML = `Phát hiện <strong class="text-amber-400">${missedTasks.length} phiên học bị trễ (${mMins} phút)</strong> từ các ngày trước. Nhấn <strong>Spread Across</strong> để tự động rải đều vào các ngày trống!`;
        } else {
          banner.classList.add('hidden');
        }

        // Today's Plan Card in Command Center
        const todayTasks = state.plannedTasks.filter(t => t.date === TODAY_KEY || (t.status === 'pending' && t.date < TODAY_KEY));
        const todayDone = todayTasks.filter(t => t.status === 'completed').length;
        const remMins = todayTasks.filter(t => t.status === 'pending').reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);
        const todayPct = todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0;

        document.getElementById('navBadgeToday').textContent = String(todayTasks.filter(t => t.status === 'pending').length);
        document.getElementById('cmdTodayPlanSub').textContent = `${todayDone}/${todayTasks.length} completed • ${remMins}m remaining`;
        document.getElementById('cmdTodayProgressBar').style.width = `${todayPct}%`;

        const cmdList = document.getElementById('cmdTodayTasksList');
        cmdList.innerHTML = '';
        todayTasks.slice(0, 5).forEach(task => {
          const subj = state.subjects.find(s => s.id === task.subjectId) || state.subjects[0];
          const isOverdue = task.status === 'pending' && task.date < TODAY_KEY;
          const row = document.createElement('div');
          row.className = `sf-inner p-2.5 flex items-center justify-between gap-2 text-xs ${task.status === 'completed' ? 'opacity-60' : ''}`;
          row.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0">
              <button type="button" data-cmd-toggle="${task.id}" class="w-4 h-4 rounded border ${task.status === 'completed' ? 'bg-[#22d3ee] border-[#22d3ee] text-slate-950' : 'border-slate-600'} flex items-center justify-center text-[10px] font-bold shrink-0">
                ${task.status === 'completed' ? '✓' : ''}
              </button>
              <div class="min-w-0">
                <div class="font-semibold text-white truncate ${task.status === 'completed' ? 'line-through text-slate-400' : ''}">${escapeHtml(subj.icon)} ${escapeHtml(task.topic)}</div>
                <div class="text-[11px] text-slate-400 truncate">${escapeHtml(task.goal)} • <span class="text-[#22d3ee] font-mono">${task.plannedMinutes}m</span> ${isOverdue ? '<span class="text-amber-400">(Overdue)</span>' : ''}</div>
              </div>
            </div>
            ${task.status === 'pending' ? `<button type="button" data-cmd-start="${task.id}" class="px-2.5 py-1 rounded-lg bg-[#0c2631] hover:bg-[#143d4f] text-[#22d3ee] font-semibold text-[11px] shrink-0">▶ Focus</button>` : ''}
          `;
          cmdList.appendChild(row);
        });

        cmdList.querySelectorAll('button[data-cmd-start]').forEach(btn => {
          btn.addEventListener('click', () => loadPlannedTaskIntoTimer(btn.getAttribute('data-cmd-start')));
        });
        cmdList.querySelectorAll('button[data-cmd-toggle]').forEach(btn => {
          btn.addEventListener('click', () => togglePlannedTaskDone(btn.getAttribute('data-cmd-toggle')));
        });

        document.getElementById('cmdZeigarnikInput').value = state.zeigarnikHook || '';

        // Overall Progress Ring
        const ringOffset = 314.16 * (1 - readinessPct / 100);
        document.getElementById('cmdOverallRing').style.strokeDashoffset = String(ringOffset);
        document.getElementById('cmdOverallPctText').textContent = `${readinessPct}%`;

        const allDoneTasks = state.plannedTasks.filter(t => t.status === 'completed').length;
        document.getElementById('cmdStatTasksDone').textContent = `${allDoneTasks} / ${state.plannedTasks.length}`;
        const msDone = state.milestones.filter(m => m.current >= m.target).length;
        document.getElementById('cmdStatMilestones').textContent = `${msDone} / ${state.milestones.length}`;
        document.getElementById('cmdStatStudyDays').textContent = `${uniqueDates.size} days`;
        const avgFocus = getAverageFocus(state.sessions);
        document.getElementById('cmdStatAvgFocus').textContent = avgFocus === null ? '—' : `${avgFocus.toFixed(1)} ★`;

        // Active Milestones Preview (Bottom Center Card)
        const msPrev = document.getElementById('cmdMilestonesPreview');
        msPrev.innerHTML = '';
        state.milestones.slice(0, 3).forEach(ms => {
          const pct = Math.min(100, Math.round((ms.current / Math.max(1, ms.target)) * 100));
          const d = document.createElement('div');
          d.className = 'sf-inner p-2.5 space-y-1.5 text-xs';
          d.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-white truncate">${escapeHtml(ms.title)}</span>
              <span class="font-mono text-[#22d3ee] shrink-0">${ms.current}/${ms.target}</span>
            </div>
            <div class="w-full h-1.5 bg-[#141f2d] rounded-full overflow-hidden">
              <div class="h-full bg-[#22d3ee]" style="width:${pct}%"></div>
            </div>
          `;
          msPrev.appendChild(d);
        });

        // Weak Areas Preview (Bottom Right Card)
        const weakPrev = document.getElementById('cmdWeakAreasPreview');
        weakPrev.innerHTML = '';
        state.weakAreas.slice(0, 3).forEach(w => {
          const d = document.createElement('div');
          d.className = 'sf-inner p-2.5 flex items-center justify-between gap-2 text-xs';
          d.innerHTML = `
            <div class="min-w-0">
              <div class="font-semibold text-white truncate">${escapeHtml(w.subtopic)}</div>
              <div class="text-[11px] text-amber-400">Mastery: ${w.accuracy}%</div>
            </div>
            <button type="button" data-cmd-remed="${w.id}" class="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-semibold shrink-0">🛠️ Fix</button>
          `;
          weakPrev.appendChild(d);
        });
        weakPrev.querySelectorAll('button[data-cmd-remed]').forEach(btn => {
          btn.addEventListener('click', () => remediateWeakArea(btn.getAttribute('data-cmd-remed')));
        });
      }

      function togglePlannedTaskDone(taskId) {
        const task = state.plannedTasks.find(t => t.id === taskId);
        if (!task) return;
        if (task.status === 'pending') {
          task.status = 'completed';
          showToast(`Đã đánh dấu "${task.topic}" hoàn thành. Hãy ghi phiên học riêng để cộng thời gian và XP.`, '✅');
        } else {
          task.status = 'pending';
        }
        saveState();
        refreshAllViews();
      }

      function remediateWeakArea(weakId) {
        const w = state.weakAreas.find(x => x.id === weakId);
        if (!w) return;
        state.plannedTasks.unshift({
          id: createId('remed'),
          subjectId: w.subjectId,
          topic: `[Remediation] ${w.subtopic}`,
          goal: w.action,
          date: TODAY_KEY,
          plannedMinutes: 50,
          status: 'pending',
          rescheduled: false
        });
        saveState();
        refreshAllViews();
        showToast(`Đã đẩy phiên khắc phục "${w.subtopic}" vào Today's Plan!`, '🛠️');
      }

      // ==================== VIEW 2: TODAY'S EXECUTION RENDERER ====================
      function renderTodayExecution() {
        const tasks = state.plannedTasks.filter(t => t.date === TODAY_KEY || (t.status === 'pending' && t.date < TODAY_KEY));
        const doneCount = tasks.filter(t => t.status === 'completed').length;
        const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
        const remMins = tasks.filter(t => t.status === 'pending').reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);

        const ringOffset = 175.9 * (1 - pct / 100);
        document.getElementById('todayExecRing').style.strokeDashoffset = String(ringOffset);
        document.getElementById('todayExecPct').textContent = `${pct}%`;
        document.getElementById('todayExecCountText').textContent = `${doneCount} of ${tasks.length} tasks`;
        document.getElementById('todayExecRemainingText').textContent = `Remaining: ${Math.floor(remMins / 60)}h ${remMins % 60}m`;

        const todayActualMins = state.sessions.filter(s => s.date === TODAY_KEY).reduce((a, s) => a + (Number(s.minutes) || 0), 0);
        const dow = getDayOfWeekIndex(TODAY_KEY);
        const plannedDayMins = Math.max(0, Number(state.onboarding.availability[dow]) || 0);
        const timePct = plannedDayMins > 0 ? Math.min(100, Math.round((todayActualMins / plannedDayMins) * 100)) : 0;

        document.getElementById('todayExecTimeLogged').textContent = `${Math.floor(todayActualMins / 60)}h ${todayActualMins % 60}m`;
        document.getElementById('todayExecTimeTarget').textContent = plannedDayMins > 0
          ? `of ${Math.floor(plannedDayMins / 60)}h ${plannedDayMins % 60}m available`
          : 'Không đặt thời gian học hôm nay';
        document.getElementById('todayExecTimeBar').style.width = `${timePct}%`;

        // Tasks List
        const container = document.getElementById('plannedTasksListContainer');
        container.innerHTML = '';
        let filtered = [...state.plannedTasks].sort((a, b) => a.date.localeCompare(b.date));
        if (currentPlanFilter === 'pending') filtered = filtered.filter(t => t.status === 'pending');
        else if (currentPlanFilter === 'done') filtered = filtered.filter(t => t.status === 'completed');

        if (filtered.length === 0) {
          container.innerHTML = `<div class="p-8 text-center text-xs text-slate-500">Chưa có nhiệm vụ nào trong danh sách lọc này.</div>`;
          return;
        }

        filtered.forEach(task => {
          const subj = state.subjects.find(s => s.id === task.subjectId) || state.subjects[0];
          const isOverdue = task.status === 'pending' && task.date < TODAY_KEY;
          const isToday = task.date === TODAY_KEY;

          const div = document.createElement('div');
          div.className = `sf-inner p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isOverdue ? 'border-amber-500/40' : ''
          }`;
          div.innerHTML = `
            <div class="flex items-start gap-3">
              <button type="button" data-plan-act="done" data-plan-id="${task.id}" class="mt-0.5 w-4 h-4 rounded border ${
                task.status === 'completed' ? 'bg-[#22d3ee] border-[#22d3ee] text-slate-950' : 'border-slate-600'
              } flex items-center justify-center text-[10px] font-bold shrink-0">
                ${task.status === 'completed' ? '✓' : ''}
              </button>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-bold text-white text-sm ${task.status === 'completed' ? 'line-through text-slate-400' : ''}">${escapeHtml(task.topic)}</span>
                  <span class="px-2 py-0.5 rounded bg-[#14202e] text-slate-200 text-[11px]">${escapeHtml(subj.icon)} ${escapeHtml(subj.name)}</span>
                  <span class="font-mono text-[#22d3ee] font-semibold">${task.plannedMinutes}m</span>
                  <span class="font-mono text-[11px] ${isOverdue ? 'text-amber-400 font-bold' : isToday ? 'text-[#22d3ee]' : 'text-slate-400'}">
                    📅 ${task.date} ${isOverdue ? '(Overdue)' : isToday ? '(Today)' : ''}
                  </span>
                  ${task.rescheduled ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">🔄 Rescheduled</span>` : ''}
                </div>
                <div class="text-slate-400">🎯 Goal: <span class="text-slate-300">${escapeHtml(task.goal)}</span></div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${task.status === 'pending' ? `
                <button type="button" data-plan-act="start" data-plan-id="${task.id}" class="sf-btn-primary px-3 py-1.5 text-xs">▶ Start</button>
                <button type="button" data-plan-act="tomorrow" data-plan-id="${task.id}" class="sf-btn-secondary px-2.5 py-1.5 text-xs" title="Dời sang ngày mai">➔ +1d</button>
              ` : `<span class="text-[#22d3ee] font-semibold px-2">Completed</span>`}
              <button type="button" data-plan-act="delete" data-plan-id="${task.id}" class="px-2 py-1 text-slate-500 hover:text-rose-400">✕</button>
            </div>
          `;
          container.appendChild(div);
        });

        container.querySelectorAll('button[data-plan-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-plan-id');
            const act = btn.getAttribute('data-plan-act');
            const task = state.plannedTasks.find(t => t.id === id);
            if (!task) return;
            if (act === 'start') loadPlannedTaskIntoTimer(id);
            else if (act === 'done') togglePlannedTaskDone(id);
            else if (act === 'tomorrow') {
              let nextD = addDays(task.date < TODAY_KEY ? TODAY_KEY : task.date, 1);
              while (state.onboarding.blackoutDates.includes(nextD)) nextD = addDays(nextD, 1);
              task.date = nextD;
              task.rescheduled = true;
              saveState();
              refreshAllViews();
              showToast(`Đã dời sang ngày ${nextD}!`, '📅');
            } else if (act === 'delete') {
              state.plannedTasks = state.plannedTasks.filter(t => t.id !== id);
              saveState();
              refreshAllViews();
            }
          });
        });
      }

      // ==================== VIEW 3: STUDY CALENDAR (WEEK & MONTH) ====================
      function renderStudyCalendar() {
        const container = document.getElementById('calendarGridContainer');
        const headerText = document.getElementById('calHeaderRangeText');
        container.innerHTML = '';

        if (calendarMode === 'week') {
          const todayDow = getDayOfWeekIndex(TODAY_KEY);
          const mondayKey = addDays(TODAY_KEY, -todayDow + calendarOffsetWeeks * 7);
          const sundayKey = addDays(mondayKey, 6);
          headerText.textContent = `Week: ${mondayKey} → ${sundayKey}`;

          for (let d = 0; d < 7; d++) {
            const dKey = addDays(mondayKey, d);
            const isToday = dKey === TODAY_KEY;
            const isBlackout = state.onboarding.blackoutDates.includes(dKey);
            const dayTasks = state.plannedTasks.filter(t => t.date === dKey);
            const daySessions = state.sessions.filter(s => s.date === dKey);
            const plannedMins = dayTasks.reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);
            const actualMins = daySessions.reduce((a, b) => a + (Number(b.minutes) || 0), 0);

            const col = document.createElement('div');
            col.className = `sf-card p-3.5 flex flex-col justify-between min-h-[260px] ${
              isToday ? 'border-[#22d3ee]' : isBlackout ? 'opacity-60 border-rose-900/40' : ''
            }`;

            const tasksHtml = dayTasks.map(t => {
              const subj = state.subjects.find(s => s.id === t.subjectId) || state.subjects[0];
              return `
                <div data-cal-task="${t.id}" class="sf-inner p-2 text-[11px] cursor-pointer hover:border-[#22d3ee]/50 transition ${t.status === 'completed' ? 'opacity-55 line-through' : ''}">
                  <div class="font-semibold text-white truncate">${escapeHtml(subj.icon)} ${escapeHtml(t.topic)}</div>
                  <div class="text-[10px] text-slate-400 flex justify-between mt-0.5">
                    <span>${t.plannedMinutes}m</span>
                    <span class="text-[#22d3ee]">${t.status === 'completed' ? '✓' : '▶'}</span>
                  </div>
                </div>
              `;
            }).join('');

            col.innerHTML = `
              <div class="space-y-2.5">
                <div class="flex items-center justify-between border-b border-[#151f2c] pb-2">
                  <div>
                    <div class="text-[10px] font-bold uppercase text-slate-400">${WEEKDAY_LABELS[d]}</div>
                    <div class="text-base font-extrabold font-mono ${isToday ? 'text-[#22d3ee]' : 'text-white'}">${dKey.slice(8)}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-[11px] font-mono text-slate-300">${(plannedMins / 60).toFixed(1)}h plan</div>
                    <div class="text-[10px] font-mono text-[#22d3ee]">${actualMins}m done</div>
                  </div>
                </div>
                ${isBlackout ? `<div class="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-[11px] text-rose-300 text-center">🚫 Blackout / Rest Day</div>` : ''}
                <div class="space-y-1.5">${tasksHtml || '<div class="text-[11px] text-slate-600 text-center py-6">No tasks</div>'}</div>
              </div>
              <div class="pt-2 border-t border-[#151f2c] text-[10px] text-slate-500 flex justify-between">
                <span>Cap: ${state.onboarding.availability[d]}m</span>
                <span>${dayTasks.length} tasks</span>
              </div>
            `;
            container.appendChild(col);
          }
        } else {
          // Month View (28-day 4-week clean grid around current month)
          const baseDate = new Date();
          baseDate.setMonth(baseDate.getMonth() + calendarOffsetMonths);
          const year = baseDate.getFullYear();
          const month = baseDate.getMonth();
          const firstDay = new Date(year, month, 1);
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          headerText.textContent = `${monthNames[month]} ${year}`;

          const firstKey = toDateKey(firstDay);
          const offsetDow = getDayOfWeekIndex(firstKey);
          const startGridKey = addDays(firstKey, -offsetDow);

          for (let i = 0; i < 35; i++) {
            const dKey = addDays(startGridKey, i);
            const isToday = dKey === TODAY_KEY;
            const dayTasks = state.plannedTasks.filter(t => t.date === dKey);
            const actualMins = state.sessions.filter(s => s.date === dKey).reduce((a, b) => a + (Number(b.minutes) || 0), 0);

            const cell = document.createElement('div');
            cell.className = `sf-card p-2.5 min-h-[110px] flex flex-col justify-between text-xs ${isToday ? 'border-[#22d3ee]' : ''}`;
            cell.innerHTML = `
              <div class="flex items-center justify-between">
                <span class="font-mono font-bold ${isToday ? 'text-[#22d3ee]' : 'text-slate-300'}">${dKey.slice(8)}</span>
                ${actualMins > 0 ? `<span class="text-[10px] font-mono text-[#22d3ee]">${actualMins}m</span>` : ''}
              </div>
              <div class="space-y-1 my-1">
                ${dayTasks.slice(0, 2).map(t => `<div data-cal-task="${t.id}" class="truncate text-[10px] px-1.5 py-0.5 rounded bg-[#0f1620] text-slate-200 cursor-pointer hover:text-[#22d3ee]">${escapeHtml(t.topic)}</div>`).join('')}
                ${dayTasks.length > 2 ? `<div class="text-[10px] text-slate-500">+${dayTasks.length - 2} more</div>` : ''}
              </div>
            `;
            container.appendChild(cell);
          }
        }

        container.querySelectorAll('[data-cal-task]').forEach(el => {
          el.addEventListener('click', () => loadPlannedTaskIntoTimer(el.getAttribute('data-cal-task')));
        });
      }

      // ==================== VIEW 4: MASTER PLAN RENDERER ====================
      function renderMasterPlan() {
        const hasExamDate = Boolean(state.onboarding.examDate);
        const examDiffDays = hasExamDate ? calendarDaysBetween(TODAY_KEY, state.onboarding.examDate) : null;
        const diffDays = examDiffDays === null ? null : Math.max(0, examDiffDays);
        const weekAvailMins = state.onboarding.availability.reduce((a, b) => a + (Number(b) || 0), 0);

        document.getElementById('mpExamName').textContent = state.onboarding.examName || 'Chưa đặt mục tiêu';
        document.getElementById('mpDaysLeft').textContent = !hasExamDate ? '—' : examDiffDays < 0 ? 'Đã qua' : String(diffDays);
        document.getElementById('mpExamDateSub').textContent = !hasExamDate ? 'Chưa đặt ngày' : examDiffDays < 0 ? `Ngày thi đã qua: ${state.onboarding.examDate}` : `Hạn chót: ${state.onboarding.examDate}`;
        document.getElementById('mpPhaseTitle').textContent = (state.onboarding.phase || 'foundation').toUpperCase();
        document.getElementById('mpWeeklyCap').textContent = `${(weekAvailMins / 60).toFixed(1)}h`;

        const grid = document.getElementById('mpSubjectsGrid');
        grid.innerHTML = '';
        state.subjects.forEach((s, idx) => {
          const totalMins = state.sessions
            .filter(sess => sess.subjectIds.includes(s.id))
            .reduce((a, b) => a + (Number(b.minutes) || 0), 0);
          const priority = idx < 2 ? 'high' : idx < 4 ? 'medium' : 'normal';
          const card = document.createElement('div');
          card.className = 'sf-inner p-3.5 flex items-center justify-between';
          card.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style="background-color:${s.color}22; border:1px solid ${s.color}66">${escapeHtml(s.icon)}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${escapeHtml(s.name)}</div>
                <div class="text-[11px] text-slate-400 font-mono">${(totalMins / 60).toFixed(1)}h logged</div>
              </div>
            </div>
            <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
              priority === 'high' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-[#14202e] text-[#22d3ee]'
            }">${priority}</span>
          `;
          grid.appendChild(card);
        });

        ['mpPlanSubjectSelect', 'mpTargetSubjectSelect'].forEach(id => {
          const select = document.getElementById(id);
          if (!select) return;
          const previous = select.value;
          select.innerHTML = state.subjects.map(subject => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.icon)} ${escapeHtml(subject.name)}</option>`).join('');
          if (state.subjects.some(subject => subject.id === previous)) select.value = previous;
        });

        const plans = document.getElementById('mpPlansList');
        plans.innerHTML = '';
        if (state.plannedTasks.length === 0) {
          plans.innerHTML = '<div class="py-4 text-center text-xs text-slate-500">Chưa có Plan. Thêm kế hoạch đầu tiên ở phía trên.</div>';
        } else {
          [...state.plannedTasks].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).forEach(plan => {
            const subject = state.subjects.find(item => item.id === plan.subjectId);
            const row = document.createElement('div');
            row.className = 'sf-inner p-3 flex items-start justify-between gap-3 text-xs';
            row.innerHTML = `<div class="min-w-0"><div class="font-semibold text-white">${escapeHtml(plan.topic)}</div><div class="mt-1 text-slate-400">${escapeHtml(plan.goal || '')}</div><div class="mt-1 font-mono text-[#22d3ee]">${escapeHtml(plan.date)} · ${Math.round((Number(plan.plannedMinutes) || 0) / 60 * 10) / 10} giờ · ${escapeHtml(subject ? `${subject.icon} ${subject.name}` : 'Chưa gắn môn')}</div></div><button type="button" data-mp-del-plan="${escapeHtml(plan.id)}" class="shrink-0 text-slate-500 hover:text-rose-400" title="Xóa Plan">✕</button>`;
            plans.appendChild(row);
          });
          plans.querySelectorAll('[data-mp-del-plan]').forEach(button => button.addEventListener('click', () => {
            state.plannedTasks = state.plannedTasks.filter(plan => plan.id !== button.getAttribute('data-mp-del-plan'));
            saveState();
            refreshAllViews();
          }));
        }

        const targets = document.getElementById('mpTargetsList');
        targets.innerHTML = '';
        if (state.milestones.length === 0) {
          targets.innerHTML = '<div class="py-4 text-center text-xs text-slate-500">Chưa có Target. Tạo mục tiêu đầu tiên ở phía trên.</div>';
        } else {
          state.milestones.forEach(target => {
            const current = Number(target.current) || 0;
            const goal = Math.max(1, Number(target.target) || 1);
            const percent = Math.min(100, Math.round(current / goal * 100));
            const row = document.createElement('div');
            row.className = 'sf-inner p-3 space-y-2 text-xs';
            row.innerHTML = `<div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="font-semibold text-white">${escapeHtml(target.title)}</div><div class="mt-1 text-slate-400">Hạn: ${escapeHtml(target.deadline || 'Chưa đặt')} · ${escapeHtml(target.unit || 'đơn vị')}</div></div><button type="button" data-mp-del-target="${escapeHtml(target.id)}" class="shrink-0 text-slate-500 hover:text-rose-400" title="Xóa Target">✕</button></div><div class="flex justify-between text-slate-300"><span>${current} / ${goal} ${escapeHtml(target.unit || '')}</span><span>${percent}%</span></div><div class="h-1.5 rounded-full bg-[#141f2d] overflow-hidden"><div class="h-full bg-[#22d3ee]" style="width:${percent}%"></div></div>`;
            targets.appendChild(row);
          });
          targets.querySelectorAll('[data-mp-del-target]').forEach(button => button.addEventListener('click', () => {
            state.milestones = state.milestones.filter(target => target.id !== button.getAttribute('data-mp-del-target'));
            saveState();
            refreshAllViews();
          }));
        }
      }

      // ==================== HEATMAP RENDERER ====================
      let selectedHeatmapDate = TODAY_KEY;

      function renderHeatmap() {
        const grid = document.getElementById('heatmapGrid');
        const monthsRow = document.getElementById('heatmapMonthsRow');
        if (!grid || !monthsRow) return;

        const subjectFilter = document.getElementById('heatmapSubjectFilter').value || 'all';
        const layer = state.heatmapConfig.layer || 'minutes';
        const paletteKey = state.heatmapConfig.palette || 'cyan';
        const palette = HEATMAP_PALETTES[paletteKey] || HEATMAP_PALETTES.cyan;
        const dailyTarget = Math.max(25, Number(state.heatmapConfig.dailyTargetMinutes) || 100);
        const thresholds = (state.heatmapConfig.thresholds || [35, 70, 100]).map(Number);
        const [t1, t2, t3] = thresholds;
        ['heatmapThreshold1', 'heatmapThreshold2', 'heatmapThreshold3'].forEach((id, index) => {
          const input = document.getElementById(id);
          if (input && document.activeElement !== input) input.value = thresholds[index];
        });

        for (let i = 0; i < 5; i++) {
          const box = document.getElementById(`legendBox${i}`);
          if (box) box.style.backgroundColor = palette[i];
        }

        grid.innerHTML = '';
        monthsRow.innerHTML = '';

        const dayMap = {};
        let totalYear = 0;

        state.sessions.forEach(sess => {
          if (subjectFilter !== 'all' && !sess.subjectIds.includes(subjectFilter)) return;
          if (!dayMap[sess.date]) dayMap[sess.date] = { minutes: 0, count: 0, focusSum: 0, focusCount: 0, sessions: [], plannedMinutes: 0 };
          dayMap[sess.date].minutes += getSessionMinutes(sess);
          dayMap[sess.date].count += 1;
          const focus = getValidFocusScore(sess);
          if (focus !== null) {
            dayMap[sess.date].focusSum += focus;
            dayMap[sess.date].focusCount += 1;
          }
          dayMap[sess.date].sessions.push(sess);
          totalYear += 1;
        });

        state.plannedTasks.forEach(task => {
          if (subjectFilter !== 'all' && task.subjectId !== subjectFilter) return;
          if (!dayMap[task.date]) dayMap[task.date] = { minutes: 0, count: 0, focusSum: 0, focusCount: 0, sessions: [], plannedMinutes: 0 };
          dayMap[task.date].plannedMinutes += (Number(task.plannedMinutes) || 50);
        });

        document.getElementById('heatmapTotalSummaryBadge').textContent = `${totalYear} sessions in past year`;

        const today = new Date();
        const endDow = today.getDay();
        const totalDays = 52 * 7 + (endDow + 1);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - totalDays + 1);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let lastMonth = -1;
        const totalWeeks = Math.ceil(totalDays / 7);

        for (let w = 0; w < totalWeeks; w++) {
          const wFirst = new Date(startDate);
          wFirst.setDate(startDate.getDate() + w * 7);
          const m = wFirst.getMonth();
          const mSpan = document.createElement('div');
          mSpan.style.width = '15px';
          mSpan.className = 'shrink-0';
          if (m !== lastMonth && wFirst.getDate() <= 14) {
            mSpan.textContent = monthNames[m];
            lastMonth = m;
          }
          monthsRow.appendChild(mSpan);
        }

        for (let i = 0; i < totalDays; i++) {
          const cellDate = new Date(startDate);
          cellDate.setDate(startDate.getDate() + i);
          const dKey = toDateKey(cellDate);
          const info = dayMap[dKey] || { minutes: 0, count: 0, focusSum: 0, focusCount: 0, sessions: [], plannedMinutes: 0 };
          const avgFocus = info.focusCount > 0 ? (info.focusSum / info.focusCount) : null;
          const targetForDay = info.plannedMinutes > 0 ? info.plannedMinutes : dailyTarget;
          const completionPct = info.minutes > 0 ? Math.round((info.minutes / targetForDay) * 100) : 0;

          let bucket = 0;
          if (layer === 'minutes') {
            if (info.minutes <= 0) bucket = 0;
            else if (info.minutes < dailyTarget * t1 / 100) bucket = 1;
            else if (info.minutes < dailyTarget * t2 / 100) bucket = 2;
            else if (info.minutes < dailyTarget * t3 / 100) bucket = 3;
            else bucket = 4;
          } else if (layer === 'completion') {
            if (completionPct <= 0) bucket = 0;
            else if (completionPct < t1) bucket = 1;
            else if (completionPct < t2) bucket = 2;
            else if (completionPct < t3) bucket = 3;
            else bucket = 4;
          } else if (layer === 'sessions') {
            if (info.count <= 0) bucket = 0;
            else if (info.count === 1) bucket = 1;
            else if (info.count === 2) bucket = 2;
            else if (info.count === 3) bucket = 3;
            else bucket = 4;
          } else if (layer === 'focus') {
            if (avgFocus === null) bucket = 0;
            else if (avgFocus < 2.5) bucket = 1;
            else if (avgFocus < 3.5) bucket = 2;
            else if (avgFocus < 4.5) bucket = 3;
            else bucket = 4;
          }

          const cell = document.createElement('div');
          cell.className = 'heatmap-cell';
          cell.style.backgroundColor = palette[bucket];
          if (dKey === selectedHeatmapDate) cell.style.boxShadow = '0 0 0 1.5px #f59e0b';

          const label = info.count > 0
            ? `📅 ${dKey}: ${info.minutes}m (${completionPct}% target) • ${info.count} sessions • Focus: ${avgFocus === null ? 'chưa đánh giá' : `${avgFocus.toFixed(1)}★`}`
            : `📅 ${dKey}: 0m logged`;

          cell.addEventListener('mouseenter', () => {
            document.getElementById('heatmapHoverStatus').textContent = label;
          });
          cell.addEventListener('click', () => {
            selectedHeatmapDate = dKey;
            renderHeatmap();
          });
          grid.appendChild(cell);
        }

        const curInfo = dayMap[selectedHeatmapDate] || { minutes: 0, count: 0, focusSum: 0, focusCount: 0, sessions: [], plannedMinutes: 0 };
        renderSelectedDayDetail(selectedHeatmapDate, curInfo, dailyTarget);
      }

      function renderSelectedDayDetail(dKey, info, dailyTarget) {
        document.getElementById('detailCardDateTitle').textContent = dKey === TODAY_KEY ? `Today (${dKey})` : dKey;
        const avgF = info.focusCount > 0 ? `${(info.focusSum / info.focusCount).toFixed(1)}★` : '—';
        document.getElementById('detailCardSummaryPill').textContent = `${info.count} sessions • ${info.minutes}m • Focus: ${avgF}`;
        const target = info.plannedMinutes > 0 ? info.plannedMinutes : dailyTarget;
        const pct = Math.round((info.minutes / target) * 100);
        document.getElementById('detailCardPlanComparison').innerHTML = `Target: <strong class="text-white">${target}m</strong> (${pct}%)`;

        const list = document.getElementById('detailCardSessionsList');
        list.innerHTML = '';
        if (info.sessions.length === 0) {
          list.innerHTML = `<div class="text-xs text-slate-500 col-span-2">Chưa có phiên học nào trong ngày này.</div>`;
          return;
        }
        info.sessions.forEach(s => {
          const subjs = s.subjectIds.map(sid => {
            const st = state.subjects.find(x => x.id === sid);
            return st ? `${st.icon} ${st.name}` : '';
          }).filter(Boolean).join(' + ');
          const div = document.createElement('div');
          div.className = 'p-2.5 rounded-lg bg-[#0b1017] border border-[#151f2c] text-xs space-y-1';
          div.innerHTML = `
            <div class="flex justify-between font-semibold text-white">
              <span>${escapeHtml(subjs)} • <span class="text-[#22d3ee]">${escapeHtml(s.topic || '')}</span></span>
              <span class="font-mono text-[#22d3ee]">${getSessionMinutes(s)}m (${getValidFocusScore(s) === null ? '—' : `${getValidFocusScore(s)}★`})</span>
            </div>
            <div class="text-slate-400">✅ ${escapeHtml(s.note || s.goal || 'Completed')}</div>
          `;
          list.appendChild(div);
        });
      }

      // ==================== VIEW 6, 7, 8, 9: TASKS, MILESTONES, RESOURCES, NEURO, SETUP ====================
      function renderTasksAndMilestonesView() {
        const msContainer = document.getElementById('milestonesListContainer');
        if (msContainer) {
          msContainer.innerHTML = '';
          state.milestones.forEach(ms => {
            const subj = state.subjects.find(s => s.id === ms.subjectId) || state.subjects[0];
            const pct = Math.min(100, Math.round((ms.current / Math.max(1, ms.target)) * 100));
            const div = document.createElement('div');
            div.className = 'sf-inner p-3.5 space-y-2 text-xs';
            div.innerHTML = `
              <div class="flex items-start justify-between gap-2">
                <div>
                  <span class="px-2 py-0.5 rounded bg-[#14202e] text-slate-300 text-[10px]">${escapeHtml(subj.icon)} ${escapeHtml(subj.name)} • Due: ${escapeHtml(ms.deadline)}</span>
                  <div class="font-bold text-white mt-1">${escapeHtml(ms.title)}</div>
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" data-ms-inc="${ms.id}" class="px-2 py-1 rounded bg-[#0c2631] text-[#22d3ee] font-bold text-[11px]">+${ms.type === 'minutes' ? '25' : '1'}</button>
                  <button type="button" data-ms-del="${ms.id}" class="px-1.5 text-slate-500 hover:text-rose-400">✕</button>
                </div>
              </div>
              <div class="flex justify-between text-[11px] text-slate-400">
                <span>Progress</span>
                    <span class="font-mono text-white font-bold">${ms.current} / ${ms.target} ${escapeHtml(ms.unit)} (${pct}%)</span>
              </div>
              <div class="w-full h-1.5 bg-[#141f2d] rounded-full overflow-hidden">
                <div class="h-full bg-[#22d3ee]" style="width:${pct}%"></div>
              </div>
            `;
            msContainer.appendChild(div);
          });

          msContainer.querySelectorAll('button[data-ms-inc]').forEach(btn => {
            btn.addEventListener('click', () => {
              const ms = state.milestones.find(x => x.id === btn.getAttribute('data-ms-inc'));
              if (!ms) return;
              ms.current = Math.min(ms.target, ms.current + (ms.type === 'minutes' ? 25 : 1));
              saveState();
              refreshAllViews();
              showToast(`Đã cập nhật cột mốc "${ms.title}"!`, '🏆');
            });
          });
          msContainer.querySelectorAll('button[data-ms-del]').forEach(btn => {
            btn.addEventListener('click', () => {
              state.milestones = state.milestones.filter(x => x.id !== btn.getAttribute('data-ms-del'));
              saveState();
              refreshAllViews();
            });
          });
        }

        // Resources
        const resContainer = document.getElementById('resourcesListContainer');
        if (resContainer) {
          resContainer.innerHTML = '';
          state.resources.forEach(res => {
            const subj = state.subjects.find(s => s.id === res.subjectId) || state.subjects[0];
            const pct = Math.min(100, Math.round((res.completed / Math.max(1, res.total)) * 100));
            const div = document.createElement('div');
            div.className = 'sf-inner p-3.5 space-y-2 text-xs';
            div.innerHTML = `
              <div class="flex items-start justify-between gap-2">
                <div>
                  <span class="px-2 py-0.5 rounded bg-[#14202e] text-[#22d3ee] font-semibold text-[10px]">${escapeHtml(res.type)} • ${escapeHtml(subj.icon)} ${escapeHtml(subj.name)}</span>
                  <div class="font-bold text-white mt-1">${escapeHtml(res.name)}</div>
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" data-res-study="${res.id}" class="sf-btn-primary px-2 py-1 text-[10px]">▶ Học</button>
                  <button type="button" data-res-inc="${res.id}" class="sf-btn-secondary px-2 py-1 text-[10px]">+1</button>
                  <button type="button" data-res-del="${res.id}" class="px-1 text-slate-500 hover:text-rose-400">✕</button>
                </div>
              </div>
              <div class="flex justify-between text-[11px] text-slate-400">
                <span>Completed: <strong class="text-white font-mono">${res.completed}/${res.total} (${pct}%)</strong></span>
                <span>Accuracy: <strong class="text-[#22d3ee] font-mono">${res.accuracy}%</strong></span>
              </div>
              <div class="w-full h-1.5 bg-[#141f2d] rounded-full overflow-hidden">
                <div class="h-full bg-[#22d3ee]" style="width:${pct}%"></div>
              </div>
            `;
            resContainer.appendChild(div);
          });

          resContainer.querySelectorAll('button[data-res-inc]').forEach(btn => {
            btn.addEventListener('click', () => {
              const r = state.resources.find(x => x.id === btn.getAttribute('data-res-inc'));
              if (!r) return;
              r.completed = Math.min(r.total, r.completed + 1);
              saveState();
              refreshAllViews();
            });
          });
          resContainer.querySelectorAll('button[data-res-study]').forEach(btn => {
            btn.addEventListener('click', () => {
              const r = state.resources.find(x => x.id === btn.getAttribute('data-res-study'));
              if (!r) return;
              state.selectedSubjectIds = [r.subjectId];
              document.getElementById('sessionTopicInput').value = r.name;
              document.getElementById('sessionNoteInput').value = `Luyện tập trên ${r.name}`;
              renderSubjects();
              switchView('timer');
            });
          });
          resContainer.querySelectorAll('button[data-res-del]').forEach(btn => {
            btn.addEventListener('click', () => {
              state.resources = state.resources.filter(x => x.id !== btn.getAttribute('data-res-del'));
              saveState();
              refreshAllViews();
            });
          });
        }
      }

      function updateMilestonesProgress(subjectIds, minutesAdded, outputCountAdded) {
        const subjectShares = [...new Set(subjectIds)].filter(id => state.subjects.some(subject => subject.id === id));
        if (!subjectShares.length) return;
        const minutesPerSubject = (Number(minutesAdded) || 0) / subjectShares.length;
        const outputPerSubject = (Number(outputCountAdded) || 0) / subjectShares.length;
        state.milestones.forEach(ms => {
          if (!subjectShares.includes(ms.subjectId) || ms.current >= ms.target) return;
          if (ms.type === 'minutes') ms.current = Math.min(ms.target, ms.current + minutesPerSubject);
          else if (ms.type === 'sessions') ms.current = Math.min(ms.target, ms.current + 1);
          else if (ms.type === 'output') ms.current = Math.min(ms.target, ms.current + outputPerSubject);
        });
      }

      // ==================== VIEW 7: ASSESSMENTS & NEURO RENDERER ====================
      const SR_INTERVALS = [1, 3, 7, 14, 30];

      function renderAssessmentsAndNeuro() {
        const srList = document.getElementById('spacedRepetitionList');
        let dueCount = 0;
        state.spacedItems.forEach(it => { if (it.nextReviewDate <= TODAY_KEY) dueCount++; });
        document.getElementById('navBadgeSr').textContent = String(dueCount);

        if (srList) {
          srList.innerHTML = '';
          state.spacedItems.forEach(item => {
            const subj = state.subjects.find(s => s.id === item.subjectId) || state.subjects[0];
            const isDue = item.nextReviewDate <= TODAY_KEY;
            const iv = SR_INTERVALS[Math.min(item.stageIndex, SR_INTERVALS.length - 1)];
            const div = document.createElement('div');
            div.className = `sf-inner p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${isDue ? 'border-amber-500/40' : ''}`;
            div.innerHTML = `
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-[#14202e] text-white font-semibold text-[10px]">${escapeHtml(subj.icon)} ${escapeHtml(subj.name)}</span>
                  <span class="text-[11px] font-mono ${isDue ? 'text-amber-400 font-bold' : 'text-[#22d3ee]'}">${isDue ? '🔔 Due Today' : `Next: ${item.nextReviewDate}`} (+${iv}d)</span>
                </div>
                <div class="font-bold text-white">${escapeHtml(item.topic)}</div>
                <div class="text-slate-400">❓ ${escapeHtml(item.question || 'Active Recall')}</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" data-sr-act="good" data-sr-id="${item.id}" class="sf-btn-primary px-2.5 py-1 text-[11px]">✓ Nhớ rõ</button>
                <button type="button" data-sr-act="fuzzy" data-sr-id="${item.id}" class="sf-btn-secondary px-2 py-1 text-[11px] text-amber-300">~ Mờ nhớ</button>
                <button type="button" data-sr-act="reset" data-sr-id="${item.id}" class="sf-btn-secondary px-2 py-1 text-[11px]">↺</button>
              </div>
            `;
            srList.appendChild(div);
          });

          srList.querySelectorAll('button[data-sr-act]').forEach(btn => {
            btn.addEventListener('click', () => {
              const it = state.spacedItems.find(x => x.id === btn.getAttribute('data-sr-id'));
              if (!it) return;
              if (btn.getAttribute('data-sr-act') === 'good') {
                it.stageIndex = Math.min(it.stageIndex + 1, SR_INTERVALS.length - 1);
                it.nextReviewDate = addDays(TODAY_KEY, SR_INTERVALS[it.stageIndex]);
                showToast(`Đã chuyển sang mốc ôn tập +${SR_INTERVALS[it.stageIndex]} ngày!`, '🧠');
              } else if (btn.getAttribute('data-sr-act') === 'fuzzy') {
                it.stageIndex = Math.max(0, it.stageIndex - 1);
                it.nextReviewDate = addDays(TODAY_KEY, SR_INTERVALS[it.stageIndex]);
                showToast(`Đã lùi lịch ôn về +${SR_INTERVALS[it.stageIndex]} ngày.`, '🟠');
              } else {
                it.stageIndex = 0;
                it.nextReviewDate = addDays(TODAY_KEY, 1);
              }
              saveState();
              refreshAllViews();
            });
          });
        }

        // Weak Areas
        const weakContainer = document.getElementById('weakAreasListContainer');
        if (weakContainer) {
          weakContainer.innerHTML = '';
          state.weakAreas.forEach(w => {
            const subj = state.subjects.find(s => s.id === w.subjectId) || state.subjects[0];
            const div = document.createElement('div');
            div.className = 'sf-inner p-3 flex items-center justify-between gap-2 text-xs';
            div.innerHTML = `
              <div>
                <span class="text-[10px] text-rose-400 font-bold uppercase">${escapeHtml(subj.icon)} ${escapeHtml(subj.name)} • Mastery ${w.accuracy}%</span>
                <div class="font-bold text-white mt-0.5">${escapeHtml(w.subtopic)}</div>
                <div class="text-[11px] text-slate-400">🛠️ ${escapeHtml(w.action)}</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" data-weak-rem="${w.id}" class="sf-btn-secondary px-2.5 py-1 text-[11px] text-[#22d3ee]">🛠️ Khắc phục</button>
                <button type="button" data-weak-del="${w.id}" class="text-slate-500 hover:text-emerald-400 px-1.5">✓</button>
              </div>
            `;
            weakContainer.appendChild(div);
          });
          weakContainer.querySelectorAll('button[data-weak-rem]').forEach(btn => {
            btn.addEventListener('click', () => remediateWeakArea(btn.getAttribute('data-weak-rem')));
          });
          weakContainer.querySelectorAll('button[data-weak-del]').forEach(btn => {
            btn.addEventListener('click', () => {
              state.weakAreas = state.weakAreas.filter(x => x.id !== btn.getAttribute('data-weak-del'));
              saveState();
              refreshAllViews();
              showToast('Đã hoàn thành khắc phục điểm yếu!', '🎉');
            });
          });
        }

        // Checkpoints
        const cpContainer = document.getElementById('checkpointsListContainer');
        if (cpContainer) {
          cpContainer.innerHTML = '';
          state.checkpoints.forEach(cp => {
            const div = document.createElement('div');
            div.className = 'sf-inner p-3 flex items-center justify-between gap-2 text-xs';
            div.innerHTML = `
              <div>
                <div class="font-mono text-[11px] text-[#22d3ee]">📅 ${cp.date}</div>
                <div class="font-bold text-white">${escapeHtml(cp.name)}</div>
                <div class="text-[11px] text-slate-400">${escapeHtml(cp.score)}</div>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" data-cp-tog="${cp.id}" class="sf-btn-secondary px-2 py-1 text-[10px]">${cp.done ? '✓ Done' : 'Mark Done'}</button>
                <button type="button" data-cp-del="${cp.id}" class="text-slate-500 hover:text-rose-400 px-1">✕</button>
              </div>
            `;
            cpContainer.appendChild(div);
          });
          cpContainer.querySelectorAll('button[data-cp-tog]').forEach(btn => {
            btn.addEventListener('click', () => {
              const cp = state.checkpoints.find(x => x.id === btn.getAttribute('data-cp-tog'));
              if (cp) cp.done = !cp.done;
              saveState();
              refreshAllViews();
            });
          });
          cpContainer.querySelectorAll('button[data-cp-del]').forEach(btn => {
            btn.addEventListener('click', () => {
              state.checkpoints = state.checkpoints.filter(x => x.id !== btn.getAttribute('data-cp-del'));
              saveState();
              refreshAllViews();
            });
          });
        }

        // RPE rewards are separate from study-hour XP and ranking.
        document.getElementById('lootTicketsBadge').textContent = `${state.lootTickets} Tickets`;
        renderRpeRewardsEditor();

      }

      // ==================== VIEW 8: STUDY SESSIONS TABLE ====================
      function renderSessionsLog() {
        const tbody = document.getElementById('sessionHistoryTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const recent = [...state.sessions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 80);
        recent.forEach(sess => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-[#0f1620] transition';
          const subjTags = sess.subjectIds.map(sid => {
            const s = state.subjects.find(x => x.id === sid);
            return s ? `${s.icon} ${s.name}` : '';
          }).filter(Boolean).join(', ');
          const focus = getValidFocusScore(sess);
          const stars = focus === null ? '—' : '★'.repeat(focus);
          tr.innerHTML = `
            <td class="py-2.5 px-3 font-mono text-slate-300">${escapeHtml(sess.date)}<div class="text-[10px] text-slate-500">${escapeHtml(sess.protocolLabel || 'Deep Work')}</div></td>
            <td class="py-2.5 px-3"><div class="text-white font-semibold">${escapeHtml(subjTags)}</div><div class="text-[#22d3ee] text-[11px]">${escapeHtml(sess.topic || '')}</div></td>
            <td class="py-2.5 px-3"><div class="text-slate-400 text-[11px]">🎯 ${escapeHtml(sess.goal || '—')}</div><div class="text-slate-200">✅ ${escapeHtml(sess.note || '')}</div></td>
            <td class="py-2.5 px-3"><div class="text-amber-400 font-mono">${stars}</div><div class="text-[11px] text-slate-400">${escapeHtml(sess.blocker || 'Không')}</div></td>
            <td class="py-2.5 px-3 text-slate-300">${escapeHtml(sess.nextStep || '—')}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-[#22d3ee]">${sess.minutes}m</td>
            <td class="py-2.5 px-3 text-right"><button type="button" data-del-sess="${sess.id}" class="text-slate-500 hover:text-rose-400">✕</button></td>
          `;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('button[data-del-sess]').forEach(btn => {
          btn.addEventListener('click', () => {
            state.sessions = state.sessions.filter(x => x.id !== btn.getAttribute('data-del-sess'));
            saveState();
            refreshAllViews();
          });
        });
      }

      // ==================== VIEW 9: PLANNING SETUP (ONBOARDING) ====================
      function renderPlanningSetup() {
        document.getElementById('onboardExamName').value = state.onboarding.examName || '';
        document.getElementById('onboardExamType').value = state.onboarding.examType || '';
        document.getElementById('onboardExamDate').value = state.onboarding.examDate || '';
        document.getElementById('onboardPhaseSelect').value = state.onboarding.phase || 'intensive';

        const boList = document.getElementById('blackoutDatesList');
        if (boList) {
          boList.innerHTML = '';
          state.onboarding.blackoutDates.forEach(d => {
            const span = document.createElement('span');
            span.className = 'px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/50 text-rose-300 text-[11px] inline-flex items-center gap-1';
            span.innerHTML = `<span>🚫 ${d}</span><button type="button" data-del-bo="${d}" class="hover:text-white">✕</button>`;
            boList.appendChild(span);
          });
          boList.querySelectorAll('button[data-del-bo]').forEach(btn => {
            btn.addEventListener('click', () => {
              state.onboarding.blackoutDates = state.onboarding.blackoutDates.filter(x => x !== btn.getAttribute('data-del-bo'));
              saveState();
              refreshAllViews();
            });
          });
        }

        const availGrid = document.getElementById('availabilityGrid');
        if (availGrid) {
          availGrid.innerHTML = '';
          let sum = 0;
          WEEKDAY_LABELS.forEach((lbl, idx) => {
            const val = Number(state.onboarding.availability[idx]) || 0;
            sum += val;
            const d = document.createElement('div');
            d.className = 'sf-inner p-2.5 flex flex-col items-center';
            d.innerHTML = `
              <span class="text-[11px] font-bold text-slate-400 mb-1.5">${lbl}</span>
              <input type="number" min="0" max="600" step="15" data-avail-idx="${idx}" value="${val}" class="sf-input w-full py-1 text-center font-mono text-xs text-[#22d3ee]" />
              <span class="text-[10px] text-slate-500 mt-1">phút</span>
            `;
            availGrid.appendChild(d);
          });
          document.getElementById('weeklyCapacitySummary').textContent = `${sum} phút/tuần (${(sum / 60).toFixed(1)}h)`;
          availGrid.querySelectorAll('input[data-avail-idx]').forEach(inp => {
            inp.addEventListener('change', () => {
              const i = Number(inp.getAttribute('data-avail-idx'));
              state.onboarding.availability[i] = boundedNumber(inp.value, 0, 0, 600);
              saveState();
              renderPlanningSetup();
            });
          });
        }
      }

      function autoGenerateWeeklyPlan() {
        let count = 0;
        if (!state.subjects.length) { showToast('Hãy thêm ít nhất một môn học trước khi lập kế hoạch.', '⚠️'); return; }
        for (let d = 0; d < 7; d++) {
          const targetDate = addDays(TODAY_KEY, d);
          if (state.onboarding.blackoutDates.includes(targetDate)) continue;
          const dow = getDayOfWeekIndex(targetDate);
          const avail = Number(state.onboarding.availability[dow]) || 0;
          const existingTasks = state.plannedTasks.filter(t => t.date === targetDate && t.status !== 'completed');
          const existing = existingTasks.reduce((a, b) => a + (Number(b.plannedMinutes) || 50), 0);
          let rem = avail - existing;
          let slot = 0;
          while (rem >= 50) {
            const dueReview = state.spacedItems.find(item => item.nextReviewDate && item.nextReviewDate <= targetDate
              && !state.plannedTasks.some(task => task.topic === item.topic && task.date >= targetDate));
            const dueMilestone = state.milestones.filter(m => m.deadline && m.deadline <= addDays(targetDate, 14) && m.current < m.target)
              .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
            const preferredSubjectId = dueReview?.subjectId || dueMilestone?.subjectId;
            const subjectLoad = state.subjects.map(subject => ({
              subject,
              minutes: state.plannedTasks.filter(task => task.date === targetDate && task.status !== 'completed' && task.subjectId === subject.id)
                .reduce((sum, task) => sum + (Number(task.plannedMinutes) || 50), 0)
            })).sort((a, b) => a.minutes - b.minutes);
            const subj = state.subjects.find(subject => subject.id === preferredSubjectId) || subjectLoad[0].subject;
            const topic = dueReview?.topic || dueMilestone?.title || `Học ${subj.name}`;
            const goal = dueReview ? `Ôn tập đến hạn: ${dueReview.question || dueReview.topic}`
              : dueMilestone ? `Tiến độ mục tiêu: ${dueMilestone.title}` : `Tiến tới mục tiêu môn ${subj.name}`;
            state.plannedTasks.push({
              id: createId('auto'),
              subjectId: subj.id,
              topic,
              goal,
              date: targetDate,
              plannedMinutes: 50,
              status: 'pending',
              rescheduled: false
            });
            rem -= 50;
            slot++;
            count++;
          }
        }
        saveState();
        refreshAllViews();
        showToast(`Đã tự động lập ${count} phiên học mới cho tuần này!`, '✨');
      }

      // ==================== VIEW 10: ANALYTICS (PLANNED VS ACTUAL) ====================
      let pvaChart = null;
      let wtChart = null;
      let subjPieChart = null;
      let dailyBarChart = null;

      function renderAnalytics() {
        const rangeDays = currentAnalyticsRange === 'day' ? 1 : (currentAnalyticsRange === 'week' ? 7 : 30);
        const startCut = addDays(TODAY_KEY, -(rangeDays - 1));
        const rSessions = state.sessions.filter(s => s.date >= startCut && s.date <= TODAY_KEY);
        const rPlanned = state.plannedTasks.filter(p => p.date >= startCut && p.date <= TODAY_KEY);

        const actualMins = rSessions.reduce((sum, session) => sum + getSessionMinutes(session), 0);
        const plannedMins = rPlanned.reduce((a, p) => a + (Number(p.plannedMinutes) || 50), 0);
        const completedPlans = rPlanned.filter(plan => plan.status === 'completed').length;
        const compPct = rPlanned.length > 0 ? Math.round((completedPlans / rPlanned.length) * 100) : null;

        document.getElementById('statWeeklyCompletionRate').textContent = compPct === null ? '—' : `${compPct}%`;
        document.getElementById('statPlannedVsActualMinutesSub').textContent = `${actualMins} / ${plannedMins} phút`;
        document.getElementById('statScheduledVsCompleted').textContent = `${completedPlans} / ${rPlanned.length}`;

        const missedCount = state.plannedTasks.filter(t => t.status === 'pending' && t.date < TODAY_KEY).length;
        document.getElementById('statMissedSessionsSub').textContent = `${missedCount} phiên trễ`;

        const avgFocus = getAverageFocus(rSessions);
        const avgF = avgFocus === null ? '—' : avgFocus.toFixed(2);
        const effMins = rSessions.reduce((sum, session) => {
          const focus = getValidFocusScore(session);
          return focus === null ? sum : sum + getSessionMinutes(session) * (focus / 5);
        }, 0);
        document.getElementById('statAvgFocusScore').textContent = avgFocus === null ? '—' : `${avgF} ★`;
        document.getElementById('statEffectiveHoursSub').textContent = `Giờ thực chất: ${(effMins / 60).toFixed(1)}h`;

        const subjActual = Object.fromEntries(state.subjects.map(s => [s.id, 0]));
        const subjPlanned = Object.fromEntries(state.subjects.map(s => [s.id, 0]));
        const topicRows = new Map();
        const keyFor = (sid, topic) => `${sid}|${(topic || 'Chủ đề chung').trim().toLocaleLowerCase()}`;
        const getTopicRow = (sid, topic) => {
          const label = (topic || 'Chủ đề chung').trim() || 'Chủ đề chung';
          const key = keyFor(sid, label);
          if (!topicRows.has(key)) topicRows.set(key, { subjectId: sid, topic: label, planned: 0, actual: 0, focusSum: 0, focusCount: 0 });
          return topicRows.get(key);
        };
        rPlanned.forEach(p => {
          const mins = Number(p.plannedMinutes) || 50;
          subjPlanned[p.subjectId] = (subjPlanned[p.subjectId] || 0) + mins;
          getTopicRow(p.subjectId, p.topic).planned += mins;
        });
        rSessions.forEach(sess => {
          const ids = Array.isArray(sess.subjectIds) && sess.subjectIds.length ? sess.subjectIds : [''];
          const share = (Number(sess.minutes) || 0) / ids.length;
          ids.forEach(sid => {
            subjActual[sid] = (subjActual[sid] || 0) + share;
            const row = getTopicRow(sid, sess.topic);
            row.actual += share;
            const focus = getValidFocusScore(sess);
            if (focus !== null) {
              row.focusSum += focus;
              row.focusCount += 1;
            }
          });
        });

        let underSubj = null;
        let minDelta = 999999;
        state.subjects.forEach(s => {
          const d = (subjActual[s.id] || 0) - (subjPlanned[s.id] || 0);
          if (d < minDelta) { minDelta = d; underSubj = s; }
        });

        if (underSubj && minDelta < -20) {
          document.getElementById('statImbalanceAlert').textContent = `Thiếu: ${underSubj.icon} ${underSubj.name}`;
          document.getElementById('statImbalanceSub').textContent = `${minDelta} phút so với kế hoạch`;
        } else {
          document.getElementById('statImbalanceAlert').textContent = '✅ Cân đối';
          document.getElementById('statImbalanceSub').textContent = 'Đúng tiến độ phân bổ';
        }

        const tbody = document.getElementById('subjectBalanceTableBody');
        tbody.innerHTML = '';
        [...topicRows.values()].forEach(row => {
          const s = state.subjects.find(item => item.id === row.subjectId);
          const p = Math.round(row.planned);
          const a = Math.round(row.actual);
          const d = a - p;
          const f = row.focusCount > 0 ? (row.focusSum / row.focusCount).toFixed(1) + '★' : '—';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="py-2 px-2.5"><div class="font-bold text-white">${s ? `${escapeHtml(s.icon)} ${escapeHtml(s.name)}` : 'Môn đã xóa'}</div><div class="text-[10px] text-slate-500">${escapeHtml(row.topic)}</div></td>
            <td class="py-2 px-2.5 text-right font-mono text-slate-400">${p}m</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-white">${a}m</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold ${d >= 0 ? 'text-[#22d3ee]' : 'text-amber-400'}">${d >= 0 ? `+${d}m` : `${d}m`}</td>
            <td class="py-2 px-2.5 text-right font-mono text-[#22d3ee]">${f}</td>
          `;
          tbody.appendChild(tr);
        });

        if (activeView !== 'analytics') return;

        const ctx1 = document.getElementById('plannedVsActualChartCanvas').getContext('2d');
        if (pvaChart) pvaChart.destroy();
        pvaChart = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: state.subjects.map(s => `${s.icon} ${s.name.slice(0, 12)}`),
            datasets: [
              { label: 'Planned (m)', data: state.subjects.map(s => subjPlanned[s.id] || 0), backgroundColor: '#1e293b', borderRadius: 4 },
              { label: 'Actual (m)', data: state.subjects.map(s => subjActual[s.id] || 0), backgroundColor: '#22d3ee', borderRadius: 4 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
              y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#151f2c' } }
            },
            plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } }
          }
        });

        const wLabels = [];
        const wActual = [];
        const wTarget = [];
        const wBase = state.onboarding.availability.reduce((a, b) => a + (Number(b) || 0), 0);
        const trendWeeks = Number(document.getElementById('analyticsTrendWeeks')?.value) || 8;
        for (let w = trendWeeks - 1; w >= 0; w--) {
          const wEnd = addDays(TODAY_KEY, -w * 7);
          const wStart = addDays(wEnd, -6);
          wLabels.push(`W-${w}`);
          wActual.push(state.sessions.filter(s => s.date >= wStart && s.date <= wEnd).reduce((a, b) => a + (Number(b.minutes) || 0), 0));
          wTarget.push(wBase);
        }
        const ctx2 = document.getElementById('weeklyTrendChartCanvas').getContext('2d');
        if (wtChart) wtChart.destroy();
        wtChart = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: wLabels,
            datasets: [
              { label: 'Actual (m)', data: wActual, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.12)', fill: true, tension: 0.35 },
              { label: 'Target (m)', data: wTarget, borderColor: '#f59e0b', borderDash: [4, 4], fill: false }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
              y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#151f2c' } }
            },
            plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } }
          }
        });

        const ctx3 = document.getElementById('subjectChartCanvas').getContext('2d');
        if (subjPieChart) subjPieChart.destroy();
        subjPieChart = new Chart(ctx3, {
          type: 'doughnut',
          data: {
            labels: state.subjects.map(s => `${s.icon} ${s.name}`),
            datasets: [{ data: state.subjects.map(s => subjActual[s.id] || 0), backgroundColor: state.subjects.map(s => s.color), borderColor: '#0b1017', borderWidth: 2 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 10 } } } } }
        });

        const dLabels = [];
        const dVals = [];
        for (let d = 13; d >= 0; d--) {
          const dk = addDays(TODAY_KEY, -d);
          dLabels.push(dk.slice(8));
          dVals.push(state.sessions.filter(s => s.date === dk).reduce((a, b) => a + (Number(b.minutes) || 0), 0));
        }
        const ctx4 = document.getElementById('dailyTrendChartCanvas').getContext('2d');
        if (dailyBarChart) dailyBarChart.destroy();
        dailyBarChart = new Chart(ctx4, {
          type: 'bar',
          data: { labels: dLabels, datasets: [{ data: dVals, backgroundColor: '#22d3ee', borderRadius: 3 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
              y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: '#151f2c' } }
            },
            plugins: { legend: { display: false } }
          }
        });
      }

      // ==================== COMPLETE POMODORO MODAL ====================
      let pendingCompletedMinutes = 50;
      let pendingBreakAfterCompletion = null;
      let completionSaved = false;

      function openCompletePomodoroModal(mins, breakAfterCompletion = null) {
        refreshTodayKey();
        completionSaved = false;
        pendingCompletedMinutes = mins;
        pendingBreakAfterCompletion = ['short', 'long'].includes(breakAfterCompletion) ? breakAfterCompletion : null;
        try {
          localStorage.setItem(PENDING_COMPLETION_KEY, JSON.stringify({
            minutes: mins, createdAt: Date.now(), linkedPlanId: activeLinkedPlanId,
            breakAfterCompletion: pendingBreakAfterCompletion,
            subjectIds: [...state.selectedSubjectIds], topic: document.getElementById('sessionTopicInput').value,
            goal: document.getElementById('sessionNoteInput').value,
            outputCount: document.getElementById('sessionTargetCountInput').value,
            outputUnit: document.getElementById('sessionTargetUnitSelect').value
          }));
        } catch (error) { console.error('Tflow could not preserve a pending completed session.', error); }
        const modal = document.getElementById('modalCompletePomodoro');
        document.getElementById('modalCompleteSubtext').textContent = `+${Math.round(mins)} phút học thực tế • +${(mins / 60).toFixed(2)} giờ XP & +1 vé thưởng`;
        const list = document.getElementById('modalCompleteSubjectsList');
        list.innerHTML = '';
        state.selectedSubjectIds.forEach(sid => {
          const s = state.subjects.find(x => x.id === sid);
          if (!s) return;
          const sp = document.createElement('span');
          sp.className = 'px-2 py-0.5 rounded bg-[#0c2631] text-[#22d3ee] text-xs font-semibold';
          sp.textContent = `${s.icon} ${s.name}`;
          list.appendChild(sp);
        });
        const topic = document.getElementById('sessionTopicInput').value.trim() || 'Chủ đề chung';
        const goal = document.getElementById('sessionNoteInput').value.trim();
        document.getElementById('modalCompleteTopicLabel').textContent = topic;
        document.getElementById('modalActiveRecallInput').value = goal ? `Hoàn thành: ${goal}` : '';
        const plannedOutput = Number(document.getElementById('sessionTargetCountInput').value);
        document.getElementById('modalActualOutputCount').value = Number.isFinite(plannedOutput) && plannedOutput >= 0 ? plannedOutput : 0;
        document.getElementById('modalActualOutputUnit').textContent = document.getElementById('sessionTargetUnitSelect').value || 'bài';
        document.getElementById('modalFocusScoreSelect').value = '';
        document.getElementById('modalNextStepInput').value = '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }

      function saveCompletedPomodoro() {
        if (completionSaved) return;
        completionSaved = true;
        const previousState = JSON.parse(JSON.stringify(state));
        const linkedPlanId = activeLinkedPlanId;
        const topic = document.getElementById('sessionTopicInput').value.trim() || 'Chủ đề học tập';
        const goal = document.getElementById('sessionNoteInput').value.trim() || 'Hoàn thành phiên học';
        const note = document.getElementById('modalActiveRecallInput').value.trim() || goal;
        const outCount = boundedNumber(document.getElementById('modalActualOutputCount').value, 0, 0, 500);
        const outUnit = document.getElementById('sessionTargetUnitSelect').value || 'bài';
        const focusScoreValue = document.getElementById('modalFocusScoreSelect').value;
        const focusScore = focusScoreValue === '' ? null : Number(focusScoreValue);
        const blocker = document.getElementById('modalBlockerSelect').value || 'Không gián đoạn';
        const nextStep = document.getElementById('modalNextStepInput').value.trim();

        state.sessions.push({
          id: createId('session'),
          planId: activeLinkedPlanId || null,
          date: TODAY_KEY,
          minutes: Math.round(pendingCompletedMinutes),
          subjectIds: [...state.selectedSubjectIds],
          topic,
          goal,
          note,
          outputCount: outCount,
          outputUnit: outUnit,
          protocolLabel: activeLinkedPlanId ? `Plan Timer ${Math.round(totalSeconds / 60)}m` : (state.protocol.label || 'Deep Work'),
          focusScore,
          blocker,
          nextStep,
          timestamp: Date.now()
        });
        state.lootTickets += 1;

        if (activeLinkedPlanId) {
          const linked = state.plannedTasks.find(t => t.id === activeLinkedPlanId);
          if (linked) linked.status = 'completed';
          activeLinkedPlanId = null;
          document.getElementById('activePlanLinkedBadge').classList.add('hidden');
        }

        updateMilestonesProgress(state.selectedSubjectIds, pendingCompletedMinutes, outCount);

        if (blocker === 'Bài khó / Kẹt ý tưởng' || (focusScore !== null && focusScore <= 2)) {
          state.weakAreas.unshift({
            id: createId('weak'),
            subtopic: topic,
            subjectId: state.selectedSubjectIds[0] || state.subjects[0].id,
            accuracy: focusScore === null ? 0 : focusScore * 15,
            action: nextStep || `Ôn lại lý thuyết & giải lại bài tập ${topic}`,
            status: 'active'
          });
        }

        if (nextStep) {
          state.zeigarnikHook = nextStep;
        }

        if (document.getElementById('chkAddToSpacedRep').checked) {
          state.spacedItems.unshift({
            id: createId('review'),
            topic: `${topic}: ${note}`,
            question: `Trình bày lại cách giải / ý chính của "${topic}" không nhìn tài liệu.`,
            subjectId: state.selectedSubjectIds[0] || state.subjects[0].id,
            createdDate: TODAY_KEY,
            stageIndex: 0,
            nextReviewDate: addDays(TODAY_KEY, 1)
          });
        }

        const sessionSaved = saveState();
        if (!sessionSaved) {
          state = previousState;
          activeLinkedPlanId = linkedPlanId;
          completionSaved = false;
          document.getElementById('activePlanLinkedBadge').classList.toggle('hidden', !activeLinkedPlanId);
          showToast('Không lưu được phiên học trên thiết bị. Phiên vẫn đang chờ; hãy kiểm tra dung lượng rồi bấm lưu lại.', '⚠️');
          return;
        }
        try { localStorage.removeItem(PENDING_COMPLETION_KEY); } catch (_) {}
        document.getElementById('modalCompletePomodoro').classList.add('hidden');
        document.getElementById('modalCompletePomodoro').classList.remove('flex');
        const nextBreak = pendingBreakAfterCompletion;
        pendingBreakAfterCompletion = null;
        if (nextBreak) {
          setTimerMode(nextBreak);
        } else if (cycleCount >= 4) { cycleCount = 1; setTimerMode('long'); }
        else { cycleCount++; setTimerMode('short'); }
        refreshAllViews();
        const shownMinutes = Number.isInteger(pendingCompletedMinutes) ? String(pendingCompletedMinutes) : pendingCompletedMinutes.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        showToast(`Đã lưu Session Intelligence (${shownMinutes}m${focusScore === null ? '' : ` • ${focusScore}★`})!`, '🎉');
      }

      function restorePendingCompletion() {
        try {
          const raw = localStorage.getItem(PENDING_COMPLETION_KEY);
          if (!raw) return;
          const pending = JSON.parse(raw);
          const minutes = boundedNumber(pending.minutes, 0, 0, 1440);
          if (!minutes) { localStorage.removeItem(PENDING_COMPLETION_KEY); return; }
          if (Array.isArray(pending.subjectIds)) {
            state.selectedSubjectIds = pending.subjectIds.filter(id => state.subjects.some(subject => subject.id === id));
            if (!state.selectedSubjectIds.length) state.selectedSubjectIds = [state.subjects[0].id];
          }
          document.getElementById('sessionTopicInput').value = String(pending.topic || '').slice(0, 200);
          document.getElementById('sessionNoteInput').value = String(pending.goal || '').slice(0, 500);
          document.getElementById('sessionTargetCountInput').value = String(pending.outputCount || 1);
          if ([...document.getElementById('sessionTargetUnitSelect').options].some(option => option.value === pending.outputUnit)) {
            document.getElementById('sessionTargetUnitSelect').value = pending.outputUnit;
          }
          activeLinkedPlanId = state.plannedTasks.some(task => task.id === pending.linkedPlanId) ? pending.linkedPlanId : null;
          renderSubjects();
          openCompletePomodoroModal(minutes, pending.breakAfterCompletion);
          showToast('Đã khôi phục phiên vừa hoàn tất. Lưu lại để nhận XP và vé thưởng.', '🔄');
        } catch (error) {
          console.error('Tflow could not restore a pending completed session.', error);
          try { localStorage.removeItem(PENDING_COMPLETION_KEY); } catch (_) {}
        }
      }

      function refreshAllViews() {
        refreshTodayKey();
        renderSubjects();
        updateGlobalChrome();
        // Render the visible view only. This keeps timer interactions and data entry
        // responsive even when the local history grows large.
        const renderers = {
          command: () => { renderCommandCenter(); renderHeatmap(); },
          today: renderTodayExecution,
          calendar: renderStudyCalendar,
          master: renderMasterPlan,
          timer: updateTimerUI,
          tasks: renderTasksAndMilestonesView,
          ranking: renderHokBaRanking,
          assessments: renderAssessmentsAndNeuro,
          sessions: renderSessionsLog,
          setup: renderPlanningSetup,
          analytics: renderAnalytics,
          settings: renderSubjects
        };
        const renderer = renderers[activeView];
        if (renderer) renderer();
      }

      // ==================== WIRE ALL EVENTS ====================
      function initEvents() {
        document.querySelectorAll('button[data-nav]').forEach(btn => {
          btn.addEventListener('click', () => switchView(btn.getAttribute('data-nav')));
        });

        document.getElementById('btnSidebarToggle').addEventListener('click', () => {
          const sb = document.getElementById('stepflowSidebar');
          sb.classList.toggle('hidden');
        });

        document.getElementById('topbarActiveTimerPill').addEventListener('click', () => switchView('timer'));

        // Quick Actions in Command Center
        document.getElementById('qaStartTimer').addEventListener('click', () => switchView('timer'));
        document.getElementById('qaViewToday').addEventListener('click', () => switchView('today'));
        document.getElementById('qaOpenCalendar').addEventListener('click', () => switchView('calendar'));
        document.getElementById('qaOpenNeuro').addEventListener('click', () => switchView('assessments'));
        document.getElementById('btnCmdViewToday').addEventListener('click', () => switchView('today'));
        document.getElementById('btnCmdGoMilestones').addEventListener('click', () => switchView('tasks'));
        document.getElementById('btnCmdGoWeakAreas').addEventListener('click', () => switchView('assessments'));
        const rankingShortcut = document.getElementById('btnCmdViewRanking');
        if (rankingShortcut) rankingShortcut.addEventListener('click', () => switchView('ranking'));
        document.getElementById('btnMpGoSetup').addEventListener('click', () => switchView('setup'));
        document.getElementById('btnTimerAddSubjectQuick').addEventListener('click', () => switchView('settings'));

        // Spread Across buttons
        ['btnCmdSpreadAcross', 'btnTodaySpreadAcross', 'btnCalSpreadAcross'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('click', executeSpreadAcross);
        });

        // Zeigarnik save
        document.getElementById('btnCmdSaveZeigarnik').addEventListener('click', () => {
          state.zeigarnikHook = document.getElementById('cmdZeigarnikInput').value.trim();
          saveState();
          showToast('Đã ghim bước tiếp theo (Zeigarnik Hook)!', '🪝');
        });

        // Today Execution buttons
        document.getElementById('btnTodayOpenAddTask').addEventListener('click', () => {
          document.getElementById('planDateInput').value = TODAY_KEY;
          document.getElementById('todayAddTaskDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCloseTodayAddTask').addEventListener('click', () => {
          document.getElementById('todayAddTaskDrawer').classList.add('hidden');
        });
        document.getElementById('btnSavePlannedTask').addEventListener('click', () => {
          const topic = document.getElementById('planTopicInput').value.trim();
          if (!topic) { showToast('Hãy nhập chủ đề!', '⚠️'); return; }
          const dateValue = document.getElementById('planDateInput').value || TODAY_KEY;
          if (!isValidDateKey(dateValue)) { showToast('Ngày học không hợp lệ.', '⚠️'); return; }
          if (dateValue < TODAY_KEY) { showToast('Nhiệm vụ mới không thể đặt vào ngày đã qua. Dùng Ghi bù Phiên học nếu bạn muốn lưu việc đã học.', '⚠️'); return; }
          const minutesValue = Number(document.getElementById('planMinutesInput').value);
          if (!Number.isFinite(minutesValue) || minutesValue < 15 || minutesValue > 1440) { showToast('Thời lượng phải từ 15 đến 1440 phút.', '⚠️'); return; }
          state.plannedTasks.push({
            id: createId('plan'),
            subjectId: document.getElementById('planSubjSelect').value,
            topic,
            goal: document.getElementById('planGoalInput').value.trim() || 'Hoàn thành phiên học',
            date: dateValue,
            plannedMinutes: Math.round(minutesValue),
            status: 'pending',
            rescheduled: false
          });
          document.getElementById('planTopicInput').value = '';
          document.getElementById('planGoalInput').value = '';
          document.getElementById('todayAddTaskDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
          showToast('Đã thêm nhiệm vụ vào kế hoạch!', '📅');
        });

        document.getElementById('btnTodayOpenFullTimer').addEventListener('click', () => switchView('timer'));
        document.getElementById('btnTodayMiniStart').addEventListener('click', toggleTimer);
        document.getElementById('btnTodayMiniReset').addEventListener('click', () => setTimerMode(timerMode));

        // Plan Filters
        [
          { id: 'planFilterAll', val: 'all' },
          { id: 'planFilterPending', val: 'pending' },
          { id: 'planFilterDone', val: 'done' }
        ].forEach(b => {
          document.getElementById(b.id).addEventListener('click', () => {
            currentPlanFilter = b.val;
            ['planFilterAll', 'planFilterPending', 'planFilterDone'].forEach(oid => {
              document.getElementById(oid).className = oid === b.id
                ? 'px-3 py-1 rounded-lg bg-[#0d2833] text-[#22d3ee] border border-[#164e63] font-semibold'
                : 'px-3 py-1 rounded-lg bg-[#0f1620] text-slate-400 hover:text-white';
            });
            renderTodayExecution();
          });
        });

        // Calendar Controls
        document.getElementById('calBtnWeekView').addEventListener('click', () => {
          calendarMode = 'week';
          document.getElementById('calBtnWeekView').className = 'px-3 py-1.5 rounded-lg font-semibold bg-[#1cc5dc] text-slate-950 transition';
          document.getElementById('calBtnMonthView').className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition';
          renderStudyCalendar();
        });
        document.getElementById('calBtnMonthView').addEventListener('click', () => {
          calendarMode = 'month';
          document.getElementById('calBtnMonthView').className = 'px-3 py-1.5 rounded-lg font-semibold bg-[#1cc5dc] text-slate-950 transition';
          document.getElementById('calBtnWeekView').className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition';
          renderStudyCalendar();
        });
        document.getElementById('calPrevBtn').addEventListener('click', () => {
          if (calendarMode === 'week') calendarOffsetWeeks--;
          else calendarOffsetMonths--;
          renderStudyCalendar();
        });
        document.getElementById('calNextBtn').addEventListener('click', () => {
          if (calendarMode === 'week') calendarOffsetWeeks++;
          else calendarOffsetMonths++;
          renderStudyCalendar();
        });
        document.getElementById('calTodayBtn').addEventListener('click', () => {
          calendarOffsetWeeks = 0;
          calendarOffsetMonths = 0;
          renderStudyCalendar();
        });
        document.getElementById('btnCalAutoGenWeek').addEventListener('click', autoGenerateWeeklyPlan);

        // Study Timer Controls
        document.getElementById('protocolSelect').addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === 'custom') {
            document.getElementById('modalPomodoroSettings').classList.remove('hidden');
            document.getElementById('modalPomodoroSettings').classList.add('flex');
          } else {
            const p = val.split('-').map(Number);
            state.protocol = { focus: p[0], short: p[1], long: p[2], label: `Pomodoro ${p[0]}/${p[1]}` };
            saveState();
            setTimerMode('focus');
          }
        });
        document.getElementById('modeBtnFocus').addEventListener('click', () => setTimerMode('focus'));
        document.getElementById('modeBtnShort').addEventListener('click', () => finishFocusEarly('short'));
        document.getElementById('modeBtnLong').addEventListener('click', () => finishFocusEarly('long'));
        document.getElementById('btnStartPause').addEventListener('click', toggleTimer);
        document.getElementById('btnResetTimer').addEventListener('click', () => setTimerMode(timerMode));
        document.getElementById('btnQuickComplete').addEventListener('click', () => {
          finishFocusEarly();
        });

        // Pomodoro Settings Modal
        const pomModal = document.getElementById('modalPomodoroSettings');
        ['btnOpenPomodoroSettings', 'btnOpenPomodoroSettingsTop'].forEach(id => {
          document.getElementById(id).addEventListener('click', () => {
            document.getElementById('inputFocusMin').value = state.protocol.focus;
            document.getElementById('inputShortBreakMin').value = state.protocol.short;
            document.getElementById('inputLongBreakMin').value = state.protocol.long;
            pomModal.classList.remove('hidden');
            pomModal.classList.add('flex');
          });
        });
        document.getElementById('btnClosePomodoroSettings').addEventListener('click', () => {
          pomModal.classList.add('hidden');
          pomModal.classList.remove('flex');
        });
        document.getElementById('btnSavePomodoroSettings').addEventListener('click', () => {
          state.protocol.focus = boundedNumber(document.getElementById('inputFocusMin').value, 50, 1, 180);
          state.protocol.short = boundedNumber(document.getElementById('inputShortBreakMin').value, 10, 1, 180);
          state.protocol.long = boundedNumber(document.getElementById('inputLongBreakMin').value, 20, 1, 180);
          saveState();
          setTimerMode(timerMode);
          pomModal.classList.add('hidden');
          pomModal.classList.remove('flex');
          showToast('Đã lưu cài đặt Pomodoro & Âm thanh!', '⚙️');
        });
        document.getElementById('audioPresetSelect').addEventListener('change', (e) => startBrainwaveAudio(e.target.value));
        document.getElementById('audioVolumeSlider').addEventListener('input', () => {
          const preset = document.getElementById('audioPresetSelect').value;
          if (preset !== 'off') startBrainwaveAudio(preset);
        });

        // Heatmap controls
        document.getElementById('heatmapLayerSelect').addEventListener('change', (e) => {
          state.heatmapConfig.layer = e.target.value;
          saveState();
          renderHeatmap();
        });
        document.getElementById('heatmapSubjectFilter').addEventListener('change', renderHeatmap);
        document.getElementById('heatmapPaletteSelect').addEventListener('change', (e) => {
          state.heatmapConfig.palette = e.target.value;
          saveState();
          renderHeatmap();
        });
        document.getElementById('heatmapTargetInput').addEventListener('change', (e) => {
          state.heatmapConfig.dailyTargetMinutes = Math.max(25, Number(e.target.value) || 100);
          saveState();
          renderHeatmap();
        });
        ['heatmapThreshold1', 'heatmapThreshold2', 'heatmapThreshold3'].forEach((id, index) => {
          document.getElementById(id).addEventListener('change', e => {
            const values = [...(state.heatmapConfig.thresholds || [35, 70, 100])];
            values[index] = Math.max(1, Math.min(100, Number(e.target.value) || [35, 70, 100][index]));
            values.sort((a, b) => a - b);
            state.heatmapConfig.thresholds = [values[0], Math.max(values[0] + 1, values[1]), Math.max(values[1] + 1, values[2])].map(v => Math.min(100, v));
            saveState();
            renderHeatmap();
          });
        });

        // Milestones & Resources Drawers
        document.getElementById('btnOpenAddMilestone').addEventListener('click', () => {
          document.getElementById('msDeadlineInput').value = state.onboarding.examDate;
          document.getElementById('addMilestoneDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCloseMilestoneDrawer').addEventListener('click', () => {
          document.getElementById('addMilestoneDrawer').classList.add('hidden');
        });
        document.getElementById('btnSaveMilestone').addEventListener('click', () => {
          const title = document.getElementById('msTitleInput').value.trim();
          if (!title) { showToast('Hãy nhập tên cột mốc!', '⚠️'); return; }
          state.milestones.unshift({
            id: createId('milestone'),
            title,
            subjectId: document.getElementById('msSubjSelect').value,
            type: document.getElementById('msTypeSelect').value,
            current: 0,
            target: Math.max(1, Number(document.getElementById('msTargetInput').value) || 15),
            unit: document.getElementById('msUnitInput').value.trim() || 'bài',
            deadline: document.getElementById('msDeadlineInput').value || state.onboarding.examDate
          });
          document.getElementById('msTitleInput').value = '';
          document.getElementById('addMilestoneDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
          showToast('Đã tạo cột mốc mới!', '🏆');
        });

        document.getElementById('btnOpenAddResource').addEventListener('click', () => {
          document.getElementById('addResourceDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCancelResource').addEventListener('click', () => {
          document.getElementById('addResourceDrawer').classList.add('hidden');
        });
        document.getElementById('btnSaveResource').addEventListener('click', () => {
          const name = document.getElementById('resNameInput').value.trim();
          if (!name) return;
          state.resources.unshift({
            id: createId('resource'),
            name,
            type: document.getElementById('resTypeSelect').value,
            subjectId: document.getElementById('resSubjSelect').value,
            completed: 0,
            total: Math.max(1, Number(document.getElementById('resTotalInput').value) || 100),
            accuracy: boundedNumber(document.getElementById('resAccuracyInput').value, 80, 0, 100)
          });
          document.getElementById('resNameInput').value = '';
          document.getElementById('addResourceDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
        });

        // Assessments, Spaced Rep, Weak Areas, Checkpoints, RPE
        document.getElementById('btnAddSpacedCard').addEventListener('click', () => {
          document.getElementById('addSpacedDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCancelSpaced').addEventListener('click', () => {
          document.getElementById('addSpacedDrawer').classList.add('hidden');
        });
        document.getElementById('btnSaveSpaced').addEventListener('click', () => {
          const topic = document.getElementById('srTopicInput').value.trim();
          if (!topic) return;
          state.spacedItems.unshift({
            id: createId('review'),
            topic,
            question: document.getElementById('srQuestionInput').value.trim(),
            subjectId: document.getElementById('srSubjectSelect').value,
            createdDate: TODAY_KEY,
            stageIndex: 0,
            nextReviewDate: addDays(TODAY_KEY, 1)
          });
          document.getElementById('srTopicInput').value = '';
          document.getElementById('srQuestionInput').value = '';
          document.getElementById('addSpacedDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
        });

        document.getElementById('btnOpenAddWeakArea').addEventListener('click', () => {
          document.getElementById('addWeakAreaDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCancelWeakArea').addEventListener('click', () => {
          document.getElementById('addWeakAreaDrawer').classList.add('hidden');
        });
        document.getElementById('btnSaveWeakArea').addEventListener('click', () => {
          const subtopic = document.getElementById('weakSubtopicInput').value.trim();
          if (!subtopic) return;
          state.weakAreas.unshift({
            id: createId('weak'),
            subtopic,
            subjectId: document.getElementById('weakSubjSelect').value,
            accuracy: boundedNumber(document.getElementById('weakAccuracyInput').value, 45, 0, 100),
            action: document.getElementById('weakActionInput').value.trim() || 'Ôn tập lại khái niệm',
            status: 'active'
          });
          document.getElementById('weakSubtopicInput').value = '';
          document.getElementById('addWeakAreaDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
        });

        document.getElementById('btnOpenAddCheckpoint').addEventListener('click', () => {
          document.getElementById('cpDateInput').value = addDays(TODAY_KEY, 7);
          document.getElementById('addCheckpointDrawer').classList.remove('hidden');
        });
        document.getElementById('btnCancelCheckpoint').addEventListener('click', () => {
          document.getElementById('addCheckpointDrawer').classList.add('hidden');
        });
        document.getElementById('btnSaveCheckpoint').addEventListener('click', () => {
          const name = document.getElementById('cpNameInput').value.trim();
          if (!name) return;
          state.checkpoints.push({
            id: createId('checkpoint'),
            name,
            date: document.getElementById('cpDateInput').value || addDays(TODAY_KEY, 7),
            score: document.getElementById('cpScoreInput').value.trim() || 'Target: 85%+',
            done: false
          });
          document.getElementById('cpNameInput').value = '';
          document.getElementById('addCheckpointDrawer').classList.add('hidden');
          saveState();
          refreshAllViews();
        });

        document.getElementById('btnSpinRpe').addEventListener('click', () => {
          const rewards = (state.rpeRewards || []).filter(reward => String(reward.title || '').trim());
          if (rewards.length === 0) {
            showToast('Hãy thêm ít nhất một phần thưởng trong mục tùy chỉnh!', '⚠️');
            return;
          }
          if (state.lootTickets <= 0) {
            showToast('Hoàn thành thêm 1 Pomodoro để nhận lượt mở thưởng!', '🎯');
            return;
          }
          state.lootTickets--;
          const reward = rewards[Math.floor(Math.random() * rewards.length)];
          const result = document.getElementById('rpeResultText');
          result.innerHTML = '';
          const content = document.createElement('div');
          const title = document.createElement('div');
          title.className = 'font-bold text-amber-300';
          title.textContent = reward.title;
          const message = document.createElement('div');
          message.className = 'text-[11px] text-slate-400';
          message.textContent = reward.msg || '';
          content.append(title, message);
          result.appendChild(content);
          playCompletionBell();
          saveState();
          refreshAllViews();
        });

        document.getElementById('btnToggleRewardsEditor').addEventListener('click', () => {
          const editor = document.getElementById('rpeRewardsEditor');
          editor.classList.toggle('hidden');
          renderRpeRewardsEditor();
        });
        document.getElementById('btnAddRpeReward').addEventListener('click', () => {
          state.rpeRewards.push({ id: createId('reward'), title: '', msg: '' });
          renderRpeRewardsEditor();
        });
        document.getElementById('btnSaveRpeRewards').addEventListener('click', () => {
          const rows = Array.from(document.querySelectorAll('[data-reward-title]'));
          const rewards = rows.map(input => {
            const index = Number(input.getAttribute('data-reward-title'));
            return {
              id: (state.rpeRewards[index] && state.rpeRewards[index].id) || createId('reward') + '_' + index,
              title: input.value.trim(),
              msg: (document.querySelector(`[data-reward-msg="${index}"]`) || {}).value?.trim() || ''
            };
          }).filter(reward => reward.title);
          if (rewards.length === 0) {
            showToast('Hãy giữ lại ít nhất một phần thưởng có tên!', '⚠️');
            return;
          }
          state.rpeRewards = rewards;
          saveState();
          refreshAllViews();
          showToast('Đã lưu danh sách phần thưởng của bạn!', '🎁');
        });

        // Onboarding Setup
        document.getElementById('btnAddBlackoutDate').addEventListener('click', () => {
          const val = document.getElementById('onboardBlackoutInput').value;
          if (val && !state.onboarding.blackoutDates.includes(val)) {
            state.onboarding.blackoutDates.push(val);
            saveState();
            refreshAllViews();
          }
        });
        document.getElementById('btnSaveOnboarding').addEventListener('click', () => {
          state.onboarding.examName = document.getElementById('onboardExamName').value.trim();
          state.onboarding.examType = document.getElementById('onboardExamType').value.trim();
        state.onboarding.examDate = document.getElementById('onboardExamDate').value || '';
          state.onboarding.phase = ['foundation', 'intensive', 'sprint'].includes(document.getElementById('onboardPhaseSelect').value)
            ? document.getElementById('onboardPhaseSelect').value : 'foundation';
          saveState();
          refreshAllViews();
          showToast('Đã lưu cấu hình Planning Setup!', '✅');
        });
        document.getElementById('btnAutoGenerateWeekPlan').addEventListener('click', autoGenerateWeeklyPlan);

        document.getElementById('btnMpAddPlan').addEventListener('click', () => {
          const title = document.getElementById('mpPlanTitleInput').value.trim();
          if (!title) { showToast('Hãy nhập tên cho Plan!', '⚠️'); return; }
          const planDate = document.getElementById('mpPlanDateInput').value || TODAY_KEY;
          const planMinutes = Number(document.getElementById('mpPlanMinutesInput').value);
          if (!isValidDateKey(planDate)) { showToast('Ngày Plan không hợp lệ.', '⚠️'); return; }
          if (planDate < TODAY_KEY) { showToast('Plan mới không thể đặt vào ngày đã qua. Hãy dùng Study Sessions để ghi lại phiên đã học.', '⚠️'); return; }
          if (!Number.isFinite(planMinutes) || planMinutes < 5 || planMinutes > 1440) { showToast('Thời lượng Plan phải từ 5 đến 1440 phút.', '⚠️'); return; }
          state.plannedTasks.push({
            id: createId('plan'),
            subjectId: document.getElementById('mpPlanSubjectSelect').value || state.subjects[0]?.id || '',
            topic: title,
            goal: document.getElementById('mpPlanGoalInput').value.trim() || title,
            date: planDate,
            plannedMinutes: Math.round(planMinutes),
            status: 'pending',
            rescheduled: false
          });
          document.getElementById('mpPlanTitleInput').value = '';
          document.getElementById('mpPlanGoalInput').value = '';
          saveState();
          refreshAllViews();
          showToast('Đã thêm Plan vào Master Plan!', '🗓️');
        });
        document.getElementById('btnMpAddTarget').addEventListener('click', () => {
          const title = document.getElementById('mpTargetTitleInput').value.trim();
          const target = Number(document.getElementById('mpTargetValueInput').value);
          if (!title || !Number.isFinite(target) || target <= 0) { showToast('Nhập tên và giá trị Target lớn hơn 0!', '⚠️'); return; }
          const type = document.getElementById('mpTargetTypeSelect').value;
          state.milestones.push({
            id: createId('target'),
            title,
            subjectId: document.getElementById('mpTargetSubjectSelect').value || state.subjects[0]?.id || '',
            type,
            current: 0,
            target,
            unit: document.getElementById('mpTargetUnitInput').value.trim() || (type === 'minutes' ? 'phút' : type === 'sessions' ? 'phiên' : 'bài'),
            deadline: document.getElementById('mpTargetDeadlineInput').value || ''
          });
          document.getElementById('mpTargetTitleInput').value = '';
          document.getElementById('mpTargetDeadlineInput').value = '';
          saveState();
          refreshAllViews();
          showToast('Đã thêm Target vào Master Plan!', '🎯');
        });
        document.getElementById('mpTargetTypeSelect').addEventListener('change', event => {
          document.getElementById('mpTargetUnitInput').value = event.target.value === 'minutes' ? 'phút' : event.target.value === 'sessions' ? 'phiên' : 'bài';
        });

        // Analytics Range
        [
          { id: 'analyticsRangeDay', val: 'day' },
          { id: 'analyticsRangeWeek', val: 'week' },
          { id: 'analyticsRangeMonth', val: 'month' }
        ].forEach(b => {
          document.getElementById(b.id).addEventListener('click', () => {
            currentAnalyticsRange = b.val;
            ['analyticsRangeDay', 'analyticsRangeWeek', 'analyticsRangeMonth'].forEach(oid => {
              document.getElementById(oid).className = oid === b.id
                ? 'px-3 py-1.5 rounded-lg font-semibold bg-[#1cc5dc] text-slate-950 transition'
                : 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition';
            });
            renderAnalytics();
          });
        });
        document.getElementById('analyticsTrendWeeks').addEventListener('change', renderAnalytics);

        // Settings Create Subject
        document.getElementById('btnSaveNewSubject').addEventListener('click', () => {
            const name = document.getElementById('newSubjName').value.trim().slice(0, 100);
          if (!name) { showToast('Hãy nhập tên môn học!', '⚠️'); return; }
          const color = document.getElementById('newSubjColor').value;
          const ns = { id: createId('subject'), name, icon: newSubjectPickedIcon, color };
          state.subjects.push(ns);
          state.selectedSubjectIds.push(ns.id);
          document.getElementById('newSubjName').value = '';
          saveState();
          refreshAllViews();
          showToast(`Đã tạo môn "${ns.icon} ${ns.name}"!`, '📚');
        });

        // Complete Pomodoro Modal
        document.getElementById('btnCloseCompleteModal').addEventListener('click', () => {
          document.getElementById('modalCompletePomodoro').classList.add('hidden');
          document.getElementById('modalCompletePomodoro').classList.remove('flex');
          if (!completionSaved) {
            try { localStorage.removeItem(PENDING_COMPLETION_KEY); } catch (_) {}
            pendingBreakAfterCompletion = null;
            setTimerMode('focus');
            showToast('Phiên chưa được lưu nên chưa cộng XP hoặc vé thưởng.', 'ℹ️');
          }
        });
        document.getElementById('btnSaveCompletedPomodoro').addEventListener('click', saveCompletedPomodoro);

        // Manual Log Modal
        const manModal = document.getElementById('modalManualLog');
        const openManual = () => {
          refreshTodayKey();
          document.getElementById('manualDateInput').value = selectedHeatmapDate || TODAY_KEY;
          document.getElementById('manualFocusInput').value = '';
          const box = document.getElementById('manualSubjectCheckboxes');
          box.innerHTML = '';
          state.subjects.forEach((s, i) => {
            const l = document.createElement('label');
            l.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#090d14] border border-[#192534] cursor-pointer text-xs';
            l.innerHTML = `<input type="checkbox" value="${s.id}" ${i === 0 ? 'checked' : ''} class="manual-subj-chk" /><span>${escapeHtml(s.icon)} ${escapeHtml(s.name)}</span>`;
            box.appendChild(l);
          });
          manModal.classList.remove('hidden');
          manModal.classList.add('flex');
        };
        ['btnOpenManualLogModal', 'btnTodayQuickLog', 'btnSessionsOpenManual'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('click', openManual);
        });
        const closeMan = () => { manModal.classList.add('hidden'); manModal.classList.remove('flex'); };
        document.getElementById('btnCloseManualModal').addEventListener('click', closeMan);
        document.getElementById('btnCancelManualModal').addEventListener('click', closeMan);
        document.getElementById('btnSubmitManualLog').addEventListener('click', () => {
          const dVal = document.getElementById('manualDateInput').value || TODAY_KEY;
          const rawMinutes = Number(document.getElementById('manualMinutesInput').value);
          if (!Number.isFinite(rawMinutes) || rawMinutes < 5 || rawMinutes > 240) {
            showToast('Thời lượng ghi bù phải từ 5 đến 240 phút.', '⚠️');
            return;
          }
          if (dVal > TODAY_KEY) {
            showToast('Ngày ghi bù không thể nằm trong tương lai.', '⚠️');
            return;
          }
          if (!isValidDateKey(dVal)) {
            showToast('Ngày ghi bù không hợp lệ.', '⚠️');
            return;
          }
          const mVal = Math.round(rawMinutes);
          const tVal = document.getElementById('manualTopicInput').value.trim() || 'Ôn tập chuyên đề';
          const focusValue = document.getElementById('manualFocusInput').value;
          const fValRaw = focusValue === '' ? null : Number(focusValue);
          if (fValRaw !== null && (!Number.isInteger(fValRaw) || fValRaw < 1 || fValRaw > 5)) {
            showToast('Điểm tập trung phải từ 1 đến 5.', '⚠️');
            return;
          }
          const fVal = fValRaw;
          const nVal = document.getElementById('manualNoteInput').value.trim();
          const cIds = Array.from(document.querySelectorAll('.manual-subj-chk:checked')).map(x => x.value);
          if (cIds.length === 0) { showToast('Hãy chọn ít nhất một môn học.', '⚠️'); return; }
          const previousState = JSON.parse(JSON.stringify(state));
          state.sessions.push({
            id: createId('session'),
            date: dVal,
            minutes: mVal,
            subjectIds: cIds,
            topic: tVal,
            goal: nVal || tVal,
            note: nVal || 'Ghi bù phiên học',
            outputCount: 1,
            outputUnit: 'bài',
            protocolLabel: 'Manual Log',
            focusScore: fVal,
            blocker: 'Không gián đoạn',
            nextStep: '',
            timestamp: Date.now()
          });
          updateMilestonesProgress(cIds, mVal, 1);
          if (!saveState()) {
            state = previousState;
            showToast('Không lưu được phiên trên thiết bị. Hãy kiểm tra dung lượng rồi thử lại.', '⚠️');
            return;
          }
          closeMan();
          refreshAllViews();
          showToast(`Đã ghi nhận ${mVal}m vào ngày ${dVal}!`, '✅');
        });

        // Breathing Modal
        const brModal = document.getElementById('modalBreathing');
        let brTimer = null;
        document.getElementById('btnOpenBreathingModal').addEventListener('click', () => {
          brModal.classList.remove('hidden');
          brModal.classList.add('flex');
          const steps = ['Hít vào sâu (4s)...', 'Giữ hơi (4s)...', 'Thở ra chậm (4s)...', 'Thả lỏng mắt (4s)...'];
          let idx = 0;
          document.getElementById('breathingGuideText').textContent = steps[0];
          if (brTimer) clearInterval(brTimer);
          brTimer = setInterval(() => {
            idx = (idx + 1) % steps.length;
            document.getElementById('breathingGuideText').textContent = steps[idx];
          }, 4000);
        });
        const closeBr = () => {
          if (brTimer) clearInterval(brTimer);
          brModal.classList.add('hidden');
          brModal.classList.remove('flex');
        };
        document.getElementById('btnCloseBreathingModal').addEventListener('click', closeBr);
        document.getElementById('btnDoneBreathing').addEventListener('click', closeBr);

        // Backup & restore personal data
        const bkModal = document.getElementById('modalBackup');
        document.getElementById('btnBackupModal').addEventListener('click', () => {
          bkModal.classList.remove('hidden');
          bkModal.classList.add('flex');
        });
        document.getElementById('btnCloseBackupModal').addEventListener('click', () => {
          bkModal.classList.add('hidden');
          bkModal.classList.remove('flex');
        });
        document.getElementById('btnExportJson').addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
          const dataUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.setAttribute('href', dataUrl);
          a.setAttribute('download', `tflow_neurofocus_${TODAY_KEY}.json`);
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
          showToast('Đã xuất file JSON thành công!', '💾');
        });
        document.getElementById('inputImportJson').addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) {
            showToast('File sao lưu quá lớn (giới hạn 10 MB).', '⚠️');
            e.target.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const imp = JSON.parse(String(ev.target.result));
              if (imp && typeof imp === 'object' && !Array.isArray(imp) && Array.isArray(imp.subjects) && Array.isArray(imp.sessions)) {
                const previousState = state;
                state = normalizeAppState(imp, DEFAULT_STATE);
                if (!saveState()) {
                  state = previousState;
                  showToast('Không thể lưu dữ liệu khôi phục. Dữ liệu hiện tại vẫn được giữ nguyên.', '⚠️');
                  return;
                }
                try { localStorage.removeItem(PENDING_COMPLETION_KEY); } catch (_) {}
                if (timerInterval) clearInterval(timerInterval);
                timerInterval = null;
                timerEndsAt = null;
                isRunning = false;
                activeLinkedPlanId = null;
                setTimerMode('focus');
                refreshAllViews();
                bkModal.classList.add('hidden');
                bkModal.classList.remove('flex');
                showToast('Đã khôi phục dữ liệu thành công!', '🎉');
              } else showToast('File này không phải bản sao lưu Tflow hợp lệ.', '⚠️');
            } catch (err) {
              showToast('File JSON không hợp lệ!', '⚠️');
            } finally {
              e.target.value = '';
            }
          };
          reader.readAsText(file);
        });
        document.getElementById('btnClearAllData').addEventListener('click', () => {
          if (!window.confirm('Xóa toàn bộ dữ liệu, môn học và cài đặt Tflow trên thiết bị này? Hãy xuất file sao lưu trước nếu cần giữ lại.')) return;
          state = normalizeAppState({}, DEFAULT_STATE);
          try { localStorage.removeItem(TIMER_STORAGE_KEY); } catch (_) {}
          try { localStorage.removeItem(PENDING_COMPLETION_KEY); } catch (_) {}
          if (timerInterval) clearInterval(timerInterval);
          timerInterval = null;
          timerEndsAt = null;
          isRunning = false;
          cycleCount = 1;
          setTimerMode('focus');
          refreshTodayKey();
          selectedHeatmapDate = TODAY_KEY;
          saveState();
          refreshAllViews();
          bkModal.classList.add('hidden');
          bkModal.classList.remove('flex');
          showToast('Đã reset toàn bộ dữ liệu!', '🗑️');
        });

        // Live Clock
        const updateClock = () => {
          const now = new Date();
          const dateChanged = refreshTodayKey();
          document.getElementById('cmdLiveClock').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const dStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          document.getElementById('cmdLiveDate').textContent = dStr;
          document.getElementById('todayViewDateSub').textContent = dStr;
          if (dateChanged) refreshAllViews();
        };
        updateClock();
        setInterval(updateClock, 30000);
      }

      function init() {
        loadState();
        document.getElementById('heatmapLayerSelect').value = state.heatmapConfig.layer || 'minutes';
        document.getElementById('heatmapPaletteSelect').value = state.heatmapConfig.palette || 'cyan';
        document.getElementById('heatmapTargetInput').value = state.heatmapConfig.dailyTargetMinutes || 100;
        renderIconPicker();
        timerMode = 'focus';
        totalSeconds = state.protocol.focus * 60;
        remainingSeconds = totalSeconds;
        updateTimerUI();
        refreshAllViews();
        initEvents();
        restorePendingCompletion();
        restoreTimerState();
        if (stateRecoveryWarning) showToast(stateRecoveryWarning, '⚠️');
      }

      window.addEventListener('DOMContentLoaded', init);
    })();
