/* ==========================================================================
   Infinitum — authentication helpers
   Thin wrapper around Supabase Auth, plus the "profile" row that tells us
   whether the signed-in user is an admin or a specific restaurant's owner.
   ========================================================================== */

const Auth = {
  async signIn(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    await sb.auth.signOut();
  },

  async getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  /** Returns { id, email, role, restaurant_id } for the signed-in user, or null. */
  async getProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).single();
    if (error) return null;
    return data;
  },

  /** Redirects to login.html unless a session + profile exist; returns the profile. */
  async requireProfile() {
    const session = await this.getSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    const profile = await this.getProfile();
    if (!profile) {
      window.location.href = "login.html";
      return null;
    }
    return profile;
  },

  /** Like requireProfile, but also redirects away if the role doesn't match. */
  async requireRole(role) {
    const profile = await this.requireProfile();
    if (!profile) return null;
    if (profile.role !== role) {
      window.location.href = profile.role === "admin" ? "admin-dashboard.html" : `restaurant-dashboard.html?r=${profile.restaurant_id}`;
      return null;
    }
    return profile;
  }
};

window.Auth = Auth;
