import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      roles: string[]
      memberId: string | null
      status: string
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    roles: string[]
    memberId: string | null
    status: string
    /** The central (bkesari.com) user id, for a session bridged from central login. */
    ssoSub?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    roles: string[]
    memberId: string | null
    status: string
    /** The central (bkesari.com) user id, for a session bridged from central login. */
    ssoSub?: string | null
  }
}
