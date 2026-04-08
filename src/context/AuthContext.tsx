import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoading(true);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile/${userId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Profile fetch failed:', response.status, errorData);
        
        if (response.status === 404) {
          console.warn('Profile not found for user:', userId);
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
        
        // If it's not a 404, we might want to retry or just show an error
        throw new Error(errorData.message || 'Erro ao carregar perfil');
      }
      
      const data = await response.json().catch(err => {
        console.error('JSON parse error:', err);
        throw new Error('Resposta do servidor inválida');
      });
      
      const mappedUser: User = {
        ...data,
        avatar: {
          equipped: data.avatar_equipped,
          inventory: data.avatar_inventory
        },
        checkins: data.checkins || [],
        paidBonuses: data.paid_bonuses || []
      };
      
      setUser(mappedUser);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.message || 'Erro ao entrar' } };
      }
      
      // Also sign in the supabase client to get the session for other things
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { error: authError };
      
      const mappedUser: User = {
        ...data,
        avatar: {
          equipped: data.avatar_equipped,
          inventory: data.avatar_inventory
        },
        checkins: data.checkins || [],
        paidBonuses: data.paid_bonuses || []
      };
      
      setUser(mappedUser);
      return { error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.message || 'Erro ao cadastrar' } };
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { error: { message: 'Erro ao conectar com o servidor' } };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
