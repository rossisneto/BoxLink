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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch failed:', error);
        if (error.code === 'PGRST116') { // Not found
          await supabase.auth.signOut();
          setUser(null);
        }
        return;
      }
      
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: { message: 'Configuração de autenticação ausente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.' } };
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        const invalidCredentialsMessages = [
          'Invalid login credentials',
          'Email not confirmed',
          'Invalid email or password'
        ];
        const isInvalidCredentials = invalidCredentialsMessages.some(msg => authError.message?.includes(msg));
        if (isInvalidCredentials) {
          return { error: { message: 'Credenciais inválidas' } };
        }
        return { error: { message: authError.message || 'Erro ao autenticar' } };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return { error: { message: 'Falha de rede ao autenticar. Tente novamente.' } };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) return { error: authError };

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          name,
          role: 'athlete',
          status: 'pending',
          xp: 0,
          coins: 0,
          level: 1
        });
        if (profileError) {
          console.error('Error creating profile:', profileError);
          return { error: profileError };
        }
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { error: { message: 'Erro ao realizar cadastro' } };
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
