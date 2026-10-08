export const PERSON_COOKIE = 'tribuo_person'
export const PERSON_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

// The Idea Bank remembers people separately: just a name and a department.
export const IDEA_COOKIE = 'tribuo_idea_person'
