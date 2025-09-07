import { DataTypes, Model, Optional, Association, HasManyGetAssociationsMixin } from 'sequelize';
import { getDatabase } from '../config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const sequelize = getDatabase();

/**
 * User attributes interface
 */
export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  loginAttempts: number;
  accountLockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * User creation attributes (optional fields during creation)
 */
export interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 'passwordHash' | 'isActive' | 'isEmailVerified' | 'lastLoginAt' | 
  'passwordResetToken' | 'passwordResetExpires' | 'emailVerificationToken' | 
  'emailVerificationExpires' | 'mfaEnabled' | 'mfaSecret' | 'loginAttempts' | 
  'accountLockedUntil' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {
  password?: string; // Plain text password for creation
}

/**
 * User model class
 */
export class User extends Model<UserAttributes, UserCreationAttributes> 
  implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public passwordHash!: string;
  public firstName!: string;
  public lastName!: string;
  public isActive!: boolean;
  public isEmailVerified!: boolean;
  public lastLoginAt?: Date;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public emailVerificationToken?: string;
  public emailVerificationExpires?: Date;
  public mfaEnabled!: boolean;
  public mfaSecret?: string;
  public loginAttempts!: number;
  public accountLockedUntil?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Association mixins
  public getRoles!: HasManyGetAssociationsMixin<any>;

  // Associations
  public static associations: {
    roles: Association<User, any>;
  };

  /**
   * Get full name
   */
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Check if account is locked
   */
  public get isLocked(): boolean {
    return Boolean(this.accountLockedUntil && this.accountLockedUntil > new Date());
  }

  /**
   * Check if password reset is valid
   */
  public get isPasswordResetValid(): boolean {
    return Boolean(
      this.passwordResetToken && 
      this.passwordResetExpires && 
      this.passwordResetExpires > new Date()
    );
  }

  /**
   * Check if email verification is valid
   */
  public get isEmailVerificationValid(): boolean {
    return Boolean(
      this.emailVerificationToken && 
      this.emailVerificationExpires && 
      this.emailVerificationExpires > new Date()
    );
  }

  /**
   * Hash password
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  public async comparePassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.passwordHash);
  }

  /**
   * Generate password reset token
   */
  public generatePasswordResetToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = token;
    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return token;
  }

  /**
   * Generate email verification token
   */
  public generateEmailVerificationToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = token;
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
  }

  /**
   * Lock account for security
   */
  public lockAccount(): void {
    this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Unlock account
   */
  public unlockAccount(): void {
    this.accountLockedUntil = undefined;
    this.loginAttempts = 0;
  }

  /**
   * Increment login attempts
   */
  public async incrementLoginAttempts(): Promise<void> {
    // If we have a previous lock that has expired, restart at 1
    if (this.accountLockedUntil && this.accountLockedUntil < new Date()) {
      this.loginAttempts = 1;
      this.accountLockedUntil = undefined;
    } else {
      this.loginAttempts += 1;
      
      // If we've reached max attempts, lock the account
      if (this.loginAttempts >= 5) {
        this.lockAccount();
      }
    }
    
    await this.save();
  }

  /**
   * Reset login attempts on successful login
   */
  public async resetLoginAttempts(): Promise<void> {
    if (this.loginAttempts > 0 || this.accountLockedUntil) {
      this.loginAttempts = 0;
      this.accountLockedUntil = undefined;
      await this.save();
    }
  }

  /**
   * Update last login timestamp
   */
  public async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }

  /**
   * Serialize user for JSON (exclude sensitive data)
   */
  public toJSON(): any {
    const values = super.toJSON();
    delete values.passwordHash;
    delete values.passwordResetToken;
    delete values.emailVerificationToken;
    delete values.mfaSecret;
    return values;
  }
}

// Initialize the User model
User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      name: 'unique_username',
      msg: 'Username already exists'
    },
    validate: {
      notEmpty: {
        msg: 'Username cannot be empty'
      },
      len: {
        args: [3, 50],
        msg: 'Username must be between 3 and 50 characters'
      },
      isAlphanumeric: {
        msg: 'Username can only contain letters and numbers'
      }
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: {
      name: 'unique_email',
      msg: 'Email already exists'
    },
    validate: {
      notEmpty: {
        msg: 'Email cannot be empty'
      },
      isEmail: {
        msg: 'Must be a valid email address'
      },
      len: {
        args: [5, 255],
        msg: 'Email must be between 5 and 255 characters'
      }
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Password hash cannot be empty'
      }
    }
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'First name cannot be empty'
      },
      len: {
        args: [1, 100],
        msg: 'First name must be between 1 and 100 characters'
      }
    }
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Last name cannot be empty'
      },
      len: {
        args: [1, 100],
        msg: 'Last name must be between 1 and 100 characters'
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  mfaEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  mfaSecret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Login attempts cannot be negative'
      }
    }
  },
  accountLockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'users',
  modelName: 'User',
  timestamps: true,
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['username']
    },
    {
      fields: ['email']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['isEmailVerified']
    },
    {
      fields: ['lastLoginAt']
    },
    {
      fields: ['accountLockedUntil']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    },
    {
      fields: ['deletedAt']
    }
  ],
  hooks: {
    beforeCreate: async (user: User) => {
      // Hash password if provided during creation
      if ((user as any).password) {
        user.passwordHash = await User.hashPassword((user as any).password);
      }
    },
    beforeUpdate: async (user: User) => {
      // Hash password if it's being updated
      if (user.changed('passwordHash') && !(user.passwordHash.startsWith('$2b$'))) {
        user.passwordHash = await User.hashPassword(user.passwordHash);
      }
    }
  },
  scopes: {
    active: {
      where: {
        isActive: true,
        deletedAt: null
      }
    },
    verified: {
      where: {
        isEmailVerified: true
      }
    },
    withoutPassword: {
      attributes: {
        exclude: ['passwordHash', 'passwordResetToken', 'emailVerificationToken', 'mfaSecret']
      }
    }
  }
});

export default User;