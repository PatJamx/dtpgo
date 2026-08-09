'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthContextType, AuthState, LoginCredentials, RegisterCredentials, UserWithRole, UserRole } from '@/lib/types/auth'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase'

// Create the authentication context
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Custom hook to use the auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// AuthProvider component props
interface AuthProviderProps {
  children: React.ReactNode
}

// AuthProvider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  })

  const supabase = createSupabaseBrowserClient()

  // Initialize auth state on component mount
  useEffect(() => {
    let mounted = true

    // Get initial session - use getUser() for secure authentication, but fall back to getSession
    const getInitialSession = async () => {
      try {
        let user: UserWithRole | null = null
        let session = null
        let sessionError: { message?: string } | null = null
        let userError: { message?: string } | null = null

        if (typeof supabase.auth.getSession === 'function') {
          const sessionResponse = await supabase.auth.getSession()
          session = sessionResponse?.data?.session ?? null
          sessionError = sessionResponse?.error ?? null
          user = (session?.user as UserWithRole | null) ?? null
        }

        if (!user && typeof supabase.auth.getUser === 'function') {
          const userResponse = await supabase.auth.getUser()
          user = (userResponse?.data?.user ?? null) as UserWithRole | null
          userError = userResponse?.error ?? null
        }

        if (mounted) {
          setAuthState({
            user,
            session,
            loading: false,
            error: userError?.message || sessionError?.message || null,
          })
        }
      } catch (error) {
        if (mounted) {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to get user',
          })
        }
      }
    }

    getInitialSession()

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setAuthState((prev) => ({
          ...prev,
          user: session?.user as UserWithRole | null,
          session: session,
          loading: false,
          error: null,
        }))
      }
    })

    // Cleanup function
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Sign in function
  const signIn = async (credentials: LoginCredentials): Promise<{ error: string | null }> => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })
      
      if (error) {
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
        return { error: error.message }
      }
      
      // Success - auth state will be updated by onAuthStateChange listener
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      return { error: errorMessage }
    }
  }

  // Sign up function
  const signUp = async (credentials: RegisterCredentials): Promise<{ error: string | null }> => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.firstName && credentials.lastName 
              ? `${credentials.firstName} ${credentials.lastName}`
              : undefined,
            first_name: credentials.firstName,
            last_name: credentials.lastName,
          }
        }
      })
      
      if (error) {
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
        return { error: error.message }
      }
      
      // Success - check if email confirmation is required
      setAuthState((prev) => ({ ...prev, loading: false }))
      return { error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      return { error: errorMessage }
    }
  }

  // Sign out function
  const signOut = async (): Promise<void> => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
      }
      // The auth state will be updated by the onAuthStateChange listener
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
    }
  }

  // Reset password function
  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || null,
      }))
      
      return { error: error?.message || null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      return { error: errorMessage }
    }
  }

  // Update password function
  const updatePassword = async (currentPassword: string, newPassword: string): Promise<{ error: string | null }> => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    
    try {
      // First, verify the current password by attempting to sign in
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        return { error: 'User not authenticated' }
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || null,
      }))
      
      return { error: error?.message || null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      return { error: errorMessage }
    }
  }

  // Role helper functions
  const hasRole = (role: UserRole): boolean => {
    return authState.user?.user_metadata?.role === role
  }

  const isAdmin = (): boolean => {
    return hasRole('admin')
  }

  const isOrganizer = (): boolean => {
    return hasRole('organizer')
  }

  // Refresh session function
  const refreshSession = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Failed to refresh session:', error)
      }
    } catch (error) {
      console.error('Error refreshing session:', error)
    }
  }

  // Context value
  const value: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    hasRole,
    isAdmin,
    isOrganizer,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
