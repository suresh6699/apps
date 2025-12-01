class User {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.username = data.username;
    this.password = data.password; // Will be hashed
    this.name = data.name || '';
    this.email = data.email || '';
    this.role = data.role || 'user';
    this.googleId = data.googleId || null;
    this.picture = data.picture || null;
    this.googleAccessToken = data.googleAccessToken || null;
    this.googleRefreshToken = data.googleRefreshToken || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      name: this.name,
      email: this.email,
      role: this.role,
      googleId: this.googleId,
      picture: this.picture,
      googleAccessToken: this.googleAccessToken,
      googleRefreshToken: this.googleRefreshToken,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;
