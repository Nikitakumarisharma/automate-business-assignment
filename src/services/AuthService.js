const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  // Generate JWT token
  static generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Hash password
  static async hashPassword(password) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Compare password
  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  // Register new user
  static async register(userData) {
    const { email, password, firstName, lastName } = userData;

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          isVerified: false
        }
      });

      // Assign default 'user' role
      const userRole = await prisma.role.findUnique({
        where: { name: 'user' }
      });

      if (userRole) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: userRole.id
          }
        });
      }

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: 'user'
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  static async login(email, password) {
    try {
      // Get user with password hash
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Get user roles
      const userRoles = user.userRoles?.map(ur => ur.role.name) || ['user'];

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        roles: userRoles
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          roles: userRoles
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Google OAuth login/register
  static async googleAuth(googleUser) {
    try {
      const { email, name, picture, googleId } = googleUser;

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user) {
        // Create new user
        const nameParts = name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        user = await prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            googleId,
            avatarUrl: picture,
            isVerified: true
          },
          include: {
            userRoles: {
              include: {
                role: true
              }
            }
          }
        });

        // Assign default 'user' role
        const userRole = await prisma.role.findUnique({
          where: { name: 'user' }
        });

        if (userRole) {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: userRole.id
            }
          });
        }
      } else {
        // Update existing user with Google info if needed
        if (!user.googleId) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId,
              avatarUrl: picture,
              isVerified: true
            }
          });
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Get user roles
      const userRoles = user.userRoles?.map(ur => ur.role.name) || ['user'];

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        roles: userRoles
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          isVerified: user.isVerified,
          roles: userRoles
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Log activity
  static async logActivity(userId, userEmail, action, resourceType, resourceId, details, req) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          userEmail,
          action,
          resourceType,
          resourceId,
          details,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

module.exports = AuthService;