import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      clinicId: string;
      role: string;
      roleId: string;
      isActive: boolean;
      sessionVersion: number;
      name: string;
      email: string;
    };
    expires: string;
  }

  interface User {
    id: string;
    clinicId?: string;
    role?: string;
    roleId?: string;
    isActive?: boolean;
    sessionVersion?: number;
    name?: string;
    email?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    clinicId?: string;
    role?: string;
    roleId?: string;
    isActive?: boolean;
    sessionVersion?: number;
  }
}
