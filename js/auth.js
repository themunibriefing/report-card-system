// ============================================================
// Auth: login, logout, session persistence, role detection,
// and protected-page guarding.
// Requires supabase-config.js to be loaded first.
// ============================================================

/**
 * Signs a user in with email + password.
 * Returns { profile, error }.
 */
async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { profile: null, error: friendlyAuthError(error) };
  }

  const profile = await fetchOwnProfile();
  if (!profile) {
    await supabaseClient.auth.signOut();
    return {
      profile: null,
      error: "Your account isn't set up yet. Ask your administrator to add you.",
    };
  }

  if (!profile.is_active) {
    await supabaseClient.auth.signOut();
    return {
      profile: null,
      error: "This account has been deactivated. Contact your administrator.",
    };
  }

  return { profile, error: null };
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "/login.html";
}

/** Reads the current session's own profile row (id, school_id, role, ...). */
async function fetchOwnProfile() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, school_id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }

  return data;
}

/**
 * Call at the top of any protected page.
 * Redirects to login if there's no session, or to the correct
 * dashboard if the signed-in role doesn't match requiredRole.
 * Resolves with the profile on success.
 */
async function requireRole(requiredRole) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "/login.html";
    return null;
  }

  const profile = await fetchOwnProfile();

  if (!profile || !profile.is_active) {
    await supabaseClient.auth.signOut();
    window.location.href = "/login.html";
    return null;
  }

  if (profile.role !== requiredRole) {
    window.location.href =
      profile.role === "admin" ? "/admin/dashboard.html" : "/teacher/dashboard.html";
    return null;
  }

  return profile;
}

function friendlyAuthError(error) {
  if (error.message && error.message.includes("Invalid login credentials")) {
    return "Incorrect email or password.";
  }
  return "Something went wrong signing in. Please try again.";
}
