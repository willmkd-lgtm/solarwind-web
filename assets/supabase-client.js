// Supabase 클라이언트 공통 초기화
// 모든 페이지에서 이 파일을 먼저 로드해야 합니다.

const SUPABASE_URL = 'https://nrsrtmcmoykndzphznuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yc3J0bWNtb3lrbmR6cGh6bnV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODM5NDEsImV4cCI6MjA5MjI1OTk0MX0.sz7aALGYbLcFQxFRXx2nXvC3MxONXoYJvXLf9Mpl8UU';

// Supabase 전역 객체 생성
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // 로그인 상태 localStorage 유지
    autoRefreshToken: true,    // 토큰 자동 갱신
    detectSessionInUrl: true   // OAuth 콜백 자동 감지
  }
});

window.supabaseClient = supabaseClient;
