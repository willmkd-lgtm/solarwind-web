// 공통 인증 유틸리티
// 모든 페이지의 헤더에서 로그인 상태를 표시할 때 사용

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    alert('로그아웃 실패: ' + error.message);
    return;
  }
  window.location.href = '/index.html';
}

// 헤더 우측에 로그인 상태 표시 (모든 페이지에서 호출)
async function renderAuthHeader(containerId = 'auth-header') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const profile = await getCurrentProfile();
  
  if (profile) {
    container.innerHTML = `
      <span style="color:#555; margin-right:12px;">
        ${profile.nickname}님
        ${profile.role === 'admin' ? '<span style="font-size:10px; background:#1a1a1a; color:#fff; padding:2px 6px; border-radius:3px; margin-left:4px;">ADMIN</span>' : ''}
      </span>
      <a href="/mypage.html" style="color:#1a1a1a; margin-right:12px; text-decoration:none;">마이페이지</a>
      <button onclick="logout()" style="background:none; border:1px solid #ddd; padding:6px 12px; cursor:pointer; font-size:13px;">로그아웃</button>
    `;
  } else {
    container.innerHTML = `
      <a href="/login.html" style="color:#1a1a1a; text-decoration:none; margin-right:12px;">로그인</a>
      <a href="/signup.html" style="background:#1a1a1a; color:#fff; padding:6px 14px; text-decoration:none; font-size:13px;">회원가입</a>
    `;
  }
}

// 로그인 필수 페이지에서 호출 — 미로그인 시 로그인 페이지로
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    alert('로그인이 필요한 페이지입니다.');
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return user;
}
