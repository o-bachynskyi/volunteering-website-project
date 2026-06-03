function isAdmin(user) {
  if (!user) {
    return false;
  }

  const adminRnokpp = String(process.env.ADMIN_RNOKPP || '').trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (adminRnokpp && String(user.user_rnokpp || '').trim() === adminRnokpp) {
    return true;
  }

  if (adminEmail && String(user.user_email || '').trim().toLowerCase() === adminEmail) {
    return true;
  }

  return false;
}

module.exports = { isAdmin };
